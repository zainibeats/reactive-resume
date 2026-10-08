import type { ProposeEditsInput, ProposeEditsOutput } from "@reactive-resume/ai/tools/agent-tool-contracts";
import type { Passage, ProposalTarget } from "@reactive-resume/resume/proposals";
import type { ResumeData } from "@reactive-resume/schema/resume/data";
import { buildMarkdown } from "@reactive-resume/resume/markdown";
import {
	additionAfter,
	canApplyTo,
	collectPassages,
	readTarget,
	replaceBlockText,
} from "@reactive-resume/resume/proposals";
import { generateId } from "@reactive-resume/utils/string";
import { resumeService } from "../resume/service";

/** The one resume a conversation is about. */
export type AssistantDocument = { kind: "resume"; id: string };

/** Conversations from before the assistant was resume-only have no resume, and stay read-only. */
export const documentOf = (thread: { workingResumeId: string | null }): AssistantDocument | null =>
	thread.workingResumeId ? { kind: "resume", id: thread.workingResumeId } : null;

// The model reads passage locations in English; the editor shows its own, translated.
const LABELS = {
	includeEmpty: true,
	summary: "Summary",
	bullet: (n: number) => `bullet ${n}`,
	paragraph: (n: number) => `paragraph ${n}`,
};

const ENTRY_TITLE_FIELDS = ["company", "school", "organization", "name", "title", "network", "language", "position"];

function entryTitle(_type: string, entry: Record<string, unknown>) {
	for (const field of ENTRY_TITLE_FIELDS) {
		const value = entry[field];
		if (typeof value === "string" && value.trim()) return value.trim();
	}
	return "";
}

function sectionTitle(data: ResumeData, sectionId: string) {
	const custom = data.customSections.find((section) => section.id === sectionId);
	const title = custom ? custom.title : data.sections[sectionId as keyof ResumeData["sections"]]?.title;
	const fallback = (custom?.type ?? sectionId).replace(/-/g, " ");
	return title?.trim() || fallback.charAt(0).toUpperCase() + fallback.slice(1);
}

type LoadedDocument = {
	name: string;
	updatedAt: Date;
	locked: boolean;
	passages: Passage[];
	/** The field a proposal targets, as it reads now. */
	read: (target: ProposalTarget) => string | undefined;
	/** What read_resume returns to the model. */
	view: Record<string, unknown>;
};

export async function loadDocument(userId: string, document: AssistantDocument): Promise<LoadedDocument> {
	const resume = await resumeService.getById({ id: document.id, userId });
	const passages = collectPassages(resume.data, {
		...LABELS,
		sectionTitle: (sectionId) => sectionTitle(resume.data, sectionId),
		entryTitle,
	});

	return {
		name: resume.name,
		updatedAt: resume.updatedAt,
		locked: resume.isLocked,
		passages,
		read: (target) => readTarget(resume.data, target),
		view: { resume: buildMarkdown(resume.data) },
	};
}

/** The read tool's result: the document's text and every passage an edit can target. */
export function documentView(document: LoadedDocument) {
	return {
		name: document.name,
		updatedAt: document.updatedAt.toISOString(),
		// `data` holds the snapshot; older snapshots are pruned from the model's context.
		data: {
			...document.view,
			passages: document.passages.map((passage) => ({
				id: passage.id,
				location: passage.location,
				text: passage.text || "(empty)",
			})),
		},
	};
}

/**
 * Places the model's edits on the document as it is now. An edit whose passage id no longer exists (the words
 * changed since the document was read) is skipped, with a reason the model can act on.
 */
export function resolveEdits(document: LoadedDocument, input: ProposeEditsInput): ProposeEditsOutput {
	const byId = new Map(document.passages.map((passage) => [passage.id, passage]));
	const edits: ProposeEditsOutput["edits"] = [];
	const skipped: ProposeEditsOutput["skipped"] = [];

	for (const edit of input.edits) {
		const passage = byId.get(edit.passageId);
		if (!passage) {
			skipped.push({
				passageId: edit.passageId,
				reason: "No passage has this id now: the document changed since it was read. Read it again.",
			});
			continue;
		}
		if (!canApplyTo(document.read(passage.target), { before: passage.html })) {
			skipped.push({
				passageId: edit.passageId,
				reason: "This passage is ambiguous or changed. Edit its repeated text manually, or read the document again.",
			});
			continue;
		}

		const placed = edit.add
			? additionAfter(document.read(passage.target) ?? "", passage.html, edit.text)
			: { before: passage.html, after: replaceBlockText(passage.html, edit.text) };
		if (!placed || placed.after === placed.before) {
			skipped.push({ passageId: edit.passageId, reason: "The edit doesn't change the passage." });
			continue;
		}

		edits.push({
			id: generateId(),
			target: passage.target,
			location: passage.location,
			before: placed.before,
			after: placed.after,
			why: edit.why,
			status: "pending",
		});
	}

	return { title: input.title, edits, skipped };
}
