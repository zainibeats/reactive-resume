import { describe, expect, it } from "vitest";
import { AI_PROVIDER_DEFAULT_BASE_URLS, aiProviderSchema, isApiKeyOptional } from "./types";

const popularProviderDefaults = {
	mistral: "https://api.mistral.ai/v1",
	cohere: "https://api.cohere.com/v2",
	xai: "https://api.x.ai/v1",
	groq: "https://api.groq.com/openai/v1",
	deepseek: "https://api.deepseek.com/v1",
	togetherai: "https://api.together.xyz/v1",
	fireworks: "https://api.fireworks.ai/inference/v1",
	cerebras: "https://api.cerebras.ai/v1",
	perplexity: "https://api.perplexity.ai",
} as const;

describe("AI provider types", () => {
	it("accepts popular AI SDK text providers with default base URLs", () => {
		for (const [provider, baseURL] of Object.entries(popularProviderDefaults)) {
			expect(aiProviderSchema.parse(provider)).toBe(provider);
			expect(AI_PROVIDER_DEFAULT_BASE_URLS[provider as keyof typeof AI_PROVIDER_DEFAULT_BASE_URLS]).toBe(baseURL);
		}
	});

	it("keeps self-hosted providers selectable with local defaults", () => {
		for (const provider of ["ollama", "lmstudio", "openai-compatible"] as const) {
			expect(aiProviderSchema.parse(provider)).toBe(provider);
			expect(isApiKeyOptional(provider)).toBe(true);
		}

		expect(AI_PROVIDER_DEFAULT_BASE_URLS.ollama).toBe("http://localhost:11434/api");
		expect(AI_PROVIDER_DEFAULT_BASE_URLS.lmstudio).toBe("http://localhost:1234/v1");
		expect(AI_PROVIDER_DEFAULT_BASE_URLS["openai-compatible"]).toBe("");
	});

	it("requires an API key for hosted providers", () => {
		expect(isApiKeyOptional("openai")).toBe(false);
		expect(isApiKeyOptional("anthropic")).toBe(false);
	});
});
