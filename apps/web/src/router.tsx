import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import { createRouter } from "@tanstack/react-router";
import { ErrorScreen } from "./components/layout/error-screen";
import { LoadingScreen } from "./components/layout/loading-screen";
import { NotFoundScreen } from "./components/layout/not-found-screen";
import { getSession } from "./libs/auth/session";
import { getLocale, loadLocale } from "./libs/locale";
import { client, orpc } from "./libs/orpc/client";
import { getQueryClient } from "./libs/query/client";
import { getTheme } from "./libs/theme";
import { routeTree } from "./routeTree.gen";

const ErrorScreenWithI18n: typeof ErrorScreen = (props) => (
	<I18nProvider i18n={i18n}>
		<ErrorScreen {...props} />
	</I18nProvider>
);

const LoadingScreenWithI18n: typeof LoadingScreen = () => (
	<I18nProvider i18n={i18n}>
		<LoadingScreen />
	</I18nProvider>
);

const NotFoundScreenWithI18n: typeof NotFoundScreen = (props) => (
	<I18nProvider i18n={i18n}>
		<NotFoundScreen {...props} />
	</I18nProvider>
);

export const getRouter = async () => {
	const queryClient = getQueryClient();

	const [theme, locale, session, flags] = await Promise.all([
		getTheme(),
		getLocale(),
		getSession(),
		client.flags.get(),
	]);

	await loadLocale(locale);

	const router = createRouter({
		routeTree,
		scrollRestoration: true,
		defaultViewTransition: true,
		defaultStructuralSharing: true,
		defaultErrorComponent: ErrorScreenWithI18n,
		defaultPendingComponent: LoadingScreenWithI18n,
		defaultNotFoundComponent: NotFoundScreenWithI18n,
		context: { orpc, queryClient, theme, locale, session, flags },
	});

	return router;
};
