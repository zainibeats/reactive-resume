# Simplification Backlog

This note captures simplification opportunities found during the initial project scan. It is intended as an iteration document, not an implementation plan.

## Quick Wins

### Keep runtime identity local to the instance - Done

Authentication emails loaded logos and fonts from public third-party hosts and included project promotion. MCP metadata also
advertised the public hosted service even when returned by a self-hosted instance.

Completed change:

- Simplified authentication emails to self-contained system-font markup without promotional links or remote images/fonts.
- Built live and static MCP server identity from the configured `APP_URL` through one shared helper.
- Removed hosted-service social preview URLs and project contact promotion from self-hosted runtime metadata.

References:

- `packages/email/src/templates/auth.tsx`
- `packages/mcp/src/mcp-server-card.ts`
- `apps/server/src/mcp/server.ts`

### Remove hosted-service structured marketing data - Done

The focused first-visit screen still emitted hidden FAQ, pricing, project, and software marketing schemas. The FAQ was not
visible on the page, and server rendering assigned self-hosted instances a canonical URL for the public hosted service.

Completed change:

- Removed the home-only JSON-LD marketing graph and hosted-service canonical fallback.
- Kept the small `noindex` helper used by authenticated and private routes.

References:

- `apps/web/src/routes/_home/index.tsx`
- `apps/web/src/libs/seo.ts`

### Default to local file storage - Done

The default production and development Compose stacks started SeaweedFS and a separate bucket initializer even though local
filesystem storage is already supported and volume-mounted. This made an optional object store part of the basic self-hosted
deployment.

Completed change:

- Reduced the default stack to the app, PostgreSQL, and Redis.
- Made local filesystem storage the default in `.env.example`; S3-compatible storage remains available through optional
  environment variables.
- Made the production Compose stack read the owner's `.env` file instead of running with example secrets.

References:

- `compose.yml`
- `compose.dev.yml`
- `.env.example`

### Remove promotional and legacy workspace chrome - Done

The builder still ended with a project-attribution footer, the README included social/funding metrics and a star-history chart,
and the server continued serving the removed standalone `/agent` route as an application shell.

Completed change:

- Removed the builder attribution footer and its now-unused component and tests.
- Removed promotional badges, funding calls to action, star history, and the hosted-project funding manifest.
- Return a real 404 for removed standalone agent web routes while retaining the internal agent API/storage namespace used by
  the builder assistant.
- Renamed environment and API messages from “agent workspace” to “AI assistant.”
- Removed the unused `react-markdown` dependency and Better Auth dashboard/analytics plugin from all package manifests.

References:

- `apps/web/src/routes/builder/$resumeId/-sidebar/right/index.tsx`
- `apps/server/src/static/web.ts`
- `README.md`
- `packages/api/src/features/agent/routing.ts`

### Remove project resources from the resume editor - Done

The builder's design sidebar ended with an Information section containing only links to hosted documentation, source code,
issue tracking, and translation contribution. It occupied core editor navigation without helping create or manage a resume.

Completed change:

- Removed the project-resources section and its dedicated tests.
- Removed the Information entry from right-sidebar types, ordering, titles, icons, and component dispatch.
- Kept the builder sidebar focused on template, layout, design, sharing, analysis, and export actions.

References:

- `apps/web/src/routes/builder/$resumeId/-sidebar/right/index.tsx`
- `apps/web/src/libs/resume/section.tsx`

### Enforce a single instance owner - Done

Signup was controlled only by an optional environment flag, so a default self-hosted instance could accumulate multiple user
accounts even though the product is intended for one owner.

Completed change:

- Allow user creation only while the instance has no owner, regardless of whether signup uses email or OAuth.
- Disable the registration UI automatically after the owner account exists.
- Added a database uniqueness constraint to prevent concurrent requests from creating multiple owners.
- Kept first-run signup available so a fresh self-hosted instance can be initialized without manual database work.
- Existing multi-user databases must be reduced to one account before migration; the migration fails explicitly rather than
  deleting resume data automatically.

References:

- `packages/auth/src/single-owner.ts`
- `packages/api/src/features/flags/service.ts`
- `packages/db/src/schema/auth.ts`
- `migrations/20260703092347_rare_scarlet_spider/migration.sql`

### Remove decorative dashboard footer chrome - Done

The authenticated sidebar animated a copyright notice below the owner menu. It occupied persistent workspace space and added
motion without helping create, edit, export, or share a resume.

Completed change:

- Removed the animated copyright footer from the dashboard sidebar.
- Kept the owner account menu as the sole sidebar footer action.

References:

- `apps/web/src/routes/dashboard/-components/sidebar.tsx`

### Remove decorative settings chrome - Done

The owner settings pages animated their entire contents into view, and Preferences included a project-contribution link that
did not help configure the personal instance.

Completed change:

- Removed page-load animation wrappers from profile, preferences, authentication, integrations, and danger-zone settings.
- Removed hover/tap animation from the destructive account deletion action.
- Removed the external translation-contribution call to action from owner preferences.
- Reduced the optional API-key page to key management by removing its hosted documentation promo and decorative motion.
- Removed the remaining hosted API documentation card and list animations from the API-key page.
- Kept state-transition animation where it communicates an actual authentication or profile state change.

References:

- `apps/web/src/features/settings`

### Remove decorative resume dashboard motion - Done

The primary resume list animated every create, import, and resume card on entry, exit, sorting, and interaction. These effects
added wrapper elements and timing logic to the core navigation surface without improving the personal resume workflow.

Completed change:

- Render create, import, grid, and list entries directly without staggered entrance or exit animations.
- Removed hover/tap transforms from resume cards.
- Render the locked-resume indicator directly while preserving its visual state.
- Kept lazy thumbnail generation so large personal resume collections do not render every PDF eagerly.

References:

- `apps/web/src/routes/dashboard/resumes/-components/grid-view.tsx`
- `apps/web/src/routes/dashboard/resumes/-components/list-view.tsx`
- `apps/web/src/routes/dashboard/resumes/-components/cards/resume-card.tsx`

### Focus the project overview on the personal product - Done

The README opened with hosted-service links and platform-oriented messaging before explaining the self-hosted personal workflow.

Completed change:

- Replaced the promotional header with a concise product description.
- Made the existing builder-integrated AI assistant explicit in the core description.
- Corrected stale design guidance that still described the removed standalone agent navigation.

References:

- `README.md`
- `DESIGN.md`

### Make the README a self-hosting guide - Done

The project overview still contained a promotional banner, a full visual template gallery, hosted-documentation funnels,
registry promotion, a broad technology showcase, and contribution marketing before explaining the actual personal deployment.

Completed change:

- Replaced the landing-page-style README with a concise description of the single-owner resume workflow.
- Made the Docker Compose setup, required secrets, persistent data, first-owner initialization, and AI configuration explicit.
- Kept focused development and architecture notes in the repository instead of depending on hosted documentation.
- Removed the promotional template gallery, registry commands, hosted guide tables, and contribution funnel.

References:

- `README.md`

### Preserve first-visit resume actions through sign-in - Done

The first-visit create and import cards both linked to the dashboard without preserving the selected workflow. A separate Get Started button duplicated the same navigation.

Completed change:

- Remember the selected create or import action for the current browser tab while authentication completes.
- Open the matching resume dialog on the resumes dashboard and consume the pending action once.
- Removed the redundant Get Started button.

References:

- `apps/web/src/features/resume/start-intent.ts`
- `apps/web/src/routes/_home/-sections/hero.tsx`
- `apps/web/src/routes/dashboard/resumes/index.tsx`

### Remove platform-wide statistics endpoints - Done

The public user-count, resume-count, and GitHub-star endpoints supported marketing and platform-scale messaging rather than the personal resume workflow. They also added filesystem caching, outbound GitHub requests, and hard-coded hosted-instance fallback counts to self-hosted deployments.

Completed change:

- Removed the global statistics router and service from the API.
- Removed the endpoints from the checked-in OpenAPI specification.
- Kept owner-facing statistics for individual shared resumes; those directly support the share workflow.

References:

- `packages/api/src/routers/index.ts`
- `packages/api/src/features/resume/statistics.ts`

### Focus the first visit on resume actions - Done

The home page repeated template previews in both the hero and a full gallery, while decorative entrance and scroll animations added code without improving the resume workflow.

Completed change:

- Kept create, import, sign-in, and four template previews as the complete first-visit surface.
- Removed the duplicated full template gallery.
- Removed home-only entrance animations and the JavaScript-driven hiding header.

References:

- `apps/web/src/routes/_home/index.tsx`
- `apps/web/src/routes/_home/-sections/hero.tsx`
- `apps/web/src/routes/_home/-sections/header.tsx`

### Remove unused `react-markdown` - Done

- `pnpm -s knip` reports `react-markdown` as unused.
- `rg "react-markdown"` only finds it in `apps/web/package.json` and `pnpm-lock.yaml`.
- Completed change: removed it from `apps/web/package.json` and updated `pnpm-lock.yaml`.

References:

- `apps/web/package.json:75`

### Remove stale static SEO files - Done

The web public directory contained hosted-service copies of `robots.txt` and `sitemap.xml`. The sitemap advertised private
authentication and dashboard routes, external documentation pages, and removed API surfaces. The production server already
generates both responses from the configured `APP_URL`, so the static files were dead and misleading for self-hosted instances.

Completed change:

- Removed the checked-in static `robots.txt` and `sitemap.xml` files.
- Kept the server-generated endpoints, which expose only the configured instance root and exclude API/auth/MCP paths from
  crawling.

References:

- `apps/server/src/static/seo.ts`
- `apps/server/src/static/seo.test.ts`

### Keep discovery metadata local to the instance - Done

Generated `robots.txt` and `llms.txt` still advertised the public hosted documentation, its sitemap, and its AI index from
every self-hosted deployment.

Completed change:

- Removed the hosted documentation sitemap from generated robots metadata.
- Reduced the generated AI index to the configured instance URL, local resume schema, and local OpenAPI specification.
- Described the runtime as a single-owner resume builder instead of advertising the broader open-source project.

References:

- `apps/server/src/static/seo.ts`
- `apps/server/src/static/seo.test.ts`

### Deduplicate resume menu behavior - Done

`ResumeDropdownMenu` and `ResumeContextMenu` repeat the same resume actions:

- open
- update
- duplicate
- create child resume
- lock/unlock
- delete

The repeated pieces include mutation setup, confirmation flows, dialog opening, toast handling, labels, icons, and locked-state behavior.

Completed change:

- Extract a `useResumeMenuActions(resume)` hook for shared behavior.
- Represent menu entries as a small action list.
- Keep dropdown/context-specific rendering separate because the UI primitives differ.

References:

- `apps/web/src/routes/dashboard/resumes/-components/menus/dropdown-menu.tsx:33`
- `apps/web/src/routes/dashboard/resumes/-components/menus/context-menu.tsx:33`

### Remove the job application tracker - Done

The dashboard included a separate job application tracker with board/table/insights views, CSV import, document
attachments, application-specific AI actions, API endpoints, MCP tools, and a dedicated database table. That expanded the
product into a job-search CRM instead of a focused self-hosted resume creator.

Completed change:

- Removed the application tracker route, feature UI, command-palette entries, API router, DTOs, schema exports, and tests.
- Removed application-specific MCP tools and static server-card metadata while keeping resume-focused MCP support.
- Removed the application database schema and added a migration that drops the old `application` table.
- Cleaned stale application tracker messages out of the Lingui catalogs.
- Removed unused job-search rate-limit buckets that only supported the deleted tracker surface.
- Kept local AI setup simple by making LM Studio an explicit local OpenAI-compatible provider and restoring agent request
  timeouts.
- Removed stale public docs, API reference entries, and MCP guide copy for the deleted application tracker.
- Removed the orphaned platform-statistics service left behind by earlier marketing endpoint removal.

References:

- `apps/web/src/routes/dashboard/applications/index.tsx`
- `apps/web/src/features/applications`
- `packages/api/src/features/applications`
- `packages/mcp/src/tools.ts`
- `docs/docs.json`
- `docs/spec.json`
- `migrations/20260709110711_workable_lady_ursula/migration.sql`

## Medium Refactors

### Make the rich text toolbar table-driven - Done

`RichInput` manually repeats toolbar command state and rendering for marks, headings, alignment, lists, table operations, and utility commands.

Completed change:

- Defined render-side command descriptor arrays for repeated groups.
- Render headings and alignment dropdowns from config.
- Render simple toggle/button groups from config.
- Keep link and color pickers custom because they have richer behavior.
- Extracted shared toolbar state helpers and descriptor maps for repeated marks, headings, alignment, list commands, code commands, and table commands.

References:

- `apps/web/src/components/input/rich-input.tsx:209`

### Simplify custom style editor controls - Done

`CustomStylesSectionBuilder` hand-writes each style intent control. The same field shapes repeat across color, text, spacing, and border groups.

Completed change:

- Define grouped field config for style intent properties.
- Render fields through existing `ColorField`, `NumberInput`, and `IntentSelectField`.
- Extract shared rule deletion/filtering used by reset and delete paths.
- Extract style-rule options, field descriptors, target/slot helpers, spacing patch helpers, and applied-rule summary helpers into a focused sibling module.

Decision:

- Leave spacing controls explicit because their per-side value merging and compact input layout are more specialized than the table-driven color/text/border fields.

References:

- `apps/web/src/routes/builder/$resumeId/-sidebar/right/sections/custom-styles.tsx:160`
- `apps/web/src/routes/builder/$resumeId/-sidebar/right/sections/custom-styles.tsx:478`

## Larger Refactors

### Remove the unused dynamic template route - Done

The web app exposed a client-rendered `/templates/*` PDF viewer that was not linked from the product. Template selection uses
static JPG previews, and static PDF previews are served directly from the public directory, so the route added a second
rendering path without supporting the personal resume workflow.

Completed change:

- Removed the dynamic template route and regenerated the TanStack route tree.
- Stopped treating missing `/templates/*` paths as application-shell routes; missing template assets now return a real 404.
- Kept `templates` reserved from public resume usernames so removed paths cannot be mistaken for shared resumes.

References:

- `apps/web/src/routes/templates/$.tsx`
- `apps/server/src/static/web.ts`

### Remove standalone agent routes - Done

The builder assistant is now the product surface for AI-assisted resume editing. The old standalone agent workspace route files only redirected to the resumes dashboard, but they still kept `/agent`, `/agent/new`, and `/agent/$threadId` in the generated web route tree.

Completed change:

- Deleted the standalone agent route files under `apps/web/src/routes/agent`.
- Regenerated `apps/web/src/routeTree.gen.ts` so `/agent/*` routes are no longer part of the web route graph.
- Kept the builder assistant panel and agent API services because they support editing the active resume directly.

References:

- `docs/superpowers/plans/2026-06-04-builder-integrated-assistant-simplification.md:27`

### Split shared PDF section rendering - Done

`packages/pdf/src/templates/shared/sections.tsx` owns too many responsibilities:

- section shell and heading behavior
- item grid/timeline layout
- common item primitives
- built-in section rendering
- custom section dispatch
- final `Section` routing

Candidate change:

- Move shell/layout primitives into focused files.
- Move built-in section renderers into `sections/`.
- Keep behavior-specific section JSX explicit rather than over-generalizing.

Completed change:

- Extracted section shell, item grid/timeline layout, item wrapper, and item header primitives into `packages/pdf/src/templates/shared/section-layout.tsx`.
- Extracted item header, title, website-link, and split-row helpers into `packages/pdf/src/templates/shared/section-item-content.tsx`.
- Moved built-in section renderers and custom section dispatch into `packages/pdf/src/templates/shared/section-renderers.tsx`.
- Kept `packages/pdf/src/templates/shared/sections.tsx` as the small public `Section` routing facade used by template pages.

References:

- `packages/pdf/src/templates/shared/sections.tsx:392`

### Split agent service by capability - Done

`packages/api/src/features/agent/service.ts` combines thread CRUD, message streaming, attachments, rollback actions, model input shaping, and legacy repair.

Candidate change:

- Split implementation into capability files such as:
  - `threads-service.ts`
  - `messages-service.ts`
  - `attachments-service.ts`
  - `actions-service.ts`
- Keep `service.ts` as the public facade if that matches existing API imports.

Completed change:

- Extracted pure row-to-response mappers into `packages/api/src/features/agent/serializers.ts`.
- Extracted attachment create/delete behavior into `packages/api/src/features/agent/attachment-service.ts`.
- Extracted action rollback behavior into `packages/api/src/features/agent/action-service.ts`.
- Extracted thread list/create/get/archive/delete behavior into `packages/api/src/features/agent/thread-service.ts` and wired `service.ts` to use it.
- Extracted message persistence, stop/resume, active-run cleanup, attachment-to-model shaping, and streaming implementation into `packages/api/src/features/agent/message-service.ts`.
- Kept `packages/api/src/features/agent/service.ts` as the small public facade used by existing routers and tests.

References:

- `packages/api/src/features/agent/service.ts:783`

## Validation Notes

Initial scan commands:

```sh
git status --short
pnpm -s knip
find apps packages -name '*.ts' -o -name '*.tsx' | xargs wc -l | sort -nr | head -40
```

Initial findings:

- Worktree was clean before this note was added.
- `pnpm -s knip` reported one unused dependency: `react-markdown` in `apps/web/package.json`.
