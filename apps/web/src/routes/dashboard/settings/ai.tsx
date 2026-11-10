import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { AiDeveloperSettings } from "@/features/settings/ai/page";

export const Route = createFileRoute("/dashboard/settings/ai")({
	// Agents hand off "create an API key" with `?newKey=true#api-keys`, which opens the New key dialog.
	validateSearch: z.object({ newKey: z.boolean().optional().catch(false) }),
	component: AiDeveloperSettings,
});
