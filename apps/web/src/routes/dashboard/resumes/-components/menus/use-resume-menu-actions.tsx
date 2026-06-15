import type { ReactNode } from "react";
import type { RouterOutput } from "@/libs/orpc/client";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import {
	CopySimpleIcon,
	FolderOpenIcon,
	GitBranchIcon,
	LockSimpleIcon,
	LockSimpleOpenIcon,
	PencilSimpleLineIcon,
	TrashSimpleIcon,
} from "@phosphor-icons/react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { useDialogStore } from "@/dialogs/store";
import { useConfirm } from "@/hooks/use-confirm";
import { getResumeErrorMessage } from "@/libs/error-message";
import { orpc } from "@/libs/orpc/client";

type Resume = RouterOutput["resume"]["list"][number];

type ResumeMenuAction = {
	id: "open" | "update" | "duplicate" | "derive" | "toggle-lock" | "delete";
	icon: ReactNode;
	label: ReactNode;
	disabled?: boolean;
	variant?: "destructive";
	onClick?: () => void | Promise<void>;
};

export function useResumeMenuActions(resume: Resume) {
	const confirm = useConfirm();
	const { openDialog } = useDialogStore();

	const { mutate: deleteResume } = useMutation(orpc.resume.delete.mutationOptions());
	const { mutate: setLockedResume } = useMutation(orpc.resume.setLocked.mutationOptions());

	const handleToggleLock = async () => {
		if (!resume.isLocked) {
			const confirmation = await confirm(t`Are you sure you want to lock this resume?`, {
				description: t`When locked, the resume cannot be updated or deleted.`,
			});

			if (!confirmation) return;
		}

		setLockedResume(
			{ id: resume.id, isLocked: !resume.isLocked },
			{
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
			{ id: resume.id },
			{
				onSuccess: () => {
					toast.success(t`Your resume has been deleted successfully.`, { id: toastId });
				},
				onError: (error) => {
					toast.error(getResumeErrorMessage(error), { id: toastId });
				},
			},
		);
	};

	const openAction = {
		id: "open",
		icon: <FolderOpenIcon />,
		label: <Trans comment="Resume card menu action to open the resume editor">Open</Trans>,
	} satisfies ResumeMenuAction;

	const mainActions = [
		{
			id: "update",
			icon: <PencilSimpleLineIcon />,
			label: <Trans comment="Resume card menu action to edit resume metadata">Update</Trans>,
			disabled: resume.isLocked,
			onClick: () => {
				openDialog("resume.update", resume);
			},
		},
		{
			id: "duplicate",
			icon: <CopySimpleIcon />,
			label: <Trans comment="Resume card menu action to create a copy">Duplicate</Trans>,
			onClick: () => {
				openDialog("resume.duplicate", resume);
			},
		},
		{
			id: "derive",
			icon: <GitBranchIcon />,
			label: <Trans comment="Resume card menu action to create a linked child resume">Create child resume</Trans>,
			onClick: () => {
				openDialog("resume.derive", resume);
			},
		},
		{
			id: "toggle-lock",
			icon: resume.isLocked ? <LockSimpleOpenIcon /> : <LockSimpleIcon />,
			label: resume.isLocked ? (
				<Trans comment="Resume card menu action to remove edit lock">Unlock</Trans>
			) : (
				<Trans comment="Resume card menu action to prevent edits">Lock</Trans>
			),
			onClick: handleToggleLock,
		},
	] satisfies ResumeMenuAction[];

	const deleteAction = {
		id: "delete",
		icon: <TrashSimpleIcon />,
		label: <Trans comment="Resume card menu destructive action to remove a resume">Delete</Trans>,
		disabled: resume.isLocked,
		variant: "destructive",
		onClick: handleDelete,
	} satisfies ResumeMenuAction;

	return {
		openAction,
		mainActions,
		deleteAction,
	};
}
