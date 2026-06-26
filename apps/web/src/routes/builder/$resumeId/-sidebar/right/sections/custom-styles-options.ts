import type {
	ResumeData,
	StyleIntent,
	StyleRule,
	StyleRuleTarget,
	StyleSlot,
} from "@reactive-resume/schema/resume/data";
import type { ComboboxOption } from "@/components/ui/combobox";
import { sectionTypeSchema } from "@reactive-resume/schema/resume/data";
import { getSectionTitle } from "@/libs/resume/section";

export type TargetScope = StyleRuleTarget["scope"];

type StyleSlotOption = {
	value: StyleSlot;
	label: string;
	group: "Section" | "Rich text";
};

export const targetScopeOptions: ComboboxOption<TargetScope>[] = [
	{ value: "global", label: "All sections" },
	{ value: "sectionType", label: "Section type" },
	{ value: "sectionId", label: "Specific section" },
];

const styleSlotOptions: StyleSlotOption[] = [
	{ value: "section", label: "Section container", group: "Section" },
	{ value: "heading", label: "Section heading", group: "Section" },
	{ value: "item", label: "Item container", group: "Section" },
	{ value: "text", label: "Primary text", group: "Section" },
	{ value: "secondaryText", label: "Secondary text", group: "Section" },
	{ value: "link", label: "Link", group: "Section" },
	{ value: "icon", label: "Icon", group: "Section" },
	{ value: "level", label: "Level indicator", group: "Section" },
	{ value: "richParagraph", label: "Paragraph", group: "Rich text" },
	{ value: "richList", label: "List", group: "Rich text" },
	{ value: "richListItemRow", label: "List item row", group: "Rich text" },
	{ value: "richListItemContent", label: "List item content", group: "Rich text" },
	{ value: "richLink", label: "Inline link", group: "Rich text" },
	{ value: "richBold", label: "Bold text", group: "Rich text" },
	{ value: "richMark", label: "Highlight", group: "Rich text" },
];

export const styleSlotComboboxOptions: ComboboxOption<StyleSlot>[] = styleSlotOptions.map((option) => ({
	value: option.value,
	label: option.label,
	group: option.group,
	keywords: [option.group],
}));

export const fontWeightOptions = ["100", "200", "300", "400", "500", "600", "700", "800", "900"] as const;
export const fontStyleOptions = [
	{ value: "normal", label: "Normal" },
	{ value: "italic", label: "Italic" },
] as const satisfies readonly { value: NonNullable<StyleIntent["fontStyle"]>; label: string }[];
export const textDecorationOptions = [
	{ value: "none", label: "None" },
	{ value: "underline", label: "Underline" },
	{ value: "line-through", label: "Line through" },
] as const satisfies readonly { value: NonNullable<StyleIntent["textDecoration"]>; label: string }[];
export const textDecorationStyleOptions = [
	{ value: "solid", label: "Solid" },
	{ value: "dashed", label: "Dashed" },
	{ value: "dotted", label: "Dotted" },
] as const satisfies readonly { value: NonNullable<StyleIntent["textDecorationStyle"]>; label: string }[];
export const textAlignOptions = [
	{ value: "left", label: "Left" },
	{ value: "center", label: "Center" },
	{ value: "right", label: "Right" },
	{ value: "justify", label: "Justify" },
] as const satisfies readonly { value: NonNullable<StyleIntent["textAlign"]>; label: string }[];
export const textTransformOptions = [
	{ value: "none", label: "None" },
	{ value: "uppercase", label: "Uppercase" },
	{ value: "lowercase", label: "Lowercase" },
	{ value: "capitalize", label: "Capitalize" },
] as const satisfies readonly { value: NonNullable<StyleIntent["textTransform"]>; label: string }[];
export const borderStyleOptions = [
	{ value: "solid", label: "Solid" },
	{ value: "dashed", label: "Dashed" },
	{ value: "dotted", label: "Dotted" },
] as const satisfies readonly { value: NonNullable<StyleIntent["borderStyle"]>; label: string }[];

export type StringIntentProperty = {
	[K in keyof StyleIntent]-?: NonNullable<StyleIntent[K]> extends string ? K : never;
}[keyof StyleIntent];

export type NumberIntentProperty = {
	[K in keyof StyleIntent]-?: NonNullable<StyleIntent[K]> extends number ? K : never;
}[keyof StyleIntent];

export type ColorIntentField = {
	property: StringIntentProperty;
	label: string;
	idSuffix: string;
	placeholder: string;
	fallback: string;
};

export type NumberIntentField = {
	property: NumberIntentProperty;
	label: string;
	idSuffix: string;
	min: number;
	max: number;
	step?: number;
};

export type SelectIntentField<TValue extends string = string> = {
	property: StringIntentProperty;
	label: string;
	idSuffix: string;
	options: readonly ComboboxOption<TValue>[];
};

export const colorIntentFields = [
	{
		property: "color",
		label: "Text Color",
		idSuffix: "color",
		placeholder: "rgba(0, 0, 0, 1)",
		fallback: "rgba(0, 0, 0, 1)",
	},
	{
		property: "backgroundColor",
		label: "Background",
		idSuffix: "background",
		placeholder: "rgba(255, 255, 255, 1)",
		fallback: "rgba(255, 255, 255, 1)",
	},
	{
		property: "textDecorationColor",
		label: "Text Decoration Color",
		idSuffix: "text-decoration-color",
		placeholder: "rgba(0, 0, 0, 1)",
		fallback: "rgba(0, 0, 0, 1)",
	},
] as const satisfies readonly ColorIntentField[];

export const textNumberIntentFields = [
	{ property: "fontSize", label: "Font Size", idSuffix: "font-size", min: 6, max: 48, step: undefined },
	{ property: "lineHeight", label: "Line Height", idSuffix: "line-height", min: 0.5, max: 4, step: 0.05 },
	{ property: "letterSpacing", label: "Letter Spacing", idSuffix: "letter-spacing", min: -16, max: 16, step: 0.1 },
] as const satisfies readonly NumberIntentField[];

export const textSelectIntentFields = [
	{ property: "fontStyle", label: "Font Style", idSuffix: "font-style", options: fontStyleOptions },
	{
		property: "textDecoration",
		label: "Text Decoration",
		idSuffix: "text-decoration",
		options: textDecorationOptions,
	},
	{
		property: "textDecorationStyle",
		label: "Decoration Style",
		idSuffix: "text-decoration-style",
		options: textDecorationStyleOptions,
	},
	{ property: "textAlign", label: "Text Align", idSuffix: "text-align", options: textAlignOptions },
	{
		property: "textTransform",
		label: "Text Transform",
		idSuffix: "text-transform",
		options: textTransformOptions,
	},
] as const satisfies readonly SelectIntentField[];

export const borderNumberIntentFields = [
	{ property: "borderWidth", label: "Border Width", idSuffix: "border-width", min: 0, max: 24, step: undefined },
	{ property: "borderRadius", label: "Border Radius", idSuffix: "border-radius", min: 0, max: 72, step: undefined },
] as const satisfies readonly NumberIntentField[];

export const borderColorIntentField = {
	property: "borderColor",
	label: "Border Color",
	idSuffix: "border-color",
	placeholder: "rgba(0, 0, 0, 1)",
	fallback: "rgba(0, 0, 0, 1)",
} as const satisfies ColorIntentField;

export function getSectionTypeOptions(): ComboboxOption<string>[] {
	return sectionTypeSchema.options.map((type) => ({
		value: type,
		label: getSectionTitle(type),
	}));
}

export const paddingSideOptions = [
	{ property: "paddingTop", label: "Top" },
	{ property: "paddingRight", label: "Right" },
	{ property: "paddingBottom", label: "Bottom" },
	{ property: "paddingLeft", label: "Left" },
] as const;

export type PaddingSideProperty = (typeof paddingSideOptions)[number]["property"];

export const marginSideOptions = [
	{ property: "marginTop", label: "Top" },
	{ property: "marginRight", label: "Right" },
	{ property: "marginBottom", label: "Bottom" },
	{ property: "marginLeft", label: "Left" },
] as const;

export type MarginSideProperty = (typeof marginSideOptions)[number]["property"];

type CreateTargetParams = {
	targetScope: TargetScope;
	sectionType: string;
	sectionId: string;
};

export function createTarget({ targetScope, sectionType, sectionId }: CreateTargetParams): StyleRuleTarget {
	if (targetScope === "sectionType") {
		return {
			scope: "sectionType",
			sectionType: sectionType as Extract<StyleRuleTarget, { scope: "sectionType" }>["sectionType"],
		};
	}
	if (targetScope === "sectionId") return { scope: "sectionId", sectionId };

	return { scope: "global" };
}

export function getStyleRuleId(target: StyleRuleTarget, slot: StyleSlot) {
	if (target.scope === "global") return `style-global-${slot}`;
	if (target.scope === "sectionType") return `style-section-type-${target.sectionType}-${slot}`;

	return `style-section-id-${slugify(target.sectionId)}-${slot}`;
}

export function getSlotLabel(slot: StyleSlot) {
	return styleSlotOptions.find((option) => option.value === slot)?.label ?? slot;
}

export function getTargetLabel(data: ResumeData, target: StyleRuleTarget) {
	if (target.scope === "global") return "All sections";
	if (target.scope === "sectionType") return getSectionTitle(target.sectionType);

	return getSectionIdOptions(data).find((option) => option.value === target.sectionId)?.label ?? target.sectionId;
}

export function getRuleFallbackLabel(data: ResumeData, rule: StyleRule) {
	const slots = getConfiguredSlots(rule);
	const slot = slots[0];
	return `${getTargetLabel(data, rule.target)}${slot ? `: ${getSlotLabel(slot)}` : ""}`;
}

export function getConfiguredSlots(rule: StyleRule): StyleSlot[] {
	const slots: StyleSlot[] = [];

	for (const option of styleSlotOptions) {
		if (hasIntent(rule.slots[option.value])) slots.push(option.value);
	}

	return slots;
}

export function getSectionIdOptions(data: ResumeData) {
	return [
		{ value: "summary", label: data.summary?.title || getSectionTitle("summary") },
		...Object.entries(data.sections).map(([section, value]) => ({
			value: section,
			label: value.title || getSectionTitle(section as keyof ResumeData["sections"]),
		})),
		...data.customSections.map((section) => ({
			value: section.id,
			label: section.title || getSectionTitle(section.type),
		})),
	];
}

export function compactIntent(intent: Partial<StyleIntent>): StyleIntent {
	return Object.fromEntries(
		Object.entries(intent).filter(([, value]) => value !== undefined && value !== ""),
	) as StyleIntent;
}

export function getPaddingSideValue(intent: StyleIntent, property: PaddingSideProperty) {
	return intent[property] ?? intent.padding;
}

export function createPaddingSidePatch(
	intent: StyleIntent,
	property: PaddingSideProperty,
	value: number | undefined,
): Partial<StyleIntent> {
	if (intent.padding === undefined) return { [property]: value };

	const patch: Partial<StyleIntent> = { padding: undefined };

	for (const side of paddingSideOptions) {
		patch[side.property] = intent[side.property] ?? intent.padding;
	}

	patch[property] = value;

	return patch;
}

export function createMarginSidePatch(property: MarginSideProperty, value: number | undefined): Partial<StyleIntent> {
	return { [property]: value };
}

export function createStringIntentPatch(
	property: StringIntentProperty,
	value: string | undefined,
): Partial<StyleIntent> {
	return { [property]: value };
}

export function createNumberIntentPatch(
	property: NumberIntentProperty,
	value: number | undefined,
): Partial<StyleIntent> {
	return { [property]: value };
}

export function getPaddingSummary(intent: StyleIntent) {
	if (intent.padding !== undefined) return `All ${intent.padding}`;

	const sideValues = paddingSideOptions.flatMap((side) => {
		const value = intent[side.property];
		if (value === undefined) return [];

		return [`${side.label.at(0)} ${value}`];
	});

	return sideValues.length > 0 ? sideValues.join(" / ") : undefined;
}

export function getMarginSummary(intent: StyleIntent) {
	const sideValues = marginSideOptions.flatMap((side) => {
		const value = intent[side.property];
		if (value === undefined) return [];

		return [`${side.label.at(0)} ${value}`];
	});

	return sideValues.length > 0 ? sideValues.join(" / ") : undefined;
}

export function getGapSummary(intent: StyleIntent) {
	const values = [
		intent.rowGap !== undefined && `Row ${intent.rowGap}`,
		intent.columnGap !== undefined && `Column ${intent.columnGap}`,
	].filter(Boolean);

	return values.length > 0 ? values.join(" / ") : undefined;
}

function hasIntent(intent: StyleIntent | undefined) {
	return Boolean(intent && Object.keys(intent).length > 0);
}

function slugify(value: string) {
	return value
		.replace(/[^a-zA-Z0-9]+/g, "-")
		.replace(/(^-|-$)/g, "")
		.toLowerCase();
}
