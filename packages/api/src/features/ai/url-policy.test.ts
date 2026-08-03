import { beforeEach, describe, expect, it, vi } from "vitest";

const envMock = vi.hoisted(() => ({
	FLAG_ALLOW_UNSAFE_AI_BASE_URL: false,
}));

vi.mock("@reactive-resume/env/server", () => ({ env: envMock }));

// Test files in this package share a module cache (isolate: false), so re-import the policy per test to
// make sure it reads this file's env mock instead of one left behind by a sibling test file.
let resolveAiBaseUrl: typeof import("./url-policy").resolveAiBaseUrl;

beforeEach(async () => {
	vi.resetModules();
	({ resolveAiBaseUrl } = await import("./url-policy"));
});

describe("AI provider base URL policy", () => {
	it("allows public HTTPS provider URLs", () => {
		envMock.FLAG_ALLOW_UNSAFE_AI_BASE_URL = false;

		expect(resolveAiBaseUrl({ provider: "openai", baseURL: "https://api.openai.com/v1" })).toBe(
			"https://api.openai.com/v1",
		);
	});

	it("blocks private and non-HTTPS provider URLs by default", () => {
		envMock.FLAG_ALLOW_UNSAFE_AI_BASE_URL = false;

		expect(() => resolveAiBaseUrl({ provider: "openai-compatible", baseURL: "https://localhost:11434/v1" })).toThrow(
			"INVALID_AI_BASE_URL",
		);
		expect(() => resolveAiBaseUrl({ provider: "openai-compatible", baseURL: "http://example.com/v1" })).toThrow(
			"INVALID_AI_BASE_URL",
		);
	});

	it("allows local AI provider URLs by default", () => {
		envMock.FLAG_ALLOW_UNSAFE_AI_BASE_URL = false;

		expect(resolveAiBaseUrl({ provider: "ollama", baseURL: "http://localhost:11434/api" })).toBe(
			"http://localhost:11434/api",
		);
		expect(resolveAiBaseUrl({ provider: "lmstudio", baseURL: "http://localhost:1234/v1" })).toBe(
			"http://localhost:1234/v1",
		);
	});

	it("allows private and non-HTTPS provider URLs when explicitly enabled", () => {
		envMock.FLAG_ALLOW_UNSAFE_AI_BASE_URL = true;

		expect(resolveAiBaseUrl({ provider: "openai-compatible", baseURL: "http://localhost:11434/v1" })).toBe(
			"http://localhost:11434/v1",
		);
		expect(resolveAiBaseUrl({ provider: "openai-compatible", baseURL: "https://10.0.0.5/v1" })).toBe(
			"https://10.0.0.5/v1",
		);
	});

	it("rejects non-HTTP schemes even when unsafe provider URLs are enabled", () => {
		envMock.FLAG_ALLOW_UNSAFE_AI_BASE_URL = true;

		expect(() => resolveAiBaseUrl({ provider: "openai-compatible", baseURL: "file:///etc/passwd" })).toThrow(
			"INVALID_AI_BASE_URL",
		);
		expect(() => resolveAiBaseUrl({ provider: "openai-compatible", baseURL: "ftp://example.com/v1" })).toThrow(
			"INVALID_AI_BASE_URL",
		);
	});
});
