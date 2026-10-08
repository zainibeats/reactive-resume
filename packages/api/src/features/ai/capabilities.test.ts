import { describe, expect, it } from "vitest";
import { isDirectOpenAIProvider, supportsOpenAIWebSearch } from "./capabilities";

describe("AI provider capabilities", () => {
	it("identifies direct OpenAI base URL configs", () => {
		expect(isDirectOpenAIProvider({ provider: "openai", baseURL: "" })).toBe(true);
		expect(isDirectOpenAIProvider({ provider: "openai", baseURL: "https://api.openai.com/v1/" })).toBe(true);
		expect(isDirectOpenAIProvider({ provider: "openai", baseURL: "https://example.com/v1" })).toBe(false);
		expect(isDirectOpenAIProvider({ provider: "openai", baseURL: "https://api.openai.com/v1?proxy=1" })).toBe(false);
		expect(isDirectOpenAIProvider({ provider: "openai", baseURL: "https://api.openai.com/v1#fragment" })).toBe(false);
		expect(isDirectOpenAIProvider({ provider: "openrouter", baseURL: "https://api.openai.com/v1" })).toBe(false);
	});

	it("keeps the OpenAI web search model predicate conservative", () => {
		const allowedModels = ["gpt-5", "gpt-5-mini-2025-08-07", "o4-mini"];
		const deniedModels = ["gpt-4.1-nano", "gpt-5-codex", "gpt-4o", "custom-model"];

		for (const model of allowedModels) {
			expect(supportsOpenAIWebSearch(model), model).toBe(true);
		}

		for (const model of deniedModels) {
			expect(supportsOpenAIWebSearch(model), model).toBe(false);
		}
	});
});
