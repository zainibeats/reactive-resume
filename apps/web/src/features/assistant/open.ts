import { useEditorStore } from "@/features/resume/editor/store";

type OpenAssistant = {
	/** A conversation, or "new". */
	assistant?: string | undefined;
	/** A question sent as soon as the assistant is ready. In-app actions only (⌘K Ask, Check's job match). */
	ask?: string | undefined;
	/** Text for the composer that waits for Send. Links (`?ask=`) use this, so a link can't send as the user. */
	draft?: string | undefined;
};

/** Opens the assistant on a conversation, a question to send, or a draft to review. */
export function openAssistantFrom(search: OpenAssistant) {
	if (!search.assistant && !search.ask && !search.draft) return false;
	useEditorStore.getState().setAssistantOpen(true);
	useEditorStore.setState({ assistantThread: search.ask || search.draft ? "new" : (search.assistant ?? null) });
	if (search.ask) useEditorStore.setState({ assistantPrompt: search.ask });
	if (search.draft) useEditorStore.setState({ assistantDraft: search.draft });
	return true;
}
