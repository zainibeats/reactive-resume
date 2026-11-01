// Kept apart from ./new-document-dialog.tsx, so the library loads without the importers that dialog needs.
import { t } from "@lingui/core/macro";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "@reactive-resume/ui/components/toast";
import { useNewDocumentsStore } from "./new-documents";
import { useDialogStore } from "@/dialogs/store";
import { toastError } from "@/libs/error-message";
import { orpc } from "@/libs/orpc/client";

// One create at a time across every caller: a click repeated, or a dialog reopened, while one is in flight does nothing.
let starting = false;

/** Start blank or try a sample: each creates the resume at once and opens it. */
export function useStartDocument() {
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const closeDialog = useDialogStore((state) => state.closeDialog);
	const markNew = useNewDocumentsStore((state) => state.markNew);
	const [creating, setCreating] = useState(false);
	const { mutateAsync: createResume } = useMutation(orpc.resume.create.mutationOptions());

	const created = (id: string) => {
		markNew(id);
		void queryClient.invalidateQueries({ queryKey: orpc.documents.key() });
		closeDialog();
	};
	const start = async (task: () => Promise<void>) => {
		if (starting) return;
		starting = true;
		setCreating(true);
		try {
			await task();
		} catch (error) {
			toastError(error, t`Couldn't create the document. Try again.`);
		} finally {
			starting = false;
			setCreating(false);
		}
	};

	return {
		creating,
		startBlank: () =>
			start(async () => {
				const resumeId = await createResume({
					name: t`Untitled resume`,
					tags: [],
					autoName: true,
					withSampleData: false,
				});
				created(resumeId);
				void navigate({ to: "/builder/$resumeId", params: { resumeId } });
			}),
		trySample: () =>
			start(async () => {
				// The name generator is large; only a sample needs it.
				const { generateRandomName } = await import("@reactive-resume/utils/slug");
				const resumeId = await createResume({ name: generateRandomName(), tags: [], withSampleData: true });
				created(resumeId);
				toast.add({ description: t`Sample resume added. Delete it anytime.` });
				void navigate({ to: "/builder/$resumeId", params: { resumeId } });
			}),
	};
}
