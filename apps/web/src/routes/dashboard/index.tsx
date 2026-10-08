import type { DocumentsSearch } from "@/features/documents/documents-page";
import { createFileRoute, stripSearchParams } from "@tanstack/react-router";
import { useEffect } from "react";
import z from "zod";
import { useDialogStore } from "@/dialogs/store";
import { DocumentsPage } from "@/features/documents/documents-page";
import { takeResumeStartIntent } from "@/features/resume/start-intent";

const defaults = { q: "", tags: [], sort: "edited" } satisfies DocumentsSearch;

export const Route = createFileRoute("/dashboard/")({
	validateSearch: z.object({
		q: z.string().default("").catch(""),
		tags: z.array(z.string()).default([]).catch([]),
		sort: z.enum(["edited", "name", "created"]).default("edited").catch("edited"),
		// Without one, the page uses the last view picked on this device.
		view: z.enum(["grid", "list"]).optional().catch(undefined),
	}),
	search: { middlewares: [stripSearchParams(defaults)] },
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
