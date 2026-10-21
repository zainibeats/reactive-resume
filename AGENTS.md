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

## Overview

Reactive Resume is a pnpm monorepo (Turborepo) with two deployable apps: `apps/web` (React 19 SPA with TanStack Router and Vite) and `apps/server` (Hono / Node.js). The production Docker image runs a single Node.js process on port 3000; `apps/server` mounts the API/auth/MCP/static routes and serves the built web app. Since the v6 merge the resume editor is upstream's Write / Design / Check editor, PDFs render through Forme (`packages/pdf/src/forme`), and resumes live in v6's Documents library with Trash (resumes only: this fork removed upstream's job tracker and cover-letter documents).

### Product direction

Reactive Resume should move toward a personal resume builder for an individual owner, not a broad company software platform. Prefer the simplest workflow that helps one person create, edit, export, and share resumes.

- Treat single-user authentication as acceptable. Do not introduce teams, organizations, roles, admin dashboards, tenant isolation, billing, or collaboration workflows unless explicitly requested.
- The first visit should prioritize starting or editing a resume. Avoid fancy marketing-first landing pages, large promotional funnels, or enterprise-oriented onboarding.
- Prefer local/self-hosted simplicity over operational breadth. Optional services such as SSO, S3-compatible storage, MCP, API keys, and AI integrations should remain behind existing boundaries and should not drive the core UX.
- When simplifying existing features, keep resume creation, editing, import/export, PDF/DOCX generation, templates, privacy, and ownership as the central product surface.
- If a requested change could be implemented as either a personal workflow or a multi-user/business workflow, choose the personal workflow by default and document any tradeoff.

### Fork divergence from upstream

This fork tracks `upstream/main` (github.com/reactive-resume/reactive-resume) but is a single-owner personal tool; upstream is a multi-user SaaS product. **The full record lives in [`docs/fork/upstream.md`](docs/fork/upstream.md): read it before syncing or cherry-picking from upstream, and before editing any file it names.** It holds the sync policy, the ledger of taken/skipped upstream commits, every removal and fork-specific behavior with file paths, and the re-check list.

- **Sync by `git cherry-pick -x`, never by merging `upstream/main`** (upstream's Career area rewires too much). Record each decision in the ledger. Never copy upstream migration folders.
- **Removed on purpose. Ask the owner before reintroducing any of these, even if upstream improved them:** marketing homepage, homepage SEO and prerender; `/agent` routes; statistics endpoints; the Applications tracker; standalone cover-letter documents (the embedded cover-letter resume section stays); Career; Vercel/Cloudflare/Docker Hub deploy files; admin/dash auth plugins; the public `/ats-checker` page (its engine stays for Check mode); upstream's docs site, community scaffolding and links to the hosted project.
- **Fork behavior to preserve:** single-owner auth; the `mainEntryBold` per-item toggle (default unbold, real 700 weight, PDF, DOCX and ODT agree); the Edit JSON dialog; the root public resume behind the dashboard redirect; the Scizor carve-out in the legacy→Semantic CSS converter; linked parent/child resumes with selective parent-update sync; the `lmstudio` provider and keyless local providers.

### Prerequisites

Prerequisites: **Node.js 24** (pinned in `.nvmrc`; matches Dockerfile `ARG NODE_VERSION=24`), **pnpm 12.9.1** (pinned by `packageManager` in the root `package.json`; pnpm self-manages to it, so any recent pnpm can bootstrap — the Dockerfile's `ARG PNPM_VERSION` only picks the base image) ([install guide](https://pnpm.io/installation)), and **Docker** for PostgreSQL (`sudo dockerd &` if the daemon isn't running).

## Downstream consumer: czaini.net portfolio

The owner's portfolio site (`zainibeats/czaini-monorepo`, deployed on Vercel at czaini.net/portfolio) renders part of its content directly from this app's **JSON export** of the public resume. The owner uploads that export to an R2 bucket at `files/public-resume.json`. The site fetches it server-side (`https://pub-ce3c1c9953b7492c8531cc682159ab2e.r2.dev/files/public-resume.json`) and re-fetches it hourly. **Changing the shape of the exported resume JSON can break the live site**, so treat the fields below as a public contract.

Fields the site reads (consumer code: `apps/web/src/sites/portfolio/lib/resume.ts` and `lib/html.ts` in that repo):

| JSON path                                                | Used for                                                   |
| -------------------------------------------------------- | ---------------------------------------------------------- |
| `basics.email`, `basics.location`                        | Hero kicker and Contact section                            |
| `sections.{experience,education,certifications}.hidden`  | Hidden sections are skipped                                |
| `sections.{experience,education,certifications}.items[]` | Lists rendered in order                                    |
| `items[].id`, `items[].hidden`                           | React keys / site-only links; hidden items skipped         |
| `experience.items[].{company,position,location,period}`  | Experience rows (strings rendered as-is)                   |
| `experience.items[].description`                         | HTML; the site extracts `<li>` text, falling back to `<p>` |
| `education.items[].{school,degree,area,period}`          | Education rows (`degree, area` joined)                     |
| `certifications.items[].{title,issuer,website.url}`      | Certification links                                        |

Rules:

- Do not rename, remove, retype or re-nest these fields, and do not change `description` from HTML to another format (e.g. Markdown or plain text), without telling the owner. The portfolio must be updated in the same rollout.
- Keep item `id`s stable across edits and exports. The site maps the music experience entry (`mpv569j6xclzcdn3762qf0qw`) to a `/music` link by id.
- Adding new fields is safe. The site ignores anything it does not read.
- Failure mode: if the file is missing, returns non-2xx (for example a 403 from Cloudflare Bot Fight Mode on the custom domain, which is why the site uses the `r2.dev` URL) or has a different shape, the Vercel build fails. At runtime, Next.js keeps serving the last good render.
- Upstream cherry-picks that touch `packages/schema/src/resume/*` or the JSON export path need the same check.

## Ownership map

Where each concern lives, and where new code for it goes:

| Area                                                                                            | Owner                                                                                                                                                            |
| ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Web routes, loaders, user-facing workflows                                                      | `apps/web/src/routes`, `apps/web/src/features` (file-based; never hand-edit `routeTree.gen.ts`)                                                                  |
| Server HTTP routes/adapters, startup checks, static handlers, MCP transport, OpenAPI/well-known | `apps/server/src/{http,rpc,mcp,openapi,static,startup}`                                                                                                          |
| Authenticated API contracts + business logic                                                    | `packages/api/src/features/*` (oRPC routers, DTOs, rate limiting; aggregated at `@reactive-resume/api/routers` for `/api/rpc`)                                   |
| Auth                                                                                            | `packages/auth` (Better Auth config/helpers/types; `apps/server/src/http/auth.ts` delegates to `auth.handler`)                                                   |
| DB client + schema                                                                              | `packages/db` (Drizzle; migrations at repo root `migrations/`)                                                                                                   |
| Server env validation                                                                           | `packages/env` (auto-loads root `.env`)                                                                                                                          |
| Resume/page/template Zod schemas                                                                | `packages/schema`                                                                                                                                                |
| Pure resume-domain behavior (no DB/HTTP/DOM/renderer deps)                                      | `packages/resume` (JSON Patch helpers, social-network icons)                                                                                                     |
| Resume PDF rendering                                                                            | `packages/pdf` (React templates converted through `src/forme` to Forme documents, font resolution, template primitives, browser/server adapters)                 |
| PDF.js viewer/canvas UI                                                                         | `apps/web/src/features/resume` — never in `packages/pdf`                                                                                                         |
| DOCX export                                                                                     | `packages/docx`                                                                                                                                                  |
| MCP tools/prompts/resources/server-card                                                         | `packages/mcp`                                                                                                                                                   |
| Generic UI primitives + hooks                                                                   | `packages/ui` (Base UI/shadcn-style); workflow-specific UI stays in the owning web feature                                                                       |
| Focused support surfaces                                                                        | `packages/fonts`, `packages/email`, `packages/import`, `packages/ai`, `packages/utils`, `packages/config` — prefer existing exports over cross-package shortcuts |
| Dev-only scripts                                                                                | `tooling/`, not `packages/`, so packages only hold runtime-bundled code                                                                                          |

## Web app conventions

- `apps/web/src/router.tsx` initializes router context with `queryClient`, `orpc`, `theme`, `locale`, `session`, and `flags`. Reuse route context instead of refetching these ad hoc.
- The web app is a client-rendered SPA. `apps/server` serves `index.html` from `apps/server/src/static/web.ts` (this fork only injects the root-resume noindex/canonical shell there; no homepage OG/JSON-LD); there is no React SSR.
- Builder shell: `apps/web/src/routes/builder/$resumeId`. Public resume route: `apps/web/src/routes/$username/$slug.tsx`.
- Browser-only preview code: `apps/web/src/features/resume/preview`. Public PDF viewer: `apps/web/src/features/resume/public`. Keep PDF.js/canvas code in these features, not in `packages/pdf`.
- oRPC client: `apps/web/src/libs/orpc/client.ts` calls `/api/rpc` with credentials included. `apps/web/src/libs/orpc/fetch.ts` stages large request bodies through Blob on Vercel.
- For Lingui-backed confirmation dialogs, avoid adding new `t`/`Trans` messages or putting dynamic user data directly inside `t` template strings unless catalogs are updated in the same change. In production, missing compiled catalog entries can render hashed ids such as `pkD36F`. Prefer existing cataloged messages, or pass React nodes to `useConfirm` and render dynamic/plain labels outside Lingui.
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

- **Resume data shape**: `packages/schema/src/resume/*` first, then API DTOs, importers, PDF rendering, and web forms consuming it. Also check the external czaini.net portfolio contract (see "Downstream consumer: czaini.net portfolio").
- **New template**: `packages/schema/src/templates.ts`, `packages/pdf/src/templates/index.ts`, source under `packages/pdf/src/templates/<name>/`, and previews under `apps/web/public/templates/{jpg,pdf}`.
- **New DB column/table**: `packages/db/src/schema/*`, then `pnpm db:generate`.
- **New env var**: `packages/env/src/server.ts`, `.env.example`, **and** the `globalPassThroughEnv` array (plus applicable test-task `env` arrays) in `turbo.json`. Turborepo 2.x strict env mode filters out unlisted vars, so the variable will be `undefined` in child processes at runtime even when correctly set in the OS/container environment.

## Environment and database

Copy `.env.example` to `.env.local`. Three required vars: `APP_URL` (default `http://localhost:3000`), `DATABASE_URL` (default `postgresql://postgres:postgres@localhost:5432/postgres`), `AUTH_SECRET` (any non-empty string).

- **S3/SeaweedFS optional.** If `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, and `S3_BUCKET` are all set, the app uses S3-compatible storage. `.env.example` ships SeaweedFS defaults, so either start the `seaweedfs` compose service or comment those vars out to use local filesystem storage under `<workspace>/data`. `LOCAL_STORAGE_PATH` must be absolute when set.
- **`ENCRYPTION_SECRET`** is required for saved AI providers and the assistant. **`REDIS_URL`** is optional on a single server (v6 persists conversations in PostgreSQL); it shares rate limits, cancellation and resumable replies between processes. Host-run dev uses `REDIS_URL=redis://localhost:6379`; the container-run app uses `redis://redis:6379`.
- **`drizzle-kit` (used by `pnpm db:migrate`) reads `DATABASE_URL` from `process.env` directly** — it does not auto-load `.env`. The root migration scripts load `.env.local` through `dotenvx` before invoking Drizzle Kit.
- The production server auto-runs migrations at startup before serving traffic, so manual `pnpm db:migrate` is mainly for first setup, migration debugging, or applying migrations without starting the app.
- **The fork's two migrations branch off upstream's snapshot chain; `migrations/20261008093000_fork_merge_v6` joins them.** Its SQL is a no-op and its `snapshot.json` lists both leaves in `prevIds` with the combined schema, so `pnpm db:migrate` (drizzle-kit) and `pnpm db:generate` see one schema. Upstream's later migrations chain through its Career snapshot (`20261007205051_career_platform`), which this fork does not have, so **do not copy upstream migration folders when cherry-picking**: apply the commit's `packages/db/src/schema/*` change, then run `pnpm db:generate` to create the fork's own migration and review its SQL. If the DAG ever branches again (`drizzle-kit migrate` reports "Non-commutative migrations detected"), add a no-op merge migration whose snapshot (`generateDrizzleJson` from `drizzle-kit/api-postgres` on the current schema) lists both leaf snapshot ids. Before `pnpm db:generate`, review the generated SQL and drop any statements that re-add the fork's `resume.revision`/`parent_*` columns or `user_single_owner_idx`.

## Commands

Dev server and migration scripts load `.env.local` through the project-local `dotenvx`. Tests, typechecks, linters, boundary checks, and `pnpm build` do not load it automatically; if one fails for a missing env var, rerun it as `dotenvx run -f .env.local -- <command>`.

```
pnpm install
sudo docker compose -f compose.dev.yml up -d postgres                                    # DB only
sudo docker compose -f compose.dev.yml up -d postgres redis seaweedfs seaweedfs_create_bucket   # full infra
pnpm dev                                          # port 3000 (dev:web for web only)
pnpm db:generate                                  # db:migrate to apply
pnpm check                                       # vp lint --fix + vp fmt — WRITE-CAPABLE; pnpm lint / pnpm format:check are read-only
pnpm test | pnpm typecheck | pnpm build | pnpm exec turbo boundaries
```

Prefer package filters over repo-wide runs, e.g. `pnpm --filter web typecheck`, `pnpm --filter @reactive-resume/pdf test`. Vitest paths are package-relative under `pnpm --filter <package> test -- <path>`.

## Gotchas

- Email sending requires SMTP config; without it, emails are logged to console. This is fine for dev — the app still functions, but email verification links appear in server logs.
- The `lefthook.yml` pre-commit hook checks conflict markers, applies safe `vp lint` fixes and `vp fmt` to staged files, then fails on remaining diagnostics; the commit-message hook enforces Conventional Commits. Run `pnpm lint` and `pnpm format:check` before committing.
- `pnpm check` is write-capable (PDF translations, `vp lint --fix`, `vp fmt --write`). Call that out when using it, and use `pnpm lint` / `pnpm format:check` for a non-mutating inspection.
- Tooling runs through Vite+ (`vp`, which wraps Oxlint, Oxfmt and Vitest). Formatting uses tabs, double quotes, line width 120, separated type import groups, and sorted Tailwind classes for `clsx`, `cva`, and `cn`. Lint and format rules live in the root `vite.config.ts`.
- v6 uses design tokens (`bg-bg`, `bg-surface`, `text-ink`, `text-ink-2`, `border-line`, `bg-accent`, `text-danger-text`, …) and Material Symbols through `@reactive-resume/ui/components/icon` (only names listed in `packages/ui/src/icons/names.ts` render). The shadcn-era `bg-background`/`text-muted-foreground`/`bg-primary` classes no longer exist.
- Most packages use `tsrs --noEmit` for typechecking and `vp test run --passWithNoTests` for tests. Tests import from `vite-plus/test`, not `vitest`.
- There may be unrelated local edits in the worktree. Inspect `git status --short` first and avoid reverting files you did not touch.

## Rules for Agent

- Always keep your responses concise to the user
- When you are ready, you may agentically work on your own (i.e. spin up sub-agents, write/use skills, search online, etc without human interaction).
- Use the latest stable versions of packages
- Never hard‑code sensitive info
- Ask clarifying questions if the user’s intent is ambiguous
- Less is always more. Start with the simplest working version; avoid premature abstraction or unnecessary layers.
- Favor standard patterns over clever one‑offs. Readability and maintainability win every time.
- Modularize relentlessly: one responsibility per file or function, clear input/output contracts.
- Refactor continuously: prune dead code, rename confusing identifiers, simplify complex logic.
- Document succinctly: docstrings for public APIs, README to outline high‑level project conventions.
- If changes are agreed upon, git add and commit your changes when necessary

<!-- BEGIN:turborepo-agent-rules -->

# This is NOT the Turborepo you know

Turborepo configuration, task behavior, and CLI commands can vary between installed versions and may differ from your training data. Resolve the `turbo` package from this file's directory or relevant workspace; in monorepos, it may not be visible from the repository root. For example, run `node -p "require.resolve('turbo/package.json')"` from a workspace that depends on `turbo`.

Read `docs/README.md` inside that installed package first, then read the relevant pages from its `docs/` directory before changing Turborepo configuration or commands. Heed deprecation notices. These bundled docs match the installed package version and are available without network access.

This block is written and re-added by `turbo` before repository-scoped commands when an AI agent is detected. In the Turborepo source repository, its template is defined in `crates/turborepo-cli/src/cli/agent_guidance.rs`. Removing the managed block while updates are enabled means a later qualifying invocation will add it again. Set `"agentGuidance": false` in the root `turbo.json` or `turbo.jsonc` to opt out; this does not remove an existing block. Keep the block committed with your work to avoid an uncommitted change on the next agent invocation.
<!-- END:turborepo-agent-rules -->
