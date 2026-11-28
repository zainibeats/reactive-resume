/**
 * Contract for the czaini.net portfolio, which renders part of its content from this app's JSON export of the
 * public resume (see "Downstream consumer: czaini.net portfolio" in AGENTS.md).
 *
 * This lists only the fields that site reads. Unknown fields are ignored, so adding fields stays safe; renaming,
 * removing, retyping or re-nesting any field here breaks the live site and must ship with a portfolio update.
 */
import z from "zod";

export const PORTFOLIO_RESUME_URL = "https://pub-ce3c1c9953b7492c8531cc682159ab2e.r2.dev/files/public-resume.json";

/** The site links this experience entry to `/music` by id, so it must survive edits and exports. */
export const PORTFOLIO_MUSIC_ITEM_ID = "mpv569j6xclzcdn3762qf0qw";

// The site extracts `<li>` text, falling back to `<p>`. Anything else (Markdown, plain text) renders nothing.
const htmlDescription = z
	.string()
	.refine((value) => value.trim() === "" || /<(li|p)[\s>]/i.test(value), "must be HTML with <li> or <p> content");

const item = z.object({ id: z.string().min(1), hidden: z.boolean() });

const section = <T extends z.ZodType>(itemSchema: T) => z.object({ hidden: z.boolean(), items: z.array(itemSchema) });

export const portfolioResumeContract = z.object({
	basics: z.object({ email: z.string(), location: z.string() }),
	sections: z.object({
		experience: section(
			item.extend({
				company: z.string(),
				position: z.string(),
				location: z.string(),
				period: z.string(),
				description: htmlDescription,
			}),
		),
		education: section(item.extend({ school: z.string(), degree: z.string(), area: z.string(), period: z.string() })),
		certifications: section(
			item.extend({ title: z.string(), issuer: z.string(), website: z.object({ url: z.string() }) }),
		),
	}),
});

export type PortfolioResume = z.infer<typeof portfolioResumeContract>;

/** Returns human-readable contract violations; an empty array means the export is safe for the portfolio. */
export function checkPortfolioContract(data: unknown, options: { requireMusicItem?: boolean } = {}): string[] {
	const result = portfolioResumeContract.safeParse(data);
	if (!result.success) {
		return result.error.issues.map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`);
	}

	const experienceIds = result.data.sections.experience.items.map((entry) => entry.id);
	if (options.requireMusicItem && !experienceIds.includes(PORTFOLIO_MUSIC_ITEM_ID)) {
		return [`sections.experience.items: missing music entry with id "${PORTFOLIO_MUSIC_ITEM_ID}"`];
	}

	return [];
}
