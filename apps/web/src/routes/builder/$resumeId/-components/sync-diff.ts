import type { MessageDescriptor } from "@lingui/core";
import { i18n } from "@lingui/core";
import { msg } from "@lingui/core/macro";
import { createSectionTitleResolver } from "@/libs/resume/section-title";

export type SyncDiff = {
	op: "add" | "remove" | "replace" | "move" | "copy" | "test";
	path: string;
	from: string | null;
	hasPrevious: boolean;
	hasNext: boolean;
	previous: unknown | null;
	next: unknown | null;
	hasConflict: boolean;
};

type Translator = {
	_: (descriptor: MessageDescriptor) => string;
};

const fieldLabels = {
	basics: msg`Basics`,
	metadata: msg`Resume settings`,
	customSections: msg`Custom sections`,
	customFields: msg`Custom fields`,
	items: msg`Items`,
	roles: msg`Roles`,
	website: msg`Website`,
	page: msg`Page`,
	layout: msg`Layout`,
	typography: msg`Typography`,
	theme: msg`Theme`,
	css: msg`Custom CSS`,
	template: msg`Template`,
	name: msg`Name`,
	headline: msg`Headline`,
	email: msg`Email`,
	phone: msg`Phone`,
	location: msg`Location`,
	url: msg`URL`,
	label: msg`Label`,
	icon: msg`Icon`,
	iconColor: msg`Icon color`,
	text: msg`Text`,
	link: msg`Link`,
	title: msg`Title`,
	columns: msg`Columns`,
	hidden: msg`Hidden`,
	content: msg`Content`,
	company: msg`Company`,
	position: msg`Position`,
	period: msg`Period`,
	description: msg`Description`,
	school: msg`School`,
	degree: msg`Degree`,
	area: msg`Area of Study`,
	grade: msg`Grade`,
	organization: msg`Organization`,
	network: msg`Network`,
	username: msg`Username`,
	recipient: msg`Recipient`,
	keywords: msg`Keywords`,
	proficiency: msg`Proficiency`,
	level: msg`Level`,
	language: msg`Language`,
	fluency: msg`Fluency`,
	awarder: msg`Awarder`,
	issuer: msg`Issuer`,
	publisher: msg`Publisher`,
	date: msg`Date`,
	mainEntryBold: msg`Bold primary line`,
	inlineLink: msg`Show link in title`,
} satisfies Record<string, MessageDescriptor>;

const sectionTypes = new Set<string>([
	"summary",
	"profiles",
	"experience",
	"education",
	"projects",
	"skills",
	"languages",
	"interests",
	"awards",
	"certifications",
	"publications",
	"volunteer",
	"references",
	"cover-letter",
]);

function decodeJsonPointerSegment(segment: string): string {
	return segment.replaceAll("~1", "/").replaceAll("~0", "~");
}

function translateField(segment: string, translator: Translator): string {
	const descriptor = fieldLabels[segment as keyof typeof fieldLabels];
	return descriptor ? translator._(descriptor) || descriptor.message || segment : segment;
}

function translateSection(sectionId: string, translator: Translator): string {
	const resolveSectionTitle = createSectionTitleResolver(translator);

	return resolveSectionTitle({
		sectionId,
		locale: i18n.locale,
		sectionKind: "builtin",
		defaultEnglishTitle: sectionId,
	});
}

function formatArrayIndex(segment: string, translator: Translator): string | null {
	if (segment === "-") return translator._(msg`New item`) || "New item";

	const index = Number(segment);
	if (!Number.isInteger(index) || index < 0) return null;

	return `#${index + 1}`;
}

export function formatDiffPath(path: string, translator: Translator = i18n): string {
	if (path === "") return translator._(msg`Entire resume`) || "Entire resume";
	if (!path.startsWith("/")) return path;

	const segments = path.slice(1).split("/").map(decodeJsonPointerSegment);
	const labels: string[] = [];

	for (let index = 0; index < segments.length; index += 1) {
		const segment = segments[index];
		if (!segment) continue;

		if (segment === "sections") {
			const sectionId = segments[index + 1];
			if (sectionId) {
				labels.push(translateSection(sectionId, translator));
				index += 1;
			}
			continue;
		}

		if (sectionTypes.has(segment)) {
			labels.push(translateSection(segment, translator));
			continue;
		}

		if (index > 0) {
			const arrayIndexLabel = formatArrayIndex(segment, translator);
			if (arrayIndexLabel) {
				labels.push(arrayIndexLabel);
				continue;
			}
		}

		labels.push(translateField(segment, translator));
	}

	return labels.length > 0 ? labels.join(" / ") : path;
}

function stripHtml(value: string): string {
	return value
		.replace(/<br\s*\/?>/gi, "\n")
		.replace(/<\/(p|div|li|h[1-6])>/gi, "\n")
		.replace(/<[^>]*>/g, "")
		.replace(/&nbsp;/g, " ")
		.replace(/&amp;/g, "&")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/\n{3,}/g, "\n\n")
		.trim();
}

export function formatDiffValue(value: unknown, hasValue: boolean, translator: Translator = i18n): string {
	if (!hasValue) return translator._(msg`No value`) || "No value";
	if (typeof value === "string") {
		if (value.length === 0) return '""';
		const plainText = /<[^>]+>/.test(value) ? stripHtml(value) : value;
		return plainText.length > 0 ? plainText : value;
	}
	if (value === null) return "null";

	try {
		return JSON.stringify(value, null, 2);
	} catch {
		return String(value);
	}
}
