import type { RouterOutput } from "@/libs/orpc/client";
import { strToU8, zipSync } from "fflate";
import { slugify } from "@reactive-resume/utils/string";

type AccountExport = RouterOutput["auth"]["exportData"];

const json = (value: unknown) => strToU8(`${JSON.stringify(value, null, 2)}\n`);

// The whole id keeps two documents with the same name apart. Ids are UUIDv7, so a prefix is only a timestamp and repeats.
const fileName = (name: string, id: string) => `${slugify(name)}-${id}.json`;

/**
 * "Export everything": one zip with the account and each resume as its own JSON file.
 * Extract the archive to import individual resumes; the account file is a record.
 */
export function buildAccountZip(data: AccountExport): Uint8Array {
	const files: Record<string, Uint8Array> = {
		"account.json": json({ exportedAt: data.exportedAt, user: data.user }),
	};
	for (const resume of data.resumes) files[`resumes/${fileName(resume.name, resume.id)}`] = json(resume);
	return zipSync(files);
}
