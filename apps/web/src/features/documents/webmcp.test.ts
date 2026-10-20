// @vitest-environment happy-dom

import type { WebMcpTool } from "@/libs/webmcp";
import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDocumentWebMcpTools } from "./webmcp";

const mocks = vi.hoisted(() => ({ list: vi.fn(), navigate: vi.fn() }));
vi.mock("@/libs/orpc/client", () => ({ client: { documents: { list: mocks.list } } }));
vi.mock("@tanstack/react-router", () => {
	const router = { navigate: mocks.navigate };
	return { useRouter: () => router };
});

const documents = [
	{
		type: "resume",
		id: "older",
		name: "Base resume",
		tags: ["base"],
		isLocked: false,
		trashedAt: null,
		createdAt: new Date("2026-01-01T00:00:00.000Z"),
		updatedAt: new Date("2026-02-01T00:00:00.000Z"),
	},
	{
		type: "resume",
		id: "newer",
		name: "Resume for Acme",
		tags: [],
		isLocked: true,
		trashedAt: null,
		createdAt: new Date("2026-03-01T00:00:00.000Z"),
		updatedAt: new Date("2026-04-01T00:00:00.000Z"),
	},
];

function mountTools(enabled: boolean) {
	const tools = new Map<string, WebMcpTool>();
	Object.defineProperty(document, "modelContext", {
		value: { registerTool: (tool: WebMcpTool) => void tools.set(tool.name, tool) },
		configurable: true,
	});
	renderHook(() => useDocumentWebMcpTools(enabled));
	return tools;
}

beforeEach(() => {
	vi.resetAllMocks();
	mocks.list.mockResolvedValue(documents);
	mocks.navigate.mockResolvedValue(undefined);
});

afterEach(() => {
	delete (document as { modelContext?: unknown }).modelContext;
});

describe("document WebMCP tools", () => {
	it("offers nothing to signed-out visitors", () => {
		expect(mountTools(false).size).toBe(0);
	});

	it("lists live documents, most recently edited first", async () => {
		const tools = mountTools(true);

		const result = JSON.parse((await tools.get("list_documents")?.execute({})) ?? "null");

		expect(mocks.list).toHaveBeenCalledWith({ trashed: false }, {});
		expect(result.map((item: { id: string }) => item.id)).toEqual(["newer", "older"]);
		expect(result[0]).toEqual({
			type: "resume",
			id: "newer",
			name: "Resume for Acme",
			tags: [],
			isLocked: true,
			updatedAt: "2026-04-01T00:00:00.000Z",
		});
	});

	it("opens a resume in the editor", async () => {
		const tools = mountTools(true);

		await expect(tools.get("open_document")?.execute({ id: "older" })).resolves.toBe(
			"Opened “Base resume” in the editor.",
		);
		expect(mocks.navigate).toHaveBeenLastCalledWith({ to: "/builder/$resumeId", params: { resumeId: "older" } });
	});

	it("doesn't navigate to a document that isn't there", async () => {
		const tools = mountTools(true);

		await expect(tools.get("open_document")?.execute({ id: "missing" })).rejects.toThrow("No resume with ID missing.");
		expect(mocks.navigate).not.toHaveBeenCalled();
	});
});
