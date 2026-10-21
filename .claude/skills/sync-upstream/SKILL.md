---
name: sync-upstream
description: Bring upstream Reactive Resume changes (github.com/reactive-resume/reactive-resume) into the owner's fork zainibeats/reactive-resume, following the fork's AGENTS.md and docs/fork/upstream.md. Use this whenever the user asks to merge, sync, pull, update or catch up the fork with upstream, check what's new upstream, or cherry-pick upstream fixes into reactive-resume — even if they just say "sync upstream", "merge from upstream" or "update my resume builder".
---

# Sync the reactive-resume fork with upstream

Two files in the fork are the source of truth for **how** to sync and **what** to keep, skip or re-check:

- `AGENTS.md`: general repo rules, the checks to run, and a short summary of how the fork diverges from upstream.
- `docs/fork/upstream.md`: the sync policy, the ledger of reviewed upstream commits, the "Removed entirely" list, intentional behavior differences, fork-only features and the re-check list.

Both change over time, so read them fresh on every run instead of relying on memory or on this skill.

## Steps

1. **Repository and branch.** Work in `zainibeats/reactive-resume` (attach it to the session if it isn't there). Use the current branch, or the session's designated branch if one is given. If that branch's pull request was already merged, restart the branch from the latest `main` before adding new work.

2. **Read `AGENTS.md`, then all of `docs/fork/upstream.md`**, before looking at any upstream commits. `docs/fork/upstream.md` says whether to merge or cherry-pick, which upstream commits were already reviewed, what was removed on purpose, which areas to re-check, and how to handle migrations.

3. **Find what's new upstream.** Add the `upstream` remote (`https://github.com/reactive-resume/reactive-resume`) if it's missing, then fetch `main`. The Ledger in `docs/fork/upstream.md` opens with a "Reviewed through upstream `<sha>`" marker, so list upstream commits after it. Then check them against the Ledger's lines (one line can list several commits) and the `cherry picked from commit` trailers from `git log --grep "cherry picked from"`. Any upstream commit after `11571ae` that appears in neither is new. That includes one older than the marker, which means an earlier sync missed it.

4. **Sort before applying.** Group the new commits into: take (fixes and resume-builder improvements), skip (things the sync policy in `docs/fork/upstream.md` says the fork doesn't adopt), and ask (large new features, anything that would bring back an item from that file's "Removed entirely" list, or anything unclear). Show the user that short list and get answers on the "ask" group before applying it. A wrong guess here means hours of rework.

5. **Apply and verify.** Bring in the agreed commits the way the sync policy in `docs/fork/upstream.md` describes, and resolve conflicts while keeping the fork's features. When a commit is only partly relevant, drop its unrelated hunks. That includes test changes that target UI the fork doesn't have. Never copy upstream migration folders, because upstream's migration chain doesn't match the fork's; follow the migration note in `docs/fork/upstream.md` instead. After applying, go through every item in that file's "Re-check after every sync" list, then run the checks `AGENTS.md` lists, including the browser end-to-end tests, before pushing.

6. **Record and deliver.** Add one line per reviewed upstream commit (or per group of commits sharing one decision) to the Ledger in `docs/fork/upstream.md`, marked `taken`, `partial` (some hunks dropped; say which) or `skipped` (say why). Then move its "Reviewed through" marker to the newest upstream commit you reviewed, so the next run knows where it left off. If the sync removes something new or adds fork-specific behavior, update the matching section of that file. Touch `AGENTS.md` only if its short summary becomes wrong, and don't add sync details back into it. Commit with Conventional Commits, push the branch, and offer to open a pull request.

7. **Report briefly.** List what came in, what was skipped and why, anything waiting on the user, and the check results.
