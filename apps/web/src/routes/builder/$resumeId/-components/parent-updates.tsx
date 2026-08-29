import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { GitBranchIcon } from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@reactive-resume/ui/components/badge";
import { Button } from "@reactive-resume/ui/components/button";
import { Checkbox } from "@reactive-resume/ui/components/checkbox";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@reactive-resume/ui/components/dialog";
import { ScrollArea } from "@reactive-resume/ui/components/scroll-area";
import { useCurrentBuilderResumeSelector } from "@/features/resume/builder/draft";
import { formatSyncDiffPath, formatSyncDiffValue } from "@/features/resume/sync/diff";
import { useConfirm } from "@/hooks/use-confirm";
import { getResumeErrorMessage } from "@/libs/error-message";
import { orpc } from "@/libs/orpc/client";

type SyncStatus = Awaited<ReturnType<typeof orpc.resume.getSyncStatus.call>>;
type SyncDiff = SyncStatus["diffs"][number];

type BuilderParentUpdatesProps = {
	resumeId: string;
};

const NO_DIFFS: SyncDiff[] = [];

function DiffOperationLabel({ op }: { op: SyncDiff["op"] }) {
	if (op === "add") return <Trans>Added</Trans>;
	if (op === "remove") return <Trans>Removed</Trans>;
	return <Trans>Changed</Trans>;
}

function DiffRow({
	diff,
	checked,
	onCheckedChange,
}: {
	diff: SyncDiff;
	checked: boolean;
	onCheckedChange: (checked: boolean) => void;
}) {
	const breadcrumb = formatSyncDiffPath(diff.path).join(" › ");
	const previous = formatSyncDiffValue(diff.previous);
	const next = formatSyncDiffValue(diff.next);

	return (
		<div className="flex items-start gap-3 rounded-md px-2 py-2 hover:bg-muted/50">
			<Checkbox
				checked={checked}
				aria-label={breadcrumb}
				className="mt-0.5"
				onCheckedChange={(value) => onCheckedChange(value === true)}
			/>

			<div className="min-w-0 flex-1 space-y-1">
				<div className="flex flex-wrap items-center gap-2">
					<span className="min-w-0 break-all font-medium">{breadcrumb}</span>
					<Badge variant="secondary">
						<DiffOperationLabel op={diff.op} />
					</Badge>
					{diff.hasConflict && (
						<Badge variant="destructive">
							<Trans>Conflict</Trans>
						</Badge>
					)}
				</div>

				<div className="space-y-0.5 text-muted-foreground text-xs">
					{previous && <p className="break-words line-through">{previous}</p>}
					{next && <p className="break-words text-foreground">{next}</p>}
				</div>
			</div>
		</div>
	);
}

/**
 * Review surface for a child resume: lists the updates made to its parent since the last sync and
 * applies only the ones the author picks.
 *
 * Applying publishes a `resume.updated` event with `mutation: "sync"`, which the builder's update
 * subscription (see `draft.ts`) already routes straight to `replaceResumeFromServer` — so this
 * component only has to invalidate the sync status it renders.
 */
export function BuilderParentUpdates({ resumeId }: BuilderParentUpdatesProps) {
	const parentId = useCurrentBuilderResumeSelector((resume) => resume.parentId ?? null);
	const confirm = useConfirm();
	const queryClient = useQueryClient();

	const [open, setOpen] = useState(false);
	// `null` means "no explicit choice yet", so the default selection stays in sync with new diffs.
	const [override, setOverride] = useState<Set<string> | null>(null);

	const { data: status } = useQuery({
		...orpc.resume.getSyncStatus.queryOptions({ input: { id: resumeId } }),
		enabled: Boolean(parentId),
	});

	const { mutate: applyParentUpdates, isPending: isApplying } = useMutation(
		orpc.resume.applyParentUpdates.mutationOptions(),
	);
	const { mutate: dismissParentUpdates, isPending: isDismissing } = useMutation(
		orpc.resume.dismissParentUpdates.mutationOptions(),
	);

	const diffs = status?.diffs ?? NO_DIFFS;
	const defaultSelection = useMemo(
		() => new Set(diffs.filter((diff) => !diff.hasConflict).map((diff) => diff.path)),
		[diffs],
	);
	const selection = override ?? defaultSelection;

	const selectedDiffs = diffs.filter((diff) => selection.has(diff.path));
	const hasSelectedConflicts = selectedDiffs.some((diff) => diff.hasConflict);
	const isBusy = isApplying || isDismissing;

	const invalidateSyncStatus = () =>
		queryClient.invalidateQueries({ queryKey: orpc.resume.getSyncStatus.queryKey({ input: { id: resumeId } }) });

	const handleOpenChange = (nextOpen: boolean) => {
		setOpen(nextOpen);
		if (!nextOpen) setOverride(null);
	};

	const handleToggle = (path: string, checked: boolean) => {
		const next = new Set(selection);
		if (checked) next.add(path);
		else next.delete(path);
		setOverride(next);
	};

	const handleToggleAll = () => {
		setOverride(selectedDiffs.length === diffs.length ? new Set() : new Set(diffs.map((diff) => diff.path)));
	};

	const handleApply = async () => {
		if (selectedDiffs.length === 0) return;

		if (hasSelectedConflicts) {
			const confirmed = await confirm(t`Replace your own edits?`, {
				description: t`Some selected updates overlap changes made in this child resume. Applying them keeps the parent's version.`,
			});

			if (!confirmed) return;
		}

		applyParentUpdates(
			{ id: resumeId, paths: selectedDiffs.map((diff) => diff.path), force: hasSelectedConflicts },
			{
				onSuccess: () => {
					toast.success(t`Parent updates applied.`);
					handleOpenChange(false);
					void invalidateSyncStatus();
				},
				onError: (error) => {
					toast.error(getResumeErrorMessage(error));
				},
			},
		);
	};

	const handleDismiss = async () => {
		const confirmed = await confirm(t`Dismiss these updates?`, {
			description: t`This resume stops reporting the current parent updates. Its own content is left unchanged.`,
		});

		if (!confirmed) return;

		dismissParentUpdates(
			{ id: resumeId },
			{
				onSuccess: () => {
					toast.success(t`Parent updates dismissed.`);
					handleOpenChange(false);
					void invalidateSyncStatus();
				},
				onError: (error) => {
					toast.error(getResumeErrorMessage(error));
				},
			},
		);
	};

	if (!status?.isBehind) return null;

	return (
		<>
			<Button
				size="icon"
				variant="ghost"
				aria-label={t`Review updates from the parent resume`}
				className="relative"
				onClick={() => setOpen(true)}
			>
				<GitBranchIcon />
				<span className="absolute -end-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-primary font-medium text-[10px] text-primary-foreground">
					{status.operationCount}
				</span>
			</Button>

			<Dialog open={open} onOpenChange={handleOpenChange}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle className="flex items-center gap-x-2">
							<GitBranchIcon />
							<Trans>Parent updates</Trans>
						</DialogTitle>
						<DialogDescription>
							<Trans>Choose which changes made to the parent resume to bring into this one.</Trans>
						</DialogDescription>
						{status.parent && <p className="text-muted-foreground text-xs">{status.parent.name}</p>}
					</DialogHeader>

					<div className="flex items-center justify-between border-b pb-2">
						<Button size="sm" variant="ghost" disabled={isBusy} onClick={handleToggleAll}>
							{selectedDiffs.length === diffs.length ? <Trans>Select none</Trans> : <Trans>Select all</Trans>}
						</Button>
						<span className="text-muted-foreground text-xs">
							{selectedDiffs.length} / {diffs.length}
						</span>
					</div>

					<ScrollArea className="max-h-[45svh]">
						<div className="space-y-1 pe-3">
							{diffs.map((diff) => (
								<DiffRow
									key={diff.path}
									diff={diff}
									checked={selection.has(diff.path)}
									onCheckedChange={(checked) => handleToggle(diff.path, checked)}
								/>
							))}
						</div>
					</ScrollArea>

					{status.hasConflicts && (
						<p className="text-destructive text-xs">
							<Trans>
								Updates marked as conflicts overlap edits made in this resume. Selecting one replaces your version.
							</Trans>
						</p>
					)}

					<DialogFooter>
						<Button variant="outline" disabled={isBusy} onClick={handleDismiss}>
							<Trans>Dismiss updates</Trans>
						</Button>
						<Button disabled={isBusy || selectedDiffs.length === 0} onClick={handleApply}>
							<Trans>Apply selected</Trans>
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}
