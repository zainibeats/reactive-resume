import type { DocumentSummary } from "./filter";
import type { IconName } from "@reactive-resume/ui/components/icon";
import { plural, t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@reactive-resume/ui/components/button";
import { ContextMenuContent, ContextMenuItem, ContextMenuSeparator } from "@reactive-resume/ui/components/context-menu";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@reactive-resume/ui/components/dialog";
import {
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
} from "@reactive-resume/ui/components/dropdown-menu";
import { Icon } from "@reactive-resume/ui/components/icon";
import { toast } from "@reactive-resume/ui/components/toast";
import { useNewDocumentsStore } from "./new-documents";
import { ChipInput } from "@/components/input/chip-input";
import { useDialogStore } from "@/dialogs/store";
import { useClosingValue } from "@/hooks/use-closing-value";
import { useConfirm } from "@/hooks/use-confirm";
import { getOrpcErrorMessage } from "@/libs/error-message";
import { orpc } from "@/libs/orpc/client";

type Ref = { type: DocumentSummary["type"]; id: string };
const ref = (document: DocumentSummary): Ref => ({ type: document.type, id: document.id });

const failed = (error: unknown) =>
	toast.add({
		type: "error",
		description: getOrpcErrorMessage(error, { fallback: t`Something went wrong. Try again.` }),
	});

/** Everything the card menu does, shared by grid cards, list rows and Trash. */
function useRefreshDocuments() {
	const queryClient = useQueryClient();
	return () =>
		Promise.all([
			queryClient.invalidateQueries({ queryKey: orpc.documents.key() }),
			queryClient.invalidateQueries({ queryKey: orpc.resume.list.key() }),
		]);
}

export function useDocumentActions() {
	const confirm = useConfirm();
	const openDialog = useDialogStore((state) => state.openDialog);
	const markNew = useNewDocumentsStore((state) => state.markNew);
	const refresh = useRefreshDocuments();

	const rename = useMutation(orpc.documents.rename.mutationOptions({ onSettled: refresh, onError: failed }));
	const setLocked = useMutation(orpc.documents.setLocked.mutationOptions({ onSettled: refresh, onError: failed }));
	const trash = useMutation(orpc.documents.trash.mutationOptions({ onSettled: refresh }));
	const restore = useMutation(orpc.documents.restore.mutationOptions({ onSettled: refresh }));
	const purge = useMutation(orpc.documents.purge.mutationOptions({ onSettled: refresh }));
	const duplicate = useMutation(orpc.resume.duplicate.mutationOptions({ onSettled: refresh }));

	return {
		rename: (document: DocumentSummary, name: string) => {
			const trimmed = name.trim();
			if (!trimmed || trimmed === document.name) return;
			rename.mutate({ ...ref(document), name: trimmed });
		},

		duplicate: async (document: DocumentSummary) => {
			try {
				markNew(
					await duplicate.mutateAsync({ id: document.id, name: t`${document.name} (copy)`, tags: document.tags }),
				);
				toast.add({ description: t`Duplicated` });
			} catch (error) {
				failed(error);
			}
		},

		/** A linked child keeps reviewing its parent's later changes, unlike a duplicate. */
		createChild: (document: DocumentSummary) =>
			openDialog("resume.derive", { id: document.id, name: document.name, tags: document.tags }),

		setLocked: (document: DocumentSummary, isLocked: boolean) => setLocked.mutate({ ...ref(document), isLocked }),

		/** Undoable, so it doesn't ask first. */
		trash: async (document: DocumentSummary) => {
			try {
				await trash.mutateAsync(ref(document));
				toast.add({
					description: t`“${document.name}” moved to Trash`,
					actionProps: {
						children: t`Undo`,
						onClick: () => restore.mutate(ref(document), { onError: failed }),
					},
				});
			} catch (error) {
				failed(error);
			}
		},

		restore: async (document: DocumentSummary) => {
			try {
				await restore.mutateAsync(ref(document));
				toast.add({ description: t`Restored “${document.name}”` });
			} catch (error) {
				failed(error);
			}
		},

		/** The only permanent action here; it asks once. */
		purge: async (document: DocumentSummary) => {
			const confirmed = await confirm(t`Delete “${document.name}” now?`, {
				description: t`It will be deleted for good and can't be restored.`,
				confirmText: t`Delete now`,
				cancelText: t`Keep in Trash`,
			});
			if (!confirmed) return;
			try {
				await purge.mutateAsync(ref(document));
				toast.add({ description: t`Deleted “${document.name}”` });
			} catch (error) {
				failed(error);
			}
		},
	};
}

/**
 * The selection bar's actions: each runs on every selected document it applies to, refreshes the library once and
 * says how many changed. Locked documents keep their tags and place.
 */
export function useBatchActions() {
	const refresh = useRefreshDocuments();
	const setLocked = useMutation(orpc.documents.setLocked.mutationOptions());
	const trash = useMutation(orpc.documents.trash.mutationOptions());
	const restore = useMutation(orpc.documents.restore.mutationOptions());

	const run = async (
		documents: readonly DocumentSummary[],
		applies: (document: DocumentSummary) => boolean,
		task: (document: DocumentSummary) => Promise<unknown>,
	) => {
		const targets = documents.filter(applies);
		const results = await Promise.allSettled(targets.map(task));
		await refresh();
		return targets.filter((_, index) => results[index]?.status === "fulfilled");
	};

	const report = (done: number, total: number) =>
		toast.add({
			type: done === 0 ? "error" : undefined,
			description:
				done === total
					? plural(done, { one: "# document updated", other: "# documents updated" })
					: t`Updated ${done} of ${total}. Locked documents were skipped.`,
		});

	return {
		setLocked: async (documents: readonly DocumentSummary[], isLocked: boolean) => {
			const done = await run(
				documents,
				(document) => document.isLocked !== isLocked,
				(document) => setLocked.mutateAsync({ type: document.type, id: document.id, isLocked }),
			);
			report(done.length + documents.filter((document) => document.isLocked === isLocked).length, documents.length);
		},

		/** Undoable, so it doesn't ask first. */
		trash: async (documents: readonly DocumentSummary[]) => {
			const done = await run(
				documents,
				(document) => !document.isLocked,
				(document) => trash.mutateAsync({ type: document.type, id: document.id }),
			);
			if (done.length === 0) return report(0, documents.length);
			toast.add({
				description:
					done.length === documents.length
						? plural(done.length, { one: "# document moved to Trash", other: "# documents moved to Trash" })
						: t`Moved ${done.length} of ${documents.length} to Trash. Locked documents were skipped.`,
				actionProps: {
					children: t`Undo`,
					onClick: () =>
						void run(
							done,
							() => true,
							(document) => restore.mutateAsync({ type: document.type, id: document.id }),
						),
				},
			});
		},
	};
}

type MenuEntry = { icon: IconName; label: string; onSelect: () => void; disabled?: boolean; danger?: boolean };

type DocumentMenuProps = {
	document: DocumentSummary;
	onOpen: () => void;
	onRename: () => void;
	onTags: () => void;
	/** Starts a selection with this document; absent in the list, which always shows its checkboxes, and in Trash. */
	onSelect?: (() => void) | undefined;
	/** The same items as a context menu (right-click and long-press) instead of the ⋯ menu. */
	variant?: "dropdown" | "context";
};

/** Open, Select, Rename, Duplicate, Create child, Tags, Lock, then Move to Trash. */
export function DocumentMenuContent({
	document,
	onOpen,
	onRename,
	onTags,
	onSelect,
	variant = "dropdown",
}: DocumentMenuProps) {
	const actions = useDocumentActions();

	const trashEntries: MenuEntry[] = [
		{ icon: "restore_from_trash", label: t`Restore`, onSelect: () => void actions.restore(document) },
		{ icon: "delete_forever", label: t`Delete now…`, onSelect: () => void actions.purge(document), danger: true },
	];
	const liveEntries: MenuEntry[] = [
		{ icon: "open_in_new", label: t`Open`, onSelect: onOpen },
		...(onSelect ? [{ icon: "check_box", label: t`Select`, onSelect } satisfies MenuEntry] : []),
		{ icon: "edit", label: t`Rename`, onSelect: onRename, disabled: document.isLocked },
		{ icon: "content_copy", label: t`Duplicate`, onSelect: () => void actions.duplicate(document) },
		{ icon: "hub", label: t`Create child resume…`, onSelect: () => actions.createChild(document) },
		{ icon: "sell", label: t`Tags…`, onSelect: onTags, disabled: document.isLocked },
		document.isLocked
			? { icon: "lock_open", label: t`Unlock`, onSelect: () => actions.setLocked(document, false) }
			: { icon: "lock", label: t`Lock editing`, onSelect: () => actions.setLocked(document, true) },
		{
			icon: "delete",
			label: t`Move to Trash`,
			onSelect: () => void actions.trash(document),
			danger: true,
			disabled: document.isLocked,
		},
	];
	const entries = document.trashedAt ? trashEntries : liveEntries;

	const Content = variant === "context" ? ContextMenuContent : DropdownMenuContent;
	const Item = variant === "context" ? ContextMenuItem : DropdownMenuItem;
	const Separator = variant === "context" ? ContextMenuSeparator : DropdownMenuSeparator;

	return (
		<Content align="end" className="w-60">
			{entries.map((entry) => (
				<div key={entry.label} className="contents">
					{entry.danger && <Separator />}
					<Item
						variant={entry.danger ? "destructive" : "default"}
						disabled={entry.disabled}
						onClick={entry.onSelect}
						title={entry.disabled ? t`Unlock it first` : undefined}
					>
						<Icon name={entry.icon} />
						{entry.label}
					</Item>
				</div>
			))}
		</Content>
	);
}

type TagsDialogProps = { documents: DocumentSummary[] | null; onClose: () => void };

/** The tags every one of these documents has. */
const sharedTags = (documents: readonly DocumentSummary[]) =>
	documents[0]?.tags.filter((tag) => documents.every((document) => document.tags.includes(tag))) ?? [];

/**
 * Tags… for one document from its menu, or for a selection: a tag added goes on each document and a tag removed
 * comes off each, leaving their other tags alone. Locked documents keep theirs.
 */
export function TagsDialog({ documents: requested, onClose }: TagsDialogProps) {
	const refresh = useRefreshDocuments();
	// Closing keeps the documents' tags on screen until the dialog has faded out.
	const [documents, onDocumentsOpenChangeComplete] = useClosingValue(requested);
	const [tags, setTags] = useState<string[] | null>(null);
	const setDocumentTags = useMutation(orpc.documents.setTags.mutationOptions());
	const shared = documents ? sharedTags(documents) : [];

	const save = async () => {
		if (!documents) return;
		const next = tags ?? shared;
		const removed = shared.filter((tag) => !next.includes(tag));
		const added = next.filter((tag) => !shared.includes(tag));
		const results = await Promise.allSettled(
			documents
				.filter((document) => !document.isLocked)
				.map((document) =>
					setDocumentTags.mutateAsync({
						type: document.type,
						id: document.id,
						tags: [
							...document.tags.filter((tag) => !removed.includes(tag)),
							...added.filter((tag) => !document.tags.includes(tag)),
						],
					}),
				),
		);
		await refresh();
		const failure = results.find((result) => result.status === "rejected");
		if (failure) failed(failure.reason);
		else onClose();
	};

	return (
		<Dialog
			open={requested !== null}
			onOpenChange={(open) => !open && onClose()}
			onOpenChangeComplete={(open) => {
				onDocumentsOpenChangeComplete(open);
				// Unsaved edits are dropped once the dialog has closed, so the chips don't change while it fades.
				if (!open) setTags(null);
			}}
		>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>
						{documents && documents.length > 1 ? (
							<Trans>Tags for {documents.length} documents</Trans>
						) : (
							<Trans>Tags</Trans>
						)}
					</DialogTitle>
					<DialogDescription>
						{documents && documents.length > 1 ? (
							<Trans>
								Shows the tags they all share. Tags you add go on every document; tags you remove come off every one.
								Locked documents are left as they are.
							</Trans>
						) : (
							<Trans>Tags group documents in the library; pick one above the grid to filter by it.</Trans>
						)}
					</DialogDescription>
				</DialogHeader>
				<ChipInput value={tags ?? shared} onChange={setTags} />
				<DialogFooter>
					<Button onClick={() => void save()} disabled={setDocumentTags.isPending}>
						<Trans>Save</Trans>
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
