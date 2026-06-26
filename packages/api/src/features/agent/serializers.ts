import type * as schema from "@reactive-resume/db/schema";
import type { UIMessage } from "ai";

type AgentThreadRecord = typeof schema.agentThread.$inferSelect;
type AgentMessageRecord = typeof schema.agentMessage.$inferSelect;
type AgentActionRecord = typeof schema.agentAction.$inferSelect;
type AgentAttachmentRecord = typeof schema.agentAttachment.$inferSelect;

export function toThreadSummary(
	row: AgentThreadRecord & { resumeName?: string | null; providerLabel?: string | null },
) {
	return {
		id: row.id,
		title: row.title,
		status: row.status,
		sourceResumeId: row.sourceResumeId,
		workingResumeId: row.workingResumeId,
		aiProviderId: row.aiProviderId,
		resumeName: row.resumeName ?? null,
		providerLabel: row.providerLabel ?? null,
		activeRunId: row.activeRunId,
		lastMessageAt: row.lastMessageAt,
		archivedAt: row.archivedAt,
		deletedAt: row.deletedAt,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
	};
}

export function toMessage(row: AgentMessageRecord): UIMessage {
	return row.uiMessage as unknown as UIMessage;
}

export function toAction(row: AgentActionRecord) {
	return {
		id: row.id,
		threadId: row.threadId,
		messageId: row.messageId,
		resumeId: row.resumeId,
		kind: row.kind,
		status: row.status,
		title: row.title,
		summary: row.summary,
		operations: row.operations,
		canRollback: row.status === "applied" && row.snapshotData !== null,
		baseUpdatedAt: row.baseUpdatedAt,
		appliedUpdatedAt: row.appliedUpdatedAt,
		revertedAt: row.revertedAt,
		revertMessage: row.revertMessage,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
	};
}

export function toAttachment(row: AgentAttachmentRecord) {
	return {
		id: row.id,
		threadId: row.threadId,
		messageId: row.messageId,
		filename: row.filename,
		mediaType: row.mediaType,
		size: row.size,
		createdAt: row.createdAt,
	};
}
