import type { LetterWords } from "@reactive-resume/resume/cover-letter";
import type { CoverLetter } from "@reactive-resume/schema/cover-letter/data";
import { t } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { composeCoverLetter, createCoverLetterResumeData } from "@reactive-resume/resume/cover-letter";

/**
 * The words structured letters are composed with. They follow the app's language, like the rest of what the app
 * writes for you.
 */
export function useLetterWords(): LetterWords {
	const { i18n } = useLingui();

	return {
		greeting: (name: string) => t`Dear ${name},`,
		teamGreeting: t`Dear hiring team,`,
		hiringTeam: t`Hiring team`,
		signOff: t`Kind regards,`,
		formatDate: (date: string) =>
			new Date(`${date}T12:00:00Z`).toLocaleDateString(i18n.locale, {
				day: "numeric",
				month: "long",
				year: "numeric",
				timeZone: "UTC",
			}),
	};
}

/** The letter as a one-section document the PDF renderer draws: sender header, recipient, greeting, body, sign-off. */
export const letterPageData = (letter: CoverLetter, words: LetterWords) =>
	createCoverLetterResumeData({ ...letter, ...composeCoverLetter(letter, words) });
