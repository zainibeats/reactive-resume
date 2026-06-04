import { createFileRoute, redirect } from "@tanstack/react-router";
import z from "zod";

const searchSchema = z.object({ resumeId: z.string().optional() });

export const Route = createFileRoute("/agent/new")({
	validateSearch: searchSchema,
	beforeLoad: () => {
		throw redirect({ to: "/dashboard/resumes", replace: true });
	},
});
