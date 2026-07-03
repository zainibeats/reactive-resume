export type ResumeStartIntent = "create" | "import";

const storageKey = "resume-start-intent";

export function saveResumeStartIntent(intent: ResumeStartIntent) {
	if (typeof sessionStorage === "undefined") return;
	sessionStorage.setItem(storageKey, intent);
}

export function takeResumeStartIntent(): ResumeStartIntent | null {
	if (typeof sessionStorage === "undefined") return null;

	const intent = sessionStorage.getItem(storageKey);
	sessionStorage.removeItem(storageKey);

	return intent === "create" || intent === "import" ? intent : null;
}
