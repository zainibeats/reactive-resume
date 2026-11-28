import type { ResumeData } from "@reactive-resume/schema/resume/data";
import { describe, expect, it } from "vite-plus/test";
import { defaultResumeData } from "@reactive-resume/schema/resume/default";
import { isCoverLetterOnlyDocument } from "./export-sections";

const letter = {
	id: "letter",
	type: "cover-letter",
	hidden: false,
	items: [{ id: "l1", hidden: false, recipient: "", content: "<p>Dear team</p>" }],
} as unknown as ResumeData["customSections"][number];

const withLayout = (main: string[]): ResumeData => ({
	...defaultResumeData,
	customSections: [letter],
	metadata: {
		...defaultResumeData.metadata,
		layout: { ...defaultResumeData.metadata.layout, pages: [{ fullWidth: true, main, sidebar: [] }] },
	},
});

describe("isCoverLetterOnlyDocument", () => {
	it("is true when the cover letter is the only laid-out section", () => {
		expect(isCoverLetterOnlyDocument(withLayout(["letter"]))).toBe(true);
	});

	// Same answer as the PDF: hidden and empty sections in the layout don't count.
	it("ignores hidden or empty sections still in the layout", () => {
		expect(isCoverLetterOnlyDocument(withLayout(["letter", "experience"]))).toBe(true);
	});

	it("is false when a visible resume section is laid out too", () => {
		const data = withLayout(["letter", "summary"]);
		expect(isCoverLetterOnlyDocument({ ...data, summary: { ...data.summary, content: "<p>Hi</p>" } })).toBe(false);
	});
});
