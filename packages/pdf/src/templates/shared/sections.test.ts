import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const source = readFileSync(fileURLToPath(new URL("./section-renderers.tsx", import.meta.url)), "utf8");
const layoutSource = readFileSync(fileURLToPath(new URL("./section-layout.tsx", import.meta.url)), "utf8");
const itemContentSource = readFileSync(fileURLToPath(new URL("./section-item-content.tsx", import.meta.url)), "utf8");

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
		const itemTitleBlock = itemContentSource.match(/const ItemTitle = \([\s\S]*?\n};/)?.[0] ?? "";

		expect(itemTitleBlock).toContain("if (!bold) return <Link src={inlineWebsiteUrl}>{children}</Link>;");
		expect(itemTitleBlock).not.toContain("{title}");
	});
});

describe("CertificationsSection", () => {
	it("uses the certification bold toggle for title rendering", () => {
		const certificationsBlock =
			source.match(/const CertificationsSection = \([\s\S]*?const PublicationsSection/)?.[0] ?? "";

		expect(certificationsBlock).toContain("bold={item.mainEntryBold ?? false}");
	});
});

describe("SectionShell", () => {
	it("keeps section and heading style rules when section heading icons are hidden", () => {
		expect(layoutSource).toContain("<View style={composeStyles(sectionStyle, sectionRuleStyle)}>");
		expect(layoutSource).toContain("<Heading style={composeStyles(sectionHeadingStyle, sectionHeadingRuleStyle)}>");
	});

	it("wires the section heading container style slot into the icon row", () => {
		expect(layoutSource).toContain('useTemplateStyle("sectionHeadingContainer")');
		expect(layoutSource).toContain("sectionHeadingContainerStyle");
	});

	it("top-aligns heading icon rows and does not use unsupported auto width resets", () => {
		const headingContainerBlock = layoutSource.match(
			/const defaultSectionHeadingContainerStyle = {(?<body>[\s\S]*?)} satisfies Style;/,
		);

		expect(headingContainerBlock?.groups?.body).toContain('alignItems: "flex-start"');
		expect(layoutSource).toContain("getSectionHeadingTextStyle(sectionHeadingStyle, sectionHeadingRuleStyle)");
		expect(layoutSource).toContain("width: _width");
		expect(layoutSource).not.toContain('width: "auto"');
	});
});
