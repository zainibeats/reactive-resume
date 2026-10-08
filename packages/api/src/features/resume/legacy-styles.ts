import type { SemanticStylesheet } from "@reactive-resume/schema/resume/stylesheet";
import { convertLegacyStylesheet, needsLegacyStyleConversion } from "@reactive-resume/pdf/semantic-legacy";
import { parseResumeData } from "@reactive-resume/schema/resume/data";

type Metadata = { stylesheet?: unknown; styleRules?: unknown };

/** A stored resume's new stylesheet, or null when it needs none. Throws when the stored data doesn't parse. */
export function migrateResumeStylesheet(data: unknown): SemanticStylesheet | null {
	if (!needsLegacyStyleConversion((data as { metadata?: Metadata } | null)?.metadata)) return null;
	return convertLegacyStylesheet(parseResumeData(data));
}
