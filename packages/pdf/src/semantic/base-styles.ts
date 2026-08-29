import type { ResolvedNodeStyle, SemanticNode } from "@reactive-resume/resume/stylesheet";
import type { ResumeData } from "@reactive-resume/schema/resume/data";
import type { Template } from "@reactive-resume/schema/templates";
import { resolveBoldFontWeight } from "@reactive-resume/fonts";
import { resolveMainEntryBoldWeight } from "../templates/shared/base-template-styles";

export type BuildPdfBaseStylesInput = {
	data: ResumeData;
	template: Template;
	tree: SemanticNode;
};

const textKinds = new Set([
	"name",
	"headline",
	"section-heading",
	"combined-text",
	"field",
	"link",
	"rich-heading",
	"paragraph",
	"list-marker",
	"list-item-content",
	"strong",
	"emphasis",
	"underline",
	"strike",
	"code",
	"text-span",
	"mark",
	"hard-break",
]);

const headingKinds = new Set(["name", "section-heading", "rich-heading"]);

type SectionBreaks = {
	keepTogether?: boolean;
	startOnNewPage?: boolean;
};

type SectionWithItems = SectionBreaks & {
	items?: readonly { id: string; mainEntryBold?: boolean | undefined }[] | undefined;
};

const resolveSection = (data: ResumeData, id: string | undefined): SectionWithItems | undefined => {
	if (!id) return undefined;
	if (id === "summary") return data.summary;
	if (id in data.sections) return data.sections[id as keyof typeof data.sections];
	return data.customSections.find((section) => section.id === id);
};

/**
 * Heading fields that carry the per-item "Bold" toggle (`mainEntryBold`), by section type.
 *
 * Every other `primary-text` field is unconditionally bold, but these five render unbold by
 * default. The declared base weight has to follow the toggle so `revert` restores what the
 * template actually renders instead of snapping to the wrong weight.
 */
const MAIN_ENTRY_BOLD_FIELDS: Readonly<Record<string, string>> = {
	experience: "company",
	education: "school",
	projects: "name",
	certifications: "title",
	skills: "name",
};

/** Section/item ancestry carried down the tree walk so field nodes can find their own item. */
type ItemContext = {
	sectionId?: string | undefined;
	sectionType?: string | undefined;
	itemId?: string | undefined;
};

const isMainEntryBoldField = (node: SemanticNode, context: ItemContext): boolean =>
	context.sectionType !== undefined && MAIN_ENTRY_BOLD_FIELDS[context.sectionType] === node.attributes.name;

const isMainEntryBold = (data: ResumeData, context: ItemContext): boolean => {
	const items = resolveSection(data, context.sectionId)?.items;
	return items?.find((item) => item.id === context.itemId)?.mainEntryBold ?? false;
};

const pageSize = (format: ResumeData["metadata"]["page"]["format"]) => {
	if (format === "letter") return "LETTER" as const;
	if (format === "free-form") return { width: 595.28 };
	return "A4" as const;
};

export function buildPdfBaseStyles({
	data,
	tree,
}: BuildPdfBaseStylesInput): Readonly<Record<string, ResolvedNodeStyle>> {
	const result: Record<string, ResolvedNodeStyle> = {};
	const body = data.metadata.typography.body;
	const heading = data.metadata.typography.heading;
	const bodyWeight = body.fontWeights[0] ?? "400";
	// Bold must use the family's true Bold face when one exists; the last
	// stored weight is only a fallback (#3310).
	const boldWeight = resolveBoldFontWeight(body.fontFamily, body.fontWeights) ?? body.fontWeights.at(-1) ?? "600";
	const headingWeight = heading.fontWeights.at(-1) ?? "600";
	const mainEntryBoldWeight = resolveMainEntryBoldWeight(body.fontWeights);

	const resolveTextWeight = (node: SemanticNode, context: ItemContext) => {
		if (headingKinds.has(node.kind)) return headingWeight;
		if (isMainEntryBoldField(node, context)) {
			return isMainEntryBold(data, context) ? mainEntryBoldWeight : bodyWeight;
		}
		if (node.roles.includes("primary-text") || node.kind === "strong") return boldWeight;

		return bodyWeight;
	};

	const visit = (node: SemanticNode, context: ItemContext) => {
		const style: Record<string, string | number> = {};
		const structural: ResolvedNodeStyle["structural"] = {};

		if (node.kind === "page") {
			style.color = data.metadata.design.colors.text;
			style["background-color"] = data.metadata.design.colors.background;
			style["font-size"] = body.fontSize;
			style["font-weight"] = bodyWeight;
			style["line-height"] = body.lineHeight;
			structural.pageSize = pageSize(data.metadata.page.format);
		}

		if (textKinds.has(node.kind)) {
			style.color = data.metadata.design.colors.text;
			style["font-size"] = headingKinds.has(node.kind) ? heading.fontSize : body.fontSize;
			style["font-weight"] = resolveTextWeight(node, context);
			style["line-height"] = headingKinds.has(node.kind) ? heading.lineHeight : body.lineHeight;
		}

		if (node.kind === "link" || (node.kind === "contact-item" && node.roles.includes("structured-link"))) {
			style["text-decoration"] = data.metadata.page.hideLinkUnderline ? "none" : "underline";
		}

		if (node.kind === "picture") {
			Object.assign(style, {
				width: data.picture.size,
				height: data.picture.size,
				"object-fit": "cover",
				"aspect-ratio": data.picture.aspectRatio,
				"border-radius": data.picture.borderRadius,
				"border-color": data.picture.borderColor,
				"border-width": data.picture.borderWidth,
				"-resume-shadow-color": data.picture.shadowColor,
				"-resume-shadow-width": data.picture.shadowWidth,
				transform: `rotate(${data.picture.rotation}deg)`,
			});
		}

		if (node.kind === "section") {
			const section = resolveSection(data, node.id);
			if (section?.keepTogether) structural.breakInside = "avoid";
			if (section?.startOnNewPage) structural.breakBefore = "page";
		}

		result[node.key] = Object.freeze({
			style: Object.freeze(style),
			structural: Object.freeze(structural),
			hidden: false,
			order: 0,
		});

		const childContext =
			node.kind === "section"
				? { ...context, sectionId: node.id, sectionType: node.attributes.type }
				: node.kind === "item"
					? { ...context, itemId: node.id }
					: context;
		for (const child of node.children) visit(child, childContext);
	};

	visit(tree, {});
	return Object.freeze(result);
}
