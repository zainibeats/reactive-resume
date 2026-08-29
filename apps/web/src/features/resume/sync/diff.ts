/**
 * Formatters that turn `resume.getSyncStatus` diffs — raw JSON Patch pointers and untyped
 * values — into something a resume author can read when reviewing updates from a parent resume.
 */

const MAX_VALUE_LENGTH = 120;

/** Segments that only describe the document's shape, never a field the author recognises. */
const STRUCTURAL_SEGMENTS = new Set(["sections", "items"]);

function decodePointerSegment(segment: string): string {
	return segment.replaceAll("~1", "/").replaceAll("~0", "~");
}

function titleCase(segment: string): string {
	const spaced = segment.replaceAll(/([a-z0-9])([A-Z])/g, "$1 $2").toLowerCase();
	return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function truncate(text: string): string {
	if (text.length <= MAX_VALUE_LENGTH) return text;
	return `${text.slice(0, MAX_VALUE_LENGTH - 1)}…`;
}

/**
 * Turns a JSON Pointer into a breadcrumb, e.g. `/sections/experience/items/2/company`
 * becomes `["Experience", "Item 3", "Company"]`.
 */
export function formatSyncDiffPath(path: string): string[] {
	if (!path.startsWith("/")) return [];

	const segments = path.slice(1).split("/").map(decodePointerSegment);

	return segments.flatMap((segment, index) => {
		if (STRUCTURAL_SEGMENTS.has(segment)) return [];

		if (/^\d+$/.test(segment)) {
			const noun = segments[index - 1] === "customSections" ? "Section" : "Item";
			return [`${noun} ${Number(segment) + 1}`];
		}

		return [titleCase(segment)];
	});
}

/** Renders a patched value as a short single-line preview, or `null` when there is nothing to show. */
export function formatSyncDiffValue(value: unknown): string | null {
	if (value === null || value === undefined) return null;

	if (Array.isArray(value)) return `${value.length} item${value.length === 1 ? "" : "s"}`;
	if (typeof value === "object") return truncate(JSON.stringify(value));

	if (typeof value === "string") {
		const text = value
			.replaceAll(/<[^>]*>/g, " ")
			.replaceAll(/\s+/g, " ")
			.trim();
		return text ? truncate(text) : null;
	}

	return String(value);
}
