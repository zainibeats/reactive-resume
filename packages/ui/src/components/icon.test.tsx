import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import manifest from "../icons/material-symbols-rounded.json";
import { iconNames } from "../icons/names";
import { Icon } from "./icon";

describe("Icon", () => {
	it("keeps its glyph when a caller passes its own data-icon", () => {
		const { container } = render(<Icon name="undo" {...{ "data-icon": "inline-start" }} />);
		expect(container.querySelector('[data-slot="icon"]')).toHaveAttribute("data-icon", "undo");
	});
});

describe("Material Symbols subset", () => {
	it("was built from the current icon list (run `pnpm icons:build` after editing it)", () => {
		expect(manifest.names).toEqual([...iconNames].sort());
	});
});
