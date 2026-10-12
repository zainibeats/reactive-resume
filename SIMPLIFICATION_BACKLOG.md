# Simplification Backlog

Open simplification opportunities only. Completed removals are recorded in `AGENTS.md` ("Fork divergence from upstream")
and in git history; delete an entry here once it is done.

## Open

### Remove remaining hosted-documentation links

v6 links the owner to the public hosted docs from inside the app. A self-hosted personal instance should not send the owner
to the hosted project's site from core settings.

- `apps/web/src/routes/dashboard/settings/route.tsx` (`Docs` nav link)
- `apps/web/src/features/settings/root.tsx` (docs link)
- `apps/web/src/features/settings/ai/mcp.tsx` (MCP guide link)

### Drop the `/dashboard/resumes` redirect stub

`apps/web/src/routes/dashboard/resumes/index.tsx` only redirects pre-v6 links to the Documents library (upstream keeps it
"through 6.0.x"). Harmless; remove once old bookmarks no longer matter.

### Re-run `pnpm -s knip`

Not run since the v6 merge. Check for dependencies or exports the merge left unused.
