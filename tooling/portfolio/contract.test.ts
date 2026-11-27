import type { PortfolioResume } from "./contract";
import type { ResumeData } from "@reactive-resume/schema/resume/data";
import { describe, expect, it } from "vite-plus/test";
import { parseResumeData } from "@reactive-resume/schema/resume/data";
import { defaultResumeData } from "@reactive-resume/schema/resume/default";
import { sampleResumeData } from "@reactive-resume/schema/resume/sample";
import { checkPortfolioContract, PORTFOLIO_MUSIC_ITEM_ID } from "./contract";

// Compile-time guard: fails `typecheck` if the resume schema renames, removes or retypes a contract field.
const toPortfolioResume = (data: ResumeData): PortfolioResume => data;

// Mirrors the JSON export in apps/web/src/features/resume/export/use-resume-export.ts.
const exportResumeJson = (data: ResumeData): unknown => JSON.parse(JSON.stringify(data, null, 2));

function firstExperience() {
	const [first] = sampleResumeData.sections.experience.items;
	if (!first) throw new Error("sample resume needs an experience item");
	return first;
}

// Sample resume with its first experience item replaced; `unknown` lets tests build shapes the schema forbids.
function withFirstExperience(item: Record<string, unknown>): unknown {
	const resume = structuredClone(sampleResumeData);
	return {
		...resume,
		sections: {
			...resume.sections,
			experience: { ...resume.sections.experience, items: [item, ...resume.sections.experience.items.slice(1)] },
		},
	};
}

describe("czaini.net portfolio contract", () => {
	it("accepts the JSON export of the sample resume", () => {
		const exported = exportResumeJson(parseResumeData(structuredClone(sampleResumeData)));

		expect(checkPortfolioContract(exported)).toEqual([]);
		expect(toPortfolioResume(sampleResumeData).sections.experience.items.length).toBeGreaterThan(0);
	});

	it("accepts the JSON export of an empty resume", () => {
		expect(checkPortfolioContract(exportResumeJson(parseResumeData(structuredClone(defaultResumeData))))).toEqual([]);
	});

	it("rejects a renamed field", () => {
		const { company, ...rest } = firstExperience();
		const exported = withFirstExperience({ ...rest, employer: company });

		expect(checkPortfolioContract(exported)).toEqual([expect.stringContaining("sections.experience.items.0.company")]);
	});

	it("rejects a non-HTML description", () => {
		const exported = withFirstExperience({ ...firstExperience(), description: "- Shipped things" });

		expect(checkPortfolioContract(exported)).toEqual([
			expect.stringContaining("sections.experience.items.0.description"),
		]);
	});

	it("requires the music entry only when asked", () => {
		expect(checkPortfolioContract(sampleResumeData, { requireMusicItem: true })).toEqual([
			expect.stringContaining(PORTFOLIO_MUSIC_ITEM_ID),
		]);

		const exported = withFirstExperience({ ...firstExperience(), id: PORTFOLIO_MUSIC_ITEM_ID });
		expect(checkPortfolioContract(exported, { requireMusicItem: true })).toEqual([]);
	});
});
