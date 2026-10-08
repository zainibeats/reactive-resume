import { beforeAll, describe, expect, it } from "vitest";
import { i18n } from "@lingui/core";
import { strFromU8, unzipSync } from "fflate";
import { defaultResumeData } from "@reactive-resume/schema/resume/default";
import { buildAccountZip } from "./export";
import { detectImportKind, detectJsonImportKind, parseResumeJson } from "@/features/resume/import/read-file";

beforeAll(() => i18n.loadAndActivate({ locale: "en-US", messages: {} }));

describe("buildAccountZip", () => {
	it("explains how to restore documents instead of treating an account zip as LinkedIn", async () => {
		const archive = buildAccountZip({ user: {}, resumes: [] } as never);
		await expect(detectImportKind(new File([new Uint8Array(archive)], "reactive-resume.zip"))).rejects.toThrow(
			"Extract this account archive",
		);
	});
	it("exports individual documents that the importer accepts", () => {
		const files = unzipSync(
			buildAccountZip({
				exportedAt: "2026-09-30T00:00:00.000Z",
				user: {},
				resumes: [{ id: "r1", name: "Resume", data: defaultResumeData }],
			} as never),
		);
		const resumeText = strFromU8(files["resumes/resume-r1.json"] as Uint8Array);
		expect(detectJsonImportKind(JSON.parse(resumeText))).toBe("reactive-resume-json");
		expect(parseResumeJson(resumeText, "reactive-resume-json").basics).toEqual(defaultResumeData.basics);
	});
	it("puts the account and each resume in their own files", () => {
		const zip = buildAccountZip({
			exportedAt: "2026-09-29T00:00:00.000Z",
			user: { id: "u1", name: "Dana" },
			// UUIDv7 ids created seconds apart share their leading (timestamp) characters.
			resumes: [
				{ id: "01a0ec71-03e8-77b1-a5e4-ce04be126204", name: "Product Designer" },
				{ id: "01a0ec71-32c8-728b-b43b-b760a673b825", name: "Product Designer" },
			],
		} as never);

		const files = unzipSync(zip);
		expect(Object.keys(files).sort()).toEqual([
			"account.json",
			"resumes/product-designer-01a0ec71-03e8-77b1-a5e4-ce04be126204.json",
			"resumes/product-designer-01a0ec71-32c8-728b-b43b-b760a673b825.json",
		]);
		expect(JSON.parse(strFromU8(files["account.json"] as Uint8Array))).toEqual({
			exportedAt: "2026-09-29T00:00:00.000Z",
			user: { id: "u1", name: "Dana" },
		});
	});
});
