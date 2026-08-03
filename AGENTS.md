# AGENTS.md

## Cursor Cloud specific instructions

### Overview

Reactive Resume is a pnpm monorepo (Turborepo) with two deployable apps: `apps/web` (TanStack Start / React 19 / Vite) and `apps/server` (Hono / Node.js). The production Docker image runs a single Node.js process on port 3000, with `apps/server` mounting the API/auth/MCP/static routes and serving the built web app.

Internal packages are source-consumed through `package.json` export maps that point at `src` files. Do not assume package-local `dist` output exists unless a package explicitly adds it.

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

**Behavior kept intentionally different from upstream:**

- **Single-owner auth** (`packages/auth/src/single-owner.ts`) — no open multi-user signup, no teams/orgs/roles.
- **`mainEntryBold` per-item toggle, default unbold.** Company/school/project name/certification title/skill name render **unbold by default**, with an explicit "Bold" checkbox per item to opt in. Upstream instead treats these as unconditional "Bold hosts" (always bold, no toggle) and only exempts award titles. Every export path must read `item.mainEntryBold ?? false` for exactly these five fields, and leave headings without the toggle (publication title, reference/interest name, language, profile network, volunteer organization) unconditionally bold. Touches: `packages/schema/src/resume/data.ts` (field), `packages/pdf/src/templates/shared/sections.tsx` (`MainEntryText`/`ItemTitle` primitives), `packages/docx/src/section-renderers.ts` (`titleAndSubtitle` bold argument plus the skills run), and the item dialogs under `apps/web/src/dialogs/resume/sections/*.tsx` (checkbox UI). PDF and DOCX must agree; `packages/docx/src/section-renderers.test.ts` pins both defaults and the opt-in for all five fields.
- **Resume JSON editor is restored** (`apps/web/src/routes/builder/$resumeId/-components/edit-json-dialog.tsx`, opened from the builder header). Upstream removed direct JSON editing in favor of guided forms plus the Semantic CSS stylesheet editor; this fork keeps both the guided forms *and* a raw JSON editing escape hatch.
- **Legacy→Semantic CSS converter carve-out** (`packages/pdf/src/semantic/legacy-converter.ts`, `scizorBoldColorSelector`/`TOGGLE_BOLD_SECTION_TYPES`): the converter does not apply Scizor's "Bold-after-text" color restoration to experience/education/projects/certifications/skills headings, because in this fork those are `mainEntryBold`-toggle-driven rather than unconditional Bold hosts. If upstream reworks this converter again, re-check that this carve-out still exists — a clean text-level merge can silently drop it.

**Added beyond upstream:**

- **`lmstudio` AI provider** (LM Studio), on top of upstream's provider list — see `AI_PROVIDERS` in `packages/ai/src/types.ts`. Ollama and OpenAI-compatible providers also carry fork-specific usability fixes (clearing failed agent runs, handling large prompts) not present upstream.

**Before merging a new `upstream/main`**, explicitly re-diff these areas rather than trusting a clean 3-way merge: `packages/pdf/src/templates/shared/sections.tsx` (ItemTitle/Bold/MainEntryText), `packages/pdf/src/semantic/legacy-converter.ts` (Scizor carve-out), `apps/web/src/routes/builder/$resumeId/-sidebar/right/sections/custom-styles*` (Semantic CSS vs. any reintroduced GUI panel), `packages/mcp/src/mcp-tool-names.ts` (application/statistics tools), `packages/api/src/features/statistics/*`, `apps/web/src/routes/agent/*` and `-components/ai-assistant.tsx`, `packages/ai/src/types.ts` (provider enum), `packages/auth/src/config.ts` and `single-owner.ts`, `apps/web/src/routes/_home/*` (home sections), and `docs/docs.json` (comparisons nav group). Ask the user before reintroducing anything in the "Removed entirely" list above, even if upstream's version looks improved.

### Prerequisites

- **Node.js 24** (matches Dockerfile `ARG NODE_VERSION=24`). Use `nvm install 24 && nvm use 24` if needed.
- **Docker** is required to run PostgreSQL. Start it with `sudo dockerd &` if the daemon isn't running.
- **pnpm 11.17.0** is managed via corepack (`corepack enable`).

### Codebase map

- `apps/web` owns TanStack Start routes, Vite config, PWA setup, oRPC browser client wiring, web features, and the resume builder UI.
- `apps/server` owns the production Hono app, route composition, auth/RPC/MCP/OpenAPI handlers, static uploads, schema JSON, web-dist fallback serving, and startup checks.
- `packages/api` contains oRPC routers, DTOs, rate limiting, and feature-owned API modules under `packages/api/src/features/*`. The router export at `@reactive-resume/api/routers` aggregates those feature routers for `/api/rpc`.
- `packages/auth` contains Better Auth config, auth helper functions, and exported auth types. The server auth adapter in `apps/server/src/http/auth.ts` delegates to `auth.handler`.
- `packages/db` contains the Drizzle client and schema. Migration files live at the repo root in `migrations/`.
- `packages/env` defines server environment validation and auto-loads the root `.env` for app/server code.
- `packages/schema` contains Zod schemas and typed resume/page/template models.
- `packages/pdf` contains the React PDF document, font registration, shared template primitives, template implementations, and browser/server PDF generation adapters. PDF.js viewer UI stays in `apps/web`.
- `packages/resume` contains pure resume-domain behavior such as JSON Patch helpers and social-network icon mapping.
- `packages/docx` contains DOCX export generation.
- `packages/mcp` contains MCP tools, prompts, resources, server-card generation, and tool metadata.
- `packages/ui` contains shared Base UI/shadcn-style components and hooks.
- `packages/fonts`, `packages/email`, `packages/import`, `packages/ai`, `packages/utils`, and `packages/config` provide focused support surfaces. Prefer their existing exports over adding cross-package shortcuts.
- Development-only scripts live in `tooling/`, not under `packages/`, so packages only contain code bundled by the app/runtime.

### Web app conventions

- Routes are file-based under `apps/web/src/routes`. Do not hand-edit `apps/web/src/routeTree.gen.ts`; it is generated by TanStack Router tooling.
- Server-owned HTTP behavior lives in `apps/server/src/{http,rpc,mcp,openapi,static,startup}`. Keep API/RPC/auth/MCP/static route wiring in `apps/server`, not in web routes.
- `apps/web/src/router.tsx` initializes router context with `queryClient`, `orpc`, `theme`, `locale`, `session`, and `flags`. Reuse route context where possible instead of refetching these concerns ad hoc.
- The builder shell lives under `apps/web/src/routes/builder/$resumeId`. The nested preview route is client-only (`ssr: false`), while the public resume route `apps/web/src/routes/$username/$slug.tsx` uses `ssr: "data-only"`.
- Browser-only resume preview code lives under `apps/web/src/features/resume/preview`, and public resume PDF viewer code lives under `apps/web/src/features/resume/public`. Keep PDF.js/canvas/browser APIs out of SSR paths and out of `packages/pdf`.
- The isomorphic oRPC client is in `apps/web/src/libs/orpc/client.ts`; server calls use an in-process router client and browser calls use `/api/rpc` with credentials included.
- For Lingui-backed confirmation dialogs, avoid adding new `t`/`Trans` messages or putting dynamic user data directly inside `t` template strings unless catalogs are updated in the same change. In production, missing compiled catalog entries can render hashed ids such as `pkD36F`. Prefer existing cataloged messages, or pass React nodes to `useConfirm` and render dynamic/plain labels outside Lingui.
- For React components with explicit props, prefer a named TypeScript props type over inline object annotations in the function signature, especially once the props include more than one field or generics. For example:

```ts
type IntentSelectFieldProps<TValue extends string> = {
	label: string;
	id: string;
	value: TValue | undefined;
	options: readonly ComboboxOption<TValue>[];
	onChange: (value: TValue | undefined) => void;
};

function IntentSelectField<TValue extends string>(props: IntentSelectFieldProps<TValue>) {
	// ...
}
```

### Package and feature boundaries

- Workspace dependencies must go through package names and package export maps. Do not import another workspace's `src` tree through repository paths, `@reactive-resume/*/src/*`, or TypeScript path aliases.
- `turbo boundaries` is the executable package-boundary check. Workspace-level `turbo.json` files declare coarse tags:
  - `app:web` for the TanStack Start app.
  - `app:server` and `runtime:server` for the Node/Hono process.
  - `runtime:server` for server-only packages such as API/auth/db/env/email/MCP.
  - `runtime:browser` for browser-only shared UI.
  - `runtime:universal` for environment-neutral domain packages.
  - `role:domain`, `role:infra`, `role:adapter`, `role:api`, `role:rendering`, and `role:tooling` for package intent.
- Browser/server runtime-specific code should live behind explicit export subpaths such as `@reactive-resume/pdf/browser`, `@reactive-resume/pdf/server`, or `@reactive-resume/env/server`. Keep root exports environment-neutral unless the package is intentionally server-only.
- Wildcard exports are allowed only for leaf libraries whose public surface is intentionally file-like, currently `@reactive-resume/ui/components/*`, `@reactive-resume/ui/hooks/*`, and schema resume model files. Prefer explicit exports for packages that own runtime behavior.
- Add new API procedures and business logic inside the owning `packages/api/src/features/*` module. Keep route wiring, DTO usage, helpers, and services colocated by feature/capability, then expose only intentional public surfaces through `packages/api/package.json`. Prefer `protectedProcedure` from `packages/api/src/context.ts` for authenticated procedures.
- Add database columns/tables in `packages/db/src/schema/*`, then generate root-level migrations with `dotenvx run -f .env.local -- pnpm db:generate`.
- Add or change resume data shape in `packages/schema/src/resume/*` first, then update API DTOs, importers, PDF rendering, and web forms that consume that shape.
- Add or rename templates in all relevant places: `packages/schema/src/templates.ts`, `packages/pdf/src/templates/index.ts`, template source under `packages/pdf/src/templates/<name>/`, and static previews under `apps/web/public/templates/{jpg,pdf}`.
- Resume JSON Patch behavior belongs in `@reactive-resume/resume/patch`; do not put resume-domain helpers in `@reactive-resume/utils`.
- DOCX export behavior belongs in `@reactive-resume/docx`; do not put DOCX builders in `@reactive-resume/utils`.
- Shared PDF section filtering lives in `packages/pdf/src/templates/shared/filtering.ts`. Keep template-specific visual exceptions in the owning template directory unless multiple templates need the same behavior.
- `packages/pdf/src/hooks/use-register-fonts.ts` owns React PDF font registration, standard PDF font handling, CJK fallback stacks, and global hyphenation behavior.
- PDF generation helpers live behind `@reactive-resume/pdf/browser` and `@reactive-resume/pdf/server`; locale-specific section-title resolution stays in the caller.
- MCP implementation belongs in `@reactive-resume/mcp`; app packages must not import MCP implementation from another app's source tree.
- `packages/utils` has narrowly exported helpers. If another package needs a utility, add an explicit export path instead of importing private files.

Placement decision tree:

1. If the change is a web route, route loader, or user-facing web workflow, start in `apps/web/src/routes` or `apps/web/src/features`.
2. If the change is a server HTTP route/adapter, startup check, static handler, MCP transport, or OpenAPI/well-known handler, start in `apps/server/src`.
3. If it is authenticated API behavior, put the contract and implementation in the owning `packages/api/src/features/*` module.
4. If it is pure resume data behavior with no DB, HTTP, DOM, or PDF renderer dependency, put it in `packages/resume`.
5. If it renders resume PDFs, put shared React PDF/template code in `packages/pdf`; put PDF.js viewer/canvas UI in `apps/web/src/features/resume`.
6. If it creates DOCX exports, put it in `packages/docx`.
7. If it exposes MCP tools/prompts/resources, put it in `packages/mcp`.
8. If it is a generic UI primitive or hook, put it in `packages/ui`; if it is workflow-specific UI, keep it in the owning web feature.
9. If it is a narrow cross-cutting helper, add an explicit `packages/utils` export only after checking that no domain package is a better owner.

### Database

PostgreSQL runs via Docker Compose:

```
sudo docker compose -f compose.dev.yml up -d postgres
```

The dev default connection string is `postgresql://postgres:postgres@localhost:5432/postgres`.

**Important**: `drizzle-kit` (used by `pnpm db:migrate`) reads `DATABASE_URL` from `process.env` directly — it does **not** auto-load the `.env` file. Run migration commands through `dotenvx`, for example `dotenvx run -f .env.local -- pnpm db:migrate`, so `DATABASE_URL` is present in the process environment.

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
