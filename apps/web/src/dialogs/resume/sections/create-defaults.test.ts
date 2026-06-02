import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const dialogs = [
	{ file: "education.tsx", create: "CreateEducationDialog", update: "UpdateEducationDialog" },
	{ file: "experience.tsx", create: "CreateExperienceDialog", update: "UpdateExperienceDialog" },
	{ file: "project.tsx", create: "CreateProjectDialog", update: "UpdateProjectDialog" },
	{ file: "skill.tsx", create: "CreateSkillDialog", update: "UpdateSkillDialog" },
];

function createDialogBody(file: string, createName: string, updateName: string) {
	const source = readFileSync(new URL(`./${file}`, import.meta.url), "utf8");
	const start = source.indexOf(`export function ${createName}`);
	expect(start).toBeGreaterThanOrEqual(0);

	const end = source.indexOf(`export function ${updateName}`, start);
	expect(end).toBeGreaterThan(start);

	return source.slice(start, end);
}

describe("section create dialog defaults", () => {
	it.each(dialogs)("$create does not validate empty defaults before submit", ({ file, create, update }) => {
		const body = createDialogBody(file, create, update);

		expect(body).not.toContain("defaultValues: formSchema.parse");
		expect(body).toContain("makeSectionItem(defaultValues, data?.item)");
		expect(body).toContain("validators: { onSubmit: formSchema }");
	});
});
