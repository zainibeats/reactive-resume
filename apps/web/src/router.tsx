import type { ErrorComponentProps } from "@tanstack/react-router";
import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import { createRouter } from "@tanstack/react-router";
import { ErrorScreen } from "./components/layout/error-screen";
import { LoadingScreen } from "./components/layout/loading-screen";
import { NotFoundScreen } from "./components/layout/not-found-screen";
import { orpc } from "./libs/orpc/client";
import { getQueryClient } from "./libs/query/client";
import { loadRootContext } from "./libs/root-context";
import { routeTree } from "./routeTree.gen";

const ErrorScreenWithI18n = (props: ErrorComponentProps) => (
	<I18nProvider i18n={i18n}>
		<ErrorScreen {...props} />
	</I18nProvider>
);

const LoadingScreenWithI18n: typeof LoadingScreen = () => (
	<I18nProvider i18n={i18n}>
		<LoadingScreen />
	</I18nProvider>
);

const NotFoundScreenWithI18n = () => (
	<I18nProvider i18n={i18n}>
		<NotFoundScreen />
	</I18nProvider>
);

// A pathname change fades the page (styles in index.css). Search-param and hash changes (filters, views, editor
// modes), the first load, and browsers without view-transition types swap instantly.
const supportsTransitionTypes = globalThis.CSS?.supports?.("selector(:active-view-transition-type(a))") === true;

export const getRouter = async () => {
	const queryClient = getQueryClient();

	const { theme, locale, session, flags } = await loadRootContext(queryClient);

	const router = createRouter({
		routeTree,
		scrollRestoration: true,
		defaultStructuralSharing: true,
		defaultViewTransition: supportsTransitionTypes && {
			types: ({ fromLocation, pathChanged }) => (fromLocation && pathChanged ? ["page"] : false),
		},
		// Hovering a link starts its loaders; TanStack Query decides freshness, not the router's preload cache.
		defaultPreload: "intent",
		defaultPreloadStaleTime: 0,
		// Past 300ms a navigation shows the loader, held long enough (300ms) for its 200ms fade-in to land.
		defaultPendingMs: 300,
		defaultPendingMinMs: 300,
		defaultErrorComponent: ErrorScreenWithI18n,
		defaultPendingComponent: LoadingScreenWithI18n,
		defaultNotFoundComponent: NotFoundScreenWithI18n,
		context: { orpc, queryClient, theme, locale, session, flags },
	});

	return router;
};
