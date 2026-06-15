import type { UIMessage } from "ai";
import { describe, expect, it } from "vitest";
import { shouldSendAnsweredAskUserQuestion } from "./assistant-chat";

describe("shouldSendAnsweredAskUserQuestion", () => {
	it("does not auto-send completed resume patch tool results", () => {
		const message = {
			id: "assistant-1",
			role: "assistant",
			parts: [
				{
					type: "tool-apply_resume_patch",
					toolCallId: "patch-1",
					state: "output-available",
					input: { title: "Update summary" },
					output: { actionId: "action-1" },
				},
			],
		} as UIMessage;

		expect(shouldSendAnsweredAskUserQuestion({ messages: [message] })).toBe(false);
	});

	it("auto-sends answered ask-user-question tool results", () => {
		const message = {
			id: "assistant-1",
			role: "assistant",
			parts: [
				{
					type: "tool-ask_user_question",
					toolCallId: "question-1",
					state: "output-available",
					input: { question: "Which section?", choices: ["Only change the summary"] },
					output: "Only change the summary",
				},
			],
		} as UIMessage;

		expect(shouldSendAnsweredAskUserQuestion({ messages: [message] })).toBe(true);
	});
});
