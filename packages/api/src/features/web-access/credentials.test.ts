import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const fixtures = vi.hoisted(() => ({
	env: {} as { WEB_SEARCH_SEARXNG_URL?: string; WEB_ACCESS_PROVIDER?: "tavily"; WEB_ACCESS_API_KEY?: string },
	searxngRows: [] as { searxngUrl: string }[],
}));
vi.mock("@reactive-resume/env/server", () => ({ env: fixtures.env }));
// Without ENCRYPTION_SECRET no saved credential is read; the only query is the user's own SearXNG address.
vi.mock("@reactive-resume/db/client", () => ({
	db: { select: () => ({ from: () => ({ where: () => ({ limit: async () => fixtures.searxngRows }) }) }) },
}));

const { webAccessService } = await import("./credentials");

describe("web access status", () => {
	beforeEach(() => {
		for (const key of Object.keys(fixtures.env)) delete fixtures.env[key as keyof typeof fixtures.env];
		fixtures.searxngRows = [];
	});

	it("says search goes to the server's SearXNG when no connection is configured", async () => {
		fixtures.env.WEB_SEARCH_SEARXNG_URL = "http://searxng:8080";
		expect(await webAccessService.status("alice")).toMatchObject({
			configured: false,
			provider: null,
			search: true,
			searxng: true,
		});
	});

	it("says search goes to SearXNG beside a shared web connection", async () => {
		fixtures.env.WEB_SEARCH_SEARXNG_URL = "http://searxng:8080";
		fixtures.env.WEB_ACCESS_PROVIDER = "tavily";
		expect(await webAccessService.status("alice")).toMatchObject({
			managed: true,
			provider: "tavily",
			search: true,
			searxng: true,
		});
	});

	it("reports no SearXNG and no search without either", async () => {
		expect(await webAccessService.status("alice")).toMatchObject({ search: false, searxng: false, searxngUrl: null });
	});

	it("says search goes to the user's own SearXNG", async () => {
		fixtures.searxngRows = [{ searxngUrl: "http://192.168.1.5:8080" }];
		expect(await webAccessService.status("alice")).toMatchObject({
			search: true,
			searxng: true,
			searxngManaged: false,
			searxngUrl: "http://192.168.1.5:8080",
		});
		expect(await webAccessService.resolveSearxng("alice")).toBe("http://192.168.1.5:8080");
	});

	it("prefers the server's SearXNG and refuses changes to it", async () => {
		fixtures.env.WEB_SEARCH_SEARXNG_URL = "http://searxng:8080";
		fixtures.searxngRows = [{ searxngUrl: "http://192.168.1.5:8080" }];
		expect(await webAccessService.status("alice")).toMatchObject({ searxngManaged: true, searxngUrl: null });
		expect(await webAccessService.resolveSearxng("alice")).toBe("http://searxng:8080");
		await expect(webAccessService.saveSearxng("alice", "http://other:8080")).rejects.toMatchObject({
			code: "FORBIDDEN",
		});
	});
});
