import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";
import { buildGeneratedDocumentation } from "./generate-reference";

const skillSchemaReference = fileURLToPath(
	new URL("../../skills/resume-builder/references/schema.md", import.meta.url),
);

it("keeps the committed skill schema reference synchronized", async () => {
	expect(buildGeneratedDocumentation()).toEqual({
		skillSchemaReference: await readFile(skillSchemaReference, "utf8"),
	});
});
