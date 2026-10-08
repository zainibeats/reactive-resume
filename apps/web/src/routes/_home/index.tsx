import { ORPCError } from "@orpc/client";
import { createFileRoute, lazyRouteComponent, redirect } from "@tanstack/react-router";
import { getResumeSocialMeta } from "@reactive-resume/resume/social-meta";
import { Hero } from "./-sections/hero";
import { NotFoundScreen } from "@/components/layout/not-found-screen";
import { orpc } from "@/libs/orpc/client";
import { createNoindexFollowMeta } from "@/libs/seo";

const PublicResumePage = lazyRouteComponent(() => import("@/features/resume/public/public-resume"), "PublicResumePage");

export const Route = createFileRoute("/_home/")({
	component: RouteComponent,
	beforeLoad: ({ context }) => {
		if (context.session) {
			throw redirect({ to: "/dashboard", replace: true });
		}
	},
	loader: async ({ context }) => ({
		root: await context.queryClient.fetchQuery(orpc.resume.getRoot.queryOptions({ staleTime: 0 })),
	}),
	onError: (error) => {
		if (error instanceof ORPCError && error.code === "NEED_PASSWORD") {
			const { username, slug } = error.data as { username: string; slug: string };
			throw redirect({ to: "/auth/resume-password", search: { redirect: `/${username}/${slug}`, returnTo: "/" } });
		}
	},
	head: ({ loaderData }) => {
		const root = loaderData?.root;
		if (root && root.status !== "disabled") {
			if (root.status === "unavailable") {
				return { meta: [{ title: "Reactive Resume" }, createNoindexFollowMeta()] };
			}
			const social = getResumeSocialMeta(root.resume.data, root.resume.name || "Resume");
			return {
				meta: [
					{ title: `${social.name} - Reactive Resume` },
					{ name: "description", content: social.description },
					createNoindexFollowMeta(),
				],
			};
		}
		return {};
	},
});

function RouteComponent() {
	const { flags } = Route.useRouteContext();
	const { root } = Route.useLoaderData();

	if (root.status === "unavailable")
		return (
			<main id="main-content">
				<NotFoundScreen />
			</main>
		);

	if (root.status === "public") {
		return <PublicResumePage resume={root.resume} username={root.username} slug={root.slug} flags={flags} isRoot />;
	}

	return (
		<main id="main-content">
			<Hero />
		</main>
	);
}
