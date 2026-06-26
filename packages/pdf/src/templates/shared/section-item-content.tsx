import type { Style } from "@react-pdf/types";
import type { ProfileItem } from "@reactive-resume/schema/resume/data";
import type { ReactNode } from "react";
import { View } from "../../renderer";
import { getWebsiteDisplayText } from "./contact";
import { useTemplateFeature, useTemplatePlacement, useTemplateStyle } from "./context";
import { Bold, Link, Text } from "./primitives";
import { getInlineItemWebsiteUrl, shouldRenderSeparateItemWebsite } from "./section-links";
import { composeStyles } from "./styles";

type InlineItemHeaderProps = {
	leading?: ReactNode;
	middle?: ReactNode;
	trailing?: ReactNode;
};

type ItemWebsite = {
	url: string;
	label: string;
	inlineLink?: boolean | undefined;
};

type ItemTitleProps = {
	bold?: boolean;
	children: ReactNode;
	website: ItemWebsite;
};

type ItemWebsiteLinkProps = {
	website: ItemWebsite;
};

const stackedSidebarSplitRowStyle = {
	flexDirection: "column",
	alignItems: "flex-start",
} satisfies Style;

export const useSectionSplitRowStyle = () => {
	const placement = useTemplatePlacement();
	const splitRowStyle = useTemplateStyle("splitRow");
	const stackSidebarItemHeader = useTemplateFeature("stackSidebarItemHeader");

	return composeStyles(
		splitRowStyle,
		stackSidebarItemHeader && placement === "sidebar" ? stackedSidebarSplitRowStyle : undefined,
	);
};

export const InlineItemHeader = ({ leading, middle, trailing }: InlineItemHeaderProps) => {
	const inlineItemHeaderStyle = useTemplateStyle("inlineItemHeader");
	const leadingStyle = useTemplateStyle("inlineItemHeaderLeading");
	const middleStyle = useTemplateStyle("inlineItemHeaderMiddle");
	const trailingStyle = useTemplateStyle("inlineItemHeaderTrailing");

	return (
		<View style={composeStyles(inlineItemHeaderStyle)}>
			<View style={composeStyles(leadingStyle)}>{leading}</View>
			<View style={composeStyles(middleStyle)}>{middle}</View>
			<View style={composeStyles(trailingStyle)}>{trailing}</View>
		</View>
	);
};

export const MainEntryText = ({ bold, children }: { bold: boolean; children: ReactNode }) => {
	if (bold) return <Bold style={{ fontWeight: 700 }}>{children}</Bold>;

	return <Text>{children}</Text>;
};

export const ItemTitle = ({ bold = true, children, website }: ItemTitleProps) => {
	const inlineWebsiteUrl = getInlineItemWebsiteUrl(website);
	const boldStyle = useTemplateStyle("bold");

	if (!inlineWebsiteUrl) return <MainEntryText bold={bold}>{children}</MainEntryText>;

	if (!bold) return <Link src={inlineWebsiteUrl}>{children}</Link>;

	return (
		<Link src={inlineWebsiteUrl} style={composeStyles(boldStyle, { fontWeight: 700 })}>
			{children}
		</Link>
	);
};

export const ProfileTitle = ({ item }: { item: ProfileItem }) => {
	const inlineWebsiteUrl = getInlineItemWebsiteUrl(item.website);
	const title = <Bold>{item.network}</Bold>;

	if (!inlineWebsiteUrl) return title;

	return <Link src={inlineWebsiteUrl}>{title}</Link>;
};

export const ItemWebsiteLink = ({ website }: ItemWebsiteLinkProps) => {
	if (!shouldRenderSeparateItemWebsite(website)) return null;

	return <Link src={website.url}>{getWebsiteDisplayText(website)}</Link>;
};
