import type { LanguageItem, ProfileItem, ResumeData } from "@reactive-resume/schema/resume/data";
import type { StylesheetMode } from "@reactive-resume/schema/resume/stylesheet";
import { describe, expect, it } from "vitest";
import { pdf } from "@react-pdf/renderer";
import { createElement } from "react";
import { defaultResumeData } from "@reactive-resume/schema/resume/default";
import { ResumeDocument } from "../../document";

type HostNode = {
	type: string;
	props?: Record<string, unknown>;
	style?: unknown;
	value?: string;
	children?: HostNode[];
};

type RenderedLink = { src: unknown; text: string };

const nodeText = (node: HostNode): string =>
	node.value ?? (node.children ?? []).map((child) => nodeText(child)).join("");

const collectLinks = (node: HostNode, out: RenderedLink[] = []): RenderedLink[] => {
	if (node.type === "LINK") out.push({ src: node.props?.src, text: nodeText(node) });
	for (const child of node.children ?? []) collectLinks(child, out);
	return out;
};

const findText = (node: HostNode, text: string): HostNode | undefined => {
	if (node.type === "TEXT" && nodeText(node) === text) return node;
	for (const child of node.children ?? []) {
		const match = findText(child, text);
		if (match) return match;
	}
};

const mergedStyle = (node: HostNode | undefined): Record<string, unknown> =>
	Object.assign({}, ...(Array.isArray(node?.style) ? node.style : node?.style ? [node.style] : []));

const profileItem = (id: string, overrides: Partial<ProfileItem>): ProfileItem => ({
	id,
	hidden: false,
	icon: "github-logo",
	iconColor: "",
	network: `Network ${id}`,
	username: "",
	website: { url: `https://example.com/${id}`, label: "", inlineLink: false },
	...overrides,
});

const renderResume = async (data: ResumeData, mode: StylesheetMode) => {
	data.picture.hidden = true;
	data.metadata.stylesheet = { mode, source: { languageVersion: 1, text: "@version 1;" } };

	const element = createElement(ResumeDocument, { data, template: "glalie" }) as unknown as Parameters<typeof pdf>[0];
	const instance = pdf(element);
	await expect.poll(() => instance.container.document).not.toBeNull();

	return instance.container.document as HostNode;
};

const renderProfiles = (items: ProfileItem[], mode: StylesheetMode) => {
	const data = structuredClone(defaultResumeData) as ResumeData;
	data.metadata.layout.pages = [{ fullWidth: true, main: ["profiles"], sidebar: [] }];
	data.sections.profiles.items = items;
	return renderResume(data, mode);
};

const renderLanguages = (items: LanguageItem[], mode: StylesheetMode) => {
	const data = structuredClone(defaultResumeData) as ResumeData;
	data.metadata.layout.pages = [{ fullWidth: true, main: ["languages"], sidebar: [] }];
	data.sections.languages.items = items;
	return renderResume(data, mode);
};

describe.each(["legacy", "semantic"] as const)("profile links in %s mode", (mode) => {
	// A profile with no username used to wrap an empty <Text> in the link, leaving nothing to click.
	it("links the network name when 'Show link in title' is on", async () => {
		const document = await renderProfiles(
			[
				profileItem("a", {
					network: "GitHub",
					website: { url: "https://github.com/x", label: "View", inlineLink: true },
				}),
			],
			mode,
		);

		expect(collectLinks(document)).toEqual([{ src: "https://github.com/x", text: "GitHub" }]);
	});

	it("falls back to the link label, then the url, when the username is empty", async () => {
		const document = await renderProfiles(
			[
				profileItem("a", {
					network: "Spotify",
					website: { url: "https://spotify.com/x", label: "Listen", inlineLink: false },
				}),
				profileItem("b", {
					network: "Bandcamp",
					website: { url: "https://bandcamp.com/x", label: "", inlineLink: false },
				}),
			],
			mode,
		);

		expect(collectLinks(document)).toEqual([
			{ src: "https://spotify.com/x", text: "Listen" },
			{ src: "https://bandcamp.com/x", text: "https://bandcamp.com/x" },
		]);
	});

	it("keeps the username as the link text when one is set", async () => {
		const document = await renderProfiles(
			[
				profileItem("a", {
					network: "GitHub",
					username: "octocat",
					website: { url: "https://github.com/octocat", label: "", inlineLink: false },
				}),
			],
			mode,
		);

		expect(collectLinks(document)).toEqual([{ src: "https://github.com/octocat", text: "octocat" }]);
	});

	it("renders no link when the profile has no url", async () => {
		const document = await renderProfiles(
			[
				profileItem("a", {
					network: "Discord",
					username: "octocat#1234",
					website: { url: "", label: "", inlineLink: false },
				}),
			],
			mode,
		);

		expect(collectLinks(document)).toEqual([]);
		expect(findText(document, "octocat#1234")).toBeDefined();
	});

	it("honors the mainEntryBold toggle on the network name", async () => {
		const document = await renderProfiles(
			[
				profileItem("a", { network: "Bold Network", mainEntryBold: true }),
				profileItem("b", { network: "Plain Network", mainEntryBold: false }),
			],
			mode,
		);

		expect(mergedStyle(findText(document, "Bold Network")).fontWeight).toBe(700);
		expect(mergedStyle(findText(document, "Plain Network")).fontWeight).toBe("400");
	});
});

describe.each(["legacy", "semantic"] as const)("language names in %s mode", (mode) => {
	it("honors the mainEntryBold toggle on the language name", async () => {
		const document = await renderLanguages(
			[
				{ id: "a", hidden: false, language: "Bold Tongue", fluency: "Native", level: 0, mainEntryBold: true },
				{ id: "b", hidden: false, language: "Plain Tongue", fluency: "Fluent", level: 0, mainEntryBold: false },
			],
			mode,
		);

		expect(mergedStyle(findText(document, "Bold Tongue")).fontWeight).toBe(700);
		expect(mergedStyle(findText(document, "Plain Tongue")).fontWeight).toBe("400");
	});
});
