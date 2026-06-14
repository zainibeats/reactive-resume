import { createSelectSchema } from "drizzle-zod";
import z from "zod";
import * as schema from "@reactive-resume/db/schema";
import { jsonPatchOperationSchema } from "@reactive-resume/resume/patch";
import { resumeDataSchema } from "@reactive-resume/schema/resume/data";

const resumeSchema = createSelectSchema(schema.resume, {
	id: z.string().describe("The ID of the resume."),
	name: z.string().trim().min(1).describe("The name of the resume."),
	slug: z.string().trim().min(1).describe("The slug of the resume."),
	tags: z.array(z.string()).describe("The tags of the resume."),
	isPublic: z.boolean().describe("Whether the resume is public."),
	isLocked: z.boolean().describe("Whether the resume is locked."),
	password: z.string().trim().min(6).max(64).nullable().describe("The password of the resume, if any."),
	data: resumeDataSchema,
	revision: z.number().int().min(1).describe("The content revision of the resume."),
	parentId: z.string().nullable().describe("The parent resume ID, if this resume is derived from another resume."),
	parentRevision: z
		.number()
		.int()
		.min(1)
		.nullable()
		.describe("The parent revision this resume last synced from, if derived."),
	parentData: resumeDataSchema
		.nullable()
		.describe("The parent resume snapshot this resume last synced from, if derived."),
	userId: z.string().describe("The ID of the user who owns the resume."),
	createdAt: z.date().describe("The date and time the resume was created."),
	updatedAt: z.date().describe("The date and time the resume was last updated."),
});

const resumeOutputSchema = resumeSchema
	.omit({ password: true, userId: true, createdAt: true, parentData: true })
	.extend({ hasPassword: z.boolean() });

export const resumeDto = {
	list: {
		input: z
			.object({
				tags: z.array(z.string()).optional().default([]),
				sort: z.enum(["lastUpdatedAt", "createdAt", "name"]).optional().default("lastUpdatedAt"),
			})
			.optional()
			.default({ tags: [], sort: "lastUpdatedAt" }),
		output: z.array(resumeSchema.omit({ data: true, password: true, userId: true, parentData: true })),
	},

	getById: {
		input: resumeSchema.pick({ id: true }),
		output: resumeOutputSchema,
	},

	getBySlug: {
		input: z.object({ username: z.string(), slug: z.string() }),
		// `name` is the owner-chosen dashboard title and is intentionally redacted
		// to an empty string for non-owner viewers (see redactResumeForViewer in
		// features/resume/access-policy.ts). Relax the `min(1)` constraint here so
		// the redacted public response passes output validation.
		output: resumeSchema
			.omit({
				name: true,
				password: true,
				userId: true,
				createdAt: true,
				updatedAt: true,
				revision: true,
				parentId: true,
				parentRevision: true,
				parentData: true,
			})
			.extend({ name: z.string() }),
	},

	create: {
		input: resumeSchema
			.pick({ name: true, slug: true, tags: true })
			.extend({ withSampleData: z.boolean().default(false) }),
		output: z.string().describe("The ID of the created resume."),
	},

	import: {
		input: resumeSchema.pick({ data: true }),
		output: z.string().describe("The ID of the imported resume."),
	},

	update: {
		input: resumeSchema
			.pick({ name: true, slug: true, tags: true, data: true, isPublic: true })
			.partial()
			.extend({ id: z.string() }),
		output: resumeOutputSchema,
	},

	setLocked: {
		input: resumeSchema.pick({ id: true, isLocked: true }),
		output: z.void(),
	},

	setPassword: {
		input: resumeSchema.pick({ id: true }).extend({ password: z.string().min(6).max(64) }),
		output: z.void(),
	},

	removePassword: {
		input: resumeSchema.pick({ id: true }),
		output: z.void(),
	},

	patch: {
		input: z.object({
			id: z.string().describe("The ID of the resume to patch."),
			expectedUpdatedAt: z.coerce
				.date()
				.optional()
				.describe("If provided, the patch only applies when the resume version still matches this timestamp."),
			operations: z
				.array(jsonPatchOperationSchema)
				.min(1)
				.describe("An array of JSON Patch (RFC 6902) operations to apply to the resume data."),
		}),
		output: resumeOutputSchema,
	},

	duplicate: {
		input: resumeSchema.pick({ id: true, name: true, slug: true, tags: true }),
		output: z.string().describe("The ID of the duplicated resume."),
	},

	createDerived: {
		input: resumeSchema.pick({ id: true, name: true, slug: true, tags: true }),
		output: z.string().describe("The ID of the derived resume."),
	},

	getSyncStatus: {
		input: resumeSchema.pick({ id: true }),
		output: z.object({
			hasParent: z.boolean(),
			parent: z
				.object({
					id: z.string(),
					name: z.string(),
					revision: z.number().int().min(1),
					updatedAt: z.date(),
				})
				.nullable(),
			childRevision: z.number().int().min(1),
			lastSyncedParentRevision: z.number().int().min(1).nullable(),
			isBehind: z.boolean(),
			operationCount: z.number().int().min(0),
			operations: z.array(jsonPatchOperationSchema),
			conflicts: z.array(z.string()),
			hasConflicts: z.boolean(),
		}),
	},

	applyParentUpdates: {
		input: resumeSchema.pick({ id: true }).extend({ force: z.boolean().optional().default(false) }),
		output: resumeOutputSchema,
	},

	dismissParentUpdates: {
		input: resumeSchema.pick({ id: true }),
		output: resumeOutputSchema,
	},

	delete: {
		input: resumeSchema.pick({ id: true }),
		output: z.void(),
	},
};
