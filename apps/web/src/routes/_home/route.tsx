import { Trans } from "@lingui/react/macro";
import { createFileRoute, Outlet, useMatch } from "@tanstack/react-router";
import { Header } from "./-sections/header";

export const Route = createFileRoute("/_home")({
	component: RouteComponent,
});

function RouteComponent() {
	const rootMatch = useMatch({ from: "/_home/", shouldThrow: false });
	const rootMode = rootMatch?.loaderData?.root.status;
	const showMarketingHeader = !rootMode || rootMode === "disabled";
	return (
		<>
			<a
				href="#main-content"
				className="sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:inset-s-4 focus-visible:top-4 focus-visible:z-100 focus-visible:rounded-md focus-visible:bg-bg focus-visible:px-4 focus-visible:py-2 focus-visible:text-ink focus-visible:shadow-lg focus-visible:ring-2 focus-visible:ring-accent"
			>
				<Trans>Skip to main content</Trans>
			</a>

			{showMarketingHeader && <Header />}
			<Outlet />
		</>
	);
}
