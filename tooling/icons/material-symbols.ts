/**
 * Builds the self-hosted Material Symbols Rounded subset used by `@reactive-resume/ui`'s `Icon`.
 *
 * Google Fonts silently ignores unknown names in `icon_names`, so names are checked against the
 * font's published codepoints first. Axes match the design system: weight 300, grade 0, optical
 * size 20–24 and FILL 0–1 (filled icons mark the selected navigation item).
 */
import { readFile, writeFile } from "node:fs/promises";

const CODEPOINTS_URL =
	"https://raw.githubusercontent.com/google/material-design-icons/master/variablefont/MaterialSymbolsRounded%5BFILL,GRAD,opsz,wght%5D.codepoints";
const FAMILY = "Material+Symbols+Rounded:opsz,wght,FILL,GRAD@20..24,300,0..1,0";
// A current Chrome user agent makes Google Fonts answer with WOFF2.
const USER_AGENT =
	"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

const namesFile = new URL("../../packages/ui/src/icons/names.ts", import.meta.url);
const fontFile = new URL("../../packages/ui/src/icons/material-symbols-rounded.woff2", import.meta.url);
const manifestFile = new URL("../../packages/ui/src/icons/material-symbols-rounded.json", import.meta.url);

const fetchOk = async (url: string, init?: RequestInit) => {
	const response = await fetch(url, init);
	if (!response.ok) throw new Error(`${response.status} ${response.statusText} for ${url}`);
	return response;
};

// Tooling can't depend on the browser-only UI package, so the list is read from its source: one
// quoted name per line inside the `iconNames` array.
const names = [...(await readFile(namesFile, "utf8")).matchAll(/^\t"([a-z0-9_]+)",$/gm)].map(
	(match) => match[1] as string,
);
if (names.length === 0) throw new Error("No icon names found in packages/ui/src/icons/names.ts");
names.sort();
const known = new Set(
	(await (await fetchOk(CODEPOINTS_URL)).text())
		.split("\n")
		.map((line) => line.split(" ")[0])
		.filter(Boolean),
);
const unknown = names.filter((name) => !known.has(name));
if (unknown.length > 0) throw new Error(`Not Material Symbols icons: ${unknown.join(", ")}`);

const cssUrl = `https://fonts.googleapis.com/css2?family=${FAMILY}&icon_names=${names.join(",")}&display=block`;
const css = await (await fetchOk(cssUrl, { headers: { "User-Agent": USER_AGENT } })).text();
const woff2Url = css.match(/src:\s*url\(([^)]+)\)\s*format\('woff2'\)/)?.[1];
if (!woff2Url) throw new Error(`No WOFF2 source in the Google Fonts response:\n${css}`);

const font = new Uint8Array(await (await fetchOk(woff2Url)).arrayBuffer());
await writeFile(fontFile, font);
await writeFile(manifestFile, `${JSON.stringify({ names }, null, "\t")}\n`);
console.log(`Wrote ${names.length} icons (${(font.byteLength / 1024).toFixed(1)} KB).`);
