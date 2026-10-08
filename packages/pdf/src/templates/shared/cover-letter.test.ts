import type { ResumeData } from "@reactive-resume/schema/resume/data";
import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { sampleResumeData } from "@reactive-resume/schema/resume/sample";
import { ResumeDocument } from "../../document";
import { pdf, type RenderedNode } from "../../forme/testing";
import { shouldShowResumeHeader } from "./cover-letter";

// A resume's cover letter on its own: one full-width page holding only the cover-letter section.
const createCoverLetterOnlyData = (): ResumeData => {
	const data = structuredClone(sampleResumeData);
	data.customSections = [
		{
			id: "letter-section",
			type: "cover-letter",
			title: "Cover Letter",
			icon: "envelope",
			columns: 1,
			hidden: false,
			keepTogether: false,
			startOnNewPage: false,
			items: [
				{
					id: "letter-item",
					hidden: false,
					recipient: "<p>Hiring Manager</p>",
					content: "<p>Dear Hiring Manager,</p>",
				},
			],
		},
	];
	data.metadata.layout.pages = [{ fullWidth: true, main: ["letter-section"], sidebar: [] }];
	return data;
};

describe("shouldShowResumeHeader", () => {
	it("hides the header when every visible layout section is a cover letter", () => {
		expect(shouldShowResumeHeader(createCoverLetterOnlyData(), 0)).toBe(false);
	});

	it("keeps the first-page header for normal resume documents", () => {
		expect(shouldShowResumeHeader(sampleResumeData, 0)).toBe(true);
		expect(shouldShowResumeHeader(sampleResumeData, 1)).toBe(false);
	});
});

const renderedText = (node: RenderedNode): string =>
	"value" in node ? node.value : node.children.map(renderedText).join("");

describe("ResumeDocument cover letter header", () => {
	it.each(["gengar", "onyx"] as const)("omits the sender block for %s cover-letter-only PDFs", async (template) => {
		const data = createCoverLetterOnlyData();
		const element = createElement(ResumeDocument, { data, template }) as unknown as Parameters<typeof pdf>[0];
		const instance = pdf(element);
		await expect.poll(() => instance.container.document).not.toBeNull();
		const rendered = renderedText(instance.container.document as RenderedNode);

		expect(rendered).toContain("Dear Hiring Manager");
		expect(rendered).not.toContain(data.basics.email);
	});
});
