import type { RouterOutput } from "@/libs/orpc/client";
import { Link } from "@tanstack/react-router";
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuSeparator,
	ContextMenuTrigger,
} from "@reactive-resume/ui/components/context-menu";
import { useResumeMenuActions } from "./use-resume-menu-actions";

type Props = {
	resume: RouterOutput["resume"]["list"][number];
	children: React.ComponentProps<typeof ContextMenuTrigger>["render"];
};

export function ResumeContextMenu({ resume, children }: Props) {
	const { openAction, mainActions, deleteAction } = useResumeMenuActions(resume);

	return (
		<ContextMenu>
			<ContextMenuTrigger render={children} />

			<ContextMenuContent>
				<ContextMenuItem
					render={
						<Link to="/builder/$resumeId" params={{ resumeId: resume.id }}>
							{openAction.icon}
							{openAction.label}
						</Link>
					}
				/>

				<ContextMenuSeparator />

				{mainActions.map((action) => (
					<ContextMenuItem key={action.id} disabled={action.disabled} onClick={action.onClick}>
						{action.icon}
						{action.label}
					</ContextMenuItem>
				))}

				<ContextMenuSeparator />

				<ContextMenuItem variant={deleteAction.variant} disabled={deleteAction.disabled} onClick={deleteAction.onClick}>
					{deleteAction.icon}
					{deleteAction.label}
				</ContextMenuItem>
			</ContextMenuContent>
		</ContextMenu>
	);
}
