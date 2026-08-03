import fs from "node:fs/promises";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	env: { APP_URL: "https://rxresu.me" },
	serveStatic: vi.fn((_options?: unknown) => vi.fn()),
}));

vi.mock("node:fs", () => ({
	existsSync: vi.fn(() => true),
}));

vi.mock("node:fs/promises", () => ({
	default: {
		readFile: vi.fn(),
	},
}));

vi.mock("@hono/node-server/serve-static", () => ({
	serveStatic: mocks.serveStatic,
}));

vi.mock("@reactive-resume/env/server", () => ({
	env: mocks.env,
}));

type StaticOptions = {
	onFound?: (
		path: string,
		context: {
			req: { path: string };
			header: (name: string, value: string) => void;
		},
	) => void | Promise<void>;
};

const { handleWebApp } = await import("./web");
const staticOptions = mocks.serveStatic.mock.calls[0]?.[0] as StaticOptions | undefined;

describe("web app fallback classification", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(fs.readFile).mockResolvedValue("<html>app</html>");
	});

	it("serves the shell for the root app route without noindex", async () => {
		const response = await handleWebApp(new Request("https://example.com/"));

		expect(response.status).toBe(200);
		expect(response.headers.get("Content-Type")).toBe("text/html; charset=UTF-8");
		expect(response.headers.get("X-Robots-Tag")).toBeNull();
		expect(await response.text()).toBe("<html>app</html>");
	});

	it("serves the root shell without hosted-service SEO metadata", async () => {
		vi.mocked(fs.readFile).mockResolvedValue(`
			<!doctype html>
			<html>
				<head>
					<title>Reactive Resume</title>
				</head>
				<body><div id="app"></div></body>
			</html>
		`);

		const response = await handleWebApp(new Request("http://server.internal/?utm_source=search"));
		const html = await response.text();

		expect(html).toContain('<div id="app"></div>');
		expect(html).not.toContain('rel="canonical"');
		expect(html).not.toContain('id="reactive-resume-structured-data"');
		expect(html).not.toContain("og:image");
		expect(html).not.toContain("/videos/timelapse-v1.webp");
	});

	it("caches versioned homepage media immutably", async () => {
		const headers = new Headers();

		await staticOptions?.onFound?.("", {
			req: { path: "/videos/timelapse-v1.mp4" },
			header: (name, value) => headers.set(name, value),
		});

		expect(headers.get("Cache-Control")).toBe("public, max-age=31536000, immutable");

		const unversionedHeaders = new Headers();
		await staticOptions?.onFound?.("", {
			req: { path: "/videos/timelapse.mp4" },
			header: (name, value) => unversionedHeaders.set(name, value),
		});

		expect(unversionedHeaders.get("Cache-Control")).toBeNull();
	});

	it.each(["/", "/alice/resume"])("sets framing and report-only CSP security headers on %s", async (pathname) => {
		const response = await handleWebApp(new Request(`https://example.com${pathname}`));

		expect(response.status).toBe(200);
		expect(response.headers.get("X-Frame-Options")).toBe("DENY");
		expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
		expect(response.headers.get("Content-Security-Policy-Report-Only")).toContain("frame-ancestors 'none'");
	});

	it.each(["/auth/login", "/dashboard", "/builder/resume-1"])(
		"serves noindex shell for known app prefix %s",
		async (pathname) => {
			const response = await handleWebApp(new Request(`https://example.com${pathname}`));

			expect(response.status).toBe(200);
			expect(response.headers.get("Content-Type")).toBe("text/html; charset=UTF-8");
			expect(response.headers.get("X-Robots-Tag")).toBe("noindex, follow");
			expect(await response.text()).toBe("<html>app</html>");
		},
	);

	it.each(["/agent", "/agent/thread-1", "/templates"])("returns a 404 for removed app route %s", async (pathname) => {
		const response = await handleWebApp(new Request(`https://example.com${pathname}`));

		expect(response.status).toBe(404);
		expect(response.headers.get("X-Robots-Tag")).toBe("noindex, nofollow");
		expect(fs.readFile).not.toHaveBeenCalled();
	});

	it("returns a plain 404 for a missing static template asset", async () => {
		const response = await handleWebApp(new Request("https://example.com/templates/missing.pdf"));

		expect(response.status).toBe(404);
		expect(response.headers.get("X-Robots-Tag")).toBeNull();
		expect(fs.readFile).not.toHaveBeenCalled();
	});

	it("serves noindex shell for public resume shaped routes", async () => {
		const response = await handleWebApp(new Request("https://example.com/alice/resume"));

		expect(response.status).toBe(200);
		expect(response.headers.get("X-Robots-Tag")).toBe("noindex, follow");
		expect(await response.text()).toBe("<html>app</html>");
	});

	it("returns noindex 404 for unknown non-asset routes", async () => {
		const response = await handleWebApp(new Request("https://example.com/unknown/extra/path"));

		expect(response.status).toBe(404);
		expect(response.headers.get("Content-Type")).toBe("text/plain; charset=UTF-8");
		expect(response.headers.get("X-Robots-Tag")).toBe("noindex, nofollow");
		expect(await response.text()).toBe("Not Found");
		expect(fs.readFile).not.toHaveBeenCalled();
	});

	it.each(["/api/foo", "/mcp/foo", "/uploads/foo"])(
		"does not treat reserved two-segment path %s as a public resume",
		async (pathname) => {
			const response = await handleWebApp(new Request(`https://example.com${pathname}`));

			expect(response.status).toBe(404);
			expect(response.headers.get("Content-Type")).toBe("text/plain; charset=UTF-8");
			expect(response.headers.get("X-Robots-Tag")).toBe("noindex, nofollow");
			expect(await response.text()).toBe("Not Found");
			expect(fs.readFile).not.toHaveBeenCalled();
		},
	);

	it("returns plain 404 for missing asset-looking paths", async () => {
		const response = await handleWebApp(new Request("https://example.com/assets/missing.css"));

		expect(response.status).toBe(404);
		expect(response.headers.get("X-Robots-Tag")).toBeNull();
		expect(await response.text()).toBe("Not Found");
		expect(fs.readFile).not.toHaveBeenCalled();
	});

	it("mirrors fallback status and headers for HEAD without a body", async () => {
		const knownResponse = await handleWebApp(new Request("https://example.com/dashboard", { method: "HEAD" }));
		const unknownResponse = await handleWebApp(
			new Request("https://example.com/unknown/extra/path", { method: "HEAD" }),
		);

		expect(knownResponse.status).toBe(200);
		expect(knownResponse.headers.get("Content-Type")).toBe("text/html; charset=UTF-8");
		expect(knownResponse.headers.get("X-Robots-Tag")).toBe("noindex, follow");
		expect(await knownResponse.text()).toBe("");

		expect(unknownResponse.status).toBe(404);
		expect(unknownResponse.headers.get("Content-Type")).toBe("text/plain; charset=UTF-8");
		expect(unknownResponse.headers.get("X-Robots-Tag")).toBe("noindex, nofollow");
		expect(await unknownResponse.text()).toBe("");
	});
});
