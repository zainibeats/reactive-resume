import { describe, expect, it } from "vitest";
import { createNoindexFollowMeta } from "./seo";

describe("createNoindexFollowMeta", () => {
	it("returns the robots noindex metadata used by private app surfaces", () => {
		expect(createNoindexFollowMeta()).toEqual({ name: "robots", content: "noindex, follow" });
	});
});
