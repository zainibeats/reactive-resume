import type { ResumeData } from "@reactive-resume/schema/resume/data";
import type { StylesheetMode } from "@reactive-resume/schema/resume/stylesheet";
import { describe, expect, it } from "vite-plus/test";
import { createElement } from "react";
import { defaultResumeData } from "@reactive-resume/schema/resume/default";
import { ResumeDocument } from "../../document";
import { pdf } from "../../forme/testing";

type HostNode = {
	type: string;
	style?: unknown;
	value?: string;
	children?: HostNode[];
};

const nodeText = (node: HostNode): string =>
	node.value ?? (node.children ?? []).map((child) => nodeText(child)).join("");

const findText = (node: HostNode, text: string): HostNode | undefined => {
	if (node.type === "TEXT" && nodeText(node) === text) return node;
	for (const child of node.children ?? []) {
		const match = findText(child, text);
		if (match) return match;
	}
};

const mergedStyle = (node: HostNode | undefined): Record<string, unknown> =>
	Object.assign({}, ...(Array.isArray(node?.style) ? node.style : node?.style ? [node.style] : []));

const experienceItem = (id: string, company: string, mainEntryBold: boolean, position = "Engineer") => ({
	id,
	hidden: false,
	company,
	mainEntryBold,
	position,
	location: "London",
	period: "1842",
	website: { url: "", label: "", inlineLink: false },
	description: "",
	roles: [],
});

const companyWeights = async (fontWeights: string[], mode: StylesheetMode, fontFamily = "IBM Plex Serif") => {
	const data = structuredClone(defaultResumeData) as ResumeData;
	data.picture.hidden = true;
	data.metadata.typography.body.fontFamily = fontFamily;
	data.metadata.typography.body.fontWeights =
		fontWeights as ResumeData["metadata"]["typography"]["body"]["fontWeights"];
	data.metadata.layout.pages = [{ fullWidth: true, main: ["experience"], sidebar: [] }];
	data.sections.experience.items = [
		experienceItem("bold", "Bolded Engines", true),
		experienceItem("unbold", "Plain Engines", false),
	];
	const stylesheet = { languageVersion: 1, text: "@version 1;" };
	data.metadata.stylesheet = { mode, source: stylesheet };

	const element = createElement(ResumeDocument, { data, template: "onyx" }) as unknown as Parameters<typeof pdf>[0];
	const instance = pdf(element);
	await expect.poll(() => instance.container.document).not.toBeNull();
	const document = instance.container.document as HostNode;

	return {
		bold: mergedStyle(findText(document, "Bolded Engines")).fontWeight,
		unbold: mergedStyle(findText(document, "Plain Engines")).fontWeight,
	};
};

describe.each(["legacy", "semantic"] as const)("mainEntryBold in %s mode", (mode) => {
	// The heaviest body weight is only 500 by default, which is barely distinguishable from the
	// body weight — checking "Bold" has to produce a real bold face instead.
	it("renders a bolded entry at a real bold weight", async () => {
		expect(await companyWeights(["400", "500"], mode)).toEqual({ bold: 700, unbold: "400" });
	});

	// A single selected weight used to make bold and unbold identical, so the toggle did nothing.
	it("stays bold when the author selected a single body weight", async () => {
		expect(await companyWeights(["400"], mode)).toEqual({ bold: 700, unbold: "400" });
	});

	// A heavier selection must not be dragged back down to 700. Inter carries an 800 face; IBM Plex
	// Serif stops at 700, and `registerFonts` would rewrite an unavailable weight before rendering.
	it("keeps a heavier authored weight", async () => {
		expect(await companyWeights(["400", "800"], mode, "Inter")).toEqual({ bold: 800, unbold: "400" });
	});
});

type EntryLayout = NonNullable<ResumeData["metadata"]["design"]["entry"]>["layout"];

/** Row order set to the role: the toggle follows the field the entry leads with, and the company drops to plain. */
const roleFirstWeights = async (layout: EntryLayout, mode: StylesheetMode) => {
	const data = structuredClone(defaultResumeData) as ResumeData;
	data.picture.hidden = true;
	data.metadata.typography.body.fontWeights = ["400", "500"];
	data.metadata.design.entry = { layout, lead: "role", accent: "none" };
	data.metadata.layout.pages = [{ fullWidth: true, main: ["experience"], sidebar: [] }];
	data.sections.experience.items = [
		experienceItem("bold", "Bolded Engines", true, "Lead Engineer"),
		experienceItem("unbold", "Plain Engines", false, "Staff Engineer"),
	];
	data.metadata.stylesheet = { mode, source: { languageVersion: 1, text: "@version 1;" } };

	const element = createElement(ResumeDocument, { data, template: "onyx" }) as unknown as Parameters<typeof pdf>[0];
	const instance = pdf(element);
	await expect.poll(() => instance.container.document).not.toBeNull();
	const document = instance.container.document as HostNode;
	const weight = (text: string) => mergedStyle(findText(document, text)).fontWeight;

	return {
		boldLead: weight("Lead Engineer"),
		boldCompany: weight("Bolded Engines"),
		plainLead: weight("Staff Engineer"),
		plainCompany: weight("Plain Engines"),
	};
};

describe.each(["legacy", "semantic"] as const)("mainEntryBold with role-first entries in %s mode", (mode) => {
	it.each(["stacked", "inline", "compact", "date-column"] as const)(
		"bolds the leading role in %s headers",
		async (layout) => {
			expect(await roleFirstWeights(layout, mode)).toEqual({
				boldLead: 700,
				boldCompany: "400",
				plainLead: "400",
				plainCompany: "400",
			});
		},
	);

	// The eyebrow line above the title is a bold small-caps label by design, so only the title follows the toggle.
	it("bolds the leading role in eyebrow headers", async () => {
		expect(await roleFirstWeights("eyebrow", mode)).toMatchObject({ boldLead: 700, plainLead: "400" });
	});
});
