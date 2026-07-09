import { describe, expect, it } from "vitest";
import { getLocaleMessages } from "./locale";

describe("getLocaleMessages", () => {
	it("loads locale messages without empty entries", async () => {
		const { locale, messages } = await getLocaleMessages("en-GB");

		expect(locale).toBe("en-GB");
		expect(
			Object.values(messages).some((message) => message === "" || (Array.isArray(message) && message.length === 0)),
		).toBe(false);
	});
});
