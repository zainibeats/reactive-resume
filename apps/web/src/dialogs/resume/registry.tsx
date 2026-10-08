import type { AnyDialogRendererEntry } from "../schemas";
import { DeriveResumeDialog, DuplicateResumeDialog, UpdateResumeDialog } from ".";

export const resumeDialogRenderers: readonly AnyDialogRendererEntry[] = [
	{ type: "resume.update", render: ({ data }) => <UpdateResumeDialog data={data} /> },
	{ type: "resume.duplicate", render: ({ data }) => <DuplicateResumeDialog data={data} /> },
	{ type: "resume.derive", render: ({ data }) => <DeriveResumeDialog data={data} /> },
];
