import { describe, expect, it } from "vitest";
import { buildMcpServerCard } from "./mcp-server-card";
import { MCP_TOOL_NAME } from "./mcp-tool-names";

describe("buildMcpServerCard", () => {
	const card = buildMcpServerCard("1.2.3", "https://resume.example.com/base");

	it("includes the provided app version in serverInfo", () => {
		expect(card.serverInfo.version).toBe("1.2.3");
	});

	it("keeps runtime identity local to the instance", () => {
		expect(card.serverInfo.name).toBe("reactive-resume");
		expect(card.serverInfo.title).toBe("Reactive Resume");
		expect(card.serverInfo.websiteUrl).toBe("https://resume.example.com/base");
		expect(card.serverInfo.icons.map((icon) => icon.src)).toEqual([
			"https://resume.example.com/icon/light.svg",
			"https://resume.example.com/icon/dark.svg",
		]);
	});

	it("registers every resume tool", () => {
		const names = card.tools.map((tool) => tool.name);
		for (const name of Object.values(MCP_TOOL_NAME)) expect(names).toContain(name);
	});

	it("does not advertise application tracker tools", () => {
		const names = card.tools.map((tool) => tool.name);
		expect(names.filter((name) => name.includes("application"))).toEqual([]);
	});

	it("does not advertise independent cover-letter library tools", () => {
		const names = card.tools.map((tool) => tool.name);
		expect(names.filter((name) => name.includes("cover_letter"))).toEqual([]);
	});

	it("does not advertise platform-wide statistics tools", () => {
		const names = card.tools.map((tool) => tool.name);
		expect(names.filter((name) => name.startsWith("api_statistics_"))).toEqual([]);
	});

	it("declares a JSON Schema input for every tool", () => {
		for (const tool of card.tools) {
			expect(tool.inputSchema, tool.name).toBeDefined();
			expect(tool.annotations, tool.name).toBeDefined();
			expect(tool.title.length, tool.name).toBeGreaterThan(0);
			expect(tool.description.length, tool.name).toBeGreaterThan(0);
		}
	});
});
