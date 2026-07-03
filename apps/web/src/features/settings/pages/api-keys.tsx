import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { KeyIcon, PlusIcon, TrashSimpleIcon } from "@phosphor-icons/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@reactive-resume/ui/components/button";
import { useDialogStore } from "@/dialogs/store";
import { useConfirm } from "@/hooks/use-confirm";
import { authClient } from "@/libs/auth/client";
import { getReadableErrorMessage } from "@/libs/error-message";

export function ApiKeysSettingsPage() {
	const confirm = useConfirm();
	const queryClient = useQueryClient();
	const openDialog = useDialogStore((state) => state.openDialog);

	const { data: apiKeys = [] } = useQuery({
		queryKey: ["auth", "api-keys"],
		queryFn: () => authClient.apiKey.list(),
		select: ({ data }) => {
			if (!data) return [];

			return data.apiKeys
				.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
				.filter((key) => !!key.expiresAt && key.expiresAt.getTime() > Date.now());
		},
	});

	const onDelete = async (id: string) => {
		const confirmation = await confirm(t`Are you sure you want to delete this API key?`, {
			description: t`The API key will no longer be able to access your data after deletion. This action cannot be undone.`,
			confirmText: t({
				comment: "API key deletion confirmation dialog confirm action in settings",
				message: "Delete",
			}),
			cancelText: t({
				comment: "API key deletion confirmation dialog cancel action in settings",
				message: "Cancel",
			}),
		});

		if (!confirmation) return;

		const toastId = toast.loading(t`Deleting your API key...`);

		const { error } = await authClient.apiKey.delete({ keyId: id });

		if (error) {
			toast.error(
				getReadableErrorMessage(
					error,
					t({
						comment: "Fallback toast when deleting an API key fails",
						message: "Failed to delete the API key. Please try again.",
					}),
				),
				{ id: toastId },
			);
			return;
		}

		toast.success(t`The API key has been deleted successfully.`, { id: toastId });
		void queryClient.invalidateQueries({ queryKey: ["auth", "api-keys"] });
	};

	return (
		<div className="grid max-w-xl gap-6">
			<Button variant="outline" className="h-auto w-full py-3" onClick={() => openDialog("api-key.create", undefined)}>
				<PlusIcon />
				<Trans>Create a new API key</Trans>
			</Button>

			{apiKeys.map((key) => (
				<div key={key.id} className="flex items-center gap-x-4 py-4">
					<KeyIcon />

					<div className="flex-1 space-y-1">
						<p className="font-mono text-xs">{key.start}...</p>
						<div className="text-muted-foreground text-xs">
							<Trans>Expires on {key.expiresAt?.toLocaleDateString()}</Trans>
						</div>
					</div>

					<Button size="icon" variant="ghost" onClick={() => onDelete(key.id)}>
						<TrashSimpleIcon />
					</Button>
				</div>
			))}
		</div>
	);
}
