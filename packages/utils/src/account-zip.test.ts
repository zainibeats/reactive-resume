import { expect, it } from "vite-plus/test";
import { strFromU8, unzipSync } from "fflate";
import { accountBackupLimits, AccountExportLimitError, buildAccountZip } from "./account-zip";

const base = { exportedAt: "2030-01-01T00:00:00.000Z", user: { id: "owner" }, resumes: [] };

it("preserves binary files, individual raw versions and omission reasons in an offline archive", () => {
	const version = { id: "v1", resumeId: "resume", data: { historicalField: "Preserve verbatim" } };
	const files = unzipSync(
		buildAccountZip({
			...base,
			resumes: [{ id: "resume", name: "My Resume" }],
			documentVersions: { resumes: [version] },
			uploads: {
				files: [{ key: "uploads/owner/pictures/photo.png", base64: "AP9QSw==" }],
				skipped: [{ key: "uploads/owner/pictures/large.pdf", reason: "file-limit" }],
			},
		}),
	);
	expect(Object.keys(files)).toContain("resumes/my-resume-resume.json");
	expect(files["uploads/owner/pictures/photo.png"]).toEqual(new Uint8Array([0, 255, 80, 75]));
	expect(JSON.parse(strFromU8(files["versions/resumes/resume/v1.json"] ?? new Uint8Array()))).toEqual(version);
	expect(JSON.parse(strFromU8(files["upload-manifest.json"] ?? new Uint8Array()))).toMatchObject({
		included: [{ key: "uploads/owner/pictures/photo.png", path: "uploads/owner/pictures/photo.png", bytes: 4 }],
		skipped: [{ key: "uploads/owner/pictures/large.pdf", reason: "file-limit" }],
	});
});

it.each([
	"uploads/neighbor/pictures/photo.png",
	"uploads/owner/../escape",
	"uploads/owner/%2e%2e/escape",
	"uploads/owner/a\\b",
	"/uploads/owner/photo.png",
])("refuses unsafe or foreign archive path %s", (key) => {
	expect(() => buildAccountZip({ ...base, uploads: { files: [{ key, base64: "AA==" }], skipped: [] } })).toThrow(
		"Invalid account upload path",
	);
});

it("encodes document/version identifiers so they cannot create traversal paths", () => {
	const files = unzipSync(
		buildAccountZip({
			...base,
			resumes: [{ id: "../../escape", name: "../../Resume" }],
			documentVersions: { resumes: [{ id: "../version", resumeId: "../resume" }] },
		}),
	);
	expect(Object.keys(files)).toContain("resumes/resume-%2E%2E%2F%2E%2E%2Fescape.json");
	expect(Object.keys(files)).toContain("versions/resumes/%2E%2E%2Fresume/%2E%2E%2Fversion.json");
	expect(Object.keys(files).every((path) => !path.split("/").includes(".."))).toBe(true);
});

it("fails visibly instead of emitting a partial or unbounded archive", () => {
	expect(() =>
		buildAccountZip({ ...base, resumes: [{ id: "r", name: "x".repeat(accountBackupLimits.archiveBytes) }] }),
	).toThrow(AccountExportLimitError);
});
