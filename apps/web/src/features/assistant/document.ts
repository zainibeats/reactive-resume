import type { Passage, Proposal, ProposalState } from "@reactive-resume/resume/proposals";
import { t } from "@lingui/core/macro";
import { useMemo } from "react";
import { collectPassages, getProposalState } from "@reactive-resume/resume/proposals";
import { useCurrentResume } from "@/features/resume/builder/draft";
import { getSectionName } from "@/features/resume/editor/check/issues";
import { acceptResumeProposals } from "@/features/resume/editor/proposals/proposals";
import { describeEntry } from "@/features/resume/editor/write/model";

/** The resume the assistant works on, as the panel needs it. */
export type AssistantDocument = {
	id: string;
	name: string;
	locked: boolean;
	/** A proposal's state against the document as it reads now. */
	stateOf: (proposal: Proposal) => ProposalState;
	/** Applies proposals as one undo step, with Undo in the toast. */
	accept: (proposals: readonly Proposal[]) => void;
	/** Where a proposal lands, in the app's language, when its passage is still there. */
	locationOf: (proposal: Pick<Proposal, "before" | "target">) => string | undefined;
};

const bullet = (n: number) => t`bullet ${n}`;
const paragraph = (n: number) => t`paragraph ${n}`;

/** Finds the passage a proposal replaces, or the one an addition follows. */
function locate(passages: readonly Passage[], { before, target }: Pick<Proposal, "before" | "target">) {
	const matches = passages.filter(
		(passage) =>
			passage.target.sectionId === target.sectionId &&
			passage.target.itemId === target.itemId &&
			passage.target.roleId === target.roleId &&
			passage.target.field === target.field &&
			passage.html &&
			(before === passage.html || before.startsWith(passage.html)),
	);
	return matches.length === 1 ? matches[0]?.location : undefined;
}

export function useResumeAssistantDocument(): AssistantDocument {
	const resume = useCurrentResume();

	return useMemo(() => {
		const passages = collectPassages(resume.data, {
			summary: getSectionName(resume.data, "summary"),
			sectionTitle: (sectionId) => getSectionName(resume.data, sectionId),
			entryTitle: (type, entry) => describeEntry(type as never, entry as never).title,
			bullet,
			paragraph,
		});

		return {
			id: resume.id,
			name: resume.name,
			locked: resume.isLocked,
			stateOf: (proposal) => getProposalState(resume.data, proposal),
			accept: acceptResumeProposals,
			locationOf: (proposal) => locate(passages, proposal),
		};
	}, [resume.id, resume.name, resume.isLocked, resume.data]);
}
