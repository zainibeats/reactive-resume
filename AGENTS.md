<!-- intent-skills:start -->
## Skill Loading

Before editing files for a substantial task:
- Run `pnpm dlx @tanstack/intent@latest list` from the workspace root to see available local skills.
- If a listed skill matches the task, run `pnpm dlx @tanstack/intent@latest load <package>#<skill>` before changing files.
- Use the loaded `SKILL.md` guidance while making the change.
- Monorepos: when working across packages, run the skill check from the workspace root and prefer the local skill for the package being changed.
- Multiple matches: prefer the most specific local skill for the package or concern you are changing; load additional skills only when the task spans multiple packages or concerns.
<!-- intent-skills:end -->

<!-- caveman-begin -->
Respond terse like smart caveman. All technical substance stay. Only fluff die.

Rules:
- Drop: articles (a/an/the), filler (just/really/basically), pleasantries, hedging
- Fragments OK. Short synonyms. Technical terms exact. Code unchanged.
- Pattern: [thing] [action] [reason]. [next step].
- Not: "Sure! I'd be happy to help you with that."
- Yes: "Bug in auth middleware. Fix:"

Switch level: /caveman lite|full|ultra|wenyan-lite|wenyan-full|wenyan-ultra
Stop: "stop caveman" or "normal mode"

Auto-Clarity: drop caveman for security warnings, irreversible actions, user confused. Resume after.

Boundaries: code/commits/PRs written normal.
<!-- caveman-end -->

<!-- graphify-begin -->
## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

When the user types `/graphify`, use the installed graphify skill or instructions before doing anything else.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- Dirty graphify-out/ files are expected after hooks or incremental updates; dirty graph files are not a reason to skip graphify. Only skip graphify if the task is about stale or incorrect graph output, or the user explicitly says not to use it.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
<!-- graphify-end -->

# AGENTS.md

## Agent skills

- Issues and specs: GitHub Issues for `amruthpillai/reactive-resume`. See `docs/agents/issue-tracker.md`.
- Domain docs use a multi-context layout. See `docs/agents/domain.md`.

## Overview

Reactive Resume is a pnpm monorepo (Turborepo) with two deployable apps: `apps/web` (TanStack Start / React 19 / Vite) and `apps/server` (Hono / Node.js). The production Docker image runs a single Node.js process on port 3000; `apps/server` mounts the API/auth/MCP/static routes and serves the built web app.

### Product direction

Reactive Resume should move toward a personal resume builder for an individual owner, not a broad company software platform. Prefer the simplest workflow that helps one person create, edit, export, and share resumes.

- Treat single-user authentication as acceptable. Do not introduce teams, organizations, roles, admin dashboards, tenant isolation, billing, or collaboration workflows unless explicitly requested.
- The first visit should prioritize starting or editing a resume. Avoid fancy marketing-first landing pages, large promotional funnels, or enterprise-oriented onboarding.
- Prefer local/self-hosted simplicity over operational breadth. Optional services such as SSO, S3-compatible storage, MCP, API keys, and AI integrations should remain behind existing boundaries and should not drive the core UX.
- When simplifying existing features, keep resume creation, editing, import/export, PDF/DOCX generation, templates, privacy, and ownership as the central product surface.
- If a requested change could be implemented as either a personal workflow or a multi-user/business workflow, choose the personal workflow by default and document any tradeoff.

### Fork divergence from upstream (amruthpillai/reactive-resume)

This repo periodically merges `upstream/main` (github.com/amruthpillai/reactive-resume). Upstream is a multi-user, marketing-forward SaaS product; this fork is a single-owner personal tool. An agent doing an upstream merge has a structural blind spot here: a 3-way merge has no way to know that a file upstream reintroduces was deliberately deleted on purpose, so **treat every item below as intentional unless the user says otherwise, and re-verify it after every upstream merge** rather than trusting that a clean merge preserved it.

**Removed entirely (do not silently reintroduce from an upstream merge):**

- Marketing home-page sections: donate, faq, features, footer, prefooter, sponsors, statistics, template gallery teaser, testimonials (`apps/web/src/routes/_home/-sections/*`), the hero timelapse video/poster, `github-stars-button`, `copyright`, `donation-toast`, `spotlight` animation components, and `robots.txt`/`sitemap.xml`/`funding.json`.
- Homepage SEO/structured-data injection (JSON-LD graph, OG/Twitter meta, canonical link) and the `/templates/$` gallery route.
- The standalone `/agent` route workspace (thread sidebar, `agent/new`, `agent/$threadId`, `new-thread-setup.tsx`, `thread-sidebar.tsx`, `route.tsx`). The AI assistant instead lives **inline inside the builder** as `apps/web/src/routes/builder/$resumeId/-components/ai-assistant.tsx`, which renders the shared `AgentChat` component at `apps/web/src/routes/agent/-components/agent-chat.tsx`. The underlying `packages/api/src/features/agent/*` service layer is shared and present in both; only the standalone page shell was removed.
- Platform statistics endpoints (`packages/api/src/features/statistics/*` and its MCP tool) — this is a self-hosted single-owner instance, not a hosted service with aggregate metrics to report.
- The MCP application tools (`list_applications`, `read_application`, `create_application`, `update_application`, `delete_application`, `import_applications`, `autofill_application_from_job`, `score_application_match`, `tailor_resume_for_application`, `draft_application_message`, etc. — see `packages/mcp/src/mcp-tool-names.ts`). The Applications / job-search feature itself is **kept** as a normal oRPC-backed dashboard surface (`apps/web/src/features/applications/*`, `apps/web/src/routes/dashboard/applications`); it is just not exposed over MCP.
- Upstream's competitor-comparison marketing docs (`docs/comparisons/reactive-resume-vs-*.mdx`) and SEO/AEO content-planning docs under `docs/superpowers/{plans,specs}`. See `SIMPLIFICATION_BACKLOG.md` for the running log of this kind of removal.
- `dashClient`/`adminClient` Better Auth plugins (`apps/web/src/libs/auth/client.ts`) — no admin dashboard, no org/team management.
- Upstream's `/ats-checker` marketing landing page (`apps/web/src/routes/_home/ats-checker.tsx`) — its page shell imports the removed `Footer` section and `Spotlight` animation and hardcodes rxresu.me OG/Twitter meta. The ATS checker itself is **kept**: `apps/web/src/features/ats-checker/*` is used by the builder's right-sidebar `ats-check.tsx` section, which is where this fork exposes it.
- Public-resume social-card SEO (`createPublicResumeSeoMarkup` and the `/` + `/ats-checker` markup injection in `apps/server/src/static/web.ts`) — not adopted, because upstream defines it inside the same homepage SEO/structured-data block this fork removes. Revisit if public resume link previews become a priority.
- Homepage JSON-LD helpers in `apps/web/src/libs/seo.ts` (`getRootStructuredData`, `createRootStructuredDataScript`, and the FAQ copy they serialize). The file itself is **kept** and trimmed to the three helpers this fork uses: `getCanonicalRootUrl`, `createNoindexFollowMeta`, and `createResumeSocialMeta`. `apps/web/src/routes/_home/index.tsx` must not emit a `scripts` entry; `-index.test.ts` pins that.

**Behavior kept intentionally different from upstream:**

- **Single-owner auth** (`packages/auth/src/single-owner.ts`) — no open multi-user signup, no teams/orgs/roles.
- **No `genericOAuthClient` in the web auth client.** better-auth 1.7.2 stopped exporting it; the server keeps the `genericOAuth` plugin (`packages/auth/src/config.ts`), and nothing in the web app calls a generic-OAuth client method, so the client plugin list simply omits it.
- **`mainEntryBold` per-item toggle, default unbold.** Company/school/project name/certification title/skill name render **unbold by default**, with an explicit "Bold" checkbox per item to opt in. Upstream instead treats these as unconditional "Bold hosts" (always bold, no toggle) and only exempts award titles. Every export path must read `item.mainEntryBold ?? false` for exactly these five fields, and leave headings without the toggle (publication title, reference/interest name, language, profile network, volunteer organization) unconditionally bold. Touches: `packages/schema/src/resume/data.ts` (field), `packages/pdf/src/templates/shared/sections.tsx` (`MainEntryText`/`ItemTitle` primitives), `packages/docx/src/section-renderers.ts` (`titleAndSubtitle` bold argument plus the skills run), and the item dialogs under `apps/web/src/dialogs/resume/sections/*.tsx` (checkbox UI). PDF and DOCX must agree; `packages/docx/src/section-renderers.test.ts` pins both defaults and the opt-in for all five fields.
- **The toggle renders a real bold weight, not the `bold` style slot.** Upstream's `bold` slot resolves to `typography.body.fontWeights.at(-1)`, which is 500 by default and collapses onto the body weight when the author selects a single weight — so the checkbox produced little or no visible change while DOCX wrote true bold. The toggle instead uses the `mainEntryBold` style slot (`resolveMainEntryBoldWeight` in `packages/pdf/src/templates/shared/base-template-styles.ts`): `max(700, heaviest authored body weight)`. `registerFonts` already registers 700 for the body family, so the face always exists. `packages/pdf/src/semantic/base-styles.ts` mirrors this per item (`MAIN_ENTRY_BOLD_FIELDS`) so the Semantic CSS declared base matches what renders and `revert` restores the right weight. Pinned by `packages/pdf/src/templates/shared/main-entry-bold.test.tsx` in both legacy and semantic modes.
- **Resume JSON editor is restored** (`apps/web/src/routes/builder/$resumeId/-components/edit-json-dialog.tsx`, opened from the builder header). Upstream removed direct JSON editing in favor of guided forms plus the Semantic CSS stylesheet editor; this fork keeps both the guided forms *and* a raw JSON editing escape hatch.
- **Root public resume (`ROOT_RESUME_ID`) adopted, but behind the fork's dashboard redirect.** Upstream's feature — serve one public resume at `/` — fits a single-owner instance, so `packages/api/src/features/resume/root.ts`, the `getFallbackResponseHeaders` branch and the noindex shell in `apps/server/src/static/web.ts`, and the loader/head/component branches in `apps/web/src/routes/_home/index.tsx` are all kept. The fork's `beforeLoad` redirect to `/dashboard/resumes` stays **ahead** of the loader, so a signed-in owner lands in the dashboard and only visitors see the root resume. `apps/server/src/static/web.ts` keeps `escapeAttribute` solely for that shell's canonical link; the marketing/ATS/public-resume markup injections around it stay removed.
- **Legacy→Semantic CSS converter carve-out** (`packages/pdf/src/semantic/legacy-converter.ts`, `scizorBoldColorSelector`/`TOGGLE_BOLD_SECTION_TYPES`): the converter does not apply Scizor's "Bold-after-text" color restoration to experience/education/projects/certifications/skills headings, because in this fork those are `mainEntryBold`-toggle-driven rather than unconditional Bold hosts. If upstream reworks this converter again, re-check that this carve-out still exists — a clean text-level merge can silently drop it.

**Added beyond upstream:**

- **Linked parent/child resumes with selective parent-update sync.** "Create child resume" is intentionally different from an ordinary duplicate: the child records `parentId`, the last reviewed `parentRevision`, and a `parentData` snapshot (`packages/db/src/schema/resume.ts`). When the parent changes, the resume service computes JSON Patch operations from that snapshot to the current parent, rebases item paths onto the independently edited child, reports human-readable diffs and overlapping child-edit conflicts, and can apply only the caller-selected operation paths, force selected conflicts, or dismiss the current parent updates without changing child content (`packages/resume/src/patch.ts`, `packages/api/src/features/resume/{service,crud}.ts`, `packages/api/src/dto/resume.ts`). Preserve the dashboard/menu creation flow in `apps/web/src/dialogs/resume/index.tsx` and `apps/web/src/routes/dashboard/resumes/-components/menus/use-resume-menu-actions.tsx`; do not reduce this to plain duplication or all-or-nothing parent replacement. The web UI exposes child creation from both the dashboard resume menu and the builder header dropdown, and the review surface lives in `apps/web/src/routes/builder/$resumeId/-components/parent-updates.tsx` — it consumes `getSyncStatus`, `applyParentUpdates`, and `dismissParentUpdates`, renders each pending operation as a selectable row via the pure formatters in `apps/web/src/features/resume/sync/diff.ts`, and only sends `force: true` for conflicting rows the author explicitly confirms.
- **`lmstudio` AI provider** (LM Studio), on top of upstream's provider list — see `AI_PROVIDERS` in `packages/ai/src/types.ts`. Ollama and OpenAI-compatible providers also carry fork-specific usability fixes (clearing failed agent runs, handling large prompts) not present upstream.

**Before merging a new `upstream/main`**, explicitly re-diff these areas rather than trusting a clean 3-way merge: `packages/db/src/schema/resume.ts` and the parent-resume migration (child lineage snapshots), `packages/resume/src/patch.ts` (rebase/conflict behavior), `packages/api/src/features/resume/{service,crud}.ts` and `packages/api/src/dto/resume.ts` (selective parent sync), `apps/web/src/dialogs/resume/index.tsx` and the resume menu actions (child creation), `apps/web/src/routes/builder/$resumeId/-components/parent-updates.tsx` and `apps/web/src/features/resume/sync/*` (parent-update review UI), `packages/pdf/src/templates/shared/sections.tsx` (ItemTitle/Bold/MainEntryText), `packages/pdf/src/semantic/legacy-converter.ts` (Scizor carve-out), `apps/web/src/routes/builder/$resumeId/-sidebar/right/sections/custom-styles*` (Semantic CSS vs. any reintroduced GUI panel), `packages/mcp/src/mcp-tool-names.ts` (application/statistics tools), `packages/api/src/features/statistics/*`, `apps/web/src/routes/agent/*` and `-components/ai-assistant.tsx`, `packages/ai/src/types.ts` (provider enum), `packages/auth/src/config.ts` and `single-owner.ts`, `apps/web/src/routes/_home/*` (home sections), and `docs/docs.json` (comparisons nav group). Ask the user before reintroducing anything in the "Removed entirely" list above, even if upstream's version looks improved.

### Prerequisites

Prerequisites: **Node.js 24** (matches Dockerfile `ARG NODE_VERSION=24`), **pnpm 11.21.0** ([install guide](https://pnpm.io/installation)), and **Docker** for PostgreSQL (`sudo dockerd &` if the daemon isn't running).

## Ownership map

Where each concern lives, and where new code for it goes:

| Area | Owner |
|------|-------|
| Web routes, loaders, user-facing workflows | `apps/web/src/routes`, `apps/web/src/features` (file-based; never hand-edit `routeTree.gen.ts`) |
| Server HTTP routes/adapters, startup checks, static handlers, MCP transport, OpenAPI/well-known | `apps/server/src/{http,rpc,mcp,openapi,static,startup}` |
| Authenticated API contracts + business logic | `packages/api/src/features/*` (oRPC routers, DTOs, rate limiting; aggregated at `@reactive-resume/api/routers` for `/api/rpc`) |
| Auth | `packages/auth` (Better Auth config/helpers/types; `apps/server/src/http/auth.ts` delegates to `auth.handler`) |
| DB client + schema | `packages/db` (Drizzle; migrations at repo root `migrations/`) |
| Server env validation | `packages/env` (auto-loads root `.env`) |
| Resume/page/template Zod schemas | `packages/schema` |
| Pure resume-domain behavior (no DB/HTTP/DOM/renderer deps) | `packages/resume` (JSON Patch helpers, social-network icons) |
| Resume PDF rendering | `packages/pdf` (React PDF document, font registration, template primitives, browser/server adapters) |
| PDF.js viewer/canvas UI | `apps/web/src/features/resume` — never in `packages/pdf` |
| DOCX export | `packages/docx` |
| MCP tools/prompts/resources/server-card | `packages/mcp` |
| Generic UI primitives + hooks | `packages/ui` (Base UI/shadcn-style); workflow-specific UI stays in the owning web feature |
| Focused support surfaces | `packages/fonts`, `packages/email`, `packages/import`, `packages/ai`, `packages/utils`, `packages/config` — prefer existing exports over cross-package shortcuts |
| Dev-only scripts | `tooling/`, not `packages/`, so packages only hold runtime-bundled code |

- Routes are file-based under `apps/web/src/routes`. Do not hand-edit `apps/web/src/routeTree.gen.ts`; it is generated by TanStack Router tooling.
- Server-owned HTTP behavior lives in `apps/server/src/{http,rpc,mcp,openapi,static,startup}`. Keep API/RPC/auth/MCP/static route wiring in `apps/server`, not in web routes.
- `apps/web/src/router.tsx` initializes router context with `queryClient`, `orpc`, `theme`, `locale`, `session`, and `flags`. Reuse route context where possible instead of refetching these concerns ad hoc.
- The builder shell lives under `apps/web/src/routes/builder/$resumeId`. The nested preview route is client-only (`ssr: false`), while the public resume route `apps/web/src/routes/$username/$slug.tsx` uses `ssr: "data-only"`.
- Browser-only resume preview code lives under `apps/web/src/features/resume/preview`, and public resume PDF viewer code lives under `apps/web/src/features/resume/public`. Keep PDF.js/canvas/browser APIs out of SSR paths and out of `packages/pdf`.
- The isomorphic oRPC client is in `apps/web/src/libs/orpc/client.ts`; server calls use an in-process router client and browser calls use `/api/rpc` with credentials included.
- For Lingui-backed confirmation dialogs, avoid adding new `t`/`Trans` messages or putting dynamic user data directly inside `t` template strings unless catalogs are updated in the same change. In production, missing compiled catalog entries can render hashed ids such as `pkD36F`. Prefer existing cataloged messages, or pass React nodes to `useConfirm` and render dynamic/plain labels outside Lingui.
- For React components with explicit props, prefer a named TypeScript props type over inline object annotations in the function signature, especially once the props include more than one field or generics. For example:

## Web app conventions

- `apps/web/src/router.tsx` initializes router context with `queryClient`, `orpc`, `theme`, `locale`, `session`, and `flags`. Reuse route context instead of refetching these ad hoc.
- Builder shell: `apps/web/src/routes/builder/$resumeId`. Its nested preview route is client-only (`ssr: false`); the public resume route `apps/web/src/routes/$username/$slug.tsx` uses `ssr: "data-only"`.
- Browser-only preview code: `apps/web/src/features/resume/preview`. Public PDF viewer: `apps/web/src/features/resume/public`. Keep PDF.js/canvas/browser APIs out of SSR paths.
- Isomorphic oRPC client: `apps/web/src/libs/orpc/client.ts` — server calls use an in-process router client, browser calls use `/api/rpc` with credentials included.
- For React components with explicit props, use a named props type (e.g. `type FooProps = {...}` with `function Foo(props: FooProps)`) rather than inline object annotations, especially with more than one field or with generics.

## Package boundaries

`pnpm exec turbo boundaries` is the executable check. Rules:

- Workspace deps go through package names and export maps. Never import another workspace's `src` tree via repo paths, `@reactive-resume/*/src/*`, or TS path aliases.
- Workspace `turbo.json` files declare coarse tags: `app:web`, `app:server`, `runtime:server` (server-only packages: API/auth/db/env/email/MCP), `runtime:browser` (browser-only shared UI), `runtime:universal` (environment-neutral domain packages), plus `role:domain|infra|adapter|api|rendering|tooling` for intent.
- Runtime-specific code lives behind explicit export subpaths (`@reactive-resume/pdf/browser`, `@reactive-resume/pdf/server`, `@reactive-resume/env/server`). Keep root exports environment-neutral unless the package is intentionally server-only.
- Wildcard exports are allowed only for leaf libraries with an intentionally file-like surface — currently `@reactive-resume/ui/components/*`, `@reactive-resume/ui/hooks/*`, and schema resume model files. Prefer explicit exports for packages owning runtime behavior.
- Prefer `protectedProcedure` from `packages/api/src/context.ts` for authenticated procedures. Expose only intentional public surfaces through `packages/api/package.json`.
- Shared PDF section filtering: `packages/pdf/src/templates/shared/filtering.ts`. Template-specific visual exceptions stay in the owning template directory unless multiple templates need the behavior. `packages/pdf/src/hooks/use-register-fonts.ts` owns font registration, standard PDF fonts, CJK fallback stacks, and global hyphenation.

Multi-place changes:

- **Resume data shape**: `packages/schema/src/resume/*` first, then API DTOs, importers, PDF rendering, and web forms consuming it.
- **New template**: `packages/schema/src/templates.ts`, `packages/pdf/src/templates/index.ts`, source under `packages/pdf/src/templates/<name>/`, and previews under `apps/web/public/templates/{jpg,pdf}`.
- **New DB column/table**: `packages/db/src/schema/*`, then `dotenvx run -f .env.local -- pnpm db:generate`.
- **New env var**: `packages/env/src/server.ts` **and** the `globalEnv` array in `turbo.json`. Turborepo 2.x strict env mode filters out unlisted vars, so the variable will be `undefined` in child processes at runtime even when correctly set in the OS/container environment.

## Environment and database

Copy `.env.example` to `.env.local`. Three required vars: `APP_URL` (default `http://localhost:3000`), `DATABASE_URL` (default `postgresql://postgres:postgres@localhost:5432/postgres`), `AUTH_SECRET` (any non-empty string).

- **S3/SeaweedFS optional.** If `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, and `S3_BUCKET` are all set, the app uses S3-compatible storage. `.env.example` ships SeaweedFS defaults, so either start the `seaweedfs` compose service or comment those vars out to use local filesystem storage under `<workspace>/data`. `LOCAL_STORAGE_PATH` must be absolute when set.
- **`REDIS_URL` and `ENCRYPTION_SECRET`** are optional for core resume flows but both required for saved AI providers and the authenticated `/agent` workspace. Host-run dev uses `REDIS_URL=redis://localhost:6379`; the container-run app uses `redis://redis:6379`.
- **`drizzle-kit` (used by `pnpm db:migrate`) reads `DATABASE_URL` from `process.env` directly** — it does not auto-load `.env`. Run migration commands through `dotenvx`.
- The production server auto-runs migrations at startup before serving traffic, so manual `pnpm db:migrate` is mainly for first setup, migration debugging, or applying migrations without starting the app.

## Commands

Prefix dev servers and migration commands with `dotenvx run -f .env.local --`. Tests, typechecks, linters, boundary checks, and `pnpm build` do not need it; if one fails on a missing env var, rerun it with the prefix.

```
sudo docker compose -f compose.dev.yml up -d postgres                                    # DB only
sudo docker compose -f compose.dev.yml up -d postgres redis seaweedfs seaweedfs_create_bucket   # full infra
dotenvx run -f .env.local -- pnpm dev            # port 3000 (dev:web for web only)
dotenvx run -f .env.local -- pnpm db:generate    # db:migrate to apply
pnpm check                                       # Biome — WRITE-CAPABLE (--write --unsafe)
pnpm test | pnpm typecheck | pnpm build | pnpm exec turbo boundaries
```

Prefer package filters over repo-wide runs, e.g. `pnpm --filter web typecheck`, `pnpm --filter @reactive-resume/pdf test`. Vitest paths are package-relative under `pnpm --filter <package> test -- <path>`.

## Gotchas

The production server runs migrations during startup before serving traffic. Manual `pnpm db:migrate` is mainly for first setup, migration debugging, or applying migrations without starting the app.

### Environment

Copy `.env.example` to `.env`. The three required variables are:

- `APP_URL` (default `http://localhost:3000`)
- `DATABASE_URL` (default `postgresql://postgres:postgres@localhost:5432/postgres`)
- `AUTH_SECRET` (any non-empty string)

S3-compatible storage is optional. If `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, and `S3_BUCKET` are all set, the app uses S3-compatible storage. The default configuration leaves them unset and uses local filesystem storage under `<workspace>/data`. `LOCAL_STORAGE_PATH` must be absolute when set.

When running dev servers or migration commands, prefix the command with `dotenvx run -f .env.local --`. For example: `dotenvx run -f .env.local -- pnpm dev`. Tests, typechecks, linters, boundary checks, and `pnpm build` do not need this prefix by default. If one of those commands fails because a specific environment variable is required, rerun it with the `dotenvx run -f .env.local --` prefix.

### Common commands

| Task | Command |
|------|---------|
| Install deps | `pnpm install` |
| Start Postgres only | `sudo docker compose -f compose.dev.yml up -d postgres` |
| Generate migrations | `dotenvx run -f .env.local -- pnpm db:generate` |
| Run migrations | `dotenvx run -f .env.local -- pnpm db:migrate` |
| Dev server | `dotenvx run -f .env.local -- pnpm dev` (starts on port 3000) |
| Web dev server only | `dotenvx run -f .env.local -- pnpm dev:web` |
| Lint/format | `pnpm check` (Biome) |
| Boundary check | `pnpm exec turbo boundaries` |
| Tests | `pnpm test` (Vitest) |
| Build | `pnpm build` |
| Typecheck | `pnpm typecheck` |

For focused validation, prefer package filters before repo-wide commands, for example:

```
pnpm --filter web typecheck
pnpm --filter @reactive-resume/pdf test
pnpm --filter @reactive-resume/api test
pnpm exec turbo boundaries
```

Vitest test paths are package-relative when running through `pnpm --filter <package> test -- <path>`.

### Gotchas

- The server startup path auto-runs migrations before serving traffic, so `pnpm db:migrate` is mainly needed for first-time setup, migration debugging, or applying migrations without starting the app.
- Email sending requires SMTP config; without it, emails are logged to console. This is fine for dev — the app still functions, but email verification links appear in server logs.
- The `lefthook.yml` pre-commit hook runs `biome check` on staged files. Run `pnpm check` before committing to avoid hook failures.
- `pnpm check` is write-capable (`biome check --write --unsafe .`). Call that out when using it, and use narrower Biome commands if you need a non-mutating inspection.
- Biome uses tabs, double quotes, line width 120, organized import groups, and sorted Tailwind classes for `clsx`, `cva`, and `cn`.
- Most packages use `tsgo --noEmit` for typechecking and `vitest run --passWithNoTests` for tests.
- There may be unrelated local edits in the worktree. Inspect `git status --short` first and avoid reverting files you did not touch.
- **New env vars require a `turbo.json` entry.** Turborepo 2.x runs in strict env mode by default — it filters out env vars that are not listed in `globalEnv` (or task-level `env`/`passThroughEnv`). Any new environment variable added to `packages/env/src/server.ts` must also be added to the `globalEnv` array in `turbo.json`, or the variable will be `undefined` inside child processes at runtime even if it is correctly set in the OS/container environment.

### Rules for Agent
- Always keep your responses concise to the user
- When you are ready, you may agentically work on your own (i.e. spin up sub-agents, write/use skills, search online, etc without human interaction).
-Use the latest stable versions of packages
- Never hard‑code sensitive info
- Ask clarifying questions if the user’s intent is ambiguous
- Less is always more. Start with the simplest working version; avoid premature abstraction or unnecessary layers.
- Favor standard patterns over clever one‑offs. Readability and maintainability win every time.
- Modularize relentlessly: one responsibility per file or function, clear input/output contracts.
- Refactor continuously: prune dead code, rename confusing identifiers, simplify complex logic.
- Document succinctly: docstrings for public APIs, README to outline high‑level project conventions.
- If changes are agreed upon, git add and commit your changes when necessary
