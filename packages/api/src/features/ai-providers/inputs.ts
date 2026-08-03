import type { AIProvider } from "@reactive-resume/ai/types";
import z from "zod";
import { aiProviderSchema, isApiKeyOptional } from "@reactive-resume/ai/types";

const providerFields = z.object({
	label: z.string().trim().min(1),
	provider: aiProviderSchema,
	model: z.string().trim().min(1),
	baseURL: z.string().trim().optional(),
	apiKey: z.string().trim(),
});

// Self-hosted providers (LM Studio, Ollama, OpenAI-compatible servers) usually run without credentials.
function hasRequiredApiKey(input: { provider?: AIProvider | undefined; apiKey?: string | undefined }) {
	if (input.apiKey === undefined || input.provider === undefined) return true;
	return isApiKeyOptional(input.provider) || input.apiKey.length > 0;
}

const apiKeyError = { message: "An API key is required for this provider.", path: ["apiKey"] };

export const providerInput = providerFields.refine(hasRequiredApiKey, apiKeyError);

export const updateProviderInput = providerFields
	.partial()
	.extend({ id: z.string(), enabled: z.boolean().optional() })
	.refine((input) => Object.keys(input).some((key) => key !== "id"), {
		message: "At least one field must be provided.",
	})
	.refine(hasRequiredApiKey, apiKeyError);
