import type { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import { MCP_TOOL_NAME } from "./mcp-tool-names";

type McpRegisteredToolName = (typeof MCP_TOOL_NAME)[keyof typeof MCP_TOOL_NAME];

// ponytail: 5 distinct annotation shapes shared across 14 tools
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
	idempotentHint: true,
	openWorldHint: false,
};
const WRITE_IDEMPOTENT: ToolAnnotations = {
	readOnlyHint: false,
	destructiveHint: false,
	idempotentHint: true,
	openWorldHint: false,
};

/** Tool behavior hints for MCP `tools/list` and the static server card. */
export const TOOL_ANNOTATIONS: Record<McpRegisteredToolName, ToolAnnotations> = {
	[MCP_TOOL_NAME.listResumes]: READ_IDEMPOTENT,
	[MCP_TOOL_NAME.listResumeTags]: READ_IDEMPOTENT,
	[MCP_TOOL_NAME.getResume]: READ_IDEMPOTENT,
	[MCP_TOOL_NAME.getResumeAnalysis]: READ_IDEMPOTENT,
	[MCP_TOOL_NAME.downloadResumePdf]: READ_NON_IDEMPOTENT,
	[MCP_TOOL_NAME.createResume]: WRITE_NON_IDEMPOTENT,
	[MCP_TOOL_NAME.importResume]: WRITE_NON_IDEMPOTENT,
	[MCP_TOOL_NAME.duplicateResume]: WRITE_NON_IDEMPOTENT,
	[MCP_TOOL_NAME.patchResume]: WRITE_NON_IDEMPOTENT,
	[MCP_TOOL_NAME.updateResume]: WRITE_NON_IDEMPOTENT,
	[MCP_TOOL_NAME.deleteResume]: WRITE_DESTRUCTIVE,
	[MCP_TOOL_NAME.lockResume]: WRITE_IDEMPOTENT,
	[MCP_TOOL_NAME.unlockResume]: WRITE_IDEMPOTENT,
	[MCP_TOOL_NAME.getResumeStatistics]: READ_IDEMPOTENT,
};
