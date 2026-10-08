import type { DocumentsSearch } from "@/features/documents/documents-page";
import { createFileRoute, redirect, stripSearchParams } from "@tanstack/react-router";
import { useEffect } from "react";
import z from "zod";
import { useDialogStore } from "@/dialogs/store";
import { DocumentsPage } from "@/features/documents/documents-page";
import { takeResumeStartIntent } from "@/features/resume/start-intent";

const defaults = { type: "all", q: "", tags: [], sort: "edited" } satisfies DocumentsSearch;

export const Route = createFileRoute("/dashboard/")({
	validateSearch: z.object({
		type: z.enum(["all", "resume", "letter"]).default("all").catch("all"),
		q: z.string().default("").catch(""),
		tags: z.array(z.string()).default([]).catch([]),
		sort: z.enum(["edited", "name", "created"]).default("edited").catch("edited"),
		// Without one, the page uses the last view picked on this device.
		view: z.enum(["grid", "list"]).optional().catch(undefined),
		// Older links opened letters here; they open in the letter editor now.
		letter: z.string().optional().catch(undefined),
	}),
	search: { middlewares: [stripSearchParams(defaults)] },
	beforeLoad: ({ search }) => {
		if (search.letter) {
			throw redirect({ to: "/builder/letter/$coverLetterId", params: { coverLetterId: search.letter }, replace: true });
		}
	},
	component: RouteComponent,
});

function RouteComponent() {
	const search = Route.useSearch();
	const navigate = Route.useNavigate();
	const openDialog = useDialogStore((state) => state.openDialog);

	// A create or import action picked on the first-visit screen survives sign-in: open New once it lands here.
	useEffect(() => {
		if (takeResumeStartIntent()) openDialog("document.new", undefined);
	}, [openDialog]);

	return (
		<DocumentsPage
			search={search}
			onSearchChange={(patch) =>
				void navigate({
					resetScroll: false,
					search: (previous: DocumentsSearch) => ({ ...previous, ...patch }),
					replace: true,
				})
			}
		/>
	);
}
