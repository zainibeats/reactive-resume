import type { ResolvedNodeStyle, SemanticNode } from "@reactive-resume/resume/stylesheet";
import type { ResumeData } from "@reactive-resume/schema/resume/data";
import type { Template } from "@reactive-resume/schema/templates";
import { resolveBoldFontWeight } from "@reactive-resume/fonts";
import { entryHeaderOf } from "@reactive-resume/schema/resume/data";
import { findSection } from "../section-title";
import { resolveMainEntryBoldWeight } from "../templates/shared/base-template-styles";
import { leadsWithRole } from "../templates/shared/entry-header";
import { getTemplatePageSize } from "../templates/shared/page-size";

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

type SectionItemFields = { id: string; mainEntryBold?: boolean | undefined } & Readonly<Record<string, unknown>>;

type SectionWithItems = SectionBreaks & {
	items?: readonly SectionItemFields[] | undefined;
};

const resolveSection = (data: ResumeData, id: string | undefined): SectionWithItems | undefined =>
	id ? findSection(data, id) : undefined;

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

/** With Design → Entries → Row order set to the role, the toggle moves to the role field these entries lead with. */
const MAIN_ENTRY_ROLE_FIELDS: Readonly<Record<string, string>> = {
	experience: "position",
	education: "area",
};

/** Section/item ancestry carried down the tree walk so field nodes can find their own item. */
type ItemContext = {
	sectionId?: string | undefined;
	sectionType?: string | undefined;
	itemId?: string | undefined;
};

const findItem = (data: ResumeData, context: ItemContext): SectionItemFields | undefined =>
	resolveSection(data, context.sectionId)?.items?.find((item) => item.id === context.itemId);

/**
 * How a field's weight follows the toggle: `toggle` for the field the entry leads with, `plain` for an organization
 * that a role-first entry demotes to its second row (drawn unbold), and `undefined` for every other field.
 */
const mainEntryRole = (data: ResumeData, node: SemanticNode, context: ItemContext): "toggle" | "plain" | undefined => {
	const { sectionType } = context;
	if (sectionType === undefined) return undefined;
	const organizationField = MAIN_ENTRY_BOLD_FIELDS[sectionType];
	const roleField = MAIN_ENTRY_ROLE_FIELDS[sectionType];
	const name = node.attributes.name;
	if (name !== organizationField && (roleField === undefined || name !== roleField)) return undefined;
	const item = findItem(data, context);
	const roleFirst =
		roleField !== undefined &&
		item !== undefined &&
		leadsWithRole(entryHeaderOf(data.metadata.design).lead, sectionType, item);
	if (name === organizationField) return roleFirst ? "plain" : "toggle";
	return roleFirst ? "toggle" : undefined;
};

const isMainEntryBold = (data: ResumeData, context: ItemContext): boolean =>
	findItem(data, context)?.mainEntryBold ?? false;

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
		const entryRole = mainEntryRole(data, node, context);
		if (entryRole === "plain") return bodyWeight;
		if (entryRole === "toggle") return isMainEntryBold(data, context) ? mainEntryBoldWeight : bodyWeight;
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
			structural.pageSize = getTemplatePageSize(data.metadata.page.format);
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
