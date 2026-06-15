# Simplification Backlog

This note captures simplification opportunities found during the initial project scan. It is intended as an iteration document, not an implementation plan.

## Quick Wins

### Remove unused `react-markdown` - Done

- `pnpm -s knip` reports `react-markdown` as unused.
- `rg "react-markdown"` only finds it in `apps/web/package.json` and `pnpm-lock.yaml`.
- Completed change: removed it from `apps/web/package.json` and updated `pnpm-lock.yaml`.

References:

- `apps/web/package.json:75`

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

### Make the rich text toolbar table-driven - Partially done

`RichInput` manually repeats toolbar command state and rendering for marks, headings, alignment, lists, table operations, and utility commands.

Completed change:

- Defined render-side command descriptor arrays for repeated groups.
- Render headings and alignment dropdowns from config.
- Render simple toggle/button groups from config.
- Keep link and color pickers custom because they have richer behavior.

Remaining follow-up:

- Consider whether the editor state selector should also be descriptor-driven, or leave it explicit if the current shape remains easier to type.

References:

- `apps/web/src/components/input/rich-input.tsx:209`

### Simplify custom style editor controls - Partially done

`CustomStylesSectionBuilder` hand-writes each style intent control. The same field shapes repeat across color, text, spacing, and border groups.

Completed change:

- Define grouped field config for style intent properties.
- Render fields through existing `ColorField`, `NumberInput`, and `IntentSelectField`.
- Extract shared rule deletion/filtering used by reset and delete paths.

Remaining follow-up:

- Consider whether spacing controls and applied-rule summaries should also move to descriptor config, or leave them explicit because their value merging and display logic are more specialized.

References:

- `apps/web/src/routes/builder/$resumeId/-sidebar/right/sections/custom-styles.tsx:160`
- `apps/web/src/routes/builder/$resumeId/-sidebar/right/sections/custom-styles.tsx:478`

## Larger Refactors

### Split shared PDF section rendering

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

References:

- `packages/pdf/src/templates/shared/sections.tsx:392`

### Split agent service by capability

`packages/api/src/features/agent/service.ts` combines thread CRUD, message streaming, attachments, rollback actions, model input shaping, and legacy repair.

Candidate change:

- Split implementation into capability files such as:
  - `threads-service.ts`
  - `messages-service.ts`
  - `attachments-service.ts`
  - `actions-service.ts`
- Keep `service.ts` as the public facade if that matches existing API imports.

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
