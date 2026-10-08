import type { DocumentSummary } from "../../dto/documents";
import { ORPCError } from "@orpc/client";
import { and, count, eq, isNotNull, isNull, lt } from "drizzle-orm";
import { db } from "@reactive-resume/db/client";
import * as schema from "@reactive-resume/db/schema";
import { resumeService } from "../resume/service";

type DocumentRef = { userId: string; id: string };

// Trash keeps resumes this long before deleting them for good.
const TRASH_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

/** The resume's row, scoped to its owner. */
const owned = ({ id, userId }: DocumentRef) => and(eq(schema.resume.id, id), eq(schema.resume.userId, userId));

async function update(ref: DocumentRef, changes: Partial<typeof schema.resume.$inferInsert>) {
	const rows = await db.update(schema.resume).set(changes).where(owned(ref)).returning({ id: schema.resume.id });
	if (rows.length === 0) throw new ORPCError("NOT_FOUND");
}

async function readState(ref: DocumentRef) {
	const [row] = await db
		.select({ isLocked: schema.resume.isLocked, trashedAt: schema.resume.trashedAt })
		.from(schema.resume)
		.where(owned(ref));

	if (!row) throw new ORPCError("NOT_FOUND");
	return row;
}

async function assertUnlocked(ref: DocumentRef) {
	const state = await readState(ref);
	// The resume error code API and MCP clients already handle.
	if (state.isLocked) throw new ORPCError("RESUME_LOCKED", { status: 403 });
	return state;
}

/** Deletes for good through the resume's own path, so its stored files go too. */
const deleteForGood = (ref: DocumentRef) => resumeService.delete({ id: ref.id, userId: ref.userId });

const byTrash = (userId: string, trashed: boolean) =>
	and(eq(schema.resume.userId, userId), trashed ? isNotNull(schema.resume.trashedAt) : isNull(schema.resume.trashedAt));

export const documentsService = {
	/** Resumes trashed more than 30 days ago go for good. Runs only through the explicit authenticated cleanup operation. */
	purgeExpired: async (userId: string) => {
		const cutoff = new Date(Date.now() - TRASH_RETENTION_MS);
		const resumes = await db
			.select({ id: schema.resume.id })
			.from(schema.resume)
			.where(and(eq(schema.resume.userId, userId), lt(schema.resume.trashedAt, cutoff)));

		await Promise.allSettled(resumes.map(({ id }) => deleteForGood({ userId, id })));
	},

	/** Every live resume (or everything in Trash), newest edit first. The app filters and sorts them. */
	list: async (input: { userId: string; trashed: boolean }): Promise<DocumentSummary[]> => {
		const resumes = await db
			.select({
				id: schema.resume.id,
				name: schema.resume.name,
				tags: schema.resume.tags,
				isLocked: schema.resume.isLocked,
				trashedAt: schema.resume.trashedAt,
				createdAt: schema.resume.createdAt,
				updatedAt: schema.resume.updatedAt,
			})
			.from(schema.resume)
			.where(byTrash(input.userId, input.trashed));

		return resumes
			.map((row) => ({ type: "resume" as const, ...row }))
			.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
	},

	counts: async (input: { userId: string }) => {
		const [[live], [trashed]] = await Promise.all([
			db.select({ total: count() }).from(schema.resume).where(byTrash(input.userId, false)),
			db.select({ total: count() }).from(schema.resume).where(byTrash(input.userId, true)),
		]);

		return { resume: live?.total ?? 0, trash: trashed?.total ?? 0 };
	},

	/** A name typed by hand ends a blank resume's automatic naming. Locked resumes keep their details. */
	rename: async (input: DocumentRef & { name: string }) => {
		await assertUnlocked(input);
		await update(input, { name: input.name, autoName: false });
	},

	setTags: async (input: DocumentRef & { tags: string[] }) => {
		await assertUnlocked(input);
		await update(input, { tags: [...new Set(input.tags)] });
	},

	setLocked: (input: DocumentRef & { isLocked: boolean }) =>
		resumeService.setLocked({ id: input.id, userId: input.userId, isLocked: input.isLocked }),

	/** Undoable: Trash hides the resume and stops its public link; Restore brings it back intact. */
	trash: async (input: DocumentRef) => {
		await assertUnlocked(input);
		await update(input, { trashedAt: new Date() });
	},

	restore: (input: DocumentRef) => update(input, { trashedAt: null }),

	/** "Delete now…": only for resumes already in Trash. */
	purge: async (input: DocumentRef) => {
		const state = await readState(input);
		if (!state.trashedAt) throw new ORPCError("BAD_REQUEST", { message: "Move the document to Trash first." });
		await deleteForGood(input);
	},
};
