CREATE TABLE "web_search_settings" (
	"user_id" text PRIMARY KEY,
	"searxng_url" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "web_search_settings" ADD CONSTRAINT "web_search_settings_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;