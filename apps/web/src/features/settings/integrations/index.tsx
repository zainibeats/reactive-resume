import { useIsClient } from "usehooks-ts";
import { AISettingsSection } from "./components/ai-section";

export function IntegrationsSettingsPage() {
	const isClient = useIsClient();

	if (!isClient) return null;

	return (
		<div className="grid max-w-4xl gap-8">
			<AISettingsSection />
		</div>
	);
}
