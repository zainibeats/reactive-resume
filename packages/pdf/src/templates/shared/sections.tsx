import type { TemplatePlacement } from "./styles";
import { match } from "ts-pattern";
import { useRender } from "../../context";
import { SectionStyleProvider, TemplatePlacementProvider } from "./context";
import { isSectionVisible } from "./filtering";
import {
	AwardsSection,
	CertificationsSection,
	CustomSection,
	EducationSection,
	ExperienceSection,
	InterestsSection,
	LanguagesSection,
	ProfileSection,
	ProjectsSection,
	PublicationsSection,
	ReferencesSection,
	SkillsSection,
	SummarySection,
	VolunteerSection,
} from "./section-renderers";
import { getSectionStyleRuleContext } from "./style-rules";

type SectionProps = {
	section: string;
	placement: TemplatePlacement;
	showHeading?: boolean;
};

export const Section = ({ section, placement, showHeading = true }: SectionProps) => {
	const data = useRender();

	if (!isSectionVisible(section, data)) return null;

	return (
		<TemplatePlacementProvider placement={placement}>
			<SectionStyleProvider context={getSectionStyleRuleContext(data, section)}>
				{match(section)
					.with("summary", () => <SummarySection showHeading={showHeading} />)
					.with("profiles", () => <ProfileSection />)
					.with("experience", () => <ExperienceSection />)
					.with("education", () => <EducationSection />)
					.with("projects", () => <ProjectsSection />)
					.with("skills", () => <SkillsSection />)
					.with("languages", () => <LanguagesSection />)
					.with("interests", () => <InterestsSection />)
					.with("awards", () => <AwardsSection />)
					.with("certifications", () => <CertificationsSection />)
					.with("publications", () => <PublicationsSection />)
					.with("volunteer", () => <VolunteerSection />)
					.with("references", () => <ReferencesSection />)
					.otherwise(() => (
						<CustomSection sectionId={section} showHeading={showHeading} />
					))}
			</SectionStyleProvider>
		</TemplatePlacementProvider>
	);
};
