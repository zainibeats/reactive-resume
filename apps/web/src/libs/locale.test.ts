import { describe, expect, it } from "vitest";
import { getLocaleMessages } from "./locale";

describe("getLocaleMessages", () => {
	it("fills missing locale messages from the English source catalog", async () => {
		const { locale, messages } = await getLocaleMessages("en-GB");

		expect(locale).toBe("en-GB");
		expect(Object.values(messages).some((message) => Array.isArray(message) && message.includes("Apply updates"))).toBe(
			true,
		);
		expect(
			Object.values(messages).some((message) => message === "" || (Array.isArray(message) && message.length === 0)),
		).toBe(false);
	});
});
