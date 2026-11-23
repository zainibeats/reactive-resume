import { describe, expect, it } from "vite-plus/test";
import { MCP_TOOL_NAME } from "./mcp-tool-names";
import { PARITY_TOOL_META } from "./parity";
import { TOOL_META } from "./tool-meta";

describe("tool annotations", () => {
	it("declares all four behavior hints as booleans for every tool", () => {
		for (const [name, tool] of Object.entries({ ...TOOL_META, ...PARITY_TOOL_META })) {
			for (const hint of ["readOnlyHint", "destructiveHint", "idempotentHint", "openWorldHint"] as const) {
				expect(typeof tool.annotations[hint], `${name}.${hint}`).toBe("boolean");
			}
		}
	});

	it("accounts for destructive effects hidden behind list, rename, read and AI operations", () => {
		for (const name of [
			"api_documents_rename",
			"api_resume_rename_version",
			"api_ai_providers_list",
			"api_ai_providers_test",
			"api_agent_threads_get",
			"api_ai_parse_pdf",
		]) {
			expect(PARITY_TOOL_META[name]?.annotations, name).toMatchObject({ readOnlyHint: false, destructiveHint: true });
		}
	});

	it("distinguishes internal operations from external AI, search and public sharing", () => {
		for (const name of [
			"api_documents_list",
			"api_web_access_status",
			"api_web_access_delete",
			"api_ai_providers_list",
			"api_ai_providers_delete",
			"api_agent_messages_resume",
			"api_agent_attachments_create",
			"api_rest_document_exports_resume",
			"api_rest_check_pdf",
			"api_rest_match_resume",
			"api_rest_import_resume_file",
		]) {
			expect(PARITY_TOOL_META[name]?.annotations.openWorldHint, name).toBe(false);
		}
		for (const name of [
			"api_agent_messages_send",
			"api_web_access_test",
			"api_resume_get_by_slug",
			"api_documents_trash",
			"api_documents_restore",
		]) {
			expect(PARITY_TOOL_META[name]?.annotations.openWorldHint, name).toBe(true);
		}
	});

	it("keeps listing documents and probing web access read-only", () => {
		expect(PARITY_TOOL_META.api_documents_list?.annotations).toMatchObject({
			readOnlyHint: true,
			idempotentHint: true,
		});
		expect(PARITY_TOOL_META.api_web_access_test?.annotations).toMatchObject({
			readOnlyHint: true,
			destructiveHint: false,
		});
	});

	it("marks tools that replace or remove existing data as destructive", () => {
		for (const name of [
			MCP_TOOL_NAME.patchResume,
			MCP_TOOL_NAME.updateResume,
			MCP_TOOL_NAME.deleteResume,
			MCP_TOOL_NAME.lockResume,
			MCP_TOOL_NAME.unlockResume,
		]) {
			expect(TOOL_META[name].annotations.readOnlyHint, name).toBe(false);
			expect(TOOL_META[name].annotations.destructiveHint, name).toBe(true);
		}
	});
});
