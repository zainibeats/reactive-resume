import type { ResumeData } from "@reactive-resume/schema/resume/data";
import { isCoverLetterOnlyDocument } from "@reactive-resume/resume/export-sections";

/** The header prints on the first page, unless the resume holds only its cover letter. */
export const shouldShowResumeHeader = (data: ResumeData, pageIndex: number) =>
	pageIndex === 0 && !isCoverLetterOnlyDocument(data);
