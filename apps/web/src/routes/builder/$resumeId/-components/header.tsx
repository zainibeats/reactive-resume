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
} from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button } from "@reactive-resume/ui/components/button";
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
		<div className="absolute inset-x-0 top-0 z-50 flex h-14 items-center justify-between border-b bg-popover px-1.5">
			<Button size="icon" variant="ghost" onClick={() => toggleSidebar("left")}>
				<SidebarSimpleIcon />
				<span className="sr-only">
					<Trans comment="Screen-reader label for opening or closing the left sidebar in resume builder">
						Toggle left sidebar
					</Trans>
				</span>
			</Button>

			<div className="flex items-center gap-x-1">
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
				<h2 className="flex-1 truncate font-medium">{name}</h2>
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
	);
}

function BuilderHeaderDropdown() {
	const confirm = useConfirm();
	const navigate = useNavigate();
	const { openDialog } = useDialogStore();
	const queryClient = useQueryClient();

	const resume = useCurrentResume();
	const patchResume = usePatchResume();
	const id = resume.id;
	const name = resume.name;
	const slug = resume.slug;
	const tags = resume.tags;
	const isLocked = resume.isLocked;
	const parentId = resume.parentId;

	const { mutate: deleteResume } = useMutation(orpc.resume.delete.mutationOptions());
	const { mutate: setLockedResume } = useMutation(orpc.resume.setLocked.mutationOptions());
	const { mutate: applyParentUpdates, isPending: isApplyingParentUpdates } = useMutation(
		orpc.resume.applyParentUpdates.mutationOptions(),
	);
	const { data: syncStatus } = useQuery({
		...orpc.resume.getSyncStatus.queryOptions({ input: { id } }),
		enabled: Boolean(parentId),
	});

	const handleUpdate = () => {
		openDialog("resume.update", { id, name, slug, tags });
	};

	const handleDuplicate = () => {
		openDialog("resume.duplicate", { id, name, slug, tags, shouldRedirect: true });
	};

	const handleDerive = () => {
		openDialog("resume.derive", { id, name, slug, tags, shouldRedirect: true });
	};

	const handleApplyParentUpdates = () => {
		const toastId = toast.loading(t`Applying parent updates...`);

		applyParentUpdates(
			{ id },
			{
				onSuccess: (updated) => {
					patchResume((draft) => {
						Object.assign(draft, updated);
					});
					void queryClient.invalidateQueries({ queryKey: orpc.resume.getSyncStatus.queryKey({ input: { id } }) });
					toast.success(t`Parent updates have been applied.`, { id: toastId });
				},
				onError: (error) => {
					toast.error(getResumeErrorMessage(error), { id: toastId });
				},
			},
		);
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
					<Trans>Derive</Trans>
				</DropdownMenuItem>

				{syncStatus?.isBehind && (
					<DropdownMenuItem
						disabled={isLocked || syncStatus.hasConflicts || isApplyingParentUpdates}
						onClick={handleApplyParentUpdates}
					>
						<ArrowsClockwiseIcon className="me-2" />
						{syncStatus.hasConflicts ? <Trans>Parent updates need review</Trans> : <Trans>Apply parent updates</Trans>}
					</DropdownMenuItem>
				)}

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
