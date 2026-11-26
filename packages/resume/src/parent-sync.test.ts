import type { ResumeData } from "@reactive-resume/schema/resume/data";
import { describe, expect, it } from "vite-plus/test";
import { defaultResumeData } from "@reactive-resume/schema/resume/default";
import { isConflictingPath, planParentSync, selectParentSyncEntries } from "./parent-sync";

function withBasics(data: ResumeData, basics: Partial<ResumeData["basics"]>): ResumeData {
	return { ...data, basics: { ...data.basics, ...basics } };
}

const snapshot = withBasics(defaultResumeData, { name: "Ada", headline: "Engineer", email: "ada@example.com" });

describe("isConflictingPath", () => {
	it("matches the conflict path and paths below it, not siblings sharing a prefix", () => {
		expect(isConflictingPath("/basics/name", ["/basics/name"])).toBe(true);
		expect(isConflictingPath("/basics/name/0", ["/basics/name"])).toBe(true);
		expect(isConflictingPath("/basics/names", ["/basics/name"])).toBe(false);
	});
});

describe("planParentSync", () => {
	it("returns an empty plan when the parent has not changed", () => {
		const plan = planParentSync({ parentData: snapshot, parentSnapshot: snapshot, childData: snapshot });

		expect(plan).toEqual({ entries: [], operations: [], conflicts: [], diffs: [], hasConflicts: false });
	});

	it("reports parent changes as diffs with previous and next values", () => {
		const parentData = withBasics(snapshot, { headline: "Staff Engineer" });
		const plan = planParentSync({ parentData, parentSnapshot: snapshot, childData: snapshot });

		expect(plan.operations).toEqual([{ op: "replace", path: "/basics/headline", value: "Staff Engineer" }]);
		expect(plan.diffs).toEqual([
			{
				op: "replace",
				path: "/basics/headline",
				from: null,
				hasPrevious: true,
				hasNext: true,
				previous: "Engineer",
				next: "Staff Engineer",
				hasConflict: false,
			},
		]);
		expect(plan.hasConflicts).toBe(false);
	});

	it("flags a parent change that overlaps a child edit", () => {
		const parentData = withBasics(snapshot, { headline: "Staff Engineer" });
		const childData = withBasics(snapshot, { headline: "Engineering Lead" });
		const plan = planParentSync({ parentData, parentSnapshot: snapshot, childData });

		expect(plan.conflicts).toEqual(["/basics/headline"]);
		expect(plan.hasConflicts).toBe(true);
		expect(plan.diffs[0]?.hasConflict).toBe(true);
	});

	it("does not flag child edits on paths the parent left alone", () => {
		const parentData = withBasics(snapshot, { headline: "Staff Engineer" });
		const childData = withBasics(snapshot, { email: "ada@work.example.com" });
		const plan = planParentSync({ parentData, parentSnapshot: snapshot, childData });

		expect(plan.hasConflicts).toBe(false);
	});

	it("rebases an item change onto the child's reordered item", () => {
		const item = (id: string, description: string) => ({
			id,
			hidden: false,
			name: id,
			period: "",
			website: { url: "", label: "", inlineLink: false },
			description,
		});
		const withProjects = (data: ResumeData, items: ReturnType<typeof item>[]): ResumeData => ({
			...data,
			sections: { ...data.sections, projects: { ...data.sections.projects, items } },
		});
		const parentSnapshot = withProjects(snapshot, [item("a", "Original")]);
		const parentData = withProjects(snapshot, [item("a", "Updated")]);
		const childData = withProjects(snapshot, [item("b", "Child only"), item("a", "Original")]);
		const plan = planParentSync({ parentData, parentSnapshot, childData });

		expect(plan.diffs.map(({ path }) => path)).toEqual(["/sections/projects/items/0/description"]);
		expect(plan.operations).toEqual([
			{ op: "replace", path: "/sections/projects/items/1/description", value: "Updated" },
		]);
		expect(plan.hasConflicts).toBe(false);
	});
});

describe("selectParentSyncEntries", () => {
	const parentData = withBasics(snapshot, { headline: "Staff Engineer", name: "Ada Lovelace" });
	const childData = withBasics(snapshot, { headline: "Engineering Lead" });
	const plan = planParentSync({ parentData, parentSnapshot: snapshot, childData });

	it("selects every entry when no paths are given", () => {
		const selection = selectParentSyncEntries(plan);

		expect(selection.entries).toHaveLength(2);
		expect(selection.isComplete).toBe(true);
		expect(selection.hasConflicts).toBe(true);
	});

	it("selects only the given parent-side paths and reports a partial selection", () => {
		const selection = selectParentSyncEntries(plan, ["/basics/name"]);

		expect(selection.entries.map(({ baseOperation }) => baseOperation.path)).toEqual(["/basics/name"]);
		expect(selection.isComplete).toBe(false);
		expect(selection.hasConflicts).toBe(false);
	});

	it("reports conflicts only for selected entries", () => {
		expect(selectParentSyncEntries(plan, ["/basics/headline"]).hasConflicts).toBe(true);
	});

	it("is complete when the given paths cover every entry", () => {
		expect(selectParentSyncEntries(plan, ["/basics/name", "/basics/headline"]).isComplete).toBe(true);
	});
});
