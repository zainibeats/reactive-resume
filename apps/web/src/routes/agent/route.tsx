import { createFileRoute, redirect } from "@tanstack/react-router";
import { createNoindexFollowMeta } from "@/libs/seo";

export const Route = createFileRoute("/agent")({
	beforeLoad: async ({ context }) => {
		if (!context.session) throw redirect({ to: "/auth/login", replace: true });
		throw redirect({ to: "/dashboard/resumes", replace: true });
	},
	head: () => ({
		meta: [createNoindexFollowMeta()],
	}),
});
