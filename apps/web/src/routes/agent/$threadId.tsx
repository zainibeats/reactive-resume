import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/agent/$threadId")({
	beforeLoad: () => {
		throw redirect({ to: "/dashboard/resumes", replace: true });
	},
});
