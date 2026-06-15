import type { RouterOutput } from "@/libs/orpc/client";
import { Link } from "@tanstack/react-router";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@reactive-resume/ui/components/dropdown-menu";
import { useResumeMenuActions } from "./use-resume-menu-actions";

type Props = Omit<React.ComponentProps<typeof DropdownMenuContent>, "children"> & {
	resume: RouterOutput["resume"]["list"][number];
	children: React.ComponentProps<typeof DropdownMenuTrigger>["render"];
};

export function ResumeDropdownMenu({ resume, children, ...props }: Props) {
	const { openAction, mainActions, deleteAction } = useResumeMenuActions(resume);

	return (
		<DropdownMenu>
			<DropdownMenuTrigger render={children} />

			<DropdownMenuContent {...props}>
				<Link to="/builder/$resumeId" params={{ resumeId: resume.id }}>
					<DropdownMenuItem>
						{openAction.icon}
						{openAction.label}
					</DropdownMenuItem>
				</Link>

				<DropdownMenuSeparator />

				{mainActions.map((action) => (
					<DropdownMenuItem key={action.id} disabled={action.disabled} onClick={action.onClick}>
						{action.icon}
						{action.label}
					</DropdownMenuItem>
				))}

				<DropdownMenuSeparator />

				<DropdownMenuItem
					variant={deleteAction.variant}
					disabled={deleteAction.disabled}
					onClick={deleteAction.onClick}
				>
					{deleteAction.icon}
					{deleteAction.label}
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
