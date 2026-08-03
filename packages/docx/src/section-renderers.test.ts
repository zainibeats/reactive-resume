// @vitest-environment happy-dom

import type { CustomSection, ResumeData, SectionType } from "@reactive-resume/schema/resume/data";
import { describe, expect, it } from "vitest";
import { getDefaultSectionIconName } from "@reactive-resume/schema/resume/section-icons";
import { renderBuiltInSection, renderCustomSection, renderSummary, setRenderConfig } from "./section-renderers";

const baseConfig = {
	headingFont: "Inter",
	headingSizeHalfPt: 28,
	bodyFont: "Inter",
	bodySizeHalfPt: 20,
	textColorHex: "111111",
	primaryColorHex: "0563C1",
};

setRenderConfig(baseConfig);

const HEX = "#0563C1";

describe("renderSummary", () => {
	it("returns [] when the section is hidden", () => {
		const summary: ResumeData["summary"] = {
			title: "Summary",
			icon: getDefaultSectionIconName("summary"),
			content: "<p>Hello</p>",
			hidden: true,
			columns: 1,
			keepTogether: false,
			startOnNewPage: false,
		};
		expect(renderSummary(summary, HEX)).toEqual([]);
	});

	it("returns [] when content is empty", () => {
		const summary: ResumeData["summary"] = {
			title: "Summary",
			icon: getDefaultSectionIconName("summary"),
			content: "",
			hidden: false,
			columns: 1,
			keepTogether: false,
			startOnNewPage: false,
		};
		expect(renderSummary(summary, HEX)).toEqual([]);
	});

	it("includes a heading paragraph when both title and content are present", () => {
		const summary: ResumeData["summary"] = {
			title: "Summary",
			icon: getDefaultSectionIconName("summary"),
			content: "<p>Hello world</p>",
			hidden: false,
			columns: 1,
			keepTogether: false,
			startOnNewPage: false,
		};
		const paragraphs = renderSummary(summary, HEX);
		// One heading + the htmlToParagraphs output for one <p>.
		expect(paragraphs.length).toBeGreaterThanOrEqual(2);
	});

	it("omits the heading when title is empty but still renders content", () => {
		const summary: ResumeData["summary"] = {
			title: "",
			icon: getDefaultSectionIconName("summary"),
			content: "<p>Hello world</p>",
			hidden: false,
			columns: 1,
			keepTogether: false,
			startOnNewPage: false,
		};
		const paragraphs = renderSummary(summary, HEX);
		expect(paragraphs.length).toBeGreaterThanOrEqual(1);
	});
});

const emptySection = <T extends SectionType>(type: T): ResumeData["sections"][T] =>
	({
		title: "Section",
		icon: getDefaultSectionIconName(type),
		columns: 1,
		hidden: false,
		keepTogether: false,
		startOnNewPage: false,
		items: [],
	}) as ResumeData["sections"][T];

describe("renderBuiltInSection", () => {
	it("returns [] when the section has no items", () => {
		expect(renderBuiltInSection("experience", emptySection("experience"), HEX)).toEqual([]);
	});

	it("returns [] when section.hidden is true", () => {
		const section = { ...emptySection("experience"), hidden: true };
		expect(renderBuiltInSection("experience", section, HEX)).toEqual([]);
	});

	it("returns [] for an unknown section type", () => {
		expect(renderBuiltInSection("not-a-section" as never, emptySection("experience"), HEX)).toEqual([]);
	});
});

describe("renderCustomSection", () => {
	const baseCustom: CustomSection = {
		id: "custom-1",
		type: "summary",
		title: "Notes",
		icon: getDefaultSectionIconName("summary"),
		columns: 1,
		hidden: false,
		keepTogether: false,
		startOnNewPage: false,
		items: [],
	};

	it("returns [] when the custom section is hidden", () => {
		expect(renderCustomSection({ ...baseCustom, hidden: true }, HEX)).toEqual([]);
	});

	it("returns [] when all items are hidden or empty", () => {
		const section: CustomSection = {
			...baseCustom,
			items: [{ id: "x", hidden: true } as never],
		};
		expect(renderCustomSection(section, HEX)).toEqual([]);
	});

	it("returns [] for an unknown custom section type", () => {
		const section: CustomSection = {
			...baseCustom,
			type: "no-such-type" as never,
			items: [{ id: "x", hidden: false, content: "<p>x</p>" } as never],
		};
		expect(renderCustomSection(section, HEX)).toEqual([]);
	});

	it("renders content for a summary-type custom section", () => {
		const section: CustomSection = {
			...baseCustom,
			type: "summary",
			items: [{ id: "x", hidden: false, content: "<p>Hello</p>" } as never],
		};
		const paragraphs = renderCustomSection(section, HEX);
		// 1 heading + at least one paragraph for the HTML
		expect(paragraphs.length).toBeGreaterThanOrEqual(2);
	});

	it("renders recipient + content for a cover-letter custom section", () => {
		const section: CustomSection = {
			...baseCustom,
			type: "cover-letter",
			title: "Cover Letter",
			items: [
				{
					id: "x",
					hidden: false,
					recipient: "<p>Dear Jane,</p>",
					content: "<p>Body</p>",
				} as never,
			],
		};
		const paragraphs = renderCustomSection(section, HEX);
		expect(paragraphs).toHaveLength(2);
	});
});

describe("setRenderConfig", () => {
	it("can be called repeatedly with a different config (no throw)", () => {
		expect(() => setRenderConfig({ ...baseConfig, headingFont: "Roboto", primaryColorHex: "ff0000" })).not.toThrow();

		// Restore for any later tests in the file
		setRenderConfig(baseConfig);
	});
});

type DocxNode = { rootKey?: string; root?: unknown };

const asNodes = (value: unknown): DocxNode[] => (Array.isArray(value) ? (value as DocxNode[]) : []);

const findNode = (node: unknown, rootKey: string): DocxNode | undefined => {
	if (!node || typeof node !== "object") return undefined;
	const candidate = node as DocxNode;
	if (candidate.rootKey === rootKey) return candidate;

	for (const child of asNodes(candidate.root)) {
		const found = findNode(child, rootKey);
		if (found) return found;
	}

	return undefined;
};

/**
 * Finds the run (`w:r`) whose text (`w:t`) is `text`, then reports whether it is bold.
 * The docx library emits `<w:b/>` with an empty body for bold, and `<w:b w:val="false"/>`
 * for explicitly-unbold, so an empty `w:b` body is the discriminator.
 */
const isRunBold = (paragraphs: readonly unknown[], text: string): boolean => {
	for (const paragraph of paragraphs) {
		for (const run of asNodes((paragraph as DocxNode).root)) {
			if (run.rootKey !== "w:r") continue;
			const textNode = findNode(run, "w:t");
			if (!asNodes(textNode?.root).some((part) => (part as unknown) === text)) continue;

			const boldNode = findNode(findNode(run, "w:rPr"), "w:b");
			return boldNode !== undefined && asNodes(boldNode.root).length === 0;
		}
	}

	throw new Error(`No run found containing the text "${text}"`);
};

// This fork renders main entry headings unbold by default and exposes a per-item "Bold"
// checkbox (`mainEntryBold`). DOCX export must agree with the PDF renderer, which reads
// `item.mainEntryBold ?? false` in packages/pdf/src/templates/shared/sections.tsx.
describe("mainEntryBold in DOCX export", () => {
	const itemSection = <T extends SectionType>(type: T, item: unknown): ResumeData["sections"][T] =>
		({ ...emptySection(type), items: [item] }) as ResumeData["sections"][T];

	const noWebsite = { url: "", label: "", inlineLink: false };
	const baseItem = { id: "item-1", hidden: false, website: noWebsite, description: "" };

	const cases = [
		{
			label: "experience company",
			type: "experience" as const,
			text: "Analytical Engines",
			item: { ...baseItem, company: "Analytical Engines", position: "Engineer", location: "", period: "", roles: [] },
		},
		{
			label: "experience company with role progression",
			type: "experience" as const,
			text: "Analytical Engines",
			item: {
				...baseItem,
				company: "Analytical Engines",
				position: "Engineer",
				location: "",
				period: "",
				roles: [{ id: "role-1", position: "Senior Engineer", period: "1843", description: "" }],
			},
		},
		{
			label: "education school",
			type: "education" as const,
			text: "University of London",
			item: {
				...baseItem,
				school: "University of London",
				degree: "BSc",
				area: "",
				grade: "",
				location: "",
				period: "",
			},
		},
		{
			label: "project name",
			type: "projects" as const,
			text: "Difference Engine",
			item: { ...baseItem, name: "Difference Engine", period: "" },
		},
		{
			label: "certification title",
			type: "certifications" as const,
			text: "Certified Analyst",
			item: { ...baseItem, title: "Certified Analyst", issuer: "Institute", date: "" },
		},
		{
			label: "skill name",
			type: "skills" as const,
			text: "Mathematics",
			item: { ...baseItem, name: "Mathematics", icon: "", iconColor: "", proficiency: "", level: 0, keywords: [] },
		},
	];

	it.each(cases)("leaves the $label unbold by default", ({ type, text, item }) => {
		const paragraphs = renderBuiltInSection(type, itemSection(type, item), HEX);

		expect(isRunBold(paragraphs, text)).toBe(false);
	});

	it.each(cases)("bolds the $label when mainEntryBold is enabled", ({ type, text, item }) => {
		const paragraphs = renderBuiltInSection(type, itemSection(type, { ...item, mainEntryBold: true }), HEX);

		expect(isRunBold(paragraphs, text)).toBe(true);
	});

	it("keeps headings without the toggle bold, and award titles unbold", () => {
		const publication = renderBuiltInSection(
			"publications",
			itemSection("publications", { ...baseItem, title: "On Computable Numbers", publisher: "LMS", date: "" }),
			HEX,
		);
		const reference = renderBuiltInSection(
			"references",
			itemSection("references", { ...baseItem, name: "Charles Babbage", role: "", email: "", phone: "" }),
			HEX,
		);
		const award = renderBuiltInSection(
			"awards",
			itemSection("awards", { ...baseItem, title: "Turing Award", awarder: "ACM", date: "" }),
			HEX,
		);

		expect(isRunBold(publication, "On Computable Numbers")).toBe(true);
		expect(isRunBold(reference, "Charles Babbage")).toBe(true);
		expect(isRunBold(award, "Turing Award")).toBe(false);
	});
});
