import { agentRouter } from "../features/agent/router";
import { aiProvidersRouter } from "../features/ai-providers/router";
import { aiRouter } from "../features/ai/router";
import { authRouter } from "../features/auth/router";
import { documentsRouter } from "../features/documents/router";
import { flagsRouter } from "../features/flags/router";
import { resumeRouter } from "../features/resume/router";
import { storageRouter } from "../features/storage/router";
import { webAccessRouter } from "../features/web-access/router";

export default {
	ai: aiRouter,
	aiProviders: aiProvidersRouter,
	agent: agentRouter,
	auth: authRouter,
	documents: documentsRouter,
	flags: flagsRouter,
	resume: resumeRouter,
	storage: storageRouter,
	webAccess: webAccessRouter,
};
