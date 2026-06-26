import { ORPCError } from "@orpc/client";
import { and, count, eq, sql } from "drizzle-orm";
import { db } from "@reactive-resume/db/client";
import * as schema from "@reactive-resume/db/schema";
import { generateId } from "@reactive-resume/utils/string";
import { assertAgentEnvironment } from "../ai/credentials";
import { getStorageService, inferContentType } from "../storage/service";
import { toAttachment } from "./serializers";

const MAX_ATTACHMENTS_PER_MESSAGE = 10;
const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;
const MAX_THREAD_ATTACHMENT_BYTES = 100 * 1024 * 1024;

export type CreateAttachmentInput = {
	userId: string;
	threadId: string;
	filename: string;
	mediaType: string;
	data: Uint8Array;
};

type ThreadAccessCheck = (input: { id: string; userId: string }) => Promise<unknown>;

type CreateAgentAttachmentsServiceInput = {
	getThread: ThreadAccessCheck;
};

export function createAgentAttachmentsService({ getThread }: CreateAgentAttachmentsServiceInput) {
	return {
		create: async (input: CreateAttachmentInput) => {
			assertAgentEnvironment();
			await getThread({ id: input.threadId, userId: input.userId });

			const [[aggregate], [attachmentCount]] = await Promise.all([
				db
					.select({ totalBytes: sql<number>`coalesce(sum(${schema.agentAttachment.size}), 0)` })
					.from(schema.agentAttachment)
					.where(
						and(eq(schema.agentAttachment.threadId, input.threadId), eq(schema.agentAttachment.userId, input.userId)),
					),
				db
					.select({ total: count() })
					.from(schema.agentAttachment)
					.where(
						and(eq(schema.agentAttachment.threadId, input.threadId), eq(schema.agentAttachment.userId, input.userId)),
					),
			]);

			if ((attachmentCount?.total ?? 0) >= MAX_ATTACHMENTS_PER_MESSAGE) throw new ORPCError("BAD_REQUEST");
			if (input.data.byteLength > MAX_ATTACHMENT_BYTES) throw new ORPCError("BAD_REQUEST");
			if ((aggregate?.totalBytes ?? 0) + input.data.byteLength > MAX_THREAD_ATTACHMENT_BYTES) {
				throw new ORPCError("BAD_REQUEST");
			}

			const mediaType = input.mediaType || inferContentType(input.filename);
			const id = generateId();
			const key = `uploads/${input.userId}/agent/${input.threadId}/${id}-${input.filename}`;

			await getStorageService().write({ key, data: input.data, contentType: mediaType, private: true });
			const [attachment] = await db
				.insert(schema.agentAttachment)
				.values({
					id,
					userId: input.userId,
					threadId: input.threadId,
					storageKey: key,
					filename: input.filename,
					mediaType,
					size: input.data.byteLength,
				})
				.returning();

			if (!attachment) throw new Error("AGENT_ATTACHMENT_CREATE_FAILED");

			return toAttachment(attachment);
		},

		delete: async (input: { id: string; userId: string }) => {
			assertAgentEnvironment();

			const [attachment] = await db
				.select()
				.from(schema.agentAttachment)
				.where(and(eq(schema.agentAttachment.id, input.id), eq(schema.agentAttachment.userId, input.userId)))
				.limit(1);

			if (!attachment) return;

			await getStorageService().delete(attachment.storageKey);
			await db
				.delete(schema.agentAttachment)
				.where(and(eq(schema.agentAttachment.id, input.id), eq(schema.agentAttachment.userId, input.userId)));
		},
	};
}
