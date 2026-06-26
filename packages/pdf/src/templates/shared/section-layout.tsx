import type { Style } from "@react-pdf/types";
import type { IconName } from "phosphor-icons-react-pdf/dynamic";
import type { ReactNode } from "react";
import type { StyleInput } from "./styles";
import { Children, createContext, isValidElement, use } from "react";
import { useRender } from "../../context";
import { View } from "../../renderer";
import { getResumeSectionIcon } from "../../section-icon";
import { getResumeSectionTitle } from "../../section-title";
import { getSectionItemRows, getSectionItemsLayout, shouldUseSectionTimeline } from "./columns";
import {
	useSectionStyleRule,
	useTemplateFeature,
	useTemplateFeatureStyle,
	useTemplatePlacement,
	useTemplateStyle,
} from "./context";
import { getTemplateMetrics } from "./metrics";
import { Div, Heading, SectionHeadingIcon } from "./primitives";
import { createRtlStyleHelpers } from "./rtl";
import { composeStyles } from "./styles";

type SectionItemsContextValue = {
	itemStyle: StyleInput;
	useTimeline: boolean;
};

type SectionShellProps = {
	sectionId: string;
	title: string;
	showHeading?: boolean;
	children: ReactNode;
};

type SectionItemsProps = {
	children: ReactNode;
	columns?: number;
};

type SectionItemProps = {
	children: ReactNode;
	style?: StyleInput;
};

type SectionItemHeaderProps = {
	children: ReactNode;
};

const SectionItemsContext = createContext<SectionItemsContextValue>({ itemStyle: undefined, useTimeline: false });
const SECTION_ITEM_PLACEHOLDER_KEYS = [
	"placeholder-1",
	"placeholder-2",
	"placeholder-3",
	"placeholder-4",
	"placeholder-5",
	"placeholder-6",
] as const;

const defaultSectionHeadingContainerStyle = {
	flexDirection: "row",
	alignItems: "flex-start",
	columnGap: 4,
} satisfies Style;

const getSectionHeadingTextStyle = (...styles: StyleInput[]): Style[] =>
	composeStyles(...styles).map(
		({
			borderBottomWidth: _borderBottomWidth,
			borderLeftWidth: _borderLeftWidth,
			borderRightWidth: _borderRightWidth,
			borderTopWidth: _borderTopWidth,
			borderWidth: _borderWidth,
			flexGrow: _flexGrow,
			flexShrink: _flexShrink,
			marginBottom: _marginBottom,
			marginLeft: _marginLeft,
			marginRight: _marginRight,
			marginTop: _marginTop,
			paddingBottom: _paddingBottom,
			paddingLeft: _paddingLeft,
			paddingRight: _paddingRight,
			paddingTop: _paddingTop,
			width: _width,
			...textStyle
		}) => textStyle,
	);

const useSectionItemsContext = () => use(SectionItemsContext);

const getChildKey = (child: ReactNode, fallbackIndex: number) => {
	return isValidElement(child) && child.key !== null ? String(child.key) : `child-${fallbackIndex}`;
};

const getRowKey = (row: ReactNode[], rowIndex: number) => {
	const childKeys = row.map(getChildKey).join("|");
	return childKeys || `row-${rowIndex}`;
};

export const SectionShell = ({ sectionId, title, showHeading = true, children }: SectionShellProps) => {
	const data = useRender();
	const sectionStyle = useTemplateStyle("section");
	const sectionRuleStyle = useSectionStyleRule("section");
	const sectionHeadingStyle = useTemplateStyle("sectionHeading");
	const sectionHeadingContainerStyle = useTemplateStyle("sectionHeadingContainer");
	const sectionHeadingRuleStyle = useSectionStyleRule("heading");
	const sectionTitle = getResumeSectionTitle(data, sectionId, title);
	const sectionIcon = getResumeSectionIcon(data, sectionId);
	const showIcon = Boolean(sectionIcon) && !data.metadata.page.hideSectionIcons;

	if (!showIcon) {
		return (
			<View style={composeStyles(sectionStyle, sectionRuleStyle)}>
				{showHeading && (
					<Heading style={composeStyles(sectionHeadingStyle, sectionHeadingRuleStyle)}>{sectionTitle}</Heading>
				)}
				{children}
			</View>
		);
	}

	return (
		<View style={composeStyles(sectionStyle, sectionRuleStyle)}>
			{showHeading && (
				<View
					style={composeStyles(
						sectionHeadingStyle,
						defaultSectionHeadingContainerStyle,
						sectionHeadingContainerStyle,
						sectionHeadingRuleStyle,
					)}
				>
					<SectionHeadingIcon name={sectionIcon as IconName} />
					<Heading style={getSectionHeadingTextStyle(sectionHeadingStyle, sectionHeadingRuleStyle)}>
						{sectionTitle}
					</Heading>
				</View>
			)}
			{children}
		</View>
	);
};

export const SectionItems = ({ children, columns = 1 }: SectionItemsProps) => {
	const data = useRender();
	const placement = useTemplatePlacement();
	const sectionTimeline = useTemplateFeature("sectionTimeline");
	const sectionItemsStyle = useTemplateStyle("sectionItems");
	const timelineItemsStyle = useTemplateFeatureStyle("sectionTimeline", "items");
	const timelineLineStyle = useTemplateFeatureStyle("sectionTimeline", "line");
	const metrics = getTemplateMetrics(data.metadata.page);
	const layout = getSectionItemsLayout({
		columns,
		rowGap: metrics.itemGapY,
		columnGap: metrics.itemGapX,
	});
	const useTimeline = shouldUseSectionTimeline({
		sectionTimeline,
		placement,
		columns: layout.columns,
	});
	const context = { itemStyle: layout.itemStyle, useTimeline };
	const rtlRowStyle = createRtlStyleHelpers(data.rtl).gridRowStyle;

	if (!useTimeline) {
		if (layout.isGrid) {
			const rows = getSectionItemRows(Children.toArray(children), layout.columns);

			return (
				<SectionItemsContext.Provider value={context}>
					<View style={composeStyles(layout.containerStyle, sectionItemsStyle)}>
						{rows.map((row, rowIndex) => (
							<View key={getRowKey(row, rowIndex)} style={composeStyles(layout.rowStyle, rtlRowStyle)}>
								{row}
								{SECTION_ITEM_PLACEHOLDER_KEYS.slice(0, layout.columns - row.length).map((placeholderKey) => (
									<View key={placeholderKey} style={composeStyles(layout.itemStyle)} />
								))}
							</View>
						))}
					</View>
				</SectionItemsContext.Provider>
			);
		}

		return (
			<SectionItemsContext.Provider value={context}>
				<View style={composeStyles(layout.containerStyle, sectionItemsStyle)}>{children}</View>
			</SectionItemsContext.Provider>
		);
	}

	return (
		<SectionItemsContext.Provider value={context}>
			<View style={composeStyles(layout.containerStyle, sectionItemsStyle, timelineItemsStyle)}>
				<View style={composeStyles(timelineLineStyle)} />
				{children}
			</View>
		</SectionItemsContext.Provider>
	);
};

export const SectionItem = ({ children, style }: SectionItemProps) => {
	const { itemStyle: sectionItemStyle, useTimeline } = useSectionItemsContext();
	const itemStyle = useTemplateStyle("item");
	const itemRuleStyle = useSectionStyleRule("item");
	const timelineItemStyle = useTemplateFeatureStyle("sectionTimeline", "item");
	const timelineMarkerStyle = useTemplateFeatureStyle("sectionTimeline", "marker");
	const timelineDotStyle = useTemplateFeatureStyle("sectionTimeline", "dot");
	const timelineContentStyle = useTemplateFeatureStyle("sectionTimeline", "content");

	if (!useTimeline) {
		return <Div style={composeStyles(itemStyle, itemRuleStyle, sectionItemStyle, style)}>{children}</Div>;
	}

	return (
		<View style={composeStyles(timelineItemStyle)}>
			<View style={composeStyles(timelineMarkerStyle)}>
				<View style={composeStyles(timelineDotStyle)} />
			</View>
			<Div style={composeStyles(itemStyle, itemRuleStyle, timelineContentStyle, style)}>{children}</Div>
		</View>
	);
};

export const SectionItemHeader = ({ children }: SectionItemHeaderProps) => {
	const mainItemHeaderBorder = useTemplateFeature("mainItemHeaderBorder");
	const sectionItemHeaderStyle = useTemplateStyle("sectionItemHeader");

	if (!mainItemHeaderBorder) return <>{children}</>;

	return <View style={composeStyles(sectionItemHeaderStyle)}>{children}</View>;
};
