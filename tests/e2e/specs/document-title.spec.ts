import type { Page } from "@playwright/test";
import { expect, test } from "../fixtures/test";

async function rename(page: Page, name: string) {
	await page.getByRole("button", { name: /^Document menu:/ }).click();
	await page.getByRole("menuitem", { name: "Rename…", exact: true }).click();
	const dialog = page.getByRole("dialog", { name: "Update resume", exact: true });
	await dialog.getByRole("textbox", { name: "Name", exact: true }).fill(name);
	await dialog.getByRole("button", { name: "Save changes", exact: true }).click();
}

test("resume title follows successful renames across modes, documents and reloads", async ({ authPage: page }) => {
	test.setTimeout(60_000);
	const created = await page.request.post("/api/openapi/resumes", {
		data: { name: "Original document", tags: [], autoName: true },
	});
	await expect(created).toBeOK();
	const id: string = await created.json();
	await page.goto(`/builder/${id}`);
	await expect(page).toHaveTitle("Original document - Reactive Resume");

	await page.getByRole("textbox", { name: "Headline", exact: true }).fill("Automatic headline");
	await expect(page).toHaveTitle("Automatic headline - Reactive Resume");

	await rename(page, "Renamed document");
	await expect(page).toHaveTitle("Renamed document - Reactive Resume");
	await page.getByRole("tab", { name: "Design", exact: true }).click();
	await expect(page).toHaveTitle("Renamed document - Reactive Resume");
	await page.getByRole("tab", { name: "Write", exact: true }).click();

	const updateUrl = "**/api/rpc/resume/update";
	await page.route(updateUrl, (route) => route.abort("failed"));
	const failed = page.waitForEvent("requestfailed", { predicate: (request) => request.url().endsWith("/update") });
	await rename(page, "Rejected document");
	await failed;
	expect(await page.title()).toBe("Renamed document - Reactive Resume");
	await page.unroute(updateUrl);
	const dialog = page.getByRole("dialog", { name: "Update resume", exact: true });
	await dialog.getByRole("textbox", { name: "Name", exact: true }).fill("Renamed again");
	await dialog.getByRole("button", { name: "Save changes", exact: true }).click();
	const savedName = "Renamed again";
	await expect(page).toHaveTitle(`${savedName} - Reactive Resume`);

	const saved = page.waitForResponse((response) => response.url().endsWith("/resume/update") && response.ok());
	await page.getByRole("textbox", { name: "Headline", exact: true }).fill("Later headline");
	await saved;
	await expect(page).toHaveTitle(`${savedName} - Reactive Resume`);

	const second = await page.request.post("/api/openapi/resumes", { data: { name: "Second document", tags: [] } });
	await expect(second).toBeOK();
	await page.getByRole("link", { name: "Back to documents", exact: true }).click();
	await page.getByRole("link", { name: "Second document", exact: true }).click();
	await expect(page).toHaveTitle("Second document - Reactive Resume");
	await page.getByRole("link", { name: "Back to documents", exact: true }).click();
	await page.getByRole("link", { name: savedName, exact: true }).click();
	await expect(page).toHaveTitle(`${savedName} - Reactive Resume`);
	await page.reload();
	await expect(page).toHaveTitle(`${savedName} - Reactive Resume`);
});
