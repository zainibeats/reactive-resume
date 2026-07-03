import type { FeatureFlags } from "./service";
import z from "zod";
import { publicProcedure } from "../../context";
import { flagsService } from "./service";

export const flagsRouter = {
	get: publicProcedure
		.route({
			method: "GET",
			path: "/flags",
			tags: ["Feature Flags"],
			operationId: "getFeatureFlags",
			summary: "Get feature flags",
			description:
				"Returns the current feature flags for this Reactive Resume instance. Signup is disabled after the instance owner has been created. No authentication required.",
			successDescription: "The current feature flags for this instance.",
		})
		.output(
			z.object({
				disableSignups: z.boolean().describe("Whether first-owner signup is disabled on this instance."),
				disableEmailAuth: z.boolean().describe("Whether email-based authentication is disabled on this instance."),
			}),
		)
		.handler(async (): Promise<FeatureFlags> => flagsService.getFlags()),
};
