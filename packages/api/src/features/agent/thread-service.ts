import { ORPCError } from "@orpc/client";
import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { db } from "@reactive-resume/db/client";
import * as schema from "@reactive-resume/db/schema";
import { assertAgentEnvironment } from "../ai/credentials";
import { aiProvidersService } from "../ai-providers/service";
import { resumeService } from "../resume/service";
import { getStorageService } from "../storage/service";
import { clearActiveAgentRunIfCurrent } from "./runs";
import { toAction, toAttachment, toMessage, toThreadSummary } from "./serializers";

type AgentMessageRecord = typeof schema.agentMessage.$inferSelect;

export type CreateThreadInput = {
	userId: string;
	aiProviderId?: string;
	targetResumeId: string;
};

type ListThreadMessages = (input: { threadId: string; userId: string }) => Promise<AgentMessageRecord[]>;

type CreateAgentThreadsServiceInput = {
	activeRunControllers: Map<string, AbortController>;
	listThreadMessages: ListThreadMessages;
};

async function createWorkingResume(input: CreateThreadInput) {
	const resume = await resumeService.getById({ id: input.targetResumeId, userId: input.userId });
	return { id: resume.id, title: resume.name };
}

export async function getAgentThread(input: { id: string; userId: string }) {
	const [thread] = await db
		.select()
		.from(schema.agentThread)
		.where(
			and(
				eq(schema.agentThread.id, input.id),
				eq(schema.agentThread.userId, input.userId),
				isNull(schema.agentThread.deletedAt),
			),
		)
		.limit(1);

	if (!thread) throw new ORPCError("NOT_FOUND");

	return thread;
}

export function createAgentThreadsService({
	activeRunControllers,
	listThreadMessages,
}: CreateAgentThreadsServiceInput) {
	return {
		list: async (input: { userId: string }) => {
			assertAgentEnvironment();

			const rows = await db
				.select({
					id: schema.agentThread.id,
					userId: schema.agentThread.userId,
					aiProviderId: schema.agentThread.aiProviderId,
					sourceResumeId: schema.agentThread.sourceResumeId,
					workingResumeId: schema.agentThread.workingResumeId,
					title: schema.agentThread.title,
					status: schema.agentThread.status,
					activeRunId: schema.agentThread.activeRunId,
					activeStreamId: schema.agentThread.activeStreamId,
					activeRunStartedAt: schema.agentThread.activeRunStartedAt,
					lastMessageAt: schema.agentThread.lastMessageAt,
					archivedAt: schema.agentThread.archivedAt,
					deletedAt: schema.agentThread.deletedAt,
					createdAt: schema.agentThread.createdAt,
					updatedAt: schema.agentThread.updatedAt,
					resumeName: schema.resume.name,
					providerLabel: schema.aiProvider.label,
				})
				.from(schema.agentThread)
				.leftJoin(schema.resume, eq(schema.agentThread.workingResumeId, schema.resume.id))
				.leftJoin(schema.aiProvider, eq(schema.agentThread.aiProviderId, schema.aiProvider.id))
				.where(and(eq(schema.agentThread.userId, input.userId), isNull(schema.agentThread.deletedAt)))
				.orderBy(desc(schema.agentThread.lastMessageAt));

			return rows.map(toThreadSummary);
		},

		create: async (input: CreateThreadInput) => {
			assertAgentEnvironment();

			const selectedProvider = input.aiProviderId
				? await aiProvidersService.getRunnableById({ id: input.aiProviderId, userId: input.userId })
				: await aiProvidersService.getDefaultRunnable({ userId: input.userId });

			if (!selectedProvider) throw new ORPCError("BAD_REQUEST", { message: "No tested AI provider is available." });

			const working = await createWorkingResume(input);
			const [thread] = await db
				.insert(schema.agentThread)
				.values({
					userId: input.userId,
					aiProviderId: selectedProvider.id,
					sourceResumeId: null,
					workingResumeId: working.id,
					title: "New thread",
				})
				.returning();

			if (!thread) throw new Error("AGENT_THREAD_CREATE_FAILED");

			return toThreadSummary({
				...thread,
				resumeName: working.title,
				providerLabel: selectedProvider.label,
			});
		},

		get: async (input: { id: string; userId: string }) => {
			assertAgentEnvironment();

			const thread = await getAgentThread(input);
			const [messages, actions, attachments, resume] = await Promise.all([
				listThreadMessages({ threadId: input.id, userId: input.userId }),
				db
					.select()
					.from(schema.agentAction)
					.where(and(eq(schema.agentAction.threadId, input.id), eq(schema.agentAction.userId, input.userId)))
					.orderBy(desc(schema.agentAction.createdAt)),
				db
					.select()
					.from(schema.agentAttachment)
					.where(and(eq(schema.agentAttachment.threadId, input.id), eq(schema.agentAttachment.userId, input.userId)))
					.orderBy(asc(schema.agentAttachment.createdAt)),
				thread.workingResumeId
					? resumeService.getById({ id: thread.workingResumeId, userId: input.userId }).catch(() => null)
					: null,
			]);
			let hasRunnableProvider = false;
			if (thread.aiProviderId) {
				try {
					hasRunnableProvider = !!(await aiProvidersService.getRunnableById({
						id: thread.aiProviderId,
						userId: input.userId,
					}));
				} catch (error) {
					if (!(error instanceof ORPCError)) throw error;
				}
			} else {
				hasRunnableProvider = !!(await aiProvidersService.getDefaultRunnable({ userId: input.userId }));
			}

			return {
				thread: toThreadSummary(thread),
				messages: messages.map(toMessage),
				actions: actions.map(toAction),
				attachments: attachments.map(toAttachment),
				resume,
				isReadOnly: thread.status === "archived" || !thread.workingResumeId || !hasRunnableProvider || !resume,
			};
		},

		archive: async (input: { id: string; userId: string }) => {
			assertAgentEnvironment();

			const thread = await getAgentThread({ id: input.id, userId: input.userId });
			const activeRunId = thread.activeRunId;
			const activeStreamId = thread.activeStreamId;

			if (activeRunId) {
				activeRunControllers.get(activeRunId)?.abort("USER_ARCHIVED");
				activeRunControllers.delete(activeRunId);
				try {
					await clearActiveAgentRunIfCurrent({
						threadId: input.id,
						userId: input.userId,
						runId: activeRunId,
						streamId: activeStreamId,
					});
				} catch (error) {
					console.error("[agent] Failed to clear active run during archive", error);
				}
			}

			await db
				.update(schema.agentThread)
				.set({ status: "archived", archivedAt: new Date() })
				.where(and(eq(schema.agentThread.id, input.id), eq(schema.agentThread.userId, input.userId)));
		},

		delete: async (input: { id: string; userId: string }) => {
			assertAgentEnvironment();

			await getAgentThread({ id: input.id, userId: input.userId });

			await Promise.all([
				db.delete(schema.agentAttachment).where(eq(schema.agentAttachment.threadId, input.id)),
				db
					.update(schema.agentThread)
					.set({ status: "deleted", deletedAt: new Date() })
					.where(and(eq(schema.agentThread.id, input.id), eq(schema.agentThread.userId, input.userId))),
			]);

			try {
				await getStorageService().delete(`uploads/${input.userId}/agent/${input.id}`);
			} catch (error) {
				console.error("[agent] Failed to delete thread storage after soft-delete", {
					threadId: input.id,
					userId: input.userId,
					error,
				});
			}
		},
	};
}
