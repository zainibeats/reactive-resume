import z from "zod";
import { paginationShape } from "../pagination";

const documentTypeSchema = z.literal("resume").describe("Always resume: the library holds resumes only.");
const documentRefSchema = z.object({
	type: documentTypeSchema,
	id: z.string().min(1).describe("The ID of the resume."),
});

const documentSchema = z.object({
	type: documentTypeSchema,
	id: z.string(),
	name: z.string(),
	tags: z.array(z.string()),
	isLocked: z.boolean(),
	trashedAt: z.date().nullable().describe("When the resume moved to Trash; null while it's live."),
	createdAt: z.date(),
	updatedAt: z.date(),
});

export type DocumentSummary = z.infer<typeof documentSchema>;

export const documentsDto = {
	list: {
		input: z
			.object({
				...paginationShape,
				trashed: z.boolean().default(false).describe("List the resumes in Trash instead."),
			})
			.default({ trashed: false }),
		output: z.array(documentSchema),
	},
	counts: {
		input: z.void(),
		output: z.object({ resume: z.number(), trash: z.number() }),
	},
	rename: {
		input: documentRefSchema.extend({ name: z.string().trim().min(1).max(100) }),
		output: z.void(),
	},
	setTags: {
		input: documentRefSchema.extend({ tags: z.array(z.string().trim().min(1).max(40)).max(20) }),
		output: z.void(),
	},
	setLocked: {
		input: documentRefSchema.extend({ isLocked: z.boolean() }),
		output: z.void(),
	},
	trash: { input: documentRefSchema, output: z.void() },
	restore: { input: documentRefSchema, output: z.void() },
	purge: { input: documentRefSchema, output: z.void() },
};
