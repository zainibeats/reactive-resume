import type { RouterOutput } from "@/libs/orpc/client";

export type DocumentSummary = RouterOutput["documents"]["list"][number];
export type DocumentSort = "edited" | "name" | "created";

type DocumentFilters = { q: string; tags: readonly string[]; sort: DocumentSort };

const byName = new Intl.Collator(undefined, { sensitivity: "base", numeric: true });

/** Search covers titles and tags; every chosen tag must be on the document. */
export function filterDocuments(documents: readonly DocumentSummary[], filters: DocumentFilters) {
	const query = filters.q.trim().toLocaleLowerCase();

	return documents
		.filter((document) => filters.tags.every((tag) => document.tags.includes(tag)))
		.filter((document) => {
			if (!query) return true;
			return [document.name, ...document.tags].some((text) => text.toLocaleLowerCase().includes(query));
		})
		.sort((a, b) => {
			if (filters.sort === "name") return byName.compare(a.name, b.name);
			if (filters.sort === "created") return b.createdAt.getTime() - a.createdAt.getTime();
			return b.updatedAt.getTime() - a.updatedAt.getTime();
		});
}

/** Every tag in use, alphabetically; the tag chips appear only when there are some. */
export const collectTags = (documents: readonly DocumentSummary[]) =>
	[...new Set(documents.flatMap((document) => document.tags))].sort(byName.compare);

/** Days until a document in Trash is deleted for good (at least 0). */
export function daysLeftInTrash(trashedAt: Date, now = Date.now()) {
	const left = trashedAt.getTime() + 30 * 24 * 60 * 60 * 1000 - now;
	return Math.max(0, Math.ceil(left / (24 * 60 * 60 * 1000)));
}
