-- Merges the fork's migration branch (20260614091735_slim_red_wolf, 20260703092347_rare_scarlet_spider:
-- resume.revision/parent_* columns, resume_parent_id_index, resume_parent_id_resume_id_fk, user_single_owner_idx)
-- with upstream's chain up to 20261001042749_v6_release. Both branches already ran, so the database needs no change;
-- the snapshot joins the two leaves so drizzle-kit's non-commutative check and future diffs see one schema.
SELECT 1;
