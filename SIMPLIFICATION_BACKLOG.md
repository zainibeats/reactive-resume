# Simplification Backlog

This note captures simplification opportunities found during the initial project scan. It is intended as an iteration document, not an implementation plan.

## Quick Wins

### Focus the project overview on the personal product - Done

The README opened with hosted-service links and platform-oriented messaging before explaining the self-hosted personal workflow.

Completed change:

- Replaced the promotional header with a concise product description.
- Made the existing builder-integrated AI assistant explicit in the core description.
- Corrected stale design guidance that still described the removed standalone agent navigation.

References:

- `README.md`
- `DESIGN.md`

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
