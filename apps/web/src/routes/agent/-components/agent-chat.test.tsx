// @vitest-environment happy-dom

import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AssistantMarkdown } from "./agent-chat";

describe("AssistantMarkdown", () => {
	it("renders GitHub-style pipe tables as tables", () => {
		render(
			<AssistantMarkdown
				text={
					"Before\n\n| Weak/Generic | Improved Version |\n| --- | --- |\n| Placeholder text | Mentored 3+ juniors |\n| Worked closely | Collaborated with 6+ artists |\n\nAfter"
				}
			/>,
		);

		const table = screen.getByRole("table");

		expect(within(table).getByRole("columnheader", { name: "Weak/Generic" })).toBeInTheDocument();
		expect(within(table).getByRole("columnheader", { name: "Improved Version" })).toBeInTheDocument();
		expect(within(table).getByRole("cell", { name: "Mentored 3+ juniors" })).toBeInTheDocument();
		expect(screen.getByText("Before")).toBeInTheDocument();
		expect(screen.getByText("After")).toBeInTheDocument();
	});
});
