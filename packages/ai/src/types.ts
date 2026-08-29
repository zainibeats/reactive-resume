import { z } from "zod";

const AI_PROVIDERS = [
	"openai",
	"anthropic",
	"gemini",
	"vercel-ai-gateway",
	"openrouter",
	"mistral",
	"cohere",
	"xai",
	"groq",
	"deepseek",
	"togetherai",
	"fireworks",
	"cerebras",
	"perplexity",
	"ollama",
	"lmstudio",
	"openai-compatible",
] as const;

export type AIProvider = (typeof AI_PROVIDERS)[number];

export const aiProviderSchema = z.enum(AI_PROVIDERS);

export const AI_PROVIDER_DEFAULT_BASE_URLS: Record<AIProvider, string> = {
	openai: "https://api.openai.com/v1",
	anthropic: "https://api.anthropic.com/v1",
	gemini: "https://generativelanguage.googleapis.com/v1beta",
	"vercel-ai-gateway": "https://ai-gateway.vercel.sh/v3/ai",
	openrouter: "https://openrouter.ai/api/v1",
	mistral: "https://api.mistral.ai/v1",
	cohere: "https://api.cohere.com/v2",
	xai: "https://api.x.ai/v1",
	groq: "https://api.groq.com/openai/v1",
	deepseek: "https://api.deepseek.com/v1",
	togetherai: "https://api.together.xyz/v1",
	fireworks: "https://api.fireworks.ai/inference/v1",
	cerebras: "https://api.cerebras.ai/v1",
	perplexity: "https://api.perplexity.ai",
	ollama: "http://localhost:11434/api",
	lmstudio: "http://localhost:1234/v1",
	"openai-compatible": "",
};

// Local servers and unauthenticated gateways answer without credentials, so an empty API key is valid for them.
const API_KEY_OPTIONAL_PROVIDERS = new Set<AIProvider>(["ollama", "lmstudio", "openai-compatible"]);

export function isApiKeyOptional(provider: AIProvider) {
	return API_KEY_OPTIONAL_PROVIDERS.has(provider);
}

// Brand names, used when a message has to name the provider outside a translated UI string. Every
// such message opens with this value, so the generic fallback is capitalised to match.
export const AI_PROVIDER_DISPLAY_NAMES: Record<AIProvider, string> = {
	openai: "OpenAI",
	anthropic: "Anthropic",
	gemini: "Google Gemini",
	"vercel-ai-gateway": "Vercel AI Gateway",
	openrouter: "OpenRouter",
	mistral: "Mistral",
	cohere: "Cohere",
	xai: "xAI",
	groq: "Groq",
	deepseek: "DeepSeek",
	togetherai: "Together AI",
	fireworks: "Fireworks AI",
	cerebras: "Cerebras",
	perplexity: "Perplexity",
	ollama: "Ollama",
	lmstudio: "LM Studio",
	"openai-compatible": "The provider",
};
