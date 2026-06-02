import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const source = readFileSync(fileURLToPath(new URL("./sections.tsx", import.meta.url)), "utf8");

describe("ExperienceSection", () => {
	it("does not hide the item position header when role progression is present", () => {
		expect(source).not.toContain("item.roles.length === 0 && (hasPosition || hasSplitRowText(headerPeriod))");
	});

	it("does not repeat the summary period after rendering it in a role-progression header", () => {
		expect(source).not.toContain("item.roles.length > 0 && <Text>{item.period}</Text>");
	});
});

describe("ItemTitle", () => {
	it("does not make inline title links bold unless mainEntryBold is enabled", () => {
		const itemTitleBlock = source.match(/const ItemTitle = \([\s\S]*?\n};/)?.[0] ?? "";

		expect(itemTitleBlock).toContain("if (!bold) return <Link src={inlineWebsiteUrl}>{children}</Link>;");
		expect(itemTitleBlock).not.toContain("{title}");
	});
});

describe("SectionShell", () => {
	it("keeps section and heading style rules when section heading icons are hidden", () => {
		expect(source).toContain("<View style={composeStyles(sectionStyle, sectionRuleStyle)}>");
		expect(source).toContain("<Heading style={composeStyles(sectionHeadingStyle, sectionHeadingRuleStyle)}>");
	});

	it("wires the section heading container style slot into the icon row", () => {
		expect(source).toContain('useTemplateStyle("sectionHeadingContainer")');
		expect(source).toContain("sectionHeadingContainerStyle");
	});

	it("top-aligns heading icon rows and does not use unsupported auto width resets", () => {
		const headingContainerBlock = source.match(
			/const defaultSectionHeadingContainerStyle = {(?<body>[\s\S]*?)} satisfies Style;/,
		);

		expect(headingContainerBlock?.groups?.body).toContain('alignItems: "flex-start"');
		expect(source).toContain("getSectionHeadingTextStyle(sectionHeadingStyle, sectionHeadingRuleStyle)");
		expect(source).toContain("width: _width");
		expect(source).not.toContain('width: "auto"');
	});
});
