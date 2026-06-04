# Builder-Integrated Assistant Simplification

## Goal

Simplify the product around one workflow: creating and editing great resumes. The AI assistant should be available inside the resume builder, edit the active resume directly, and rely on the shared resume undo/redo system for recovery.

## Direction

- Keep the hosted multi-user model for now.
- Keep MCP support for now.
- Remove the separate agent workspace UX once the builder assistant is available.
- Do not create separate AI draft resumes for normal assistant edits.
- Current editing session chat history is enough; durable agent thread history is not required for the first simplified version.

## Iteration Checklist

- [x] Add shared resume document undo/redo for builder edits and server-delivered resume updates.
- [x] Decide whether metadata changes such as resume name, slug, public sharing, password, and lock status belong in document undo or remain separate settings actions.
- [x] Add a builder assistant panel mounted under `apps/web/src/routes/builder/$resumeId`.
- [x] Extract reusable chat pieces from `apps/web/src/routes/agent/$threadId.tsx` into builder-owned assistant components.
- [x] Make assistant sessions target the current `resumeId` directly instead of creating an `AI Draft`.
- [x] Replace `agentThread.workingResumeId`/`sourceResumeId` assumptions with direct `resumeId` targeting, or add a lighter ephemeral session contract if DB persistence is still needed for active runs.
- [x] Ensure assistant-applied patches publish resume update events so the existing builder subscription refreshes the active draft.
- [x] Ensure assistant-applied patches are captured by the shared undo stack.
- [x] Replace the builder dock `Open AI agent` navigation with a panel toggle.
- [x] Remove the dashboard `Agents` navigation item.
- [x] Remove or redirect standalone `/agent`, `/agent/new`, and `/agent/$threadId` routes after the builder panel reaches feature parity.
- [x] Remove the “Duplicate as AI Draft” flow and related draft naming helpers if no longer used.
- [x] Collapse duplicate AI chat paths so there is one primary assistant implementation for resume editing.
- [x] Keep PDF/DOCX AI import and resume analysis only if they remain useful inside the core resume-building workflow.
- [x] Keep MCP routes and package mounted for now; revisit after the builder assistant simplification stabilizes.

## Open Questions

- Decision: metadata changes remain separate settings actions for now. The shared document undo stack tracks only `resume.data`, which matches builder field edits and assistant-applied resume patches without mixing in route/title/sharing/security state.

- Decision: the builder assistant should be a bottom panel/drawer.
- Decision: undo should use grouped edit transactions, especially for high-frequency field edits.
- Decision: assistant patch results should show tool output by default.
- Decision: assistant sends should be blocked while there are unsaved local edits.
- Decision: keep resume analysis and PDF/DOCX AI import because they start or improve the same builder workflow without reviving the separate agent workspace.
- Decision: keep MCP routes and `@reactive-resume/mcp` mounted for now; this simplification removes only the standalone agent workspace UX.

## Validation Targets

- Focused tests for shared undo/redo behavior.
- Focused tests for assistant patch application against the active resume.
- `pnpm --filter web typecheck`
- `pnpm --filter @reactive-resume/api test -- src/features/agent`
- `pnpm exec turbo boundaries`
