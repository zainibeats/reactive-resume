import type { ImportKind } from "@/features/resume/import/read-file";
import type { IconName } from "@reactive-resume/ui/components/icon";
import type { CSSProperties, Dispatch, SetStateAction } from "react";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Button } from "@reactive-resume/ui/components/button";
import { DialogContent, DialogHeader, DialogTitle } from "@reactive-resume/ui/components/dialog";
import { Icon } from "@reactive-resume/ui/components/icon";
import { Spinner } from "@reactive-resume/ui/components/spinner";
import { toast } from "@reactive-resume/ui/components/toast";
import { generateRandomName } from "@reactive-resume/utils/string";
import { cn } from "@reactive-resume/utils/style";
import { useNewDocumentsStore } from "./new-documents";
import { useDialogStore } from "@/dialogs/store";
import { detectImportKind, ImportError, readResumeFile, summarizeImport } from "@/features/resume/import/read-file";
import { useHasUsableAiProvider } from "@/features/settings/integrations/hooks/use-has-usable-ai-provider";
import { getOrpcErrorMessage } from "@/libs/error-message";
import { ENTER_CLASS, POP_CLASS } from "@/libs/motion";
import { client, orpc } from "@/libs/orpc/client";

export type NewDocumentDialogData = {
	/** A file dropped on the page, imported straight away. */
	file?: File;
};

type Step =
	| { name: "choose" }
	| { name: "importing"; file: File; stage: number; notes: string[] }
	| { name: "imported"; file: File; resumeId: string; sections: number; entries: number; flagged: number }
	| { name: "failed"; file: File; message: string };

const ACCEPT = ".pdf,.docx,.json,.zip,application/pdf,application/json,application/zip";

const formatSize = (bytes: number) =>
	bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

function requireImportKind(kind: ImportKind | null): ImportKind {
	if (!kind) {
		throw new ImportError(
			t`This file type can't be imported. Use a PDF, Word, Reactive Resume or JSON Resume file, or a LinkedIn export (.zip).`,
		);
	}
	return kind;
}

/** Runs an import and reports each stage into the dialog's step; a newer run or a cancel drops the older one's updates. */
function useResumeImport(setStep: Dispatch<SetStateAction<Step>>) {
	const queryClient = useQueryClient();
	const markNew = useNewDocumentsStore((state) => state.markNew);
	const { hasUsableProvider } = useHasUsableAiProvider();
	const run = useRef(0);
	const refreshDocuments = () => queryClient.invalidateQueries({ queryKey: orpc.documents.key() });

	const importFile = async (file: File) => {
		const attempt = ++run.current;
		const current = () => run.current === attempt;
		const advance = (stage: number, note: string) => {
			const index = stage - 1;
			setStep((previous) =>
				previous.name === "importing" && current()
					? { ...previous, stage, notes: Object.assign([...previous.notes], { [index]: note }) }
					: previous,
			);
		};

		setStep({ name: "importing", file, stage: 0, notes: [] });
		try {
			const kind = requireImportKind(await detectImportKind(file));
			const resume = await readResumeFile(file, kind, {
				aiAvailable: hasUsableProvider,
				onRead: (note) => advance(1, note),
			});
			if (!current()) return;
			const summary = summarizeImport(resume);
			advance(1, t`file read`);
			advance(2, t`${summary.sections} sections`);

			const resumeId = await client.resume.import({ data: resume });
			if (!current()) return;
			markNew(resumeId);
			void refreshDocuments();
			setStep({ name: "imported", file, resumeId, ...summary });
		} catch (error) {
			if (!current()) return;
			const message =
				error instanceof ImportError
					? error.message
					: getOrpcErrorMessage(error, {
							byCode: {
								BAD_REQUEST: t`The file couldn't be read as a resume.`,
								BAD_GATEWAY: t`Couldn't reach the AI provider. Try again in a moment.`,
							},
							fallback: t`Something went wrong while importing. Try again, or start blank.`,
						});
			setStep({ name: "failed", file, message });
		}
	};

	const cancel = () => {
		run.current++;
		setStep({ name: "choose" });
	};

	return { importFile, cancel };
}

type NewDocumentDialogProps = { data?: NewDocumentDialogData | undefined };

/**
 * New: import a file or start blank; no name, slug or tags are asked for first.
 * Importing shows three labelled steps rather than a spinner, so a slow parse still looks like progress.
 */
export function NewDocumentDialog({ data }: NewDocumentDialogProps) {
	const navigate = useNavigate();
	const closeDialog = useDialogStore((state) => state.closeDialog);
	const [step, setStep] = useState<Step>({ name: "choose" });
	const inputRef = useRef<HTMLInputElement>(null);

	const openResume = (resumeId: string, importedFrom: string) => {
		closeDialog();
		void navigate({ to: "/builder/$resumeId", params: { resumeId }, search: { imported: importedFrom } });
	};

	const { importFile, cancel } = useResumeImport(setStep);

	// A file dropped on the page starts importing as soon as the dialog opens.
	const dropped = useRef(data?.file);
	useEffect(() => {
		if (!dropped.current) return;
		const file = dropped.current;
		dropped.current = undefined;
		void importFile(file);
	});

	const { startBlank, trySample, creating } = useStartDocument();

	const chooseFile = () => inputRef.current?.click();

	return (
		<DialogContent className="sm:max-w-[640px]">
			<input
				ref={inputRef}
				type="file"
				accept={ACCEPT}
				className="hidden"
				aria-label={t`Choose a file to import`}
				onChange={(event) => {
					const file = event.target.files?.[0];
					event.target.value = "";
					if (file) void importFile(file);
				}}
			/>
			{/* Each step fades up into place as it replaces the last; the dialog's height changes in the same frame. */}
			{step.name !== "choose" ? (
				<ImportStep
					key="progress"
					step={step}
					creating={creating}
					onCancel={cancel}
					onStartBlank={() => void startBlank()}
					onChooseFile={chooseFile}
					onClose={closeDialog}
					onOpen={openResume}
				/>
			) : (
				<div key="choose" className={cn(ENTER_CLASS, "grid gap-4")}>
					<DialogHeader>
						<DialogTitle className="font-display text-[22px] font-medium">
							<Trans>New document</Trans>
						</DialogTitle>
					</DialogHeader>

					<button
						type="button"
						onClick={chooseFile}
						onDragOver={(event) => event.preventDefault()}
						onDrop={(event) => {
							event.preventDefault();
							const file = event.dataTransfer.files[0];
							if (file) void importFile(file);
						}}
						className="flex items-start gap-4 rounded-xl border-[1.5px] border-dashed border-line-2 p-5 text-start transition-[background-color,border-color,scale] duration-quick ease-enter hover:border-accent hover:bg-accent-soft active:scale-[0.98]"
					>
						<span className="grid size-11 shrink-0 place-items-center rounded-[10px] bg-sunken text-ink-2">
							<Icon name="upload_file" size={24} />
						</span>
						<span className="grid gap-1">
							<span className="text-[15px] font-semibold">
								<Trans>Import a resume</Trans>
							</span>
							<span className="text-[13px] leading-[19px] text-ink-2">
								<Trans>
									Drop a file here or browse. PDF, Word, Reactive Resume or JSON Resume. We fill in every section and
									flag anything we're unsure of.
								</Trans>
							</span>
						</span>
					</button>

					<ChoiceTile
						icon="note_add"
						title={t`Start blank`}
						description={t`Opens the editor on your name. Nothing else to fill in first.`}
						disabled={creating}
						onClick={() => void startBlank()}
					/>

					<div className="flex flex-wrap items-center justify-end gap-2 border-t border-line pt-4 text-[13px]">
						<button
							type="button"
							className="text-ink-2 underline underline-offset-2 hover:text-ink"
							disabled={creating}
							onClick={() => void trySample()}
						>
							<Trans>Try with a sample resume</Trans>
						</button>
					</div>
				</div>
			)}
		</DialogContent>
	);
}

type ImportStepProps = {
	step: Extract<Step, { name: "importing" | "imported" | "failed" }>;
	creating: boolean;
	onCancel: () => void;
	onStartBlank: () => void;
	onChooseFile: () => void;
	onClose: () => void;
	onOpen: (resumeId: string, importedFrom: string) => void;
};

/** The import's progress, then its outcome: found counts with Open in editor, or the error with a way forward. */
function ImportStep({ step, creating, onCancel, onStartBlank, onChooseFile, onClose, onOpen }: ImportStepProps) {
	return (
		<div className={cn(ENTER_CLASS, "grid gap-4")}>
			<DialogHeader>
				<DialogTitle className="font-display text-[22px] font-medium">
					{step.name === "failed" ? (
						<Trans>Couldn't import</Trans>
					) : step.name === "imported" ? (
						<Trans>Imported</Trans>
					) : (
						<Trans>Importing</Trans>
					)}
				</DialogTitle>
			</DialogHeader>
			<div className="flex items-center gap-3 rounded-[10px] border border-line p-3">
				<Icon
					name={step.file.name.toLowerCase().endsWith(".pdf") ? "picture_as_pdf" : "description"}
					className="text-ink-2"
				/>
				<span className="grid min-w-0 flex-1">
					<span className="truncate text-sm font-medium">{step.file.name}</span>
					<span className="text-xs text-ink-3">{formatSize(step.file.size)}</span>
				</span>
				{step.name === "importing" && (
					<Button variant="ghost" size="sm" onClick={onCancel}>
						<Trans>Cancel</Trans>
					</Button>
				)}
			</div>

			{/* One ImportProgress for importing and imported, so its checks don't replay when the import finishes. */}
			{step.name !== "failed" && (
				<ImportProgress
					stage={step.name === "imported" ? 3 : step.stage}
					notes={
						step.name === "imported"
							? [t`file read`, t`${step.sections} sections`, t`${step.entries} entries`]
							: step.notes
					}
				/>
			)}

			{step.name === "failed" && (
				<>
					<div
						role="alert"
						className={cn(
							ENTER_CLASS,
							"flex gap-2.5 rounded-[10px] bg-danger-soft p-3 text-[13px] leading-[19px] text-danger-text",
						)}
					>
						<Icon name="error" size={20} />
						<span>{step.message}</span>
					</div>
					<div className={cn(ENTER_CLASS, "flex flex-wrap justify-end gap-2")}>
						<Button variant="secondary" onClick={onStartBlank} disabled={creating}>
							<Trans>Start blank</Trans>
						</Button>
						<Button onClick={onChooseFile}>
							<Trans>Choose another file</Trans>
						</Button>
					</div>
				</>
			)}

			{step.name === "imported" && (
				<>
					<p role="status" className={cn(ENTER_CLASS, "flex gap-2 text-[13px] leading-[19px]")}>
						<Icon
							name="check_circle"
							size={20}
							className="text-accent-text transition-[opacity,scale] duration-standard ease-enter starting:scale-80 starting:opacity-0"
						/>
						<span>
							<Trans>
								{step.sections} sections and {step.entries} entries found.
							</Trans>{" "}
							{step.flagged > 0 && <Trans>{step.flagged} fields are flagged for a quick look in the editor.</Trans>}
						</span>
					</p>
					<div className={cn(ENTER_CLASS, "flex flex-wrap justify-end gap-2")}>
						<Button variant="secondary" onClick={onClose}>
							<Trans>Stay here</Trans>
						</Button>
						<Button onClick={() => onOpen(step.resumeId, step.file.name)}>
							<Trans>Open in editor</Trans>
						</Button>
					</div>
				</>
			)}
		</div>
	);
}

/** Start blank or try a sample: each creates the resume at once and opens it. */
export function useStartDocument() {
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const closeDialog = useDialogStore((state) => state.closeDialog);
	const markNew = useNewDocumentsStore((state) => state.markNew);
	const { mutateAsync: createResume, isPending: creating } = useMutation(orpc.resume.create.mutationOptions());

	const created = (id: string) => {
		markNew(id);
		void queryClient.invalidateQueries({ queryKey: orpc.documents.key() });
		closeDialog();
	};
	const failed = (error: unknown) =>
		toast.add({
			type: "error",
			description: getOrpcErrorMessage(error, { fallback: t`Couldn't create the document.` }),
		});

	return {
		creating,
		startBlank: async () => {
			try {
				const resumeId = await createResume({
					name: t`Untitled resume`,
					tags: [],
					autoName: true,
					withSampleData: false,
				});
				created(resumeId);
				void navigate({ to: "/builder/$resumeId", params: { resumeId } });
			} catch (error) {
				failed(error);
			}
		},
		trySample: async () => {
			try {
				const resumeId = await createResume({ name: generateRandomName(), tags: [], withSampleData: true });
				created(resumeId);
				toast.add({ description: t`Sample resume added. Delete it anytime.` });
				void navigate({ to: "/builder/$resumeId", params: { resumeId } });
			} catch (error) {
				failed(error);
			}
		},
	};
}

type ChoiceTileProps = {
	icon: IconName;
	title: string;
	description: string;
	onClick: () => void;
	disabled?: boolean;
};

function ChoiceTile({ icon, title, description, onClick, disabled }: ChoiceTileProps) {
	return (
		<button
			type="button"
			disabled={disabled}
			onClick={onClick}
			className="flex items-start gap-3 rounded-xl border border-line p-4 text-start transition-[background-color,border-color,scale] duration-quick ease-enter hover:border-line-2 hover:bg-hover enabled:active:scale-[0.97] disabled:opacity-60"
		>
			<Icon name={icon} size={22} className="mt-0.5 text-ink-2" />
			<span className="grid gap-0.5">
				<span className="text-sm font-semibold">{title}</span>
				<span className="text-[13px] leading-[18px] text-ink-2">{description}</span>
			</span>
		</button>
	);
}

/** Reading the file → Finding sections → Filling in entries, each with a note once done. */
function ImportProgress({ stage, notes }: { stage: number; notes: string[] }) {
	const steps = [t`Reading the file`, t`Finding sections`, t`Filling in entries`];

	return (
		<div className="grid gap-3">
			<ol className="grid gap-2.5" aria-label={t`Import steps`}>
				{steps.map((label, index) => {
					const done = stage > index;
					const current = stage === index;
					return (
						<li
							key={label}
							className={cn("flex items-center gap-2.5 text-sm", done || current ? "text-ink" : "text-ink-3")}
						>
							{done ? (
								<Icon name="check_circle" size={18} className={cn(POP_CLASS, "text-accent-text")} />
							) : current ? (
								<Spinner decorative className={cn(POP_CLASS, "size-[18px]")} />
							) : (
								<span className="size-[18px] rounded-full border-[1.5px] border-line-2" />
							)}
							<span className="font-medium">{label}</span>
							{done && notes[index] && <span className="text-xs text-ink-3">{notes[index]}</span>}
						</li>
					);
				})}
			</ol>
			<div
				role="progressbar"
				aria-label={t`Import progress`}
				aria-valuemin={0}
				aria-valuemax={3}
				aria-valuenow={stage}
				className="h-1 overflow-hidden rounded-full bg-sunken"
			>
				<div
					className="h-full translate-x-(--fill) bg-accent transition-[translate] duration-standard ease-enter rtl:-translate-x-(--fill)"
					style={{ "--fill": `${(stage / 3) * 100 - 100}%` } as CSSProperties}
				/>
			</div>
		</div>
	);
}
