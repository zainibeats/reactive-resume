import { describe, expect, it } from "vitest";
import { MCP_TOOL_NAME } from "./mcp-tool-names";
import { TOOL_META } from "./tool-meta";

describe("tool annotations", () => {
	it("marks tools that replace or remove existing data as destructive", () => {
		for (const name of [MCP_TOOL_NAME.patchResume, MCP_TOOL_NAME.updateResume, MCP_TOOL_NAME.deleteResume]) {
			expect(TOOL_META[name].annotations.readOnlyHint, name).toBe(false);
			expect(TOOL_META[name].annotations.destructiveHint, name).toBe(true);
		}
	});
});
