# Reactive Resume: Web Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

One person, the owner of the instance, preparing, tailoring, exporting and sharing their own resumes.

## Product Purpose

Help people turn their experience into professional resumes. Success means creating or importing a resume, tailoring it for a role, and exporting or sharing it.

## Positioning

Reactive Resume is a free, open-source resume builder with privacy and data ownership as durable commitments. Users can run the application on their own infrastructure. Resume editing and reviewable AI assistance belong to the same workflow. Job-application tracking and standalone cover-letter documents are out of scope.

## Operating Context

- Browser-based use on desktop and mobile; mobile web remains the same product.
- Create or import a resume, edit with a live document preview, choose a template, and export or share it.
- Duplicate or derive a resume for a specific role and check it against a pasted job posting.
- Use optional AI assistance to propose changes; users review proposals before applying them.

## Capabilities and Constraints

- Resume creation, importing, template customization, PDF/JSON/DOCX export, and public sharing.
- Preserve free and open-source access, privacy, and user control of their data.
- Preserve multilingual and right-to-left support throughout workflows and accessible labels.
- The web app is a client-rendered React SPA. There are no prerendered marketing pages.
- Feature UI belongs in `src/features` and routes in `src/routes`; shared UI primitives belong in `../../packages/ui`.

## Brand Commitments

Keep the Reactive Resume name and existing brand assets. The incumbent visual system is documented in the inherited `../../DESIGN.md`; product setup does not replace that system. Resume templates retain their own identities independently of app styling.

## Evidence on Hand

- `../../README.md`: product description, capabilities, licensing, and self-hosting information.
- `src/features/ats-checker`: browser-based PDF checks.
- `public/templates`: real template previews and PDF samples.
- `public/icon` and `public/logo`: existing brand assets.

Do not invent testimonials, hiring outcomes, customer counts, or guarantees that an ATS score predicts hiring success.

## Product Principles

1. Keep users in control of their documents and personal data.
2. Keep the document visible and the next useful action clear.
3. Protect work through autosave and reversible edits.
4. Offer useful defaults and reveal advanced controls when needed.
5. AI proposes; the user decides what is applied.

## Accessibility & Inclusion

Target WCAG 2.2 AA; this is a design requirement, not a claim of audited compliance. Preserve keyboard access, visible focus, accessible labels, alternatives to drag operations, reduced-motion support, and usable touch targets. Support translated content, text expansion, and right-to-left layouts.
