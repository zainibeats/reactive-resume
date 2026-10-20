import type { WebMcpTool } from "@/libs/webmcp";
import { useRouter } from "@tanstack/react-router";
import { useMemo } from "react";
import z from "zod";
import { client } from "@/libs/orpc/client";
import { defineWebMcpTool, useWebMcpTools } from "@/libs/webmcp";

function createDocumentTools(router: ReturnType<typeof useRouter>): readonly WebMcpTool[] {
	const listDocuments = defineWebMcpTool({
		name: "list_documents",
		title: "List resumes",
		description: [
			"List the signed-in user's resumes, most recently edited first, with their tags and whether they're locked.",
			"Open one with open_document to read or edit it.",
		].join(" "),
		input: z.object({}),
		annotations: { readOnlyHint: true, untrustedContentHint: true },
		execute: async (_, signal) => {
			const documents = await client.documents.list({ trashed: false }, signal ? { signal } : {});
			return [...documents]
				.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
				.map(({ type, id, name, tags, isLocked, updatedAt }) => ({ type, id, name, tags, isLocked, updatedAt }));
		},
	});

	const openDocument = defineWebMcpTool({
		name: "open_document",
		title: "Open resume",
		description: [
			"Open a resume from list_documents in the editor. The editor's tools (read_resume, apply_resume_patch and",
			"check_resume) become available once it has loaded.",
		].join(" "),
		input: z.object({
			id: z.string().min(1).describe("The resume's ID from list_documents."),
		}),
		execute: async ({ id }, signal) => {
			const documents = await client.documents.list({ trashed: false }, signal ? { signal } : {});
			const document = documents.find((item) => item.id === id);
			if (!document) throw new Error(`No resume with ID ${id}. Use list_documents to find one.`);

			await router.navigate({ to: "/builder/$resumeId", params: { resumeId: id } });

			return `Opened “${document.name}” in the editor.`;
		},
	});

	return [listDocuments, openDocument];
}

/** Offers the signed-in user's resumes to the browser's AI agent on every page. */
export function useDocumentWebMcpTools(enabled: boolean) {
	const router = useRouter();
	const tools = useMemo(() => (enabled ? createDocumentTools(router) : []), [enabled, router]);
	useWebMcpTools(tools);
}
