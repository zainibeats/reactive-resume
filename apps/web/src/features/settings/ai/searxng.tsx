import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { useMutation } from "@tanstack/react-query";
import { useId, useState } from "react";
import { Button } from "@reactive-resume/ui/components/button";
import { Icon } from "@reactive-resume/ui/components/icon";
import { Input } from "@reactive-resume/ui/components/input";
import { Label } from "@reactive-resume/ui/components/label";
import { cn } from "@reactive-resume/utils/style";
import { getOrpcErrorMessage } from "@/libs/error-message";
import { orpc } from "@/libs/orpc/client";

type SearxngRowProps = {
	/** Set by the server's `WEB_SEARCH_SEARXNG_URL`; read-only here. */
	managed: boolean;
	/** The user's own instance address, or null. */
	url: string | null;
	/** Called after the address is saved or removed. */
	onChange: () => void;
};

/** The user's own SearXNG instance, which takes over the assistant's web searches. */
export function SearxngRow({ managed, url, onChange }: SearxngRowProps) {
	const id = useId();
	const [editing, setEditing] = useState(false);
	const [draft, setDraft] = useState("");
	const done = () => {
		setEditing(false);
		setDraft("");
		onChange();
	};
	const save = useMutation(orpc.webAccess.saveSearxng.mutationOptions({ onSuccess: done }));
	const remove = useMutation(orpc.webAccess.deleteSearxng.mutationOptions({ onSuccess: done }));
	const pending = save.isPending || remove.isPending;
	const failure = save.error || remove.error;
	const active = managed || url !== null;

	return (
		<div className="mx-5 flex items-start gap-3 border-b border-line py-4 max-sm:mx-4">
			<Icon name="globe-simple" size={20} className="mt-0.5 shrink-0 text-ink-2" />
			<div className="grid flex-1 gap-2">
				<div className="flex flex-wrap items-center justify-between gap-2">
					<h3 className="text-sm font-medium">SearXNG</h3>
					<span
						className={cn(
							"rounded-sm px-2 py-0.5 text-xs font-medium",
							active ? "bg-accent-soft text-accent-text" : "bg-sunken text-ink-2",
						)}
					>
						{managed ? <Trans>Managed by server</Trans> : active ? <Trans>Active</Trans> : <Trans>Optional</Trans>}
					</span>
				</div>
				<p className="max-w-[58ch] text-[13px] leading-5 text-ink-3">
					<Trans>
						Sends the assistant's web searches to a SearXNG instance. The instance must allow the JSON format.
					</Trans>
				</p>

				{failure && (
					<p
						role="alert"
						className="flex items-start gap-2 rounded-lg bg-danger-soft px-3 py-2.5 text-[13px] leading-5 text-danger-text"
					>
						<Icon name="warning-circle" size={18} className="mt-0.5 shrink-0" />
						{getOrpcErrorMessage(failure, { fallback: t`Couldn't save the SearXNG address. Try again.` })}
					</p>
				)}

				{managed ? null : editing ? (
					<form
						className="grid gap-3 rounded-lg border border-line bg-bg p-4"
						onSubmit={(event) => {
							event.preventDefault();
							if (!pending && draft.trim()) save.mutate({ url: draft.trim() });
						}}
					>
						<div className="grid gap-2">
							<Label htmlFor={`${id}-url`}>
								<Trans>Instance address</Trans>
							</Label>
							<Input
								id={`${id}-url`}
								type="url"
								value={draft}
								placeholder="http://localhost:8080"
								maxLength={2_000}
								autoComplete="off"
								autoCapitalize="off"
								autoCorrect="off"
								spellCheck={false}
								required
								autoFocus
								disabled={pending}
								onChange={(event) => setDraft(event.target.value)}
							/>
						</div>
						<div className="ms-auto flex gap-1">
							<Button
								type="button"
								variant="ghost"
								disabled={pending}
								onClick={() => {
									setEditing(false);
									setDraft("");
									save.reset();
								}}
							>
								<Trans>Cancel</Trans>
							</Button>
							<Button type="submit" disabled={pending || !draft.trim()} loading={save.isPending}>
								<Trans>Save</Trans>
							</Button>
						</div>
					</form>
				) : url ? (
					<div className="flex flex-wrap items-center gap-2">
						<code className="min-w-0 flex-1 truncate rounded-md bg-sunken px-2 py-1 text-xs text-ink-2">{url}</code>
						<Button
							variant="ghost"
							size="sm"
							disabled={pending}
							onClick={() => {
								setDraft(url);
								setEditing(true);
							}}
						>
							<Trans>Change</Trans>
						</Button>
						<Button
							variant="ghost"
							size="sm"
							className="text-danger-text hover:bg-danger-soft"
							disabled={pending}
							loading={remove.isPending}
							onClick={() => remove.mutate({})}
						>
							<Trans>Remove</Trans>
						</Button>
					</div>
				) : (
					<Button variant="secondary" size="sm" className="w-fit" onClick={() => setEditing(true)}>
						<Icon name="link-simple-horizontal" size={16} />
						<Trans>Add SearXNG</Trans>
					</Button>
				)}
			</div>
		</div>
	);
}
