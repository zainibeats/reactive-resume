import type { JdTermMatch } from "@reactive-resume/resume/ats-pdf";
import type { ResumeData, SkillItem } from "@reactive-resume/schema/resume/data";
import type { CSSProperties } from "react";
import { t } from "@lingui/core/macro";
import { Plural, Trans } from "@lingui/react/macro";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { buildMarkdown } from "@reactive-resume/resume/markdown";
import { Button } from "@reactive-resume/ui/components/button";
import { Icon } from "@reactive-resume/ui/components/icon";
import { Textarea } from "@reactive-resume/ui/components/textarea";
import { generateId } from "@reactive-resume/utils/string";
import { cn } from "@reactive-resume/utils/style";
import { useEditorStore } from "../store";
import { checkStateOf, editWithUndo } from "./actions";
import { openAssistantFrom } from "@/features/assistant/open";
import { useIsResumeLocked } from "@/features/resume/builder/draft";
import { ENTER_CLASS } from "@/libs/motion";

/** The longest posting the matcher reads. */
const MAX_POSTING_CHARS = 20_000;

/** A posting term, with `label` as the posting writes it ("C#" rather than the matcher's "csharp"). */
type MatchedTerm = JdTermMatch & { label: string };

type JobMatchResult = { found: MatchedTerm[]; missing: MatchedTerm[]; total: number };

export type JobMatch = {
	/** The posting pasted this visit. */
	posting: string;
	result: JobMatchResult | null;
	hiddenTerms: readonly string[];
};

const loadAtsPdf = () => import("@reactive-resume/resume/ats-pdf");

/**
 * Job match reads a posting pasted for this visit and sorts its terms into found and missing. Terms hidden as
 * "not true for me" are left out. It isn't part of the score.
 */
export function useJobMatch(data: ResumeData | undefined): JobMatch {
	const posting = useEditorStore((state) => state.pastedPosting).trim();

	// The matcher (stemmer and skill aliases) loads only once there's a posting to match.
	const { data: engine } = useQuery({
		queryKey: ["ats-pdf-engine"],
		queryFn: loadAtsPdf,
		staleTime: Number.POSITIVE_INFINITY,
		enabled: posting.length > 0,
	});

	const hiddenTerms = data?.metadata.check?.hiddenTerms;
	const resumeText = useMemo(() => (data ? buildMarkdown(data) : ""), [data]);

	const result = useMemo(() => {
		if (!engine || !posting) return null;
		const hidden = new Set(hiddenTerms ?? []);
		const terms = engine
			.matchJobDescription({ jobDescription: posting, resumeText })
			.terms.filter((term) => !hidden.has(term.term))
			.map((term) => ({ ...term, label: termAsWritten(engine.surfaceFormsOf(term.term), posting) ?? term.term }));

		return {
			found: terms.filter((term) => term.resumeCount > 0),
			missing: terms.filter((term) => term.resumeCount === 0),
			total: terms.length,
		};
	}, [engine, posting, resumeText, hiddenTerms]);

	return { posting, result, hiddenTerms: hiddenTerms ?? [] };
}

/** The first spelling of a term the posting uses, as it writes it ("Figma", not "figma"). */
function termAsWritten(forms: readonly string[], posting: string): string | undefined {
	for (const form of forms) {
		const escaped = form.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
		const found = posting.match(new RegExp(escaped, "i"))?.[0];
		if (found) return found;
	}
}

type JobMatchTabProps = { match: JobMatch; data: ResumeData };

export function JobMatchTab({ match }: JobMatchTabProps) {
	const { posting, result, hiddenTerms } = match;
	const [openTerm, setOpenTerm] = useState<string | null>(null);
	const highlightTerm = useEditorStore((state) => state.highlightTerm);
	const setHighlightTerm = useEditorStore((state) => state.setHighlightTerm);
	const locked = useIsResumeLocked();

	if (!posting) return <NoPosting />;

	const open = result?.missing.find((term) => term.term === openTerm);

	const addToSkills = (term: MatchedTerm) => {
		const written = term.label;
		editWithUndo(
			(draft) => {
				draft.sections.skills.items.push(newSkill(written));
			},
			t`“${written}” added to Skills`,
		);
		setOpenTerm(null);
		setHighlightTerm(term.term);
	};

	const hideTerm = (term: MatchedTerm) => {
		editWithUndo(
			(draft) => {
				const state = checkStateOf(draft);
				if (!state.hiddenTerms.includes(term.term)) state.hiddenTerms.push(term.term);
			},
			t`“${term.label}” hidden`,
		);
		setOpenTerm(null);
	};

	return (
		<div className="grid gap-3.5">
			<PostingSource />

			{!result ? (
				<p className="flex items-center gap-2 text-sm text-ink-2">
					<Trans>Reading the posting…</Trans>
				</p>
			) : result.total === 0 ? (
				<p className="text-sm text-ink-2">
					<Trans>No terms stood out in this posting.</Trans>
				</p>
			) : (
				<>
					<div className="grid gap-1.5">
						<div className="flex items-baseline justify-between gap-2">
							<strong className="text-sm font-semibold">
								<Trans>
									{result.found.length} of {result.total} posting terms appear
								</Trans>
							</strong>
							<span className="text-xs text-ink-3">
								<Trans>not scored</Trans>
							</span>
						</div>
						<div
							role="progressbar"
							aria-label={t`Posting terms in your resume`}
							aria-valuemin={0}
							aria-valuemax={result.total}
							aria-valuenow={result.found.length}
							className="h-1.5 overflow-hidden rounded-full bg-sunken"
						>
							<div
								className="h-full translate-x-(--fill) rounded-full bg-accent transition-[translate] duration-standard ease-enter rtl:-translate-x-(--fill)"
								style={{ "--fill": `${(result.found.length / result.total) * 100 - 100}%` } as CSSProperties}
							/>
						</div>
					</div>

					{result.missing.length > 0 && (
						<section aria-labelledby="match-missing" className="grid gap-2">
							<h3 id="match-missing" className="text-xs font-semibold text-ink-3 uppercase">
								<Trans>Not in your resume · add only if true</Trans>
							</h3>
							<div className="flex flex-wrap gap-1.5">
								{result.missing.map((term) => (
									<button
										key={term.term}
										type="button"
										aria-expanded={openTerm === term.term}
										onClick={() => setOpenTerm(openTerm === term.term ? null : term.term)}
										className={cn(
											"flex h-[30px] items-center gap-1 rounded-[7px] border border-dashed px-2.5 text-[13px] font-medium transition-colors duration-quick",
											openTerm === term.term ? "border-accent bg-accent-soft" : "border-line-2 hover:bg-hover",
										)}
									>
										<Icon name="add" size={15} className="text-ink-3" />
										{term.label}
									</button>
								))}
							</div>

							{open && (
								<section
									key={open.term}
									aria-label={t`Add “${open.label}”`}
									className={cn(ENTER_CLASS, "grid gap-2 rounded-xl border border-line bg-raised p-3 shadow-e2")}
								>
									<p className="text-[13px] leading-[19px] text-ink-2">
										<Plural
											value={open.jdCount}
											one={`“${open.label}” appears once in the posting.`}
											other={`“${open.label}” appears #× in the posting.`}
										/>{" "}
										<Trans>If it's part of your experience, add it where it belongs.</Trans>
									</p>
									<div className="grid justify-items-start gap-1">
										<Button size="sm" disabled={locked} onClick={() => addToSkills(open)}>
											<Icon name="add" size={16} />
											<Trans>Add to Skills</Trans>
										</Button>
										<Button size="sm" variant="secondary" disabled={locked} onClick={() => askAssistant(open.label)}>
											<Icon name="auto_awesome" size={16} />
											<Trans>Ask the assistant to work it in</Trans>
										</Button>
										<Button size="sm" variant="ghost" disabled={locked} onClick={() => hideTerm(open)}>
											<Trans>Not true for me, hide it</Trans>
										</Button>
									</div>
								</section>
							)}
						</section>
					)}

					{result.found.length > 0 && (
						<section aria-labelledby="match-found" className="grid gap-2">
							<h3 id="match-found" className="text-xs font-semibold text-ink-3 uppercase">
								<Trans>Already covered · pick one to find it on the page</Trans>
							</h3>
							<div className="flex flex-wrap gap-1.5">
								{result.found.map((term) => {
									const on = highlightTerm === term.term;
									return (
										<button
											key={term.term}
											type="button"
											aria-pressed={on}
											onClick={() => setHighlightTerm(on ? null : term.term)}
											className={cn(
												"flex h-7 items-center gap-1 rounded-md px-2 text-xs font-medium transition-colors duration-quick",
												on ? "bg-[#F2DE8C] text-[oklch(0.3_0.05_80)]" : "bg-accent-soft text-accent-text",
											)}
										>
											<Icon name="check" size={14} />
											{term.label}
										</button>
									);
								})}
							</div>
						</section>
					)}
				</>
			)}

			{hiddenTerms.length > 0 && (
				<p className="text-xs text-ink-3">
					<Trans>Hidden: {hiddenTerms.join(", ")}</Trans> ·{" "}
					<button
						type="button"
						disabled={locked}
						className="font-medium text-ink-2 underline underline-offset-2"
						onClick={() =>
							editWithUndo(
								(draft) => {
									checkStateOf(draft).hiddenTerms = [];
								},
								t`Hidden terms are back`,
							)
						}
					>
						<Trans>Show again</Trans>
					</button>
				</p>
			)}
		</div>
	);
}

const newSkill = (name: string): SkillItem => ({
	id: generateId(),
	hidden: false,
	icon: "",
	iconColor: "",
	name,
	proficiency: "",
	level: 0,
	keywords: [],
});

/** The pasted posting, with Clear to match against another one. */
function PostingSource() {
	const setPastedPosting = useEditorStore((state) => state.setPastedPosting);

	return (
		<div className="flex items-center gap-2.5 rounded-[10px] bg-bg p-3">
			<span className="grid size-7 place-items-center rounded-[7px] bg-sunken text-ink-2">
				<Icon name="content_copy" size={16} />
			</span>
			<span className="grid min-w-0 flex-1">
				<b className="text-[13px] font-semibold">
					<Trans>Pasted posting</Trans>
				</b>
				<span className="text-xs text-ink-3">
					<Trans>For this visit only</Trans>
				</span>
			</span>
			<Button size="sm" variant="secondary" onClick={() => setPastedPosting("")}>
				<Trans>Clear</Trans>
			</Button>
		</div>
	);
}

/** C2: nothing to match against yet. Paste a posting to match the resume against it. */
function NoPosting() {
	const pasted = useEditorStore((state) => state.pastedPosting);
	const setPastedPosting = useEditorStore((state) => state.setPastedPosting);
	const [draft, setDraft] = useState(pasted);

	return (
		<div className="grid gap-2.5 rounded-xl border border-line p-4">
			<strong className="text-sm font-semibold">
				<Trans>Match against a job</Trans>
			</strong>
			<Textarea
				aria-label={t`Job posting`}
				rows={4}
				maxLength={MAX_POSTING_CHARS}
				value={draft}
				placeholder={t`Paste a job posting…`}
				onChange={(event) => setDraft(event.target.value)}
			/>
			<Button size="sm" className="w-fit" disabled={!draft.trim()} onClick={() => setPastedPosting(draft)}>
				<Trans>Match this posting</Trans>
			</Button>
		</div>
	);
}

/** The assistant asks before adding anything, so it gets the term and a request to check first. */
function askAssistant(label: string) {
	openAssistantFrom({
		ask: t`The posting asks for “${label}”. If it's true for me, work it into my resume where it fits. Ask me first.`,
	});
}
