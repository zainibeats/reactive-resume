import type { ResumeData } from "@reactive-resume/schema/resume/data";
import { useState } from "react";
import { resumeDataSchema } from "@reactive-resume/schema/resume/data";
import { Button } from "@reactive-resume/ui/components/button";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@reactive-resume/ui/components/dialog";
import { Textarea } from "@reactive-resume/ui/components/textarea";
import { useUpdateResumeData } from "@/features/resume/builder/draft";

type EditJsonDialogProps = {
	data: ResumeData;
	open: boolean;
	onOpenChange: (open: boolean) => void;
};

function parseResumeData(value: string): { data?: ResumeData; error?: string } {
	try {
		const result = resumeDataSchema.safeParse(JSON.parse(value));
		if (result.success) return { data: result.data };

		const issue = result.error.issues[0];
		const path = issue?.path.length ? `${issue.path.join(".")}: ` : "";
		return { error: `${path}${issue?.message ?? "The resume data is invalid."}` };
	} catch (error) {
		return { error: error instanceof Error ? error.message : "The JSON is invalid." };
	}
}

export function EditJsonDialog({ data, open, onOpenChange }: EditJsonDialogProps) {
	const updateResumeData = useUpdateResumeData();
	// Mounted per opening (see DocumentMenu), so the text always starts from the current resume.
	const [value, setValue] = useState(() => JSON.stringify(data, null, 2));
	const [error, setError] = useState<string>();

	const handleSave = () => {
		const result = parseResumeData(value);
		if (!result.data) {
			setError(result.error);
			return;
		}

		updateResumeData((draft) => {
			Object.assign(draft, result.data);
		});
		onOpenChange(false);
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="flex h-[90svh] max-h-none! w-[90svw] max-w-none! flex-col sm:max-w-none! lg:max-w-5xl!">
				<DialogHeader>
					<DialogTitle>Edit resume JSON</DialogTitle>
					<DialogDescription>
						Replace this resume's data with valid Reactive Resume JSON. For a linked child, its parent relationship is
						preserved.
					</DialogDescription>
				</DialogHeader>

				<Textarea
					aria-invalid={Boolean(error)}
					aria-label="Resume JSON"
					className="min-h-0 flex-1 resize-none font-mono text-xs whitespace-pre"
					spellCheck={false}
					value={value}
					onChange={(event) => {
						setValue(event.target.value);
						setError(undefined);
					}}
				/>

				{error && <p className="text-sm text-danger-text">{error}</p>}

				<DialogFooter>
					<DialogClose render={<Button variant="secondary">Cancel</Button>} />
					<Button onClick={handleSave}>Save JSON</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
