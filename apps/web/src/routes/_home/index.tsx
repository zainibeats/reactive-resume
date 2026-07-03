import { createFileRoute, redirect } from "@tanstack/react-router";
import { Hero } from "./-sections/hero";

export const Route = createFileRoute("/_home/")({
	component: RouteComponent,
	beforeLoad: ({ context }) => {
		if (context.session) {
			throw redirect({ to: "/dashboard/resumes", search: { sort: "lastUpdatedAt", tags: [] }, replace: true });
		}
	},
});

function RouteComponent() {
	return (
		<main id="main-content">
			<Hero />
		</main>
	);
}
