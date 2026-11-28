import * as pg from "drizzle-orm/pg-core";
import { user } from "./auth";

/** One selected web connection per user. */
export const webAccessCredential = pg.pgTable("web_access_credentials", {
	userId: pg
		.text("user_id")
		.primaryKey()
		.references(() => user.id, { onDelete: "cascade" }),
	provider: pg.text("provider", { enum: ["firecrawl", "tavily", "exa"] }).notNull(),
	encryptedApiKey: pg.text("encrypted_api_key").notNull(),
});

/** The user's own SearXNG instance for web search. The server's `WEB_SEARCH_SEARXNG_URL` takes precedence. */
export const webSearchSetting = pg.pgTable("web_search_settings", {
	userId: pg
		.text("user_id")
		.primaryKey()
		.references(() => user.id, { onDelete: "cascade" }),
	searxngUrl: pg.text("searxng_url").notNull(),
});
