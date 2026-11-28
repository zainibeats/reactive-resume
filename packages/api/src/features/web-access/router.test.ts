import { describe, expect, it, vi } from "vite-plus/test";
import { createRouterClient } from "@orpc/server";
import { WebAccessError } from "./contracts";
import { webAccessService } from "./credentials";
import { webAccessRouter } from "./router";
import { probeWebAccess } from "./service";

vi.mock("../../context", async () => {
	const { os } = await vi.importActual<typeof import("@orpc/server")>("@orpc/server");
	return { protectedProcedure: os.$context<{ user: { id: string } }>() };
});
vi.mock("./credentials", () => ({
	webAccessService: {
		resolve: vi.fn(),
		resolveSearxng: vi.fn(async () => null),
		canSearch: vi.fn((hasConnection: boolean, searxngUrl: string | null) => hasConnection || !!searxngUrl),
	},
}));
vi.mock("./service", () => ({ probeWebAccess: vi.fn() }));

describe("web connection probe transport", () => {
	it("reports the shared retrieval limit as HTTP 429 instead of an internal server error", async () => {
		vi.mocked(webAccessService.resolve).mockResolvedValue({ provider: "tavily", apiKey: "test-only-key" });
		vi.mocked(probeWebAccess).mockRejectedValue(new WebAccessError("rate-limit"));
		const client = createRouterClient(webAccessRouter, {
			context: { user: { id: "alice" }, reqHeaders: new Headers() } as never,
		});
		await expect(client.test()).rejects.toMatchObject({ code: "RATE_LIMIT_EXCEEDED", status: 429 });
	});

	it("tests SearXNG search without a web connection", async () => {
		vi.mocked(webAccessService.resolve).mockResolvedValue(null);
		vi.mocked(webAccessService.resolveSearxng).mockResolvedValueOnce("http://searxng:8080" as never);
		const result = { search: { success: true }, read: { success: false, error: "unavailable" as const } };
		vi.mocked(probeWebAccess).mockResolvedValue(result);
		const client = createRouterClient(webAccessRouter, {
			context: { user: { id: "alice" }, reqHeaders: new Headers() } as never,
		});
		await expect(client.test()).resolves.toEqual(result);
		expect(webAccessService.canSearch).toHaveBeenCalledWith(false, "http://searxng:8080");
		expect(probeWebAccess).toHaveBeenLastCalledWith(
			null,
			expect.objectContaining({ userId: "alice", searxngUrl: "http://searxng:8080" }),
		);
	});

	it("refuses the test with neither SearXNG nor a web connection", async () => {
		vi.mocked(webAccessService.resolve).mockResolvedValue(null);
		vi.mocked(probeWebAccess).mockClear();
		const client = createRouterClient(webAccessRouter, {
			context: { user: { id: "alice" }, reqHeaders: new Headers() } as never,
		});
		await expect(client.test()).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
		expect(probeWebAccess).not.toHaveBeenCalled();
	});

	it("rejects SearXNG addresses with credentials or other protocols", async () => {
		const client = createRouterClient(webAccessRouter, {
			context: { user: { id: "alice" }, reqHeaders: new Headers() } as never,
		});
		await expect(client.saveSearxng({ url: "http://user:pass@searxng:8080" })).rejects.toMatchObject({
			code: "BAD_REQUEST",
		});
		await expect(client.saveSearxng({ url: "ftp://searxng" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
	});
});
