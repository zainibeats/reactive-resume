import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import {
	ArrowsClockwiseIcon,
	CaretDownIcon,
	CopySimpleIcon,
	GitBranchIcon,
	HouseSimpleIcon,
	LockSimpleIcon,
	LockSimpleOpenIcon,
	PencilSimpleLineIcon,
	SidebarSimpleIcon,
	TrashSimpleIcon,
	WarningCircleIcon,
	XCircleIcon,
} from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@reactive-resume/ui/components/alert";
import { Button } from "@reactive-resume/ui/components/button";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@reactive-resume/ui/components/dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@reactive-resume/ui/components/dropdown-menu";
import { useDialogStore } from "@/dialogs/store";
import { useCurrentResume, usePatchResume } from "@/features/resume/builder/draft";
import { useConfirm } from "@/hooks/use-confirm";
import { getResumeErrorMessage } from "@/libs/error-message";
import { orpc } from "@/libs/orpc/client";
import { useBuilderSidebar } from "../-store/sidebar";

export function BuilderHeader() {
	const resume = useCurrentResume();
	const name = resume.name;
	const isLocked = resume.isLocked;
	const toggleSidebar = useBuilderSidebar((state) => state.toggleSidebar);

	return (
		<>
			<div className="absolute inset-x-0 top-0 z-50 flex h-14 items-center justify-between border-b bg-popover px-1.5">
				<Button size="icon" variant="ghost" onClick={() => toggleSidebar("left")}>
					<SidebarSimpleIcon />
					<span className="sr-only">
						<Trans comment="Screen-reader label for opening or closing the left sidebar in resume builder">
							Toggle left sidebar
						</Trans>
					</span>
				</Button>

				<div className="flex min-w-0 items-center gap-x-1">
					<Button
						size="icon"
						variant="ghost"
						aria-label={t({
							comment: "Accessible label for button navigating from builder to resumes dashboard",
							message: "Go to resumes dashboard",
						})}
						nativeButton={false}
						render={
							<Link to="/dashboard/resumes" search={{ sort: "lastUpdatedAt", tags: [] }}>
								<HouseSimpleIcon />
							</Link>
						}
					/>
					<span className="me-2.5 text-muted-foreground">/</span>
					<h2 className="min-w-0 flex-1 truncate font-medium">{name}</h2>
					{isLocked && <LockSimpleIcon className="ms-2 text-muted-foreground" />}
					<BuilderHeaderDropdown />
				</div>

				<Button size="icon" variant="ghost" onClick={() => toggleSidebar("right")}>
					<SidebarSimpleIcon className="-scale-x-100" />
					<span className="sr-only">
						<Trans comment="Screen-reader label for opening or closing the right sidebar in resume builder">
							Toggle right sidebar
						</Trans>
					</span>
				</Button>
			</div>

			<ChildResumeSyncAlert />
		</>
	);
}

function ChildResumeSyncAlert() {
	const [isReviewOpen, setIsReviewOpen] = useState(false);
	const queryClient = useQueryClient();
	const resume = useCurrentResume();
	const patchResume = usePatchResume();
	const id = resume.id;
	const isLocked = resume.isLocked;
	const parentId = resume.parentId;

	const { data: syncStatus } = useQuery({
		...orpc.resume.getSyncStatus.queryOptions({ input: { id } }),
		enabled: Boolean(parentId),
	});
	const { mutate: applyParentUpdates, isPending: isApplyingParentUpdates } = useMutation(
		orpc.resume.applyParentUpdates.mutationOptions(),
	);
	const { mutate: dismissParentUpdates, isPending: isDismissingParentUpdates } = useMutation(
		orpc.resume.dismissParentUpdates.mutationOptions(),
	);

	if (!parentId || !syncStatus?.isBehind) return null;

	const refreshSyncStatus = () => {
		void queryClient.invalidateQueries({ queryKey: orpc.resume.getSyncStatus.queryKey({ input: { id } }) });
		void queryClient.invalidateQueries({ queryKey: orpc.resume.getById.queryKey({ input: { id } }) });
	};

	const applyUpdates = (force = false) => {
		const toastId = toast.loading(t`Applying parent updates...`);

		applyParentUpdates(
			{ id, force },
			{
				onSuccess: (updated) => {
					patchResume((draft) => {
						Object.assign(draft, updated);
					});
					refreshSyncStatus();
					setIsReviewOpen(false);
					toast.success(t`Parent updates have been applied.`, { id: toastId });
				},
				onError: (error) => {
					toast.error(getResumeErrorMessage(error), { id: toastId });
				},
			},
		);
	};

	const dismissUpdates = () => {
		const toastId = toast.loading(t`Dismissing parent updates...`);

		dismissParentUpdates(
			{ id },
			{
				onSuccess: (updated) => {
					patchResume((draft) => {
						Object.assign(draft, updated);
					});
					refreshSyncStatus();
					setIsReviewOpen(false);
					toast.success(t`Parent updates have been dismissed.`, { id: toastId });
				},
				onError: (error) => {
					toast.error(getResumeErrorMessage(error), { id: toastId });
				},
			},
		);
	};

	const isPending = isApplyingParentUpdates || isDismissingParentUpdates;

	return (
		<>
			<div className="pointer-events-none absolute inset-x-2 top-16 z-40 flex justify-center sm:inset-x-4">
				<Alert className="pointer-events-auto max-w-3xl border-primary/30 bg-popover shadow-lg sm:pe-36">
					<WarningCircleIcon />
					<AlertTitle>
						<Trans>Parent resume has updates</Trans>
					</AlertTitle>
					<AlertDescription>
						{syncStatus.hasConflicts ? (
							<Trans>Review the parent changes before merging because some edits overlap with this child resume.</Trans>
						) : syncStatus.operationCount > 0 ? (
							<Trans>Review and merge or dismiss the latest parent changes for this child resume.</Trans>
						) : (
							<Trans>The parent resume changed. Review it to keep or dismiss the newer parent version.</Trans>
						)}
					</AlertDescription>
					<AlertAction className="static col-start-2 mt-2 sm:absolute sm:inset-e-2 sm:top-2 sm:mt-0">
						<Button size="sm" onClick={() => setIsReviewOpen(true)}>
							<Trans>Review updates</Trans>
						</Button>
					</AlertAction>
				</Alert>
			</div>

			<Dialog open={isReviewOpen} onOpenChange={setIsReviewOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle className="flex items-center gap-x-2">
							<GitBranchIcon />
							<Trans>Review parent updates</Trans>
						</DialogTitle>
						<DialogDescription>
							<Trans>
								Merge parent changes into this child resume, or dismiss them to keep this child resume as-is.
							</Trans>
						</DialogDescription>
					</DialogHeader>

					<div className="space-y-4">
						<div className="rounded-lg border bg-muted/30 p-3">
							<div className="font-medium text-sm">{syncStatus.parent?.name}</div>
							<div className="mt-1 text-muted-foreground text-sm">
								<Trans>
									Last synced revision {syncStatus.lastSyncedParentRevision}; parent revision{" "}
									{syncStatus.parent?.revision}.
								</Trans>
							</div>
						</div>

						{syncStatus.hasConflicts && (
							<div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
								<div className="font-medium text-destructive text-sm">
									<Trans>Conflicting child edits</Trans>
								</div>
								<ul className="mt-2 max-h-32 space-y-1 overflow-auto text-sm">
									{syncStatus.conflicts.map((path) => (
										<li key={path} className="font-mono text-muted-foreground text-xs">
											{path}
										</li>
									))}
								</ul>
							</div>
						)}

						<div>
							<div className="font-medium text-sm">
								<Trans>Parent changes</Trans>
							</div>
							{syncStatus.operations.length > 0 ? (
								<ul className="mt-2 max-h-56 divide-y overflow-auto rounded-lg border text-sm">
									{syncStatus.operations.map((operation, index) => (
										<li key={`${operation.op}-${operation.path}-${index}`} className="flex items-center gap-x-2 p-2">
											<span className="rounded-md bg-secondary px-1.5 py-0.5 font-mono text-xs uppercase">
												{operation.op}
											</span>
											<span className="truncate font-mono text-muted-foreground text-xs">{operation.path}</span>
										</li>
									))}
								</ul>
							) : (
								<p className="mt-2 text-muted-foreground text-sm">
									<Trans>No content changes were detected, but the parent revision is newer.</Trans>
								</p>
							)}
						</div>
					</div>

					<DialogFooter>
						<DialogClose render={<Button variant="outline" disabled={isPending} />}>
							<Trans>Close</Trans>
						</DialogClose>
						<Button variant="destructive" disabled={isLocked || isPending} onClick={dismissUpdates}>
							<XCircleIcon />
							<Trans>Dismiss</Trans>
						</Button>
						<Button
							disabled={isLocked || isPending || (syncStatus.hasConflicts && syncStatus.operations.length === 0)}
							onClick={() => applyUpdates(syncStatus.hasConflicts)}
						>
							<ArrowsClockwiseIcon />
							{syncStatus.hasConflicts ? <Trans>Apply anyway</Trans> : <Trans>Apply updates</Trans>}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}

function BuilderHeaderDropdown() {
	const confirm = useConfirm();
	const navigate = useNavigate();
	const { openDialog } = useDialogStore();

	const resume = useCurrentResume();
	const patchResume = usePatchResume();
	const id = resume.id;
	const name = resume.name;
	const slug = resume.slug;
	const tags = resume.tags;
	const isLocked = resume.isLocked;

	const { mutate: deleteResume } = useMutation(orpc.resume.delete.mutationOptions());
	const { mutate: setLockedResume } = useMutation(orpc.resume.setLocked.mutationOptions());

	const handleUpdate = () => {
		openDialog("resume.update", { id, name, slug, tags });
	};

	const handleDuplicate = () => {
		openDialog("resume.duplicate", { id, name, slug, tags, shouldRedirect: true });
	};

	const handleDerive = () => {
		openDialog("resume.derive", { id, name, slug, tags, shouldRedirect: true });
	};

	const handleToggleLock = async () => {
		if (!isLocked) {
			const confirmation = await confirm(t`Are you sure you want to lock this resume?`, {
				description: t`When locked, the resume cannot be updated or deleted.`,
			});

			if (!confirmation) return;
		}

		setLockedResume(
			{ id, isLocked: !isLocked },
			{
				onSuccess: () => {
					patchResume((draft) => {
						draft.isLocked = !isLocked;
					});
				},
				onError: (error) => {
					toast.error(getResumeErrorMessage(error));
				},
			},
		);
	};

	const handleDelete = async () => {
		const confirmation = await confirm(t`Are you sure you want to delete this resume?`, {
			description: t`This action cannot be undone.`,
		});

		if (!confirmation) return;

		const toastId = toast.loading(t`Deleting your resume...`);

		deleteResume(
			{ id },
			{
				onSuccess: () => {
					toast.success(t`Your resume has been deleted successfully.`, { id: toastId });
					void navigate({ to: "/dashboard/resumes", search: { sort: "lastUpdatedAt", tags: [] } });
				},
				onError: (error) => {
					toast.error(getResumeErrorMessage(error), { id: toastId });
				},
			},
		);
	};

	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				render={
					<Button size="icon" variant="ghost">
						<CaretDownIcon />
					</Button>
				}
			/>

			<DropdownMenuContent>
				<DropdownMenuItem disabled={isLocked} onClick={handleUpdate}>
					<PencilSimpleLineIcon className="me-2" />
					<Trans>Update</Trans>
				</DropdownMenuItem>

				<DropdownMenuItem onClick={handleDuplicate}>
					<CopySimpleIcon className="me-2" />
					<Trans>Duplicate</Trans>
				</DropdownMenuItem>

				<DropdownMenuItem onClick={handleDerive}>
					<GitBranchIcon className="me-2" />
					<Trans>Create child resume</Trans>
				</DropdownMenuItem>

				<DropdownMenuItem onClick={handleToggleLock}>
					{isLocked ? <LockSimpleOpenIcon className="me-2" /> : <LockSimpleIcon className="me-2" />}
					{isLocked ? <Trans>Unlock</Trans> : <Trans>Lock</Trans>}
				</DropdownMenuItem>

				<DropdownMenuSeparator />

				<DropdownMenuItem variant="destructive" disabled={isLocked} onClick={handleDelete}>
					<TrashSimpleIcon className="me-2" />
					<Trans>Delete</Trans>
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
