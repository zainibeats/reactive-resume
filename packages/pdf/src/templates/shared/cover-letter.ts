import type { ResumeData } from "@reactive-resume/schema/resume/data";
import { filterSections } from "./filtering";

const isCoverLetterSection = (data: ResumeData, sectionId: string) =>
	data.customSections.some((section) => section.id === sectionId && section.type === "cover-letter");

const isCoverLetterOnlyDocument = (data: ResumeData) => {
	const visibleSections = data.metadata.layout.pages.flatMap((page) =>
		filterSections([...page.main, ...page.sidebar], data),
	);

	return visibleSections.length > 0 && visibleSections.every((sectionId) => isCoverLetterSection(data, sectionId));
};

/** The header prints on the first page, unless the resume holds only its cover letter. */
export const shouldShowResumeHeader = (data: ResumeData, pageIndex: number) =>
	pageIndex === 0 && !isCoverLetterOnlyDocument(data);
