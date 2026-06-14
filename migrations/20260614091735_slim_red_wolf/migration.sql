ALTER TABLE "resume" ADD COLUMN "revision" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "resume" ADD COLUMN "parent_id" text;--> statement-breakpoint
ALTER TABLE "resume" ADD COLUMN "parent_revision" integer;--> statement-breakpoint
ALTER TABLE "resume" ADD COLUMN "parent_data" jsonb;--> statement-breakpoint
CREATE INDEX "resume_parent_id_index" ON "resume" ("parent_id");--> statement-breakpoint
ALTER TABLE "resume" ADD CONSTRAINT "resume_parent_id_resume_id_fk" FOREIGN KEY ("parent_id") REFERENCES "resume"("id") ON DELETE SET NULL;