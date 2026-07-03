import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { saveResumeStartIntent, takeResumeStartIntent } from "./start-intent";

describe("resume start intent", () => {
	const values = new Map<string, string>();
	const storage = {
		get length() {
			return values.size;
		},
		clear: () => values.clear(),
		getItem: (key: string) => values.get(key) ?? null,
		key: (index: number) => [...values.keys()][index] ?? null,
		removeItem: (key: string) => values.delete(key),
		setItem: (key: string, value: string) => values.set(key, value),
	} satisfies Storage;

	beforeEach(() => {
		vi.stubGlobal("sessionStorage", storage);
	});

	afterEach(() => {
		values.clear();
		vi.unstubAllGlobals();
	});

	it.each(["create", "import"] as const)("stores and consumes the %s intent", (intent) => {
		saveResumeStartIntent(intent);

		expect(takeResumeStartIntent()).toBe(intent);
		expect(takeResumeStartIntent()).toBeNull();
	});

	it("discards invalid stored values", () => {
		sessionStorage.setItem("resume-start-intent", "invalid");

		expect(takeResumeStartIntent()).toBeNull();
	});
});
