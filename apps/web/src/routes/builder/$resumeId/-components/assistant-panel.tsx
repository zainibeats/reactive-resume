import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import {
	ArrowClockwiseIcon,
	CaretDownIcon,
	ChatCircleDotsIcon,
	GearSixIcon,
	TrashSimpleIcon,
} from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@reactive-resume/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuTrigger,
} from "@reactive-resume/ui/components/dropdown-menu";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@reactive-resume/ui/components/sheet";
import { useCurrentResume } from "@/features/resume/builder/draft";
import { useConfirm } from "@/hooks/use-confirm";
import { getOrpcErrorMessage } from "@/libs/error-message";
import { orpc } from "@/libs/orpc/client";
import { BuilderAssistantChat } from "./assistant-chat";

type BuilderAssistantPanelProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
};

export function BuilderAssistantPanel({ open, onOpenChange }: BuilderAssistantPanelProps) {
	const queryClient = useQueryClient();
	const confirm = useConfirm();
	const resume = useCurrentResume();
	const [threadId, setThreadId] = useState<string | null>(null);
	const [ignoredThreadIds, setIgnoredThreadIds] = useState<Set<string>>(() => new Set());
	const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null);
	const {
		data: providers,
		error: providersError,
		isLoading: isLoadingProviders,
	} = useQuery(orpc.aiProviders.list.queryOptions());
	const { data: threads, isLoading: isLoadingThreads } = useQuery(orpc.agent.threads.list.queryOptions());
	const createThreadMutation = useMutation(orpc.agent.threads.create.mutationOptions());
	const deleteThreadMutation = useMutation(orpc.agent.threads.delete.mutationOptions());

	const usableProviders = useMemo(
		() => providers?.filter((provider) => provider.enabled && provider.testStatus === "success") ?? [],
		[providers],
	);
	const usableProviderIds = useMemo(() => new Set(usableProviders.map((provider) => provider.id)), [usableProviders]);
	const selectedProvider = usableProviders.find((provider) => provider.id === selectedProviderId) ?? usableProviders[0];
	const hasUsableProvider = usableProviders.length > 0;
	const directThread = useMemo(() => {
		if (!providers) return undefined;

		return threads?.find(
			(thread) =>
				thread.workingResumeId === resume.id &&
				thread.sourceResumeId === null &&
				thread.status !== "archived" &&
				thread.deletedAt === null &&
				!ignoredThreadIds.has(thread.id) &&
				(!thread.aiProviderId || usableProviderIds.has(thread.aiProviderId)),
		);
	}, [ignoredThreadIds, providers, resume.id, threads, usableProviderIds]);
	const activeThreadId = threadId ?? directThread?.id ?? null;
	const { data: threadDetail } = useQuery(
		orpc.agent.threads.get.queryOptions({
			input: { id: activeThreadId ?? "" },
			enabled: Boolean(activeThreadId),
		}),
	);

	useEffect(() => {
		if (selectedProviderId && usableProviderIds.has(selectedProviderId)) return;
		setSelectedProviderId(usableProviders[0]?.id ?? null);
	}, [selectedProviderId, usableProviderIds, usableProviders]);

	useEffect(() => {
		if (!directThread || threadId) return;
		setThreadId(directThread.id);
	}, [directThread, threadId]);

	const createThread = () => {
		if (!selectedProvider) {
			toast.error(t`Select a tested AI provider first.`);
			return;
		}

		createThreadMutation.mutate(
			{ targetResumeId: resume.id, aiProviderId: selectedProvider.id },
			{
				onSuccess: async (thread) => {
					setThreadId(thread.id);
					setIgnoredThreadIds((previous) => {
						const next = new Set(previous);
						next.delete(thread.id);
						return next;
					});
					await queryClient.invalidateQueries({ queryKey: orpc.agent.threads.list.queryKey() });
				},
				onError: (error) => {
					toast.error(getOrpcErrorMessage(error, { fallback: t`Failed to start assistant thread.` }));
				},
			},
		);
	};

	const clearThread = async () => {
		if (!activeThreadId || deleteThreadMutation.isPending) return;

		const confirmed = await confirm(t`Clear this assistant chat?`, {
			description: t`This removes the current messages for this resume. You can start a new chat afterward.`,
			confirmText: t`Clear chat`,
		});
		if (!confirmed) return;

		deleteThreadMutation.mutate(
			{ id: activeThreadId },
			{
				onSuccess: async () => {
					setIgnoredThreadIds((previous) => new Set(previous).add(activeThreadId));
					setThreadId(null);
					await Promise.all([
						queryClient.invalidateQueries({ queryKey: orpc.agent.threads.list.queryKey() }),
						queryClient.invalidateQueries({
							queryKey: orpc.agent.threads.get.queryKey({ input: { id: activeThreadId } }),
						}),
					]);
				},
				onError: (error) => {
					toast.error(getOrpcErrorMessage(error, { fallback: t`Failed to clear assistant chat.` }));
				},
			},
		);
	};

	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent side="right" className="w-[min(92vw,30rem)] gap-0 p-0 sm:max-w-none">
				<SheetHeader className="border-b pe-14">
					<SheetTitle>
						<Trans>Assistant</Trans>
					</SheetTitle>
					<SheetDescription>
						<Trans>Edits are applied to this resume and can be undone from the builder dock.</Trans>
					</SheetDescription>
				</SheetHeader>

				{providersError ? (
					<div className="m-4 rounded-md border border-amber-300 bg-amber-50 p-3 text-amber-950 text-sm dark:bg-amber-950/20 dark:text-amber-200">
						<Trans>Assistant setup is unavailable until AI providers are configured.</Trans>
					</div>
				) : null}

				{!isLoadingProviders && !hasUsableProvider ? (
					<div className="grid flex-1 place-items-center p-6 text-center">
						<div className="max-w-sm space-y-4">
							<ChatCircleDotsIcon className="mx-auto size-8 text-muted-foreground" />
							<div className="space-y-1">
								<h3 className="font-medium">
									<Trans>No tested provider</Trans>
								</h3>
								<p className="text-muted-foreground text-sm">
									<Trans>Add and test a provider before using the builder assistant.</Trans>
								</p>
							</div>
							<Button nativeButton={false} render={<Link to="/dashboard/settings/integrations" />}>
								<GearSixIcon />
								<Trans>Settings</Trans>
							</Button>
						</div>
					</div>
				) : activeThreadId && threadDetail ? (
					<>
						<div className="flex items-center justify-between gap-2 border-b px-3 py-2">
							<div className="min-w-0">
								<div className="truncate font-medium text-sm">
									{threadDetail.thread.providerLabel ?? t`Unknown provider`}
								</div>
								<div className="text-muted-foreground text-xs">
									<Trans>Active provider</Trans>
								</div>
							</div>
							<Button
								type="button"
								variant="outline"
								size="sm"
								disabled={deleteThreadMutation.isPending}
								onClick={clearThread}
							>
								<TrashSimpleIcon />
								<Trans>Clear</Trans>
							</Button>
						</div>
						<BuilderAssistantChat
							threadId={activeThreadId}
							initialMessages={threadDetail.messages}
							activeRunId={threadDetail.thread.activeRunId}
						/>
					</>
				) : (
					<div className="grid flex-1 place-items-center p-6 text-center">
						<div className="max-w-sm space-y-4">
							<ChatCircleDotsIcon className="mx-auto size-8 text-muted-foreground" />
							<div className="space-y-1">
								<h3 className="font-medium">
									<Trans>Work on this resume</Trans>
								</h3>
								<p className="text-muted-foreground text-sm">
									<Trans>Start a builder assistant thread that edits the active resume directly.</Trans>
								</p>
							</div>
							{usableProviders.length > 0 ? (
								<DropdownMenu>
									<DropdownMenuTrigger
										render={
											<Button variant="outline" className="w-full justify-between">
												<span className="truncate">{selectedProvider?.label}</span>
												<CaretDownIcon />
											</Button>
										}
									/>
									<DropdownMenuContent align="center" className="w-64">
										<DropdownMenuRadioGroup
											value={selectedProvider?.id}
											onValueChange={(value) => setSelectedProviderId(value)}
										>
											{usableProviders.map((provider) => (
												<DropdownMenuRadioItem key={provider.id} value={provider.id}>
													<span className="truncate">{provider.label}</span>
												</DropdownMenuRadioItem>
											))}
										</DropdownMenuRadioGroup>
									</DropdownMenuContent>
								</DropdownMenu>
							) : null}
							<Button
								disabled={isLoadingProviders || isLoadingThreads || createThreadMutation.isPending || !selectedProvider}
								onClick={createThread}
							>
								{createThreadMutation.isPending ? (
									<ArrowClockwiseIcon className="animate-spin" />
								) : (
									<ChatCircleDotsIcon />
								)}
								<Trans>Start assistant</Trans>
							</Button>
						</div>
					</div>
				)}
			</SheetContent>
		</Sheet>
	);
}
