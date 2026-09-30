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

export const getRouter = async () => {
	const queryClient = getQueryClient();

	const { theme, locale, session, flags } = await loadRootContext();

	const router = createRouter({
		routeTree,
		scrollRestoration: true,
		defaultStructuralSharing: true,
		defaultErrorComponent: ErrorScreenWithI18n,
		defaultPendingComponent: LoadingScreenWithI18n,
		defaultNotFoundComponent: NotFoundScreenWithI18n,
		context: { orpc, queryClient, theme, locale, session, flags },
	});

	return router;
};
