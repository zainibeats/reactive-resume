import type {
	ProviderRequest,
	ReadPageResult,
	WebAccessConnection,
	WebAccessContext,
	WebAccessFailure,
} from "./contracts";
import { env } from "@reactive-resume/env/server";
import { rateLimitConfig } from "@reactive-resume/utils/rate-limit";
import { abortable } from "@reactive-resume/utils/url-security.node";
import { createRateLimiter } from "../../redis";
import { assertPublicTarget, htmlToText, readBuiltinPage } from "./builtin";
import { WEB_ACCESS_DEADLINE_MS, WebAccessError } from "./contracts";
import { readExa, searchExa } from "./exa";
import { readFirecrawl, searchFirecrawl } from "./firecrawl";
import { searchSearxng } from "./searxng";
import { readTavily, searchTavily } from "./tavily";
import { pageContent, safeFailure } from "./transport";

const limiter = createRateLimiter("web-access", rateLimitConfig.orpc.aiRequest);

async function consume(userId: string, signal: AbortSignal) {
	signal.throwIfAborted();
	if (process.env.NODE_ENV !== "production" || env.FLAG_DISABLE_API_RATE_LIMIT) return;
	const { success } = await abortable(limiter.limit(userId), signal);
	if (!success) throw new WebAccessError("rate-limit");
}

const deadline = (signal?: AbortSignal) =>
	AbortSignal.any([...(signal ? [signal] : []), AbortSignal.timeout(WEB_ACCESS_DEADLINE_MS)]);

async function externalSearch(query: string, options: ProviderRequest) {
	try {
		switch (options.connection.provider) {
			case "firecrawl":
				return await searchFirecrawl(query, options);
			case "tavily":
				return await searchTavily(query, options);
			case "exa":
				return await searchExa(query, options);
		}
	} catch (error) {
		throw safeFailure(error, options.signal);
	}
}

async function externalRead(url: string, options: ProviderRequest) {
	try {
		switch (options.connection.provider) {
			case "firecrawl":
				return await readFirecrawl(url, options);
			case "tavily":
				return await readTavily(url, options);
			case "exa":
				return await readExa(url, options);
		}
	} catch (error) {
		throw safeFailure(error, options.signal);
	}
}

function log(operation: "search" | "read", provider: string, started: number, outcome: string, fallback?: string) {
	console.info("[web-access]", {
		provider,
		operation,
		durationMs: Date.now() - started,
		outcome,
		...(fallback ? { fallback } : {}),
	});
}

type SearchResults = Awaited<ReturnType<typeof externalSearch>>;

/** Where searches go: the operator's SearXNG when set, otherwise the web connection's provider. */
function searchBackend(context: WebAccessContext, signal: AbortSignal) {
	const baseUrl = env.WEB_SEARCH_SEARXNG_URL;
	if (baseUrl)
		return {
			name: "searxng",
			search: (query: string): Promise<SearchResults> => searchSearxng(query, { baseUrl, signal }),
		};
	const connection = context.connection;
	if (!connection) return null;
	return {
		name: connection.provider,
		search: (query: string) => externalSearch(query, { connection, signal }),
	};
}

export async function searchWeb(query: string, context: WebAccessContext) {
	const signal = deadline(context.signal);
	const started = Date.now();
	const backend = searchBackend(context, signal);
	const provider = backend?.name ?? "builtin";
	try {
		await consume(context.userId, signal);
		if (!backend) throw new WebAccessError("unavailable");
		const input = query.trim();
		if (!input || input.length > 512) throw new WebAccessError("malformed");
		const results = await backend.search(input);
		signal.throwIfAborted();
		log("search", provider, started, "success");
		return results;
	} catch (error) {
		log(
			"search",
			provider,
			started,
			signal.aborted ? "aborted" : error instanceof WebAccessError ? error.reason : "unreachable",
		);
		throw safeFailure(error, signal);
	}
}

/** One deadline covers DNS, the selected provider, and the direct fallback. Cancellation never falls back. */
export async function readPage(input: string, context: WebAccessContext): Promise<ReadPageResult> {
	const signal = deadline(context.signal);
	const started = Date.now();
	const provider = context.connection?.provider ?? "builtin";
	let fallback: WebAccessFailure | undefined;
	try {
		await consume(context.userId, signal);
		const url = await assertPublicTarget(input, signal);
		if (context.connection) {
			// Reserve five seconds of the same overall budget for the direct reader.
			const externalBudget = Math.max(1, WEB_ACCESS_DEADLINE_MS - (Date.now() - started) - 5_000);
			const externalSignal = AbortSignal.any([signal, AbortSignal.timeout(externalBudget)]);
			try {
				// Remote services must independently protect their own redirects and DNS lookups.
				const page = await externalRead(url.toString(), {
					connection: context.connection,
					signal: externalSignal,
				});
				if (page.resolvedUrl) await assertPublicTarget(page.resolvedUrl, externalSignal);
				const content = pageContent(page.content);
				externalSignal.throwIfAborted();
				log("read", provider, started, "success");
				return {
					...page,
					...content,
					requestedUrl: url.toString(),
					retrievedAt: new Date().toISOString(),
					method: context.connection.provider,
				};
			} catch (error) {
				signal.throwIfAborted();
				const failure = safeFailure(error, externalSignal);
				if (failure.reason === "unsafe-url") throw failure;
				fallback = failure.reason;
			}
		}
		const page = await readBuiltinPage(url.toString(), signal);
		const content = pageContent(htmlToText(page.html));
		signal.throwIfAborted();
		log("read", provider, started, "success", fallback ? `${fallback}:builtin` : undefined);
		return {
			...page,
			...content,
			requestedUrl: url.toString(),
			retrievedAt: new Date().toISOString(),
			method: "builtin",
			format: "text",
			...(fallback ? { fallbackReason: fallback } : {}),
		};
	} catch (error) {
		log(
			"read",
			provider,
			started,
			signal.aborted ? "aborted" : error instanceof WebAccessError ? error.reason : "unreachable",
			fallback ? `${fallback}:failed` : undefined,
		);
		throw safeFailure(error, signal);
	}
}

/**
 * Explicit settings test. Provider operations are independent and never use the built-in fallback. Search is tested
 * against SearXNG when the server sends searches there, and the log names which service each operation tested.
 * Without a connection, reading is not tested and reports `unavailable`: only the built-in reader serves it.
 */
export async function probeWebAccess(
	connection: WebAccessConnection | null,
	context: { userId: string; signal?: AbortSignal | undefined },
) {
	const signal = deadline(context.signal);
	await consume(context.userId, signal);
	const searxng = env.WEB_SEARCH_SEARXNG_URL;
	const probe = async (operation: "search" | "read") => {
		const started = Date.now();
		const provider = operation === "search" && searxng ? "searxng" : (connection?.provider ?? "builtin");
		try {
			if (operation === "search" && searxng) await searchSearxng("example domain", { baseUrl: searxng, signal });
			else if (!connection) throw new WebAccessError("unavailable");
			else if (operation === "search") await externalSearch("example domain", { connection, signal });
			else {
				const url = await assertPublicTarget("https://example.com/", signal);
				const page = await externalRead(url.toString(), { connection, signal });
				pageContent(page.content);
				if (page.resolvedUrl) await assertPublicTarget(page.resolvedUrl, signal);
			}
			signal.throwIfAborted();
			log(operation, provider, started, "success");
			return { success: true };
		} catch (error) {
			const failure = safeFailure(error, signal);
			log(operation, provider, started, failure.reason);
			return { success: false, error: failure.reason };
		}
	};
	const [search, read] = await Promise.all([probe("search"), probe("read")]);
	return { search, read };
}
