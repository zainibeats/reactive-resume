import { env } from "@reactive-resume/env/server";

function appUrl() {
	return env.APP_URL.replace(/\/+$/, "");
}

function textResponse(body: string) {
	return new Response(body, {
		headers: { "Content-Type": "text/plain; charset=UTF-8" },
	});
}

export function handleRobots() {
	const baseUrl = appUrl();
	const body = [
		"User-agent: *",
		"Allow: /",
		"Disallow: /api/rpc",
		"Disallow: /api/auth",
		"Disallow: /mcp",
		"Disallow: /.well-known",
		"",
		`Sitemap: ${baseUrl}/sitemap.xml`,
		"",
	].join("\n");

	return textResponse(body);
}

export function handleSitemap() {
	const baseUrl = appUrl();
	// The instance root is the only indexable page; the signed-in app and public resumes are served noindex.
	const body = [
		'<?xml version="1.0" encoding="UTF-8"?>',
		'<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
		"  <url>",
		`    <loc>${baseUrl}/</loc>`,
		"  </url>",
		"</urlset>",
		"",
	].join("\n");

	return new Response(body, {
		headers: { "Content-Type": "application/xml; charset=UTF-8" },
	});
}

export function handleLlms() {
	const baseUrl = appUrl();
	const body = [
		"# Reactive Resume",
		"",
		"A single-owner resume builder for creating, editing, exporting, and sharing resumes.",
		"",
		"## Links",
		"",
		`- Application: ${baseUrl}`,
		`- Resume schema: ${baseUrl}/schema.json`,
		`- OpenAPI specification: ${baseUrl}/api/openapi/spec.json`,
		"",
	].join("\n");

	return textResponse(body);
}
