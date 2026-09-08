import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { Pool } from "pg";
import { expect, test } from "../fixtures/test";

// Upstream seeds a second account here to prove the export only returns owned rows.
// Single-owner auth makes that impossible in this fork: sign-up is rejected once an
// owner exists, and `user_single_owner_idx` blocks a direct insert too. Every
// application handler scopes its query to `context.user.id`, so ownership stays a
// server-side concern; this spec covers the search, archived and date filters.
test("exports filtered or all owned applications with an inclusive date range", async ({
	authPage: page,
	account,
}, testInfo) => {
	const pool = new Pool({ connectionString: process.env.DATABASE_URL });
	try {
		for (const [email, company, date, archived] of [
			[account.email, "Alpha Company", "2026-08-03T00:00:00Z", false],
			[account.email, "Beta Archived", "2026-08-03T23:59:59Z", true],
			[account.email, "Gamma Later", "2026-08-04T00:00:00Z", false],
		] as const) {
			await pool.query(
				`INSERT INTO application (id,user_id,company,role,status,applied_at,archived,notes,activity)
				 SELECT $1,id,$2,'Engineer','applied',$3,$4,$5,$6 FROM "user" WHERE email=$7`,
				[
					randomUUID(),
					company,
					date,
					archived,
					'Quoted "note"\nSecond line',
					JSON.stringify([{ id: randomUUID(), type: "stage", stage: "applied", at: date }]),
					email,
				],
			);
		}
		await page.goto("/dashboard/applications");
		await page.getByPlaceholder("Search saved jobs…").fill("Alpha");
		await page.getByRole("button", { name: "Export CSV", exact: true }).click();
		const sheet = page.getByRole("dialog", { name: "Export applications" });
		await sheet.getByLabel("Application date from").fill("2026-08-03");
		await sheet.getByLabel("Application date to").fill("2026-08-03");
		await expect(sheet.getByText("1 application to export")).toBeVisible();
		let downloadPromise = page.waitForEvent("download");
		await sheet.getByRole("button", { name: "Download CSV" }).click();
		let download = await downloadPromise;
		let path = await download.path();
		if (!path) throw new Error("CSV download was not saved");
		let csv = await readFile(path, "utf8");
		expect(csv).toContain('"Alpha Company"');
		expect(csv).not.toMatch(/Beta Archived|Gamma Later/);
		expect(csv).toContain('"Applied (2026-08-03)"');
		expect(csv).toContain('"Quoted ""note""\nSecond line"');

		await page.getByRole("button", { name: "Export CSV", exact: true }).click();
		await sheet.getByLabel("Applications to export").click();
		await page.getByRole("option", { name: "All applications (including archived)" }).click();
		await expect(sheet.getByText("2 applications to export")).toBeVisible();
		await sheet.getByLabel("Application date from").fill("2026-08-04");
		await expect(sheet.getByRole("button", { name: "Download CSV" })).toBeDisabled();
		await sheet.getByLabel("Application date from").fill("2026-08-03");
		downloadPromise = page.waitForEvent("download");
		await sheet.getByRole("button", { name: "Download CSV" }).click();
		download = await downloadPromise;
		path = await download.path();
		if (!path) throw new Error("CSV download was not saved");
		csv = await readFile(path, "utf8");
		expect(csv).toContain('"Alpha Company"');
		expect(csv).toContain('"Beta Archived"');
		expect(csv).not.toMatch(/Gamma Later/);
		await page.setViewportSize({ width: 390, height: 844 });
		await page.reload();
		await expect(page.getByRole("heading", { name: "Job Search", exact: true })).toBeVisible();
		const title = await page.getByRole("heading", { name: "Job Search", exact: true }).boundingBox();
		const exportButton = await page.getByRole("button", { name: "Export CSV", exact: true }).boundingBox();
		if (!title || !exportButton) throw new Error("Application header is not visible");
		const overlaps =
			title.x < exportButton.x + exportButton.width &&
			title.x + title.width > exportButton.x &&
			title.y < exportButton.y + exportButton.height &&
			title.y + title.height > exportButton.y;
		expect(overlaps).toBe(false);
		await page.screenshot({ path: testInfo.outputPath("mobile-header.png"), animations: "disabled" });
		await page.getByRole("button", { name: "Export CSV", exact: true }).click();
		await expect(sheet.getByRole("button", { name: "Download CSV" })).toBeVisible();
		await page.screenshot({ path: testInfo.outputPath("mobile-export.png"), animations: "disabled" });
	} finally {
		await pool.end();
	}
});
