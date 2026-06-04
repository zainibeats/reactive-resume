import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { ArrowClockwiseIcon, ChatCircleDotsIcon, GearSixIcon } from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@reactive-resume/ui/components/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@reactive-resume/ui/components/sheet";
import { useCurrentResume } from "@/features/resume/builder/draft";
import { getOrpcErrorMessage } from "@/libs/error-message";
import { orpc } from "@/libs/orpc/client";
import { BuilderAssistantChat } from "./assistant-chat";

type BuilderAssistantPanelProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
};

export function BuilderAssistantPanel({ open, onOpenChange }: BuilderAssistantPanelProps) {
	const queryClient = useQueryClient();
	const resume = useCurrentResume();
	const [threadId, setThreadId] = useState<string | null>(null);
	const {
		data: providers,
		error: providersError,
		isLoading: isLoadingProviders,
	} = useQuery(orpc.aiProviders.list.queryOptions());
	const { data: threads, isLoading: isLoadingThreads } = useQuery(orpc.agent.threads.list.queryOptions());
	const createThreadMutation = useMutation(orpc.agent.threads.create.mutationOptions());

	const hasUsableProvider = useMemo(
		() => providers?.some((provider) => provider.enabled && provider.testStatus === "success") ?? false,
		[providers],
	);
	const directThread = useMemo(
		() =>
			threads?.find(
				(thread) =>
					thread.workingResumeId === resume.id &&
					thread.sourceResumeId === null &&
					thread.status !== "archived" &&
					thread.deletedAt === null,
			),
		[resume.id, threads],
	);
	const activeThreadId = threadId ?? directThread?.id ?? null;
	const { data: threadDetail } = useQuery(
		orpc.agent.threads.get.queryOptions({
			input: { id: activeThreadId ?? "" },
			enabled: Boolean(activeThreadId),
		}),
	);

	useEffect(() => {
		if (!directThread || threadId) return;
		setThreadId(directThread.id);
	}, [directThread, threadId]);

	const createThread = () => {
		createThreadMutation.mutate(
			{ targetResumeId: resume.id },
			{
				onSuccess: async (thread) => {
					setThreadId(thread.id);
					await queryClient.invalidateQueries({ queryKey: orpc.agent.threads.list.queryKey() });
				},
				onError: (error) => {
					toast.error(getOrpcErrorMessage(error, { fallback: t`Failed to start assistant thread.` }));
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
					<BuilderAssistantChat
						threadId={activeThreadId}
						initialMessages={threadDetail.messages}
						activeRunId={threadDetail.thread.activeRunId}
					/>
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
							<Button disabled={isLoadingThreads || createThreadMutation.isPending} onClick={createThread}>
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
