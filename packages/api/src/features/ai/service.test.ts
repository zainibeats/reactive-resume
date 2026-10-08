import { afterEach, describe, expect, it, vi } from "vitest";

const envMock = vi.hoisted(() => ({
	FLAG_ALLOW_UNSAFE_AI_BASE_URL: false,
}));

vi.mock("@reactive-resume/env/server", () => ({ env: envMock }));

afterEach(() => {
	vi.unstubAllGlobals();
});

function stubOpenAIResponse() {
	let requestBody: unknown;

	const fetchMock = vi.fn((input: unknown, init?: { body?: unknown }) => {
		const body = JSON.parse(String(init?.body ?? "{}")) as {
			max_tokens?: number;
			max_completion_tokens?: number;
			max_output_tokens?: number;
		};
		requestBody = body;
		const hasEnoughOutputTokens = (body.max_tokens ?? body.max_completion_tokens ?? body.max_output_tokens ?? 0) >= 128;
		const text = hasEnoughOutputTokens ? "1" : "";
		if (String(input).endsWith("/responses")) {
			return new Response(
				JSON.stringify({
					id: "resp-test",
					object: "response",
					created_at: 1,
					model: "test-model",
					status: "completed",
					output: [
						{
							type: "message",
							id: "msg-test",
							role: "assistant",
							status: "completed",
							content: [{ type: "output_text", text, annotations: [] }],
						},
					],
					usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 },
				}),
				{ headers: { "Content-Type": "application/json" } },
			);
		}

		return new Response(
			JSON.stringify({
				id: "chatcmpl-test",
				object: "chat.completion",
				created: 1,
				model: "test-model",
				choices: [
					{
						index: 0,
						message: { role: "assistant", content: text },
						finish_reason: hasEnoughOutputTokens ? "stop" : "length",
					},
				],
				usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
			}),
			{ headers: { "Content-Type": "application/json" } },
		);
	});

	vi.stubGlobal("fetch", fetchMock);

	return { fetchMock, getRequestBody: () => requestBody };
}

const { testConnection } = await import("./service");

describe("AI chat service", () => {
	it("tests OpenAI-compatible providers without requiring structured output", async () => {
		const openAiCompatible = stubOpenAIResponse();

		await expect(
			testConnection({
				provider: "openai-compatible",
				model: "test-model",
				apiKey: "test-key",
				baseURL: "https://example.test/v1",
			}),
		).resolves.toEqual({ ok: true });

		expect(openAiCompatible.fetchMock).toHaveBeenCalledTimes(1);
		expect(openAiCompatible.getRequestBody()).not.toHaveProperty("response_format");
		expect(openAiCompatible.getRequestBody()).toMatchObject({ max_tokens: 128 });
	});
	it("tests OpenAI reasoning models without unsupported setting warnings", async () => {
		const { fetchMock } = stubOpenAIResponse();
		const warnings = vi.fn();
		vi.stubGlobal("AI_SDK_LOG_WARNINGS", warnings);

		await expect(
			testConnection({ provider: "openai", model: "gpt-6.1-sol", apiKey: "test-key", baseURL: "" }),
		).resolves.toEqual({ ok: true });

		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(warnings).not.toHaveBeenCalled();
	});
});
