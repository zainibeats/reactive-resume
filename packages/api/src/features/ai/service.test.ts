import { afterEach, describe, expect, it, vi } from "vitest";

const envMock = vi.hoisted(() => ({
	FLAG_ALLOW_UNSAFE_AI_BASE_URL: false,
}));

vi.mock("@reactive-resume/env/server", () => ({ env: envMock }));

afterEach(() => {
	vi.unstubAllGlobals();
});

function stubOpenAICompatibleResponse() {
	let requestBody: unknown;

	const fetchMock = vi.fn((_input: unknown, init?: { body?: unknown }) => {
		const body = JSON.parse(String(init?.body ?? "{}")) as { max_tokens?: number };
		requestBody = body;
		const hasEnoughOutputTokens = (body.max_tokens ?? 0) >= 128;

		return new Response(
			JSON.stringify({
				id: "chatcmpl-test",
				object: "chat.completion",
				created: 1,
				model: "test-model",
				choices: [
					{
						index: 0,
						message: { role: "assistant", content: hasEnoughOutputTokens ? "1" : "" },
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
		const openAiCompatible = stubOpenAICompatibleResponse();

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
		expect(openAiCompatible.getRequestBody()).toMatchObject({ max_tokens: 128, temperature: 0 });
	});
});
