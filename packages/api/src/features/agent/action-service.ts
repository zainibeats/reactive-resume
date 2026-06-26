import { ORPCError } from "@orpc/client";
import { and, desc, eq, gte } from "drizzle-orm";
import { db } from "@reactive-resume/db/client";
import * as schema from "@reactive-resume/db/schema";
import { assertAgentEnvironment } from "../ai/credentials";
import { resumeService } from "../resume/service";
import { toAction } from "./serializers";

const ROLLBACK_CONFLICT_MESSAGE = "The resume changed after this action was applied.";
const ROLLED_BACK_MESSAGE = "This patch was rolled back when the resume was restored to an earlier state.";

function cloneResumeData<T>(data: T): T {
	return structuredClone(data);
}

export function createAgentActionsService() {
	return {
		revert: async (input: { id: string; userId: string }) => {
			assertAgentEnvironment();

			const [action] = await db
				.select()
				.from(schema.agentAction)
				.where(and(eq(schema.agentAction.id, input.id), eq(schema.agentAction.userId, input.userId)))
				.limit(1);

			if (!action) throw new ORPCError("NOT_FOUND");
			if (action.status !== "applied") return toAction(action);
			if (action.kind !== "resume_patch") {
				throw new ORPCError("BAD_REQUEST", { message: "Only resume patch actions can be rolled back." });
			}
			const resumeId = action.resumeId;
			const snapshotData = action.snapshotData;
			if (!resumeId) throw new ORPCError("BAD_REQUEST", { message: "The edited resume no longer exists." });
			if (!snapshotData) {
				throw new ORPCError("BAD_REQUEST", { message: "This legacy patch does not have a rollback snapshot." });
			}

			const [latestAction] = await db
				.select()
				.from(schema.agentAction)
				.where(
					and(
						eq(schema.agentAction.userId, input.userId),
						eq(schema.agentAction.threadId, action.threadId),
						eq(schema.agentAction.resumeId, resumeId),
						eq(schema.agentAction.kind, "resume_patch"),
						eq(schema.agentAction.status, "applied"),
					),
				)
				.orderBy(desc(schema.agentAction.appliedUpdatedAt))
				.limit(1);

			if (!latestAction) {
				throw new ORPCError("BAD_REQUEST", { message: "This patch is no longer applied." });
			}

			try {
				const { updated, restored } = await db.transaction(async (tx) => {
					const restored = await resumeService.patchInTransaction(tx, {
						id: resumeId,
						userId: input.userId,
						operations: [{ op: "replace", path: "", value: cloneResumeData(snapshotData) }],
						expectedUpdatedAt: latestAction.appliedUpdatedAt,
					});

					const rolledBackAt = new Date();
					const updatedActions = await tx
						.update(schema.agentAction)
						.set({
							status: "rolled_back",
							revertedAt: rolledBackAt,
							revertMessage: ROLLED_BACK_MESSAGE,
							appliedUpdatedAt: restored.updatedAt,
						})
						.where(
							and(
								eq(schema.agentAction.userId, input.userId),
								eq(schema.agentAction.threadId, action.threadId),
								eq(schema.agentAction.resumeId, resumeId),
								eq(schema.agentAction.kind, "resume_patch"),
								eq(schema.agentAction.status, "applied"),
								gte(schema.agentAction.appliedUpdatedAt, action.appliedUpdatedAt),
							),
						)
						.returning();

					const updated = updatedActions.find((row) => row.id === action.id);
					if (!updated) throw new ORPCError("NOT_FOUND");
					return { updated, restored };
				});

				await resumeService.notifyResumePatched({
					resumeId: restored.id,
					userId: input.userId,
					updatedAt: restored.updatedAt,
				});

				return toAction(updated);
			} catch (error) {
				if (error instanceof ORPCError && error.code === "RESUME_VERSION_CONFLICT") {
					const [updated] = await db
						.update(schema.agentAction)
						.set({ status: "conflicted", revertMessage: ROLLBACK_CONFLICT_MESSAGE })
						.where(and(eq(schema.agentAction.id, input.id), eq(schema.agentAction.userId, input.userId)))
						.returning();

					if (!updated) throw new ORPCError("NOT_FOUND");

					return toAction(updated);
				}

				throw error;
			}
		},
	};
}
