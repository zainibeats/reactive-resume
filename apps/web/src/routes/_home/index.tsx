import { createFileRoute, redirect } from "@tanstack/react-router";
import { createRootStructuredDataScript, getCanonicalRootUrl } from "@/libs/seo";
import { Hero } from "./-sections/hero";

export const Route = createFileRoute("/_home/")({
	component: RouteComponent,
	beforeLoad: ({ context }) => {
		if (context.session) {
			throw redirect({ to: "/dashboard/resumes", search: { sort: "lastUpdatedAt", tags: [] }, replace: true });
		}
	},
	head: () => {
		const appUrl = typeof window !== "undefined" ? window.location.origin : "https://rxresu.me";
		const canonicalUrl = getCanonicalRootUrl(appUrl);

		return {
			links: [{ rel: "canonical", href: canonicalUrl }],
			scripts: [createRootStructuredDataScript(canonicalUrl)],
		};
	},
});

function RouteComponent() {
	return (
		<main id="main-content">
			<Hero />
		</main>
	);
}
