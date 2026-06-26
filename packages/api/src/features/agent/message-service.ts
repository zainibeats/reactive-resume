import type { JsonPatchOperation } from "@reactive-resume/resume/patch";
import type { FilePart, ImagePart, ModelMessage, TextPart, UIMessage, UIMessageChunk } from "ai";
import type { getModel } from "../ai/service";
import { ORPCError } from "@orpc/client";
import { streamToEventIterator } from "@orpc/server";
import { convertToModelMessages, generateText, stepCountIs, ToolLoopAgent } from "ai";
import { and, asc, count, eq, inArray, isNull, max } from "drizzle-orm";
import { z } from "zod";
import { db } from "@reactive-resume/db/client";
import * as schema from "@reactive-resume/db/schema";
import { jsonPatchOperationSchema } from "@reactive-resume/resume/patch";
import { generateId } from "@reactive-resume/utils/string";
import { assertAgentEnvironment } from "../ai/credentials";
import { getAgentModel, getAiRequestTimeout } from "../ai/service";
import { aiProvidersService } from "../ai-providers/service";
import { resumeService } from "../resume/service";
import { getStorageService } from "../storage/service";
import { claimActiveAgentRun, clearActiveAgentRunIfCurrent } from "./runs";
import { toMessage } from "./serializers";
import { agentStreamLifecycle } from "./streams";
import { getAgentThread } from "./thread-service";
import { buildAgentInstructions, buildAgentTools } from "./tools";

const MAX_AGENT_STEPS = 10;
const MAX_ATTACHMENTS_PER_MESSAGE = 10;
const READABLE_ATTACHMENT_TYPES = new Set(["text/plain", "text/markdown", "application/json"]);
const DIRECT_MODEL_FILE_ATTACHMENT_TYPES = new Set([
	"application/pdf",
	"audio/mpeg",
	"audio/mp3",
	"audio/wav",
	"audio/wave",
	"audio/x-wav",
]);
const AGENT_ATTACHMENT_URL_PREFIX = "agent-attachment:";
const MAX_ATTACHMENT_TEXT_CHARS = 40_000;
const ollamaPatchResponseSchema = z.object({
	title: z.string().trim().min(1),
	summary: z.string().trim().optional(),
	response: z.string().trim().min(1),
	operations: z.array(jsonPatchOperationSchema).default([]),
});

export const activeRunControllers = new Map<string, AbortController>();
const canceledRunsWithPersistedPartial = new Set<string>();

type AgentMessageRecord = typeof schema.agentMessage.$inferSelect;
type AgentAttachmentRecord = typeof schema.agentAttachment.$inferSelect;

type SendMessageInput = {
	userId: string;
	threadId: string;
	message: UIMessage;
	attachmentIds?: unknown;
};

type AttachmentModelInput = {
	attachment: AgentAttachmentRecord;
	data: Uint8Array;
};

function cloneResumeData<T>(data: T): T {
	return structuredClone(data);
}

function attachmentUiPart(attachment: AgentAttachmentRecord): UIMessage["parts"][number] {
	return {
		type: "file",
		url: `${AGENT_ATTACHMENT_URL_PREFIX}${attachment.id}`,
		mediaType: attachment.mediaType,
		filename: attachment.filename,
	};
}

function withAttachmentUiParts(message: UIMessage, attachments: AgentAttachmentRecord[]): UIMessage {
	return {
		...message,
		parts: [...withoutAgentAttachmentUiParts(message).parts, ...attachments.map(attachmentUiPart)],
	};
}

function withoutAgentAttachmentUiParts(message: UIMessage): UIMessage {
	return {
		...message,
		parts: message.parts.filter((part) => !(part.type === "file" && part.url.startsWith(AGENT_ATTACHMENT_URL_PREFIX))),
	};
}

// Provider output metadata can contain provider-owned item IDs. Keep it in UI history, but do not replay it as model input.
function withoutProviderMetadata(message: UIMessage): UIMessage {
	const cleanMessage = {
		...message,
		parts: message.parts.map((part) => {
			const cleanPart = { ...part } as Record<string, unknown>;
			delete cleanPart.providerMetadata;
			delete cleanPart.callProviderMetadata;
			delete cleanPart.resultProviderMetadata;
			return cleanPart as UIMessage["parts"][number];
		}),
	} as Record<string, unknown> & UIMessage;

	delete cleanMessage.providerMetadata;
	delete cleanMessage.callProviderMetadata;
	delete cleanMessage.resultProviderMetadata;

	return cleanMessage;
}

function toModelInputMessage(message: UIMessage): UIMessage {
	return withoutProviderMetadata(withoutAgentAttachmentUiParts(message));
}

type AgentToolPart = UIMessage["parts"][number] & {
	errorText?: string;
	output?: unknown;
	state?: string;
	toolCallId?: string;
};

type AnsweredAskUserQuestionPart = AgentToolPart & {
	toolCallId: string;
};

function isAnsweredAskUserQuestionPart(part: UIMessage["parts"][number]): part is AnsweredAskUserQuestionPart {
	const toolPart = part as AgentToolPart;
	return (
		toolPart.type === "tool-ask_user_question" &&
		typeof toolPart.toolCallId === "string" &&
		(toolPart.state === "output-available" || toolPart.state === "output-error")
	);
}

function mergeAskUserQuestionOutputs(existingMessage: UIMessage, incomingMessage: UIMessage): UIMessage {
	const answeredParts = new Map<string, AgentToolPart>();

	for (const part of incomingMessage.parts) {
		if (isAnsweredAskUserQuestionPart(part)) answeredParts.set(part.toolCallId, part);
	}

	let didMerge = false;
	const parts = existingMessage.parts.map((part) => {
		const existingPart = part as AgentToolPart;
		if (
			existingPart.type !== "tool-ask_user_question" ||
			typeof existingPart.toolCallId !== "string" ||
			existingPart.state !== "input-available"
		) {
			return part;
		}

		const answeredPart = answeredParts.get(existingPart.toolCallId);
		if (!answeredPart) return part;

		didMerge = true;
		if (answeredPart.state === "output-error") {
			return {
				...part,
				state: "output-error",
				errorText: answeredPart.errorText ?? "User answer failed.",
			} as UIMessage["parts"][number];
		}

		return {
			...part,
			state: "output-available",
			output: answeredPart.output,
		} as UIMessage["parts"][number];
	});

	if (!didMerge) {
		throw new ORPCError("BAD_REQUEST", { message: "No matching unanswered user question was found." });
	}

	return { ...existingMessage, parts };
}

function getFirstUnansweredAskUserQuestionToolCallId(message: UIMessage) {
	const part = message.parts.find((part) => {
		const toolPart = part as AgentToolPart;
		return (
			toolPart.type === "tool-ask_user_question" &&
			typeof toolPart.toolCallId === "string" &&
			toolPart.state === "input-available"
		);
	}) as AgentToolPart | undefined;

	return part?.toolCallId;
}

function answerAskUserQuestionToolCall(message: UIMessage, toolCallId: string, answer: string) {
	return mergeAskUserQuestionOutputs(message, {
		...message,
		parts: [
			{
				type: "tool-ask_user_question",
				toolCallId,
				state: "output-available",
				input: undefined,
				output: answer,
			} as UIMessage["parts"][number],
		],
	});
}

function attachmentLabel(attachment: AgentAttachmentRecord) {
	return `${attachment.filename} (${attachment.mediaType}, ${attachment.size} bytes, attachmentId: ${attachment.id})`;
}

export function buildAttachmentModelParts(input: AttachmentModelInput[]): Array<TextPart | ImagePart | FilePart> {
	return input.map(({ attachment, data }) => {
		if (READABLE_ATTACHMENT_TYPES.has(attachment.mediaType)) {
			const text = new TextDecoder().decode(data).slice(0, MAX_ATTACHMENT_TEXT_CHARS);
			return {
				type: "text",
				text: `Attachment ${attachmentLabel(attachment)}:\n\n${text}`,
			};
		}

		if (attachment.mediaType.startsWith("image/")) {
			return {
				type: "image",
				image: data,
				mediaType: attachment.mediaType,
			};
		}

		if (DIRECT_MODEL_FILE_ATTACHMENT_TYPES.has(attachment.mediaType)) {
			return {
				type: "file",
				data,
				filename: attachment.filename,
				mediaType: attachment.mediaType,
			};
		}

		return {
			type: "text",
			text: `Attachment ${attachmentLabel(attachment)} is not included directly because this media type is not supported for model file input. Use the read_attachment tool if text extraction is available.`,
		};
	});
}

function appendUserModelParts(message: ModelMessage, parts: Array<TextPart | ImagePart | FilePart>): ModelMessage {
	if (parts.length === 0 || message.role !== "user") return message;

	const content =
		typeof message.content === "string" ? [{ type: "text" as const, text: message.content }] : message.content;
	return {
		...message,
		content: [...content, ...parts],
	};
}

function uniqueAttachmentIds(ids: unknown) {
	if (ids === undefined) return [];
	if (!Array.isArray(ids)) {
		throw new ORPCError("BAD_REQUEST", { message: "Attachment IDs must be an array." });
	}

	if (ids.length > MAX_ATTACHMENTS_PER_MESSAGE) {
		throw new ORPCError("BAD_REQUEST", { message: "Too many attachments for one message." });
	}

	const unique = new Set<string>();
	for (const id of ids) {
		if (typeof id !== "string" || !id.trim()) {
			throw new ORPCError("BAD_REQUEST", { message: "Attachment IDs must be non-empty strings." });
		}
		unique.add(id.trim());
	}

	if (unique.size !== ids.length) {
		throw new ORPCError("BAD_REQUEST", { message: "Attachment IDs must be unique." });
	}

	if (unique.size > MAX_ATTACHMENTS_PER_MESSAGE) {
		throw new ORPCError("BAD_REQUEST", { message: "Too many attachments for one message." });
	}

	return Array.from(unique);
}

function normalizeAttachmentIds(ids: unknown) {
	const unique = uniqueAttachmentIds(ids);
	return unique;
}

async function getUnlinkedMessageAttachments(input: { ids: unknown; threadId: string; userId: string }) {
	const ids = normalizeAttachmentIds(input.ids);
	if (ids.length === 0) return [];

	const attachments = await db
		.select()
		.from(schema.agentAttachment)
		.where(
			and(
				eq(schema.agentAttachment.threadId, input.threadId),
				eq(schema.agentAttachment.userId, input.userId),
				inArray(schema.agentAttachment.id, ids),
				isNull(schema.agentAttachment.messageId),
			),
		);

	if (attachments.length !== ids.length) {
		throw new ORPCError("BAD_REQUEST", {
			message: "One or more attachments are unavailable or already linked to a message.",
		});
	}

	const attachmentsById = new Map(attachments.map((attachment) => [attachment.id, attachment]));
	return ids.map((id) => {
		const attachment = attachmentsById.get(id);
		if (!attachment) {
			throw new ORPCError("BAD_REQUEST", {
				message: "One or more attachments are unavailable or already linked to a message.",
			});
		}

		return attachment;
	});
}

async function linkAttachmentsToMessage(input: {
	attachments: AgentAttachmentRecord[];
	messageId: string;
	threadId: string;
	userId: string;
}) {
	if (input.attachments.length === 0) return;

	const ids = input.attachments.map((attachment) => attachment.id);
	const linked = await db
		.update(schema.agentAttachment)
		.set({ messageId: input.messageId })
		.where(
			and(
				eq(schema.agentAttachment.threadId, input.threadId),
				eq(schema.agentAttachment.userId, input.userId),
				inArray(schema.agentAttachment.id, ids),
				isNull(schema.agentAttachment.messageId),
			),
		)
		.returning({ id: schema.agentAttachment.id });

	if (linked.length !== ids.length) {
		throw new ORPCError("CONFLICT", { message: "One or more attachments were already linked to another message." });
	}
}

async function readAttachmentModelInputs(attachments: AgentAttachmentRecord[]): Promise<AttachmentModelInput[]> {
	const storage = getStorageService();
	const inputs = await Promise.all(
		attachments.map(async (attachment) => {
			const stored = await storage.read(attachment.storageKey);
			if (!stored) {
				throw new ORPCError("BAD_REQUEST", { message: `Attachment ${attachment.filename} could not be read.` });
			}

			return { attachment, data: stored.data };
		}),
	);

	return inputs;
}

function attachModelPartsToLatestUserMessage(
	messages: ModelMessage[],
	parts: Array<TextPart | ImagePart | FilePart>,
): ModelMessage[] {
	if (parts.length === 0) return messages;

	let index = -1;
	for (let messageIndex = messages.length - 1; messageIndex >= 0; messageIndex--) {
		if (messages[messageIndex]?.role === "user") {
			index = messageIndex;
			break;
		}
	}

	if (index === -1) return messages;

	return messages.map((message, messageIndex) =>
		messageIndex === index ? appendUserModelParts(message, parts) : message,
	);
}

async function getNextMessageSequence(threadId: string) {
	const [row] = await db
		.select({ maxSequence: max(schema.agentMessage.sequence) })
		.from(schema.agentMessage)
		.where(eq(schema.agentMessage.threadId, threadId));

	return (row?.maxSequence ?? -1) + 1;
}

async function persistMessage(input: {
	userId: string;
	threadId: string;
	message: UIMessage;
	status?: string;
	sequence?: number;
}) {
	const sequence = input.sequence ?? (await getNextMessageSequence(input.threadId));
	const [message] = await db
		.insert(schema.agentMessage)
		.values({
			userId: input.userId,
			threadId: input.threadId,
			role: input.message.role,
			status: input.status ?? "completed",
			sequence,
			uiMessage: input.message as unknown as Record<string, unknown>,
		})
		.returning();

	await db
		.update(schema.agentThread)
		.set({ lastMessageAt: new Date() })
		.where(and(eq(schema.agentThread.id, input.threadId), eq(schema.agentThread.userId, input.userId)));

	return message;
}

async function updateAssistantToolResultMessage(input: { userId: string; threadId: string; message: UIMessage }) {
	const existingRows = await listThreadMessages({ threadId: input.threadId, userId: input.userId });
	const existingRow = existingRows.find((row) => row.role === "assistant" && toMessage(row).id === input.message.id);
	if (!existingRow) {
		throw new ORPCError("BAD_REQUEST", { message: "The answered assistant message was not found." });
	}

	const mergedMessage = mergeAskUserQuestionOutputs(toMessage(existingRow), input.message);

	await db
		.update(schema.agentMessage)
		.set({
			status: "completed",
			uiMessage: mergedMessage as unknown as Record<string, unknown>,
		})
		.where(
			and(
				eq(schema.agentMessage.id, existingRow.id),
				eq(schema.agentMessage.threadId, input.threadId),
				eq(schema.agentMessage.userId, input.userId),
			),
		);

	await db
		.update(schema.agentThread)
		.set({ lastMessageAt: new Date() })
		.where(and(eq(schema.agentThread.id, input.threadId), eq(schema.agentThread.userId, input.userId)));

	return mergedMessage;
}

async function repairLegacyAskUserQuestionAnswers(
	rows: AgentMessageRecord[],
	input: { threadId: string; userId: string },
) {
	const nextRows = [...rows];
	const answerRowIdsToOmit = new Set<string>();
	const updates: Promise<unknown>[] = [];

	for (let index = 0; index < nextRows.length - 1; index++) {
		const assistantRow = nextRows[index];
		const answerRow = nextRows[index + 1];

		if (!assistantRow || !answerRow || assistantRow.role !== "assistant" || answerRow.role !== "user") continue;

		const assistantMessage = toMessage(assistantRow);
		const toolCallId = getFirstUnansweredAskUserQuestionToolCallId(assistantMessage);
		const answer = messageText(toMessage(answerRow));
		if (!toolCallId || !answer) continue;

		const mergedMessage = answerAskUserQuestionToolCall(assistantMessage, toolCallId, answer);
		answerRowIdsToOmit.add(answerRow.id);
		nextRows[index] = {
			...assistantRow,
			uiMessage: mergedMessage as unknown as AgentMessageRecord["uiMessage"],
		};

		updates.push(
			db
				.update(schema.agentMessage)
				.set({
					status: "completed",
					uiMessage: mergedMessage as unknown as Record<string, unknown>,
				})
				.where(
					and(
						eq(schema.agentMessage.id, assistantRow.id),
						eq(schema.agentMessage.threadId, input.threadId),
						eq(schema.agentMessage.userId, input.userId),
					),
				),
		);
	}

	await Promise.all(updates);

	return nextRows.filter((row) => !answerRowIdsToOmit.has(row.id));
}

async function cleanupActiveRun(input: {
	threadId: string;
	userId: string;
	runId: string;
	streamId: string;
	primaryError?: unknown;
}) {
	activeRunControllers.delete(input.runId);
	canceledRunsWithPersistedPartial.delete(input.runId);

	try {
		await clearActiveAgentRunIfCurrent(input);
	} catch (error) {
		if (!input.primaryError) throw error;
		console.error("[agent] Failed to clear active run after run error", error);
	}
}

function messageText(message: UIMessage) {
	const textParts: string[] = [];

	for (const part of message.parts) {
		if (part.type === "text") textParts.push(part.text);
	}

	return textParts.join(" ").trim();
}

function buildThreadTitle(message: UIMessage, fallback: string) {
	const text = messageText(message);
	if (!text) return fallback;
	return text.length > 60 ? `${text.slice(0, 57)}...` : text;
}

export async function listThreadMessages(input: { threadId: string; userId: string }) {
	return db
		.select()
		.from(schema.agentMessage)
		.where(and(eq(schema.agentMessage.threadId, input.threadId), eq(schema.agentMessage.userId, input.userId)))
		.orderBy(asc(schema.agentMessage.sequence));
}

async function readAttachment(input: { id: string; threadId: string; userId: string }) {
	const [attachment] = await db
		.select()
		.from(schema.agentAttachment)
		.where(
			and(
				eq(schema.agentAttachment.id, input.id),
				eq(schema.agentAttachment.threadId, input.threadId),
				eq(schema.agentAttachment.userId, input.userId),
			),
		)
		.limit(1);

	if (!attachment) throw new Error("ATTACHMENT_NOT_FOUND");

	const stored = await getStorageService().read(attachment.storageKey);
	if (!stored) throw new Error("ATTACHMENT_NOT_FOUND");

	if (!READABLE_ATTACHMENT_TYPES.has(attachment.mediaType)) {
		return {
			id: attachment.id,
			filename: attachment.filename,
			mediaType: attachment.mediaType,
			size: attachment.size,
			content: null,
			note: "This attachment is provided directly to the model when its message is sent. Text extraction is not available through this tool for this media type.",
		};
	}

	return {
		id: attachment.id,
		filename: attachment.filename,
		mediaType: attachment.mediaType,
		size: attachment.size,
		content: new TextDecoder().decode(stored.data).slice(0, 40_000),
	};
}

async function applyResumePatch(input: {
	userId: string;
	threadId: string;
	resumeId: string;
	title: string;
	summary?: string;
	operations: JsonPatchOperation[];
}) {
	const before = await resumeService.getById({ id: input.resumeId, userId: input.userId });
	const snapshotData = cloneResumeData(before.data);

	const { action, patched } = await db.transaction(async (tx) => {
		const patched = await resumeService.patchInTransaction(tx, {
			id: input.resumeId,
			userId: input.userId,
			operations: input.operations,
		});

		const [action] = await tx
			.insert(schema.agentAction)
			.values({
				userId: input.userId,
				threadId: input.threadId,
				resumeId: input.resumeId,
				kind: "resume_patch",
				status: "applied",
				title: input.title,
				...(input.summary !== undefined ? { summary: input.summary } : {}),
				operations: input.operations,
				snapshotData,
				baseUpdatedAt: before.updatedAt,
				appliedUpdatedAt: patched.updatedAt,
			})
			.returning();

		if (!action) throw new Error("AGENT_ACTION_CREATE_FAILED");

		return { action, patched };
	});

	await resumeService.notifyResumePatched({
		resumeId: patched.id,
		userId: input.userId,
		updatedAt: patched.updatedAt,
	});

	return {
		actionId: action.id,
		resumeId: input.resumeId,
		title: action.title,
		summary: action.summary,
		operations: action.operations,
		appliedUpdatedAt: action.appliedUpdatedAt.toISOString(),
	};
}

function createAgent(input: {
	userId: string;
	threadId: string;
	resumeId: string;
	provider: {
		provider: Parameters<typeof getModel>[0]["provider"];
		model: string;
		apiKey: string;
		baseURL?: string;
	};
	model: ReturnType<typeof getModel>;
}) {
	const tools = buildAgentTools({
		provider: input.provider,
		handlers: {
			readResume: async () => {
				const resume = await resumeService.getById({ id: input.resumeId, userId: input.userId });
				return {
					id: resume.id,
					name: resume.name,
					updatedAt: resume.updatedAt.toISOString(),
					patchRoot: "data",
					patchPathExamples: {
						visibleName: "/basics/name",
					},
					patchNotes: [
						"apply_resume_patch paths are rooted at the `data` object below.",
						"Do not prefix paths with `/data`.",
						"The resume file/title `name` metadata is read-only for apply_resume_patch.",
					],
					data: resume.data,
				};
			},
			readAttachment: (attachmentId) =>
				readAttachment({ id: attachmentId, threadId: input.threadId, userId: input.userId }),
			applyResumePatch: ({ title, summary, operations }) =>
				applyResumePatch({
					userId: input.userId,
					threadId: input.threadId,
					resumeId: input.resumeId,
					title,
					...(summary !== undefined ? { summary } : {}),
					operations,
				}),
		},
	});

	return new ToolLoopAgent({
		model: input.model,
		instructions: buildAgentInstructions({ hasProviderNativeSearch: "web_search" in tools }),
		stopWhen: stepCountIs(MAX_AGENT_STEPS),
		tools,
	});
}

function extractJsonObject(text: string) {
	const first = text.indexOf("{");
	const last = text.lastIndexOf("}");
	if (first === -1 || last === -1 || last < first) throw new Error("AI returned no JSON object.");

	return JSON.parse(text.slice(first, last + 1));
}

function textMessageStream(text: string): ReadableStream<UIMessageChunk> {
	return new ReadableStream({
		start(controller) {
			const id = generateId();
			controller.enqueue({ type: "text-start", id });
			controller.enqueue({ type: "text-delta", id, delta: text });
			controller.enqueue({ type: "text-end", id });
			controller.close();
		},
	});
}

async function runOllamaPatchAgent(input: {
	userId: string;
	threadId: string;
	resumeId: string;
	runId: string;
	streamId: string;
	message: UIMessage;
	provider: {
		provider: Parameters<typeof getModel>[0]["provider"];
		model: string;
		apiKey: string;
		baseURL?: string;
	};
}) {
	const resume = await resumeService.getById({ id: input.resumeId, userId: input.userId });
	const request = messageText(input.message);
	if (!request) throw new ORPCError("BAD_REQUEST", { message: "Agent message is empty." });

	const timeout = getAiRequestTimeout({
		provider: input.provider.provider,
		baseURL: input.provider.baseURL ?? "",
	});
	const result = await generateText({
		model: getAgentModel(input.provider),
		...(timeout ? { timeout } : {}),
		messages: [
			{
				role: "system",
				content:
					'You are an expert resume editor inside Reactive Resume. Return only a raw JSON object with this shape: {"title":"short action title","summary":"optional concise summary","response":"brief user-facing message","operations":[JSON Patch operations]}. JSON Patch paths are rooted at the resume data object, so use paths like /summary/content and /basics/name. Do not prefix paths with /data. Use valid HTML for HTML content fields such as /summary/content. Batch requested edits into one cohesive operations array. If no resume edit is needed, return an empty operations array and answer in response.',
			},
			{
				role: "user",
				content: `Current resume data:\n${JSON.stringify(resume.data, null, 2)}\n\nUser request:\n${request}`,
			},
		],
	});

	const patch = ollamaPatchResponseSchema.parse(extractJsonObject(result.text));
	const patchResult =
		patch.operations.length > 0
			? await applyResumePatch({
					userId: input.userId,
					threadId: input.threadId,
					resumeId: input.resumeId,
					title: patch.title,
					...(patch.summary !== undefined ? { summary: patch.summary } : {}),
					operations: patch.operations,
				})
			: null;

	const responseMessage: UIMessage = {
		id: generateId(),
		role: "assistant",
		parts: [
			{ type: "text", text: patch.response },
			...(patchResult
				? [
						{
							type: "tool-apply_resume_patch",
							toolCallId: generateId(),
							state: "output-available",
							input: {
								title: patch.title,
								...(patch.summary !== undefined ? { summary: patch.summary } : {}),
								operations: patch.operations,
							},
							output: patchResult,
						} as UIMessage["parts"][number],
					]
				: []),
		],
	};

	await persistMessage({
		userId: input.userId,
		threadId: input.threadId,
		message: responseMessage,
		status: "completed",
	});

	await cleanupActiveRun({
		threadId: input.threadId,
		userId: input.userId,
		runId: input.runId,
		streamId: input.streamId,
	});

	return streamToEventIterator(
		await agentStreamLifecycle.create(input.streamId, () => textMessageStream(patch.response)),
	);
}

export function createAgentMessagesService() {
	return {
		send: async (input: SendMessageInput) => {
			assertAgentEnvironment();

			const thread = await getAgentThread({ id: input.threadId, userId: input.userId });
			if (thread.status === "archived") {
				throw new ORPCError("CONFLICT", { message: "This thread is archived." });
			}
			if (thread.activeRunId) {
				throw new ORPCError("CONFLICT", { message: "This thread already has an active run." });
			}
			if (!thread.workingResumeId) {
				throw new ORPCError("BAD_REQUEST", { message: "This thread is read-only." });
			}
			if (input.message.role !== "user" && input.message.role !== "assistant") {
				throw new ORPCError("BAD_REQUEST", { message: "Agent messages must be user messages or tool results." });
			}

			const [runnableProvider, attachments] = await Promise.all([
				thread.aiProviderId
					? aiProvidersService.getRunnableById({
							id: thread.aiProviderId,
							userId: input.userId,
						})
					: aiProvidersService.getDefaultRunnable({ userId: input.userId }),
				getUnlinkedMessageAttachments({
					ids: input.attachmentIds ?? [],
					threadId: input.threadId,
					userId: input.userId,
				}),
			]);
			if (!runnableProvider) throw new ORPCError("BAD_REQUEST", { message: "No tested AI provider is available." });
			const runId = generateId();
			const streamId = generateId();
			const controller = new AbortController();
			activeRunControllers.set(runId, controller);

			const claimed = await claimActiveAgentRun({ threadId: input.threadId, userId: input.userId, runId, streamId });
			if (!claimed) {
				activeRunControllers.delete(runId);
				throw new ORPCError("CONFLICT", { message: "This thread already has an active run." });
			}

			try {
				let attachmentsForModel: AgentAttachmentRecord[] = [];

				if (input.message.role === "assistant") {
					if (attachments.length > 0) {
						throw new ORPCError("BAD_REQUEST", { message: "Tool result messages cannot include attachments." });
					}

					await updateAssistantToolResultMessage({
						userId: input.userId,
						threadId: input.threadId,
						message: input.message,
					});
				} else {
					attachmentsForModel = attachments;
					const sequence = await getNextMessageSequence(input.threadId);
					const userMessage = withAttachmentUiParts(input.message, attachments);
					const persistedUserMessage = await persistMessage({
						userId: input.userId,
						threadId: input.threadId,
						message: userMessage,
						sequence,
					});
					if (!persistedUserMessage) throw new Error("AGENT_MESSAGE_CREATE_FAILED");
					await linkAttachmentsToMessage({
						attachments,
						messageId: persistedUserMessage.id,
						threadId: input.threadId,
						userId: input.userId,
					});

					const [messageCount] = await db
						.select({ total: count() })
						.from(schema.agentMessage)
						.where(eq(schema.agentMessage.threadId, input.threadId));

					if ((messageCount?.total ?? 0) === 1) {
						await db
							.update(schema.agentThread)
							.set({ title: buildThreadTitle(userMessage, thread.title) })
							.where(and(eq(schema.agentThread.id, input.threadId), eq(schema.agentThread.userId, input.userId)));
					}
				}

				await aiProvidersService.markUsed({ id: runnableProvider.id, userId: input.userId });

				const messageRows = await repairLegacyAskUserQuestionAnswers(
					await listThreadMessages({ threadId: input.threadId, userId: input.userId }),
					{ threadId: input.threadId, userId: input.userId },
				);
				const messages = messageRows.map(toMessage);

				if (runnableProvider.provider === "ollama" && input.message.role === "user") {
					return runOllamaPatchAgent({
						userId: input.userId,
						threadId: input.threadId,
						resumeId: thread.workingResumeId,
						runId,
						streamId,
						message: input.message,
						provider: {
							provider: runnableProvider.provider,
							model: runnableProvider.model,
							apiKey: runnableProvider.apiKey,
							baseURL: runnableProvider.baseURL ?? "",
						},
					});
				}

				const modelMessages = await convertToModelMessages(messages.map(toModelInputMessage));
				const attachmentModelParts = buildAttachmentModelParts(await readAttachmentModelInputs(attachmentsForModel));
				const agent = createAgent({
					userId: input.userId,
					threadId: input.threadId,
					resumeId: thread.workingResumeId,
					provider: {
						provider: runnableProvider.provider,
						model: runnableProvider.model,
						apiKey: runnableProvider.apiKey,
						baseURL: runnableProvider.baseURL ?? "",
					},
					model: getAgentModel({
						provider: runnableProvider.provider,
						model: runnableProvider.model,
						apiKey: runnableProvider.apiKey,
						baseURL: runnableProvider.baseURL ?? "",
					}),
				});

				const agentTimeout = getAiRequestTimeout({
					provider: runnableProvider.provider,
					baseURL: runnableProvider.baseURL ?? "",
				});
				const result = await agent.stream({
					messages: attachModelPartsToLatestUserMessage(modelMessages, attachmentModelParts),
					abortSignal: controller.signal,
					...(agentTimeout ? { timeout: agentTimeout } : {}),
				});

				return streamToEventIterator(
					await agentStreamLifecycle.create(streamId, () =>
						result.toUIMessageStream({
							originalMessages: messages,
							generateMessageId: generateId,
							sendSources: true,
							onFinish: async ({ responseMessage, isAborted }) => {
								let persistError: unknown;
								try {
									if (!(isAborted && canceledRunsWithPersistedPartial.has(runId))) {
										await persistMessage({
											userId: input.userId,
											threadId: input.threadId,
											message: responseMessage,
											status: isAborted ? "canceled" : "completed",
										});
									}
								} catch (error) {
									persistError = error;
									throw error;
								} finally {
									await cleanupActiveRun({
										threadId: input.threadId,
										userId: input.userId,
										runId,
										streamId,
										primaryError: persistError,
									});
								}
							},
							onError: (error) => (error instanceof Error ? error.message : "Agent run failed."),
						}),
					),
				);
			} catch (error) {
				await cleanupActiveRun({
					threadId: input.threadId,
					userId: input.userId,
					runId,
					streamId,
					primaryError: error,
				});
				throw error;
			}
		},

		stop: async (input: { userId: string; threadId: string; partialMessage?: UIMessage }) => {
			assertAgentEnvironment();

			const thread = await getAgentThread({ id: input.threadId, userId: input.userId });
			const activeRunId = thread.activeRunId;
			const activeStreamId = thread.activeStreamId;

			let persistError: unknown;
			let cleanupError: unknown;
			try {
				if (input.partialMessage) {
					await persistMessage({
						userId: input.userId,
						threadId: input.threadId,
						message: input.partialMessage,
						status: "canceled",
					});
					if (activeRunId) canceledRunsWithPersistedPartial.add(activeRunId);
				}
			} catch (error) {
				persistError = error;
			} finally {
				if (activeRunId) {
					activeRunControllers.get(activeRunId)?.abort("USER_STOPPED");
					activeRunControllers.delete(activeRunId);
					try {
						await clearActiveAgentRunIfCurrent({
							threadId: input.threadId,
							userId: input.userId,
							runId: activeRunId,
							streamId: activeStreamId,
						});
					} catch (error) {
						cleanupError = error;
						if (persistError) console.error("[agent] Failed to clear active run after stop persistence error", error);
					}
				}
			}

			if (persistError) throw persistError;
			if (cleanupError) throw cleanupError;
		},
		resume: async (input: { userId: string; threadId: string }) => {
			assertAgentEnvironment();
			const thread = await getAgentThread({ id: input.threadId, userId: input.userId });
			return streamToEventIterator(await agentStreamLifecycle.resume(thread.activeStreamId));
		},
	};
}
