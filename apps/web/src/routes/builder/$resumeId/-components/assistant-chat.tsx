import type { UIMessage, UIMessageChunk } from "ai";
import { useChat } from "@ai-sdk/react";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { eventIteratorToUnproxiedDataStream } from "@orpc/client";
import { PaperPlaneRightIcon, StopIcon } from "@phosphor-icons/react";
import { useQueryClient } from "@tanstack/react-query";
import { lastAssistantMessageIsCompleteWithToolCalls } from "ai";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@reactive-resume/ui/components/badge";
import { Button } from "@reactive-resume/ui/components/button";
import { ScrollArea } from "@reactive-resume/ui/components/scroll-area";
import { Textarea } from "@reactive-resume/ui/components/textarea";
import { cn } from "@reactive-resume/utils/style";
import { client, orpc, streamClient } from "@/libs/orpc/client";

type BuilderAssistantChatProps = {
	threadId: string;
	initialMessages: UIMessage[];
	activeRunId: string | null;
};

function parseAgentSseStream(stream: ReadableStream<string>) {
	let buffer = "";
	const eventBoundary = /\r?\n\r?\n/;

	return stream.pipeThrough(
		new TransformStream<string, UIMessageChunk>({
			transform(chunk, controller) {
				buffer += chunk;

				let boundary = eventBoundary.exec(buffer);
				while (boundary) {
					const event = buffer.slice(0, boundary.index);
					buffer = buffer.slice(boundary.index + boundary[0].length);

					for (const line of event.split(/\r?\n/)) {
						if (!line.startsWith("data:")) continue;

						const data = line.slice("data:".length).trimStart();
						if (!data || data === "[DONE]") continue;

						try {
							controller.enqueue(JSON.parse(data) as UIMessageChunk);
						} catch (error) {
							console.warn("[builder-assistant] dropping malformed SSE frame", error);
						}
					}

					boundary = eventBoundary.exec(buffer);
				}
			},
		}),
	);
}

function messageText(message: UIMessage) {
	return message.parts
		.filter((part) => part.type === "text")
		.map((part) => part.text.trim())
		.filter(Boolean)
		.join("\n");
}

function hasAppliedPatch(message: UIMessage) {
	return message.parts.some((part) => part.type === "tool-apply_resume_patch" && "output" in part && part.output);
}

export function BuilderAssistantChat({ threadId, initialMessages, activeRunId }: BuilderAssistantChatProps) {
	const queryClient = useQueryClient();
	const [input, setInput] = useState("");
	const [lastSyncedThreadId, setLastSyncedThreadId] = useState<string | null>(null);

	const refreshThread = useCallback(async () => {
		await Promise.all([
			queryClient.invalidateQueries({ queryKey: orpc.agent.threads.list.queryKey() }),
			queryClient.invalidateQueries({ queryKey: orpc.agent.threads.get.queryKey({ input: { id: threadId } }) }),
		]);
	}, [queryClient, threadId]);

	const transport = useMemo(
		() => ({
			async sendMessages(options: { messages: UIMessage[]; abortSignal?: AbortSignal }) {
				const message = options.messages.at(-1);
				if (!message) throw new Error("No message to send.");

				return parseAgentSseStream(
					eventIteratorToUnproxiedDataStream(
						await streamClient.agent.messages.send({ threadId, message }, { signal: options.abortSignal }),
					),
				);
			},
			async reconnectToStream() {
				return parseAgentSseStream(
					eventIteratorToUnproxiedDataStream(await streamClient.agent.messages.resume({ threadId })),
				);
			},
		}),
		[threadId],
	);

	const { messages, sendMessage, setMessages, status, error, clearError } = useChat({
		id: threadId,
		messages: initialMessages,
		resume: !!activeRunId,
		transport,
		sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
		onFinish: () => {
			void refreshThread();
		},
	});

	useEffect(() => {
		if (lastSyncedThreadId === threadId) return;
		setLastSyncedThreadId(threadId);
		setMessages(initialMessages);
	}, [initialMessages, lastSyncedThreadId, setMessages, threadId]);

	const isStreaming = status === "submitted" || status === "streaming";

	const send = () => {
		const text = input.trim();
		if (!text || isStreaming) return;

		clearError();
		sendMessage({ text });
		setInput("");
	};

	const stopRun = async () => {
		const last = messages.at(-1);
		await client.agent.messages.stop({
			threadId,
			...(last?.role === "assistant" ? { partialMessage: last } : {}),
		});
	};

	return (
		<section className="flex min-h-0 flex-1 flex-col">
			<ScrollArea className="min-h-0 flex-1">
				<div className="flex flex-col gap-3 p-4">
					{messages.length === 0 ? (
						<div className="py-10 text-center text-muted-foreground text-sm">
							<Trans>Ask for targeted edits, keyword cleanup, bullet rewrites, or a role-specific review.</Trans>
						</div>
					) : null}

					{messages.map((message) => {
						const text = messageText(message);
						const hasPatch = message.role === "assistant" && hasAppliedPatch(message);
						if (!text && !hasPatch) return null;

						return (
							<div
								key={message.id}
								className={cn(
									"max-w-[88%] rounded-md px-3 py-2 text-sm",
									message.role === "user" ? "ms-auto bg-primary text-primary-foreground" : "me-auto bg-muted",
								)}
							>
								{hasPatch ? (
									<Badge variant="secondary" className="mb-2 rounded-md">
										<Trans>Resume updated</Trans>
									</Badge>
								) : null}
								{text ? <div className="whitespace-pre-wrap">{text}</div> : null}
							</div>
						);
					})}

					{isStreaming ? (
						<div className="me-auto rounded-md bg-muted px-3 py-2 text-muted-foreground text-sm">
							<Trans>Working…</Trans>
						</div>
					) : null}

					{error ? (
						<div className="rounded-md border border-rose-300 bg-rose-50 p-3 text-rose-950 text-sm dark:bg-rose-950/20 dark:text-rose-200">
							{error.message}
						</div>
					) : null}
				</div>
			</ScrollArea>

			<form
				className="border-t p-3"
				onSubmit={(event) => {
					event.preventDefault();
					send();
				}}
			>
				<div className="flex items-end gap-1 rounded-md border bg-card p-1.5">
					<Textarea
						value={input}
						rows={1}
						disabled={isStreaming}
						onChange={(event) => setInput(event.target.value)}
						onKeyDown={(event) => {
							if (event.nativeEvent.isComposing) return;
							if (event.key !== "Enter" || event.shiftKey) return;
							event.preventDefault();
							send();
						}}
						placeholder={t`Ask anything about this resume`}
						className="max-h-40 min-h-9 resize-none border-0 bg-transparent p-2 leading-5 shadow-none focus-visible:ring-0"
					/>
					{isStreaming ? (
						<Button type="button" size="icon" variant="outline" aria-label={t`Stop generation`} onClick={stopRun}>
							<StopIcon />
						</Button>
					) : (
						<Button type="submit" size="icon" aria-label={t`Send message`} disabled={!input.trim()}>
							<PaperPlaneRightIcon />
						</Button>
					)}
				</div>
			</form>
		</section>
	);
}
