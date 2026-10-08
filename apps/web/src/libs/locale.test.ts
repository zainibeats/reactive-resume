// @vitest-environment happy-dom

import { describe, expect, it } from "vitest";
import { getLocaleMessages } from "./locale";

// Messages added by this fork may be missing from community catalogs; untranslated entries fall back to English
// instead of rendering a hashed message id.
describe("getLocaleMessages", () => {
	it("loads locale messages without empty entries", async () => {
		const { locale, messages } = await getLocaleMessages("en-GB");

		expect(locale).toBe("en-GB");
		expect(
			Object.values(messages).some((message) => message === "" || (Array.isArray(message) && message.length === 0)),
		).toBe(false);
	});
});
