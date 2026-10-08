import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RouterClient } from "@orpc/server";
import type { RequestAuthentication } from "@reactive-resume/api/context";
import type router from "@reactive-resume/api/routers";
import type z from "zod";
import { ORPCError } from "@orpc/server";
import { resolveUserFromRequestHeaders } from "@reactive-resume/api/context";
import { resumeDto } from "@reactive-resume/api/dto/resume";
import { createResumePdfDownloadUrl } from "@reactive-resume/api/features/resume/export";
import { env } from "@reactive-resume/env/server";
import { MCP_TOOL_NAME } from "./mcp-tool-names";
import { json, text, withErrorHandling } from "./results";
import { TOOL_META } from "./tool-meta";

// ── Shared Helpers ───────────────���──────────────────────────────

function buildResumeShareUrl(username: string, slug: string): string {
	const base = env.APP_URL.replace(/\/$/, "");
	return `${base}/${encodeURIComponent(username)}/${encodeURIComponent(slug)}`;
}

function resumeShareUrlNotes(input: { isPublic: boolean; hasPassword: boolean }): string {
	const lines = [
		"Anyone can open this link without signing in only when the resume is public (`isPublic: true`).",
		input.isPublic
			? "This resume is currently public."
			: "This resume is currently private; the URL is still your canonical share link if you make it public later.",
	];
	if (input.hasPassword)
		lines.push(
			"Password protection is enabled in the web app; visitors may need that password before content is shown.",
		);
	return lines.join("\n");
}

// ── Shared Zod Fragments ─────────────��──────────────────────────

const T = MCP_TOOL_NAME;

// ── Tool Registration ────────────────────���──────────────────────

export function registerTools(
	server: McpServer,
	client: RouterClient<typeof router>,
	requestHeaders: Headers,
	authentication?: RequestAuthentication,
) {
	// ── List Resumes ──────────────────���───────────────────────────
	server.registerTool(
		T.listResumes,
		TOOL_META[T.listResumes],
		withErrorHandling(
			"listing resumes",
			async (params: z.infer<(typeof TOOL_META)[typeof T.listResumes]["inputSchema"]>) => {
				const resumes = await client.resume.list(params);
				return text(JSON.stringify(resumes, null, 2), {
					items: resumes,
					limit: params.limit,
					offset: params.offset,
					nextOffset: resumes.length === params.limit ? params.offset + resumes.length : null,
				});
			},
		),
	);

	// ── List Resume Tags ───────────────────���──────────────────────
	server.registerTool(
		T.listResumeTags,
		TOOL_META[T.listResumeTags],
		withErrorHandling("listing resume tags", async () => {
			const tags = await client.resume.tags.list();

			return json(tags);
		}),
	);

	// ── Read Resume ────────────────���──────────────────────────────
	server.registerTool(
		T.getResume,
		TOOL_META[T.getResume],
		withErrorHandling("getting resume", async ({ id }: { id: string }) => {
			const resume = await client.resume.getById({ id });

			return text(JSON.stringify(resume.data, null, 2), resume);
		}),
	);

	// ── Download Resume PDF ───────────────────────────────────────
	server.registerTool(
		T.downloadResumePdf,
		TOOL_META[T.downloadResumePdf],
		withErrorHandling("creating PDF download URL", async ({ id }: { id: string }) => {
			const resume = await client.resume.getById({ id });
			const user = authentication?.user ?? (await resolveUserFromRequestHeaders(requestHeaders));
			if (!user) throw new ORPCError("UNAUTHORIZED");

			const signedUrl = createResumePdfDownloadUrl({ resumeId: id, userId: user.id });

			return json({
				resumeId: id,
				name: resume.name,
				downloadUrl: signedUrl.url,
				expiresAt: signedUrl.expiresAt,
				expiresInSeconds: signedUrl.expiresInSeconds,
				contentType: "application/pdf",
			});
		}),
	);

	// ── Create Resume ─────────────────────────────────────────────
	server.registerTool(
		T.createResume,
		TOOL_META[T.createResume],
		withErrorHandling(
			"creating resume",
			async (params: z.infer<(typeof TOOL_META)[typeof T.createResume]["inputSchema"]>) => {
				const { name, slug, withSampleData } = params;
				const id = await client.resume.create(params);

				return text(
					`Created resume "${name}" (ID: ${id}) ${slug ? `with slug "${slug}"` : "with a generated address"}.${withSampleData ? " Pre-filled with sample data." : ""}\n\nNext steps: Use \`${T.getResume}\` to view it, or \`${T.patchResume}\` to start editing.`,
					{ id },
				);
			},
		),
	);

	// ── Import Resume ─────────────��───────────────────────────────
	server.registerTool(
		T.importResume,
		TOOL_META[T.importResume],
		withErrorHandling("importing resume", async ({ data }: { data: unknown }) => {
			const parsed = resumeDto.import.input.safeParse({ data });
			if (!parsed.success)
				return {
					isError: true,
					content: [
						{
							type: "text",
							text: `Invalid ResumeData: ${parsed.error.message}\n\nHint: Ensure the JSON matches the schema at resume://_meta/schema`,
						},
					],
				};

			const id = await client.resume.import(parsed.data);

			return text(
				`Imported resume (ID: ${id}).\n\nNext steps: Use \`${T.getResume}\` to inspect metadata (name/slug were auto-generated), or \`${T.updateResume}\` / \`${T.patchResume}\` to adjust.`,
				{ id },
			);
		}),
	);

	// ── Duplicate Resume ────────────────────���─────────────────────
	server.registerTool(
		T.duplicateResume,
		TOOL_META[T.duplicateResume],
		withErrorHandling(
			"duplicating resume",
			async ({
				id,
				name,
				slug,
				tags,
			}: {
				id: string;
				name?: string | undefined;
				slug?: string | undefined;
				tags?: string[] | undefined;
			}) => {
				const newId = await client.resume.duplicate({
					id,
					...(name ? { name } : {}),
					...(slug ? { slug } : {}),
					...(tags ? { tags } : {}),
				});

				return text(
					`Duplicated resume${name ? ` as "${name}"` : ""} (ID: ${newId}) ${slug ? `with slug "${slug}"` : "with a generated address"}.\n\nNext steps: Use \`${T.getResume}\` to view it, or \`${T.patchResume}\` to customize.`,
					{ id: newId },
				);
			},
		),
	);

	// ── Apply Resume Patch ────────────────────────────────────────
	server.registerTool(
		T.patchResume,
		TOOL_META[T.patchResume],
		withErrorHandling(
			"patching resume",
			async (params: z.infer<(typeof TOOL_META)[typeof T.patchResume]["inputSchema"]>) => {
				const { operations } = params;
				const resume = await client.resume.patch(resumeDto.patch.input.parse(params));
				const summary = operations.map((op) => `${op.op} ${op.path}`).join(", ");

				return text(`Applied ${operations.length} operation(s) to "${resume.name}": ${summary}`, resume);
			},
		),
	);

	// ── Update Resume (metadata) ─────────────────��───────────────
	server.registerTool(
		T.updateResume,
		TOOL_META[T.updateResume],
		withErrorHandling("updating resume", async (params) => {
			const input = resumeDto.update.input.parse(params);
			if (!Object.entries(input).some(([key, value]) => key !== "id" && key !== "sessionId" && value !== undefined))
				throw new ORPCError("BAD_REQUEST", { message: "Provide at least one field to update." });
			const resume = await client.resume.update(input);

			const user = authentication?.user ?? (await resolveUserFromRequestHeaders(requestHeaders));
			const username =
				user && "username" in user && typeof (user as { username: unknown }).username === "string"
					? (user as { username: string }).username
					: "";
			const shareUrl =
				username !== ""
					? buildResumeShareUrl(username, resume.slug)
					: "(could not build share URL: missing username on account)";

			const payload = {
				id: resume.id,
				name: resume.name,
				slug: resume.slug,
				tags: resume.tags,
				isPublic: resume.isPublic,
				hasPassword: resume.hasPassword,
				shareUrl,
			};

			return text(
				[
					JSON.stringify(payload, null, 2),
					"",
					resumeShareUrlNotes({ isPublic: resume.isPublic, hasPassword: resume.hasPassword }),
				].join("\n"),
				payload,
			);
		}),
	);

	// ── Delete Resume ────────────────────────────────────────��────
	server.registerTool(
		T.deleteResume,
		TOOL_META[T.deleteResume],
		withErrorHandling("deleting resume", async ({ id }: { id: string }) => {
			await client.resume.delete({ id });

			return text(`Moved resume (${id}) to Trash. Restore it within 30 days.`);
		}),
	);

	// ── Lock Resume ────────────────���──────────────────────────────
	server.registerTool(
		T.lockResume,
		TOOL_META[T.lockResume],
		withErrorHandling("locking resume", async ({ id }: { id: string }) => {
			await client.resume.setLocked({ id, isLocked: true });

			return text(`Resume (${id}) is now locked. It cannot be edited, patched, or deleted until unlocked.`);
		}),
	);

	// ── Unlock Resume ───────────────���─────────────────────────────
	server.registerTool(
		T.unlockResume,
		TOOL_META[T.unlockResume],
		withErrorHandling("unlocking resume", async ({ id }: { id: string }) => {
			await client.resume.setLocked({ id, isLocked: false });

			return text(`Resume (${id}) is now unlocked. It can be edited, patched, and deleted.`);
		}),
	);

	// ── Get Resume Statistics ────────────────────────────────────
	server.registerTool(
		T.getResumeStatistics,
		TOOL_META[T.getResumeStatistics],
		withErrorHandling("getting resume statistics", async ({ id }: { id: string }) => {
			const stats = await client.resume.statistics.getById({ id });

			return json(stats);
		}),
	);
}
