import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const source = readFileSync(fileURLToPath(new URL("./sections.tsx", import.meta.url)), "utf8");

// This fork renders main entry headings unbold by default behind a per-item "Bold" toggle (`mainEntryBold`).
describe("ItemTitle", () => {
	it("renders award titles without the bold style", () => {
		expect(source).toContain("const ItemTitle = ({ children, website, field, bold = true }: ItemTitleProps)");
		expect(source).toContain('<ItemTitle field="title" website={item.website} bold={false}>');
	});

	it("keeps the semantic field binding in both bold and unbold headings", () => {
		const block = source.match(/const MainEntryText = [\s\S]*?\n};/)?.[0];

		expect(block).toContain("<Bold semanticField={field} style={composeStyles(mainEntryBoldStyle, style)}>");
		expect(block).toContain("<Text semanticField={field} style={composeStyles(style)}>");
	});

	it("renders the bold toggle at a real bold weight instead of the heaviest body weight", () => {
		const block = source.match(/const MainEntryText = [\s\S]*?\n};/)?.[0];

		expect(block).toContain('useTemplateStyle("mainEntryBold")');
	});

	it("wires the bold toggle into every section that exposes it", () => {
		const sections = ["ExperienceSection", "EducationSection", "ProjectsSection", "CertificationsSection"];

		for (const section of sections) {
			const block = source.match(new RegExp(`const ${section} = [\\s\\S]*?\\n};`))?.[0];
			expect(block).toContain("bold={item.mainEntryBold ?? false}");
		}
	});

	it("uses the skill bold toggle for the skill name", () => {
		const block = source.match(/const SkillsSection = [\s\S]*?\n};/)?.[0];

		expect(block).toContain("bold={item.mainEntryBold ?? false}");
		expect(block).toContain("style={composeStyles(isInlineSkillsItem ? undefined : { flex: 1 })}");
	});
});
