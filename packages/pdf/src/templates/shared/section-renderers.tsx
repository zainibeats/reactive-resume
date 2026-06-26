import type { Style } from "@react-pdf/types";
import type {
	AwardItem,
	CertificationItem,
	CoverLetterItem,
	EducationItem,
	ExperienceItem,
	InterestItem,
	LanguageItem,
	ProfileItem,
	ProjectItem,
	PublicationItem,
	ReferenceItem,
	SkillItem,
	SummaryItem,
	VolunteerItem,
} from "@reactive-resume/schema/resume/data";
import type { IconName } from "phosphor-icons-react-pdf/dynamic";
import type { CustomItemSection, ItemSection } from "./types";
import { match } from "ts-pattern";
import { useRender } from "../../context";
import { View } from "../../renderer";
import { useTemplateFeature, useTemplateStyle } from "./context";
import { filterItems, hasVisibleItems, isVisibleSummary } from "./filtering";
import { LevelDisplay } from "./level-display";
import { getTemplateMetrics } from "./metrics";
import { Bold, Icon, Link, Small, Text } from "./primitives";
import { RichText } from "./rich-text";
import {
	InlineItemHeader,
	ItemTitle,
	ItemWebsiteLink,
	MainEntryText,
	ProfileTitle,
	useSectionSplitRowStyle,
} from "./section-item-content";
import { SectionItem, SectionItemHeader, SectionItems, SectionShell } from "./section-layout";
import { shouldRenderSeparateItemWebsite } from "./section-links";
import { hasSplitRowText, promoteSplitRowRight } from "./split-row";
import { composeStyles } from "./styles";

type SummarySectionProps = {
	showHeading?: boolean;
};

type CustomSummarySectionProps = {
	section: CustomItemSection<SummaryItem>;
	showHeading?: boolean;
};

type ItemSectionProps<T> = {
	sectionId?: string;
	sectionData?: ItemSection<T>;
};

type CoverLetterSectionProps = {
	section: CustomItemSection<CoverLetterItem>;
};

type CustomSectionProps = {
	sectionId: string;
	showHeading?: boolean;
};

const getVisibleItems = <T extends { hidden: boolean }>(section: ItemSection<T>, sectionType?: string): T[] => {
	if (!hasVisibleItems(section, sectionType)) return [];

	return filterItems(section.items, sectionType);
};

const awardTitleDateRowStyle = {
	flexDirection: "row",
	alignItems: "flex-start",
	justifyContent: "space-between",
} satisfies Style;

export const SummarySection = ({ showHeading = true }: SummarySectionProps = {}) => {
	const data = useRender();
	const { summary } = data;

	if (!isVisibleSummary(summary)) return null;

	return (
		<SectionShell sectionId="summary" title={summary.title} showHeading={showHeading}>
			<SectionItems>
				<SectionItem>
					<RichText>{summary.content}</RichText>
				</SectionItem>
			</SectionItems>
		</SectionShell>
	);
};

const CustomSummarySection = ({ section, showHeading = true }: CustomSummarySectionProps) => {
	const items = getVisibleItems(section);

	if (items.length === 0) return null;

	return (
		<SectionShell sectionId={section.id} title={section.title} showHeading={showHeading}>
			<SectionItems columns={section.columns}>
				{items.map((item) => (
					<SectionItem key={item.id}>
						<RichText>{item.content}</RichText>
					</SectionItem>
				))}
			</SectionItems>
		</SectionShell>
	);
};

export const ProfileSection = ({ sectionId = "profiles", sectionData }: ItemSectionProps<ProfileItem> = {}) => {
	const data = useRender();
	const profiles = sectionData ?? data.sections.profiles;
	const items = getVisibleItems(profiles, "profiles");
	const inlineStyle = useTemplateStyle("inline");

	if (items.length === 0) return null;

	return (
		<SectionShell sectionId={sectionId} title={profiles.title}>
			<SectionItems columns={profiles.columns}>
				{items.map((item) => (
					<SectionItem key={item.id}>
						<SectionItemHeader>
							<View style={composeStyles(inlineStyle)}>
								<Icon name={item.icon as IconName} />
								<ProfileTitle item={item} />
							</View>
						</SectionItemHeader>
						{shouldRenderSeparateItemWebsite(item.website) ? (
							<Link src={item.website.url}>{item.username}</Link>
						) : (
							<Text>{item.username}</Text>
						)}
					</SectionItem>
				))}
			</SectionItems>
		</SectionShell>
	);
};

export const ExperienceSection = ({ sectionId = "experience", sectionData }: ItemSectionProps<ExperienceItem> = {}) => {
	const data = useRender();
	const experience = sectionData ?? data.sections.experience;
	const items = getVisibleItems(experience, "experience");
	const splitRowStyle = useSectionSplitRowStyle();
	const alignEndStyle = useTemplateStyle("alignEnd");
	const inlineItemHeader = useTemplateFeature("inlineItemHeader");

	if (items.length === 0) return null;

	return (
		<SectionShell sectionId={sectionId} title={experience.title}>
			<SectionItems columns={experience.columns}>
				{items.map((item) => {
					const hasPosition = Boolean(item.position.trim());
					const hasLocation = Boolean(item.location.trim());
					const { top: headerLocation, bottom: headerPeriod } = promoteSplitRowRight({
						top: item.location,
						bottom: item.period,
					});

					const renderInlineHeader = () => (
						<InlineItemHeader
							leading={
								hasPosition || hasLocation ? (
									<Text>
										{hasPosition ? item.position : ""}
										{hasPosition && hasLocation ? " " : ""}
										{hasLocation ? `(${item.location})` : ""}
									</Text>
								) : null
							}
							middle={
								<ItemTitle bold={item.mainEntryBold ?? false} website={item.website}>
									{item.company}
								</ItemTitle>
							}
							trailing={<Text style={composeStyles(alignEndStyle)}>{item.period}</Text>}
						/>
					);

					const renderSplitHeader = () => (
						<>
							<View style={composeStyles(splitRowStyle)}>
								<ItemTitle bold={item.mainEntryBold ?? false} website={item.website}>
									{item.company}
								</ItemTitle>
								{hasSplitRowText(headerLocation) && <Text style={composeStyles(alignEndStyle)}>{headerLocation}</Text>}
							</View>

							{(hasPosition || hasSplitRowText(headerPeriod)) && (
								<View style={composeStyles(splitRowStyle)}>
									{hasPosition && <Text>{item.position}</Text>}
									{hasSplitRowText(headerPeriod) && <Text style={composeStyles(alignEndStyle)}>{headerPeriod}</Text>}
								</View>
							)}
						</>
					);

					return (
						<SectionItem key={item.id}>
							<SectionItemHeader>{inlineItemHeader ? renderInlineHeader() : renderSplitHeader()}</SectionItemHeader>

							{item.roles.map((role) => (
								<View key={role.id}>
									<View style={composeStyles(splitRowStyle)}>
										<Text>{role.position}</Text>
										<Text style={composeStyles(alignEndStyle)}>{role.period}</Text>
									</View>
									<RichText>{role.description}</RichText>
								</View>
							))}

							{item.roles.length === 0 && <RichText>{item.description}</RichText>}

							<ItemWebsiteLink website={item.website} />
						</SectionItem>
					);
				})}
			</SectionItems>
		</SectionShell>
	);
};

export const EducationSection = ({ sectionId = "education", sectionData }: ItemSectionProps<EducationItem> = {}) => {
	const data = useRender();
	const education = sectionData ?? data.sections.education;
	const items = getVisibleItems(education, "education");
	const splitRowStyle = useSectionSplitRowStyle();
	const alignEndStyle = useTemplateStyle("alignEnd");
	const inlineItemHeader = useTemplateFeature("inlineItemHeader");

	if (items.length === 0) return null;

	return (
		<SectionShell sectionId={sectionId} title={education.title}>
			<SectionItems columns={education.columns}>
				{items.map((item) => {
					const degreeAndGrade = [item.degree, item.grade].filter(Boolean).join(" • ");
					const locationAndPeriod = [item.location, item.period].filter(Boolean).join(" • ");
					const gradeAndLocation = [item.grade, item.location].filter(Boolean).join(" • ");
					const hasArea = Boolean(item.area.trim());
					const hasDegree = Boolean(item.degree.trim());
					const { top: headerDegreeAndGrade, bottom: headerLocationAndPeriod } = promoteSplitRowRight({
						top: degreeAndGrade,
						bottom: locationAndPeriod,
					});

					const renderInlineHeader = () => (
						<>
							<InlineItemHeader
								leading={
									hasArea || hasDegree ? (
										<Text>
											{hasArea ? item.area : ""}
											{hasArea && hasDegree ? " " : ""}
											{hasDegree ? `(${item.degree})` : ""}
										</Text>
									) : null
								}
								middle={
									<ItemTitle bold={item.mainEntryBold ?? false} website={item.website}>
										{item.school}
									</ItemTitle>
								}
								trailing={<Text style={composeStyles(alignEndStyle)}>{item.period}</Text>}
							/>
							{gradeAndLocation && <Text>{gradeAndLocation}</Text>}
						</>
					);

					const renderSplitHeader = () => (
						<>
							<View style={composeStyles(splitRowStyle)}>
								<ItemTitle bold={item.mainEntryBold ?? false} website={item.website}>
									{item.school}
								</ItemTitle>
								{hasSplitRowText(headerDegreeAndGrade) && (
									<Text style={composeStyles(alignEndStyle)}>{headerDegreeAndGrade}</Text>
								)}
							</View>

							{(hasArea || hasSplitRowText(headerLocationAndPeriod)) && (
								<View style={composeStyles(splitRowStyle)}>
									{hasArea && <Text>{item.area}</Text>}
									{hasSplitRowText(headerLocationAndPeriod) && (
										<Text style={composeStyles(alignEndStyle)}>{headerLocationAndPeriod}</Text>
									)}
								</View>
							)}
						</>
					);

					return (
						<SectionItem key={item.id}>
							<SectionItemHeader>{inlineItemHeader ? renderInlineHeader() : renderSplitHeader()}</SectionItemHeader>

							<RichText>{item.description}</RichText>

							<ItemWebsiteLink website={item.website} />
						</SectionItem>
					);
				})}
			</SectionItems>
		</SectionShell>
	);
};

export const ProjectsSection = ({ sectionId = "projects", sectionData }: ItemSectionProps<ProjectItem> = {}) => {
	const data = useRender();
	const projects = sectionData ?? data.sections.projects;
	const items = getVisibleItems(projects, "projects");
	const splitRowStyle = useSectionSplitRowStyle();
	const alignEndStyle = useTemplateStyle("alignEnd");

	if (items.length === 0) return null;

	return (
		<SectionShell sectionId={sectionId} title={projects.title}>
			<SectionItems columns={projects.columns}>
				{items.map((item) => (
					<SectionItem key={item.id}>
						<SectionItemHeader>
							<View style={composeStyles(splitRowStyle)}>
								<ItemTitle bold={item.mainEntryBold ?? false} website={item.website}>
									{item.name}
								</ItemTitle>
								<Text style={composeStyles(alignEndStyle)}>{item.period}</Text>
							</View>
						</SectionItemHeader>

						<RichText>{item.description}</RichText>

						<ItemWebsiteLink website={item.website} />
					</SectionItem>
				))}
			</SectionItems>
		</SectionShell>
	);
};

export const SkillsSection = ({ sectionId = "skills", sectionData }: ItemSectionProps<SkillItem> = {}) => {
	const data = useRender();
	const skills = sectionData ?? data.sections.skills;
	const items = getVisibleItems(skills, "skills");
	const inlineStyle = useTemplateStyle("inline");
	const metrics = getTemplateMetrics(data.metadata.page);

	if (items.length === 0) return null;

	return (
		<SectionShell sectionId={sectionId} title={skills.title}>
			<SectionItems columns={skills.columns}>
				{items.map((item) => (
					<SectionItem key={item.id} style={{ rowGap: metrics.gapY(0.25) }}>
						<SectionItemHeader>
							<View style={composeStyles(inlineStyle)}>
								<Icon name={item.icon as IconName} />
								<MainEntryText bold={item.mainEntryBold ?? false}>{item.name}</MainEntryText>
							</View>
						</SectionItemHeader>

						<View>
							<Text>{item.proficiency}</Text>
							<Small>{item.keywords.join(", ")}</Small>
						</View>

						<LevelDisplay level={item.level} />
					</SectionItem>
				))}
			</SectionItems>
		</SectionShell>
	);
};

export const LanguagesSection = ({ sectionId = "languages", sectionData }: ItemSectionProps<LanguageItem> = {}) => {
	const data = useRender();
	const languages = sectionData ?? data.sections.languages;
	const items = getVisibleItems(languages, "languages");

	if (items.length === 0) return null;

	return (
		<SectionShell sectionId={sectionId} title={languages.title}>
			<SectionItems columns={languages.columns}>
				{items.map((item) => (
					<SectionItem key={item.id}>
						<SectionItemHeader>
							<Bold>{item.language}</Bold>
							<Text>{item.fluency}</Text>
						</SectionItemHeader>
						<LevelDisplay level={item.level} />
					</SectionItem>
				))}
			</SectionItems>
		</SectionShell>
	);
};

export const InterestsSection = ({ sectionId = "interests", sectionData }: ItemSectionProps<InterestItem> = {}) => {
	const data = useRender();
	const interests = sectionData ?? data.sections.interests;
	const items = getVisibleItems(interests, "interests");
	const inlineStyle = useTemplateStyle("inline");

	if (items.length === 0) return null;

	return (
		<SectionShell sectionId={sectionId} title={interests.title}>
			<SectionItems columns={interests.columns}>
				{items.map((item) => (
					<SectionItem key={item.id}>
						<SectionItemHeader>
							<View style={composeStyles(inlineStyle)}>
								<Icon name={item.icon as IconName} />
								<Bold>{item.name}</Bold>
							</View>
						</SectionItemHeader>

						<Small>{item.keywords.join(", ")}</Small>
					</SectionItem>
				))}
			</SectionItems>
		</SectionShell>
	);
};

export const AwardsSection = ({ sectionId = "awards", sectionData }: ItemSectionProps<AwardItem> = {}) => {
	const data = useRender();
	const awards = sectionData ?? data.sections.awards;
	const items = getVisibleItems(awards, "awards");
	const splitRowStyle = useTemplateStyle("splitRow");
	const alignEndStyle = useTemplateStyle("alignEnd");

	if (items.length === 0) return null;

	return (
		<SectionShell sectionId={sectionId} title={awards.title}>
			<SectionItems columns={awards.columns}>
				{items.map((item) => (
					<SectionItem key={item.id}>
						<SectionItemHeader>
							<View style={composeStyles(splitRowStyle, awardTitleDateRowStyle)}>
								<ItemTitle website={item.website}>{item.title}</ItemTitle>
								<Text style={composeStyles(alignEndStyle)}>{item.date}</Text>
							</View>
							<Text>{item.awarder}</Text>
						</SectionItemHeader>
						<RichText>{item.description}</RichText>

						<ItemWebsiteLink website={item.website} />
					</SectionItem>
				))}
			</SectionItems>
		</SectionShell>
	);
};

export const CertificationsSection = ({
	sectionId = "certifications",
	sectionData,
}: ItemSectionProps<CertificationItem> = {}) => {
	const data = useRender();
	const certifications = sectionData ?? data.sections.certifications;
	const items = getVisibleItems(certifications, "certifications");
	const splitRowStyle = useSectionSplitRowStyle();
	const alignEndStyle = useTemplateStyle("alignEnd");

	if (items.length === 0) return null;

	return (
		<SectionShell sectionId={sectionId} title={certifications.title}>
			<SectionItems columns={certifications.columns}>
				{items.map((item) => (
					<SectionItem key={item.id}>
						<SectionItemHeader>
							<View style={composeStyles(splitRowStyle)}>
								<ItemTitle bold={item.mainEntryBold ?? false} website={item.website}>
									{item.title}
								</ItemTitle>
								<Text style={composeStyles(alignEndStyle)}>{item.date}</Text>
							</View>
							<Text>{item.issuer}</Text>
						</SectionItemHeader>

						<RichText>{item.description}</RichText>

						<ItemWebsiteLink website={item.website} />
					</SectionItem>
				))}
			</SectionItems>
		</SectionShell>
	);
};

export const PublicationsSection = ({
	sectionId = "publications",
	sectionData,
}: ItemSectionProps<PublicationItem> = {}) => {
	const data = useRender();
	const publications = sectionData ?? data.sections.publications;
	const items = getVisibleItems(publications, "publications");
	const splitRowStyle = useSectionSplitRowStyle();
	const alignEndStyle = useTemplateStyle("alignEnd");

	if (items.length === 0) return null;

	return (
		<SectionShell sectionId={sectionId} title={publications.title}>
			<SectionItems columns={publications.columns}>
				{items.map((item) => (
					<SectionItem key={item.id}>
						<SectionItemHeader>
							<View style={composeStyles(splitRowStyle)}>
								<ItemTitle website={item.website}>{item.title}</ItemTitle>
								<Text style={composeStyles(alignEndStyle)}>{item.date}</Text>
							</View>

							<Text>{item.publisher}</Text>
						</SectionItemHeader>

						<RichText>{item.description}</RichText>

						<ItemWebsiteLink website={item.website} />
					</SectionItem>
				))}
			</SectionItems>
		</SectionShell>
	);
};

export const VolunteerSection = ({ sectionId = "volunteer", sectionData }: ItemSectionProps<VolunteerItem> = {}) => {
	const data = useRender();
	const volunteer = sectionData ?? data.sections.volunteer;
	const items = getVisibleItems(volunteer, "volunteer");
	const splitRowStyle = useSectionSplitRowStyle();
	const alignEndStyle = useTemplateStyle("alignEnd");
	const inlineItemHeader = useTemplateFeature("inlineItemHeader");

	if (items.length === 0) return null;

	return (
		<SectionShell sectionId={sectionId} title={volunteer.title}>
			<SectionItems columns={volunteer.columns}>
				{items.map((item) => {
					return (
						<SectionItem key={item.id}>
							<SectionItemHeader>
								{inlineItemHeader ? (
									<InlineItemHeader
										leading={hasSplitRowText(item.location) ? <Text>{item.location}</Text> : null}
										middle={<ItemTitle website={item.website}>{item.organization}</ItemTitle>}
										trailing={<Text style={composeStyles(alignEndStyle)}>{item.period}</Text>}
									/>
								) : (
									<>
										<View style={composeStyles(splitRowStyle)}>
											<ItemTitle website={item.website}>{item.organization}</ItemTitle>
											{hasSplitRowText(item.period) && <Text style={composeStyles(alignEndStyle)}>{item.period}</Text>}
										</View>

										<Text>{item.location}</Text>
									</>
								)}
							</SectionItemHeader>
							<RichText>{item.description}</RichText>

							<ItemWebsiteLink website={item.website} />
						</SectionItem>
					);
				})}
			</SectionItems>
		</SectionShell>
	);
};

export const ReferencesSection = ({ sectionId = "references", sectionData }: ItemSectionProps<ReferenceItem> = {}) => {
	const data = useRender();
	const references = sectionData ?? data.sections.references;
	const items = getVisibleItems(references, "references");

	if (items.length === 0) return null;

	return (
		<SectionShell sectionId={sectionId} title={references.title}>
			<SectionItems columns={references.columns}>
				{items.map((item) => (
					<SectionItem key={item.id}>
						<SectionItemHeader>
							<ItemTitle website={item.website}>{item.name}</ItemTitle>
							<Text>{item.position}</Text>
							<Text>{item.phone}</Text>
						</SectionItemHeader>
						<RichText>{item.description}</RichText>

						<ItemWebsiteLink website={item.website} />
					</SectionItem>
				))}
			</SectionItems>
		</SectionShell>
	);
};

const CoverLetterSection = ({ section }: CoverLetterSectionProps) => {
	const items = getVisibleItems(section);

	if (items.length === 0) return null;

	return (
		<SectionShell sectionId={section.id} title={section.title} showHeading={false}>
			<SectionItems>
				{items.map((item) => (
					<SectionItem key={item.id}>
						<RichText>{item.recipient}</RichText>
						<RichText>{item.content}</RichText>
					</SectionItem>
				))}
			</SectionItems>
		</SectionShell>
	);
};

export const CustomSection = ({ sectionId, showHeading = true }: CustomSectionProps) => {
	const data = useRender();
	const customSection = data.customSections.find((section) => section.id === sectionId);

	if (!customSection) return null;

	return match(customSection.type)
		.with("summary", () => (
			<CustomSummarySection section={customSection as CustomItemSection<SummaryItem>} showHeading={showHeading} />
		))
		.with("profiles", () => (
			<ProfileSection sectionId={sectionId} sectionData={customSection as CustomItemSection<ProfileItem>} />
		))
		.with("experience", () => (
			<ExperienceSection sectionId={sectionId} sectionData={customSection as CustomItemSection<ExperienceItem>} />
		))
		.with("education", () => (
			<EducationSection sectionId={sectionId} sectionData={customSection as CustomItemSection<EducationItem>} />
		))
		.with("projects", () => (
			<ProjectsSection sectionId={sectionId} sectionData={customSection as CustomItemSection<ProjectItem>} />
		))
		.with("skills", () => (
			<SkillsSection sectionId={sectionId} sectionData={customSection as CustomItemSection<SkillItem>} />
		))
		.with("languages", () => (
			<LanguagesSection sectionId={sectionId} sectionData={customSection as CustomItemSection<LanguageItem>} />
		))
		.with("interests", () => (
			<InterestsSection sectionId={sectionId} sectionData={customSection as CustomItemSection<InterestItem>} />
		))
		.with("awards", () => (
			<AwardsSection sectionId={sectionId} sectionData={customSection as CustomItemSection<AwardItem>} />
		))
		.with("certifications", () => (
			<CertificationsSection
				sectionId={sectionId}
				sectionData={customSection as CustomItemSection<CertificationItem>}
			/>
		))
		.with("publications", () => (
			<PublicationsSection sectionId={sectionId} sectionData={customSection as CustomItemSection<PublicationItem>} />
		))
		.with("volunteer", () => (
			<VolunteerSection sectionId={sectionId} sectionData={customSection as CustomItemSection<VolunteerItem>} />
		))
		.with("references", () => (
			<ReferencesSection sectionId={sectionId} sectionData={customSection as CustomItemSection<ReferenceItem>} />
		))
		.with("cover-letter", () => <CoverLetterSection section={customSection as CustomItemSection<CoverLetterItem>} />)
		.exhaustive();
};
