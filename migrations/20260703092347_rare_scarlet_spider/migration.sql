DO $$
BEGIN
	IF (SELECT count(*) FROM "user") > 1 THEN
		RAISE EXCEPTION 'Single-owner migration requires at most one existing user';
	END IF;
END
$$;
--> statement-breakpoint
CREATE UNIQUE INDEX "user_single_owner_idx" ON "user" ((true));
