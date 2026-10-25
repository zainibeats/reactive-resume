import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { serveStatic } from "@hono/node-server/serve-static";
import { env } from "@reactive-resume/env/server";

function resolveWebDistPath() {
	const candidates = [
		// Source layout: apps/server/src/static/web.ts -> apps/web/dist
		fileURLToPath(new URL("../../../web/dist", import.meta.url)),
		// Bundled layout: apps/server/dist/index.mjs -> apps/web/dist
		fileURLToPath(new URL("../../web/dist", import.meta.url)),
	];
	const [fallback] = candidates;
	if (!fallback) throw new Error("Could not resolve web dist path");

	return candidates.find((candidate) => existsSync(candidate)) ?? fallback;
}

const staticRoot = resolveWebDistPath();
const indexHtmlPath = `${staticRoot}/index.html`;
const noindexShellPrefixes = ["/auth", "/dashboard", "/builder"];
/**
 * App pages the SPA owns that search engines should index.
 *
 * Without an entry here the fallback below returns 404 for the path in production — the dev Vite
 * server serves the shell for anything, so this failure only ever shows up once deployed.
 */
const indexableAppPaths = new Set<string>();
const reservedPublicResumeSegments = new Set([
	"api",
	"mcp",
	".well-known",
	"uploads",
	"auth",
	"dashboard",
	"builder",
	"agent",
	"templates",
	"ats-checker",
]);

function isAssetPath(pathname: string): boolean {
	return pathname.split("/").pop()?.includes(".") ?? false;
}

function getPathSegments(pathname: string) {
	return pathname.split("/").filter(Boolean);
}

function isNoindexShellPath(pathname: string): boolean {
	return noindexShellPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function isPublicResumePath(pathname: string): boolean {
	const segments = getPathSegments(pathname);
	const [firstSegment] = segments;

	return segments.length === 2 && firstSegment !== undefined && !reservedPublicResumeSegments.has(firstSegment);
}

/**
 * Scripts run only from the app's own files and the inline scripts of the page served, allowed by hash; `wasm-unsafe-eval`
 * lets the PDF engine (Forme, WebAssembly) start. Pictures, avatars and fonts can live on any https host (a resume's
 * picture URL, a sign-in provider's avatar) and the PDF engine fetches them, so images, fonts and connections stay open
 * to https. Recordings, previews and workers use blob: URLs.
 */
function contentSecurityPolicy(html = "") {
	const inlineScripts = html.matchAll(
		/<script(?![^>]*\bsrc=)(?![^>]*application\/ld\+json)[^>]*>([\s\S]*?)<\/script>/g,
	);
	const hashes = [...inlineScripts].map(
		([, body]) =>
			`'sha256-${createHash("sha256")
				.update(body ?? "")
				.digest("base64")}'`,
	);
	return [
		"default-src 'self'",
		["script-src 'self' 'wasm-unsafe-eval'", ...hashes].join(" "),
		"style-src 'self' 'unsafe-inline'",
		"img-src 'self' data: blob: https:",
		"font-src 'self' data: https:",
		"connect-src 'self' data: blob: https:",
		"media-src 'self' data: blob:",
		"worker-src 'self' blob:",
		"frame-src 'self' blob:",
		"frame-ancestors 'none'",
		"base-uri 'self'",
		// Print and template previews show a PDF from a blob: URL, which Chromium's viewer loads as a plugin.
		"object-src blob:",
	].join("; ");
}

const BASE_SECURITY_HEADERS = {
	"X-Frame-Options": "DENY",
	"X-Content-Type-Options": "nosniff",
	"Referrer-Policy": "strict-origin-when-cross-origin",
	"Content-Security-Policy": contentSecurityPolicy(),
};

/**
 * An HTML page whose policy allows exactly the inline scripts of its template. Hashes come from the template before
 * any resume-derived markup goes in, so text that slipped past escaping could never allow itself.
 */
function htmlResponse(html: string, headers: Record<string, string>, template = html) {
	return new Response(html, { headers: { ...headers, "Content-Security-Policy": contentSecurityPolicy(template) } });
}

// The root-resume canonical URL is config-derived, but it is still escaped before it reaches the
// served HTML.
const escapeAttribute = (value: string) =>
	value
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&#39;");

export const serveWebDistStatic = env.CLOUDFLARE
	? undefined
	: serveStatic({
			root: staticRoot,
			onFound: (_path, context) => {
				// Vite fingerprints everything under /assets, so a file there never changes.
				if (context.req.path.startsWith("/assets/") || /^\/videos\/.*-v\d+\.(?:mp4|webp)$/.test(context.req.path)) {
					context.header("Cache-Control", "public, max-age=31536000, immutable");
				}
				// `/index.html` is the app shell too; it must not be frameable either.
				if (context.req.path.endsWith(".html"))
					for (const [name, value] of Object.entries(BASE_SECURITY_HEADERS)) context.header(name, value);
			},
		});

function getFallbackResponseHeaders(pathname: string) {
	if (pathname === "/" && env.ROOT_RESUME_ID) {
		return {
			"Content-Type": "text/html; charset=UTF-8",
			"X-Robots-Tag": "noindex, follow",
			"Cache-Control": "private, no-store",
			...BASE_SECURITY_HEADERS,
		};
	}
	if (pathname === "/" || indexableAppPaths.has(pathname)) {
		return { "Content-Type": "text/html; charset=UTF-8", ...BASE_SECURITY_HEADERS };
	}
	if (isNoindexShellPath(pathname) || isPublicResumePath(pathname)) {
		return {
			"Content-Type": "text/html; charset=UTF-8",
			"X-Robots-Tag": "noindex, follow",
			...BASE_SECURITY_HEADERS,
		};
	}

	return null;
}

const withMeta = (html: string, meta: { title: string; description: string }) =>
	html
		.replace(/<title>[^<]*<\/title>/, () => `<title>${meta.title}</title>`)
		.replace(/<meta\s+name="description"[^>]*>/, () => `<meta name="description" content="${meta.description}">`);

// ponytail: GET and HEAD share the same routing logic; method determines body presence
export type ReadWebFile = (path: string) => Promise<string>;

export async function handleWebApp(request: Request, readFile: ReadWebFile = (path) => fs.readFile(path, "utf-8")) {
	const pathname = new URL(request.url).pathname;

	if (!isNoindexShellPath(pathname) && isAssetPath(pathname)) {
		return new Response("Not Found", { status: 404 });
	}

	const headers = getFallbackResponseHeaders(pathname);
	if (!headers)
		return new Response("Not Found", {
			status: 404,
			headers: { "Content-Type": "text/plain; charset=UTF-8", "X-Robots-Tag": "noindex, nofollow" },
		});

	// Hono drops HEAD bodies itself; returning early skips reading the shell and a public resume's DB lookup.
	if (request.method === "HEAD") return new Response(null, { status: 200, headers });

	const html = await readFile(indexHtmlPath);

	if (pathname === "/" && env.ROOT_RESUME_ID) {
		const canonicalUrl = new URL("/", env.APP_URL).toString();
		// Root configuration never discloses a target in the HTML shell. The public API
		// gates data and browser metadata; shell requests must not count extra views.
		const shell = withMeta(html, { title: "Reactive Resume", description: "" });
		const markup = `<link rel="canonical" href="${escapeAttribute(canonicalUrl)}" data-root-resume-shell><meta name="robots" content="noindex, follow" data-root-resume-shell>`;
		return htmlResponse(
			shell.replace("</head>", () => `${markup}</head>`),
			headers,
			html,
		);
	}

	return htmlResponse(html, headers);
}
