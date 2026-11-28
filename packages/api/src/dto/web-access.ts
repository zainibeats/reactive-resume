import z from "zod";
import { webAccessProviderSchema } from "../features/web-access/contracts";

const capabilityTest = z.object({ success: z.boolean(), error: z.string().optional() });

export const webAccessDto = {
	status: {
		output: z.object({
			builtInReader: z.literal(true),
			configured: z.boolean(),
			provider: webAccessProviderSchema.nullable(),
			managed: z.boolean(),
			canSave: z.boolean(),
			search: z.boolean(),
			/** Searches go to the server's SearXNG rather than the connection. Older servers leave it out. */
			searxng: z.boolean(),
			/** SearXNG is set by the server's `WEB_SEARCH_SEARXNG_URL` and can't be changed here. */
			searxngManaged: z.boolean(),
			/** The user's own SearXNG address; null when unset or managed by the server. */
			searxngUrl: z.string().nullable(),
			read: z.literal(true),
		}),
	},
	save: {
		input: z.object({ provider: webAccessProviderSchema, apiKey: z.string().trim().min(1).max(2_000) }),
		output: z.void(),
	},
	delete: { output: z.void() },
	saveSearxng: {
		input: z.object({
			// Self-hosted instances usually sit on a private address, so LAN and loopback hosts are allowed.
			url: z
				.url({ protocol: /^https?$/ })
				.trim()
				.max(2_000)
				.refine((value) => {
					const url = new URL(value);
					return !url.username && !url.password;
				}, "Leave credentials out of the SearXNG address."),
		}),
		output: z.void(),
	},
	deleteSearxng: { output: z.void() },
	test: { output: z.object({ search: capabilityTest, read: capabilityTest }) },
};
