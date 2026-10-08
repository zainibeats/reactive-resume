/**
 * Canonical tool metadata (title, description, inputSchema, annotations) declared once.
 * Consumed by both `registerTools` (raw Zod) and `buildMcpServerCard` (toJsonSchemaCompat).
 */
import type { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import z from "zod";
import { resumePatchOperationsSchema } from "@reactive-resume/ai/tools/resume-tool-contracts";
import { resumeDto } from "@reactive-resume/api/dto/resume";
import { toWireObjectSchema, toWireSchema } from "./contracts";
import { MCP_TOOL_NAME as T } from "./mcp-tool-names";

const READ_IDEMPOTENT: ToolAnnotations = {
	readOnlyHint: true,
	destructiveHint: false,
	idempotentHint: true,
	openWorldHint: false,
};
const READ_NON_IDEMPOTENT: ToolAnnotations = {
	readOnlyHint: true,
	destructiveHint: false,
	idempotentHint: false,
	openWorldHint: false,
};
const WRITE_NON_IDEMPOTENT: ToolAnnotations = {
	readOnlyHint: false,
	destructiveHint: false,
	idempotentHint: false,
	openWorldHint: false,
};
const WRITE_DESTRUCTIVE: ToolAnnotations = {
	readOnlyHint: false,
	destructiveHint: true,
	idempotentHint: false,
	openWorldHint: false,
};
const WRITE_IDEMPOTENT: ToolAnnotations = {
	readOnlyHint: false,
	destructiveHint: false,
	idempotentHint: true,
	openWorldHint: false,
};

// ponytail: shared schema fragment; exported so server-card can re-use without re-importing
const resumeIdSchema = z.string().min(1).describe(`Resume ID. Use \`${T.listResumes}\` to find valid IDs.`);

// SDK discovery requires pure JSON schemas; API handlers still validate native DTOs.
function wireInput<T extends z.ZodObject>(schema: T): T {
	const wire = toWireSchema(schema, "input");
	if (!(wire instanceof z.ZodObject)) throw new Error("MCP tool input must be an object.");
	return wire as T;
}

const messageOutput = z.object({ message: z.string() });
const idOutput = z.object({ id: z.string() });

const BASE_TOOL_META = {
	[T.listResumes]: {
		title: "List Resumes",
		description: [
			"Primary way to discover resume IDs for this account. Resumes are not listed as MCP resources;",
			"use this tool (not `resources/list`) to enumerate IDs.",
			"",
			"Returns an array of resume objects (without full resume data) containing:",
			"id, name, slug, tags, isPublic, isLocked, createdAt, updatedAt.",
			"",
			`Call this before \`${T.getResume}\`, \`${T.patchResume}\`, prompts, or \`resources/read\` with \`resume://{id}\`.`,
			"Results can be filtered by tags and sorted by last updated date, creation date, or name.",
		].join("\n"),
		outputSchema: toWireObjectSchema(resumeDto.list.output),
		inputSchema: wireInput(
			z.strictObject({
				tags: z
					.array(z.string())
					.optional()
					.default([])
					.describe(
						"Filter resumes by tags. Only resumes matching ALL specified tags are returned. Default: no filter.",
					),
				sort: z
					.enum(["lastUpdatedAt", "createdAt", "name"])
					.optional()
					.default("lastUpdatedAt")
					.describe("Sort order for results. Default: lastUpdatedAt."),
			}),
		),
		annotations: READ_IDEMPOTENT,
	},
	[T.listResumeTags]: {
		title: "List Resume Tags",
		description: [
			"Returns a sorted list of every distinct tag used across your resumes.",
			"Useful for choosing tag filters when calling list tools or keeping naming consistent.",
		].join("\n"),
		outputSchema: z.object({ items: z.array(z.string()) }),
		inputSchema: wireInput(z.strictObject({})),
		annotations: READ_IDEMPOTENT,
	},
	[T.getResume]: {
		title: "Read Resume",
		description: [
			"Get the full data of a specific resume by its ID.",
			"",
			"Returns the complete resume data as JSON, including: basics (name, headline, email, phone,",
			"location, website), summary, picture settings, all sections (experience, education, skills,",
			"projects, etc.), custom sections, and metadata (template, layout, typography, colors).",
			"",
			`Use \`${T.listResumes}\` first to find valid IDs.`,
			"The `resume://_meta/schema` resource describes the full data structure for JSON Patch paths.",
		].join("\n"),
		outputSchema: toWireObjectSchema(resumeDto.getById.output),
		inputSchema: wireInput(z.strictObject({ id: resumeIdSchema })),
		annotations: READ_IDEMPOTENT,
	},
	[T.downloadResumePdf]: {
		title: "Download Resume PDF",
		description: [
			"Create a short-lived authenticated URL for downloading a resume as a PDF.",
			"The URL expires in 10 minutes. Anyone holding this URL can download the PDF until expiry; keep it private.",
			"Returns JSON containing: resumeId, name, downloadUrl, expiresAt, expiresInSeconds, contentType.",
			`Use \`${T.listResumes}\` first to find valid IDs.`,
		].join("\n"),
		outputSchema: z.object({
			resumeId: z.string(),
			name: z.string(),
			downloadUrl: z.url(),
			expiresAt: z.iso.datetime({ offset: true }),
			expiresInSeconds: z.number().int().positive(),
			contentType: z.literal("application/pdf"),
		}),
		inputSchema: wireInput(z.strictObject({ id: resumeIdSchema })),
		annotations: READ_NON_IDEMPOTENT,
	},
	[T.createResume]: {
		title: "Create Resume",
		description: [
			"Create a new, empty resume with a name. Its URL-friendly slug is generated when omitted.",
			"",
			"Returns the ID of the newly created resume.",
			"Set `withSampleData` to true to pre-fill with example content (useful for testing).",
			`After creating, use \`${T.getResume}\` to view or \`${T.patchResume}\` to populate it.`,
		].join("\n"),
		outputSchema: idOutput,
		inputSchema: wireInput(
			z.strictObject({
				name: z.string().min(1).max(64).describe("Display name for the resume (e.g. 'Software Engineer 2026')"),
				slug: z
					.string()
					.min(1)
					.max(64)
					.optional()
					.describe("Optional URL-friendly slug; generated from the name when omitted."),
				tags: z
					.array(z.string())
					.optional()
					.default([])
					.describe("Tags to categorize the resume (e.g. ['tech', 'senior'])"),
				withSampleData: z.boolean().optional().default(false).describe("Pre-fill with sample data. Default: false."),
			}),
		),
		annotations: WRITE_NON_IDEMPOTENT,
	},
	[T.importResume]: {
		title: "Import Resume",
		description: [
			"Create a new resume from a full ResumeData JSON object (e.g. an exported file from Reactive Resume).",
			"A random name and slug are assigned automatically, like the web importer.",
			`For small edits to an existing resume, prefer \`${T.patchResume}\` instead of re-importing.`,
			"Large payloads may exceed MCP client message limits; in that case, use the web UI or the HTTP API.",
		].join("\n"),
		outputSchema: idOutput,
		inputSchema: wireInput(
			z.strictObject({
				data: z
					.unknown()
					.describe("Complete ResumeData JSON (same shape as `read_resume` body or `resume://_meta/schema`)."),
			}),
		),
		annotations: WRITE_NON_IDEMPOTENT,
	},
	[T.duplicateResume]: {
		title: "Duplicate Resume",
		description: [
			"Create a copy of an existing resume with all its data.",
			"",
			"Returns the ID of the newly duplicated resume.",
			"Name and tags default to the original; a unique slug is generated when omitted.",
			"Useful for creating job-specific variants of a base resume.",
		].join("\n"),
		outputSchema: idOutput,
		inputSchema: wireInput(
			z.strictObject({
				id: resumeIdSchema.describe("ID of the resume to duplicate"),
				name: z.string().min(1).max(64).optional().describe("Name for the duplicate; defaults to the original"),
				slug: z.string().min(1).max(64).optional().describe("Optional unique slug; generated when omitted"),
				tags: z.array(z.string()).optional().describe("Tags for the duplicate; defaults to the original"),
			}),
		),
		annotations: WRITE_NON_IDEMPOTENT,
	},
	[T.patchResume]: {
		title: "Apply Resume Patch",
		description: [
			"Apply JSON Patch (RFC 6902) operations to partially update a resume's data.",
			"",
			`This is the primary way to edit resume content. Use \`${T.getResume}\` first to inspect the`,
			"current structure, and `resume://_meta/schema` to understand valid paths and types.",
			"",
			"Supported operations: add, remove, replace, move, copy, test.",
			"Can remove or overwrite existing content; edits to a public resume change its published content.",
			"",
			"Common path examples:",
			"  /basics/name                          — Change the name",
			"  /basics/headline                      — Change the headline",
			"  /summary/content                      — Replace summary (HTML string)",
			"  /sections/experience/items/-           — Append a new experience item",
			"  /sections/experience/items/0/company   — Update first experience's company",
			"  /sections/skills/items/-               — Append a new skill",
			"  /metadata/template                     — Change the template (e.g. 'azurill', 'bronzor', 'onyx')",
			"  /metadata/design/colors/primary        — Change the primary color (rgba string)",
			"  /sections/interests/hidden              — Hide/show a section",
			"  /sections/experience/items/0/dates      — Set dates: { start, end, present } with years or",
			"                                            year-months ('2022' or '2022-03')",
			"",
			"Dates: write `dates`; the text in `period` (or `date` for awards, certifications and",
			"publications) is rewritten from it in the resume's locale, so an edit to the text alone is lost.",
			"Important: HTML content fields (description, summary.content) must use valid HTML.",
			"New items must include a valid UUID as `id` and `hidden: false`.",
			`Locked resumes cannot be patched. Ask the user before unlocking with \`${T.unlockResume}\`.`,
		].join("\n"),
		outputSchema: toWireObjectSchema(resumeDto.patch.output),
		inputSchema: wireInput(
			z.strictObject({
				id: resumeIdSchema,
				operations: resumePatchOperationsSchema,
			}),
		),
		annotations: { ...WRITE_NON_IDEMPOTENT, destructiveHint: true, openWorldHint: true },
	},
	[T.updateResume]: {
		title: "Update Resume (metadata)",
		description: [
			"Update resume display name, URL slug, tags, visibility, download settings, or full document data.",
			"Prefer JSON Patch with expectedUpdatedAt for content edits to avoid overwriting concurrent changes.",
			`Locked resumes cannot be updated. Ask the user before unlocking with \`${T.unlockResume}\`.`,
			"Use the account security workflow to manage password protection.",
			"",
			"Always returns your canonical share URL (`{app}/{username}/{slug}`). Anonymous viewers can use it only when `isPublic` is true; password protection from the web app still applies.",
		].join("\n"),
		outputSchema: toWireObjectSchema(
			resumeDto.update.output
				.pick({ id: true, name: true, slug: true, tags: true, isPublic: true, hasPassword: true })
				.extend({ shareUrl: z.string() }),
		),
		inputSchema: wireInput(
			z.strictObject({
				id: resumeIdSchema,
				name: z.string().min(1).max(64).optional().describe("Display name for the resume."),
				slug: z
					.string()
					.min(1)
					.max(64)
					.optional()
					.describe(
						"New URL slug: lowercase letters and numbers joined by single dashes (e.g. 'product-designer'), unique among your resumes. The old address keeps redirecting for 30 days.",
					),
				tags: z.array(z.string()).optional().describe("Replace the resume's tags (omit to leave unchanged)."),
				isPublic: z
					.boolean()
					.optional()
					.describe(
						"When true, anyone with the link can view the public resume (subject to password if set in the app).",
					),
			}),
		),
		annotations: { ...WRITE_NON_IDEMPOTENT, destructiveHint: true, openWorldHint: true },
	},
	[T.deleteResume]: {
		title: "Delete Resume",
		description: [
			"Move a resume to Trash, removing public access if published.",
			"",
			"It stays in Trash for 30 days, where the user can restore it from the app; then it and its files are deleted.",
			`Locked resumes cannot be moved; use \`${T.unlockResume}\` first.`,
		].join("\n"),
		outputSchema: messageOutput,
		inputSchema: wireInput(z.strictObject({ id: resumeIdSchema })),
		annotations: { ...WRITE_DESTRUCTIVE, openWorldHint: true },
	},
	[T.lockResume]: {
		title: "Lock Resume",
		description: [
			"Lock a resume to prevent any modifications.",
			"",
			`When locked, a resume cannot be edited (${T.patchResume}, ${T.updateResume}) or deleted.`,
			"Useful for protecting finalized resumes from accidental changes.",
			`Use \`${T.unlockResume}\` to re-enable editing.`,
		].join("\n"),
		outputSchema: messageOutput,
		inputSchema: wireInput(z.strictObject({ id: resumeIdSchema })),
		annotations: WRITE_IDEMPOTENT,
	},
	[T.unlockResume]: {
		title: "Unlock Resume",
		description: "Unlock a previously locked resume, re-enabling edits, patches, and deletion.",
		outputSchema: messageOutput,
		inputSchema: wireInput(z.strictObject({ id: resumeIdSchema })),
		annotations: WRITE_IDEMPOTENT,
	},
	[T.getResumeStatistics]: {
		title: "Get Resume Statistics",
		description: [
			"Get view and download statistics for a resume.",
			"",
			"Returns: isPublic (boolean), views (count), downloads (count),",
			"lastViewedAt (timestamp or null), lastDownloadedAt (timestamp or null).",
		].join("\n"),
		outputSchema: toWireObjectSchema(
			z.object({
				isPublic: z.boolean(),
				views: z.number(),
				downloads: z.number(),
				lastViewedAt: z.date().nullable(),
				lastDownloadedAt: z.date().nullable(),
			}),
		),
		inputSchema: wireInput(z.strictObject({ id: resumeIdSchema })),
		annotations: READ_IDEMPOTENT,
	},
} as const;

const pagination = {
	limit: z.number().int().min(1).max(100).default(20).describe("Maximum rows per page; default 20."),
	offset: z.number().int().min(0).default(0).describe("Rows to skip; default 0."),
};
// Shared DTOs keep fields, validation and limits aligned with API contracts.
export const TOOL_META = {
	...BASE_TOOL_META,
	[T.listResumes]: {
		...BASE_TOOL_META[T.listResumes],
		inputSchema: wireInput(BASE_TOOL_META[T.listResumes].inputSchema.extend(pagination)),
		outputSchema: toWireObjectSchema(
			z.object({
				items: resumeDto.list.output,
				limit: z.number(),
				offset: z.number(),
				nextOffset: z.number().nullable(),
			}),
		),
	},
	[T.getResume]: {
		...BASE_TOOL_META[T.getResume],
		description:
			BASE_TOOL_META[T.getResume].description +
			" Structured output also includes record metadata and updatedAt for expectedUpdatedAt.",
		outputSchema: toWireObjectSchema(resumeDto.getById.output),
	},
	[T.createResume]: {
		...BASE_TOOL_META[T.createResume],
		inputSchema: wireInput(
			resumeDto.create.input.extend({ tags: resumeDto.create.input.shape.tags.default([]) }).strict(),
		),
		outputSchema: idOutput,
	},
	[T.duplicateResume]: {
		...BASE_TOOL_META[T.duplicateResume],
		inputSchema: wireInput(resumeDto.duplicate.input.strict()),
		outputSchema: idOutput,
	},
	[T.importResume]: { ...BASE_TOOL_META[T.importResume], outputSchema: idOutput },
	[T.patchResume]: {
		...BASE_TOOL_META[T.patchResume],
		inputSchema: wireInput(
			BASE_TOOL_META[T.patchResume].inputSchema
				.extend({
					expectedUpdatedAt: z.iso
						.datetime({ offset: true })
						.optional()
						.describe(
							"updatedAt from the latest read_resume. Rejects changes when document has changed since that read.",
						),
				})
				.strict(),
		),
		outputSchema: toWireObjectSchema(resumeDto.patch.output),
	},
	[T.updateResume]: {
		...BASE_TOOL_META[T.updateResume],
		inputSchema: wireInput(resumeDto.update.input.strict()),
		outputSchema: toWireObjectSchema(
			resumeDto.update.output
				.pick({ id: true, name: true, slug: true, tags: true, isPublic: true, hasPassword: true })
				.extend({ shareUrl: z.string() }),
		),
	},
} as const;
