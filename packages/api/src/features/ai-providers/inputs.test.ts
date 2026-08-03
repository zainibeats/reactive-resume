import { describe, expect, it } from "vitest";
import { providerInput, updateProviderInput } from "./inputs";

const base = { label: "Local", model: "qwen3-8b", baseURL: "http://localhost:1234/v1" };

describe("AI provider inputs", () => {
	it("accepts self-hosted providers without an API key", () => {
		for (const provider of ["lmstudio", "ollama", "openai-compatible"] as const) {
			expect(providerInput.safeParse({ ...base, provider, apiKey: "" }).success).toBe(true);
		}
	});

	it("rejects hosted providers without an API key", () => {
		expect(providerInput.safeParse({ ...base, provider: "openai", apiKey: "" }).success).toBe(false);
		expect(providerInput.safeParse({ ...base, provider: "openai", apiKey: "sk-test" }).success).toBe(true);
	});

	it("keeps the same API key rule on updates", () => {
		expect(updateProviderInput.safeParse({ id: "provider-1", provider: "lmstudio", apiKey: "" }).success).toBe(true);
		expect(updateProviderInput.safeParse({ id: "provider-1", provider: "openai", apiKey: "" }).success).toBe(false);
		expect(updateProviderInput.safeParse({ id: "provider-1", enabled: true }).success).toBe(true);
		expect(updateProviderInput.safeParse({ id: "provider-1" }).success).toBe(false);
	});
});
