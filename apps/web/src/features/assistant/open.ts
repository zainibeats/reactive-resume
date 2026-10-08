import { useEditorStore } from "@/features/resume/editor/store";

/** `?assistant=` (a conversation, or "new") and `?ask=` (a question to send) open the assistant. */
export function openAssistantFrom(search: { assistant?: string | undefined; ask?: string | undefined }) {
	if (!search.assistant && !search.ask) return false;
	const editor = useEditorStore.getState();
	editor.setAssistantOpen(true);
	editor.setAssistantThread(search.ask ? "new" : (search.assistant ?? null));
	if (search.ask) editor.setAssistantPrompt(search.ask);
	return true;
}
