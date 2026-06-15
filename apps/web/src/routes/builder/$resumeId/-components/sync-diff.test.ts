import type { MessageDescriptor } from "@lingui/core";
import { describe, expect, it, vi } from "vitest";
import { formatDiffPath, formatDiffValue } from "./sync-diff";

const makeTranslator = (
	translate: (descriptor: MessageDescriptor) => string = (descriptor) => descriptor.message ?? "",
) => ({
	_: vi.fn(translate),
});

describe("formatDiffPath", () => {
	it("formats built-in section paths with translated labels", () => {
		const translator = makeTranslator((descriptor) => {
			if (descriptor.message === "Experience") return "Erfahrung";
			if (descriptor.message === "Items") return "Einträge";
			if (descriptor.message === "Company") return "Firma";
			return descriptor.message ?? "";
		});

		expect(formatDiffPath("/sections/experience/items/0/company", translator)).toBe(
			"Erfahrung / Einträge / #1 / Firma",
		);
	});

	it("decodes JSON pointer escape sequences", () => {
		const translator = makeTranslator();

		expect(formatDiffPath("/basics/customFields/0/text~1label", translator)).toBe(
			"Basics / Custom fields / #1 / text/label",
		);
	});

	it("keeps invalid paths readable", () => {
		expect(formatDiffPath("not-a-pointer", makeTranslator())).toBe("not-a-pointer");
	});
});

describe("formatDiffValue", () => {
	it("falls back when a diff side has no value", () => {
		const translator = makeTranslator((descriptor) => (descriptor.message === "No value" ? "Kein Wert" : ""));

		expect(formatDiffValue(undefined, false, translator)).toBe("Kein Wert");
	});

	it("strips rich-text markup from string values", () => {
		expect(formatDiffValue("<p>Senior &amp; Staff<br />Engineer</p>", true, makeTranslator())).toBe(
			"Senior & Staff\nEngineer",
		);
	});

	it("keeps objects as formatted JSON", () => {
		expect(formatDiffValue({ name: "TypeScript", level: 5 }, true, makeTranslator())).toBe(
			'{\n  "name": "TypeScript",\n  "level": 5\n}',
		);
	});
});
