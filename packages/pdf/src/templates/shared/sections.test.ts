import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vite-plus/test";

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
		for (const section of ["ExperienceSection", "EducationSection"]) {
			const block = source.match(new RegExp(`const ${section} = [\\s\\S]*?\\n};`))?.[0];
			expect(block).toContain("bold={item.mainEntryBold ?? false}");
		}

		// Projects and certifications share the dated-item layout with publications, which stay always bold.
		const dated = source.match(/const DatedItemSection = [\s\S]*?\n};/)?.[0];
		expect(dated).toContain("(item.mainEntryBold ?? false)");
		for (const section of ["ProjectsSection", "CertificationsSection"]) {
			const block = source.match(new RegExp(`const ${section} = [\\s\\S]*?\\n\\);`))?.[0];
			expect(block).toContain("toggleBold");
		}
		const publications = source.match(/const PublicationsSection = [\s\S]*?\n\);/)?.[0];
		expect(publications).not.toContain("toggleBold");
	});

	it("uses the skill bold toggle for the skill name", () => {
		const block = source.match(/const SkillsSection = [\s\S]*?\n};/)?.[0];

		expect(block).toContain("bold={item.mainEntryBold ?? false}");
		expect(block).toContain("style={composeStyles(isInlineSkillsItem ? undefined : { flex: 1 })}");
	});
});
