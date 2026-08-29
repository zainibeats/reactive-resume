import { describe, expect, it } from "vitest";
import { formatSyncDiffPath, formatSyncDiffValue } from "./diff";

describe("formatSyncDiffPath", () => {
	it("returns an empty breadcrumb for the document root", () => {
		expect(formatSyncDiffPath("")).toEqual([]);
	});

	it("labels a basics field", () => {
		expect(formatSyncDiffPath("/basics/name")).toEqual(["Basics", "Name"]);
	});

	it("labels a section item field with a one-based item number", () => {
		expect(formatSyncDiffPath("/sections/experience/items/2/company")).toEqual(["Experience", "Item 3", "Company"]);
	});

	it("labels a section-level field without an item number", () => {
		expect(formatSyncDiffPath("/sections/skills/name")).toEqual(["Skills", "Name"]);
	});

	it("labels a custom section index as a section rather than an item", () => {
		expect(formatSyncDiffPath("/customSections/0/items/1/content")).toEqual([
			"Custom sections",
			"Section 1",
			"Item 2",
			"Content",
		]);
	});

	it("title-cases unmapped camelCase keys", () => {
		expect(formatSyncDiffPath("/metadata/typography/body/fontFamily")).toEqual([
			"Metadata",
			"Typography",
			"Body",
			"Font family",
		]);
	});

	it("decodes escaped JSON pointer segments", () => {
		expect(formatSyncDiffPath("/basics/na~1me")).toEqual(["Basics", "Na/me"]);
	});
});

describe("formatSyncDiffValue", () => {
	it("returns null for an absent value", () => {
		expect(formatSyncDiffValue(null)).toBeNull();
	});

	it("returns null for a blank string", () => {
		expect(formatSyncDiffValue("   ")).toBeNull();
	});

	it("strips markup and collapses whitespace in rich text", () => {
		expect(formatSyncDiffValue("<p>Hello   <b>world</b></p>")).toBe("Hello world");
	});

	it("renders booleans and numbers literally", () => {
		expect(formatSyncDiffValue(true)).toBe("true");
		expect(formatSyncDiffValue(0)).toBe("0");
	});

	it("summarises arrays by length", () => {
		expect(formatSyncDiffValue(["a", "b"])).toBe("2 items");
		expect(formatSyncDiffValue(["a"])).toBe("1 item");
	});

	it("previews objects as compact JSON", () => {
		expect(formatSyncDiffValue({ a: 1 })).toBe('{"a":1}');
	});

	it("truncates long values with an ellipsis", () => {
		const value = formatSyncDiffValue("x".repeat(200));
		expect(value).toHaveLength(120);
		expect(value?.endsWith("…")).toBe(true);
	});
});
