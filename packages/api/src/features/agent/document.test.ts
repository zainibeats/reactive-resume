import { describe, expect, it, vi } from "vitest";
import { collectPassages, readTarget } from "@reactive-resume/resume/proposals";
import { defaultResumeData } from "@reactive-resume/schema/resume/default";

vi.mock("../resume/service", () => ({ resumeService: {} }));

const { documentOf, resolveEdits } = await import("./document");

function makeDocument() {
	const data = structuredClone(defaultResumeData);
	data.summary.content = "";
	data.sections.experience.items = [
		{
			id: "lumen",
			hidden: false,
			company: "Lumen Health",
			position: "Designer",
			location: "",
			period: "",
			website: { url: "", label: "", inlineLink: false },
			description: "<ul><li><p>Built the design system</p></li><li><p>Ran usability sessions</p></li></ul>",
			roles: [],
		} as never,
	];
	const passages = collectPassages(data, {
		includeEmpty: true,
		summary: "Summary",
		sectionTitle: () => "Experience",
		entryTitle: () => "Lumen Health",
		bullet: (n) => `bullet ${n}`,
		paragraph: (n) => `paragraph ${n}`,
	});
	return {
		data,
		passages,
		document: {
			name: "Resume",
			updatedAt: new Date(),
			locked: false,
			passages,
			read: (target: Parameters<typeof readTarget>[1]) => readTarget(data, target),
			view: {},
		},
	};
}

describe("agent documents", () => {
	it("finds a conversation's resume, and none for conversations without one", () => {
		expect(documentOf({ workingResumeId: "resume-1" })).toEqual({ kind: "resume", id: "resume-1" });
		// Letter conversations from before the assistant was resume-only have no working resume.
		expect(documentOf({ workingResumeId: null })).toBeNull();
	});

	it("places rewrites, additions and an empty summary, and skips edits on text that changed", () => {
		const { document, passages } = makeDocument();
		const [summary, first, second] = passages;
		if (!summary || !first || !second) throw new Error("Expected three passages");
		expect(summary.html).toBe("");

		const output = resolveEdits(document, {
			title: "Tailor",
			edits: [
				{
					passageId: first.id,
					text: "Built the Lumen design system and rolled it out",
					why: "Leads with the rollout.",
				},
				{ passageId: second.id, text: "Introduced monthly accessibility reviews", why: "You said so.", add: true },
				{ passageId: summary.id, text: "Product designer for health tools.", why: "A summary." },
				{ passageId: "p_gone", text: "Anything", why: "Stale." },
				{ passageId: first.id, text: "Built the design system", why: "No change." },
			],
		});

		expect(output.title).toBe("Tailor");
		expect(output.edits.map(({ before, after, status }) => ({ before, after, status }))).toEqual([
			{
				before: "<p>Built the design system</p>",
				after: "<p>Built the Lumen design system and rolled it out</p>",
				status: "pending",
			},
			{
				before: "<p>Ran usability sessions</p></li>",
				after: "<p>Ran usability sessions</p></li><li><p>Introduced monthly accessibility reviews</p></li>",
				status: "pending",
			},
			{ before: "", after: "<p>Product designer for health tools.</p>", status: "pending" },
		]);
		expect(output.edits[0]?.location).toBe("Experience · Lumen Health · bullet 1");
		expect(output.skipped.map((skip) => skip.passageId)).toEqual(["p_gone", first.id]);
	});
});
