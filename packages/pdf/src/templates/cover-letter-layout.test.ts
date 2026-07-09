import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const pageFiles = [
	"azurill/AzurillPage.tsx",
	"bronzor/BronzorPage.tsx",
	"chikorita/ChikoritaPage.tsx",
	"ditgar/DitgarPage.tsx",
	"ditto/DittoPage.tsx",
	"gengar/GengarPage.tsx",
	"glalie/GlaliePage.tsx",
	"kakuna/KakunaPage.tsx",
	"lapras/LaprasPage.tsx",
	"leafish/LeafishPage.tsx",
	"meowth/MeowthPage.tsx",
	"onyx/OnyxPage.tsx",
	"pikachu/PikachuPage.tsx",
	"rhyhorn/RhyhornPage.tsx",
	"scizor/ScizorPage.tsx",
];

const readTemplate = (file: string) => {
	const path = fileURLToPath(new URL(file, import.meta.url));
	return readFileSync(path, "utf8");
};

describe("cover letter PDF layout", () => {
	it.each(pageFiles)("%s suppresses the resume header for cover-letter-only documents", (file) => {
		const source = readTemplate(file);

		expect(source, basename(file)).toContain('from "../shared/cover-letter"');
		expect(source, basename(file)).toContain("shouldShowResumeHeader(data, pageIndex)");
		expect(source, basename(file)).not.toContain("const showHeader = pageIndex === 0;");
	});
});
