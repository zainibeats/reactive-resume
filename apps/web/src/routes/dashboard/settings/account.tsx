import { createFileRoute } from "@tanstack/react-router";
import { AccountSettings } from "@/features/settings/account/page";

export const Route = createFileRoute("/dashboard/settings/account")({
	component: AccountSettings,
});
