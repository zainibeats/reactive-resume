import type { ResumeData } from "@reactive-resume/schema/resume/data";
import { useEffect, useState } from "react";
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
	const [value, setValue] = useState(() => JSON.stringify(data, null, 2));
	const [error, setError] = useState<string>();

	useEffect(() => {
		if (!open) return;
		setValue(JSON.stringify(data, null, 2));
		setError(undefined);
	}, [data, open]);

	const handleOpenChange = (nextOpen: boolean) => {
		onOpenChange(nextOpen);
	};

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
		<Dialog open={open} onOpenChange={handleOpenChange}>
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
					className="min-h-0 flex-1 resize-none whitespace-pre font-mono text-xs"
					spellCheck={false}
					value={value}
					onChange={(event) => {
						setValue(event.target.value);
						setError(undefined);
					}}
				/>

				{error && <p className="text-destructive text-sm">{error}</p>}

				<DialogFooter>
					<DialogClose render={<Button variant="outline">Cancel</Button>} />
					<Button onClick={handleSave}>Save JSON</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
