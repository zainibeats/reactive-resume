import { describe, expect, it } from "vitest";
import { mapCsvToApplications, parseCsv, rowsToCsv } from "./csv";

describe("parseCsv", () => {
	it("parses quoted fields with commas and newlines", () => {
		const table = parseCsv('Company,Role\n"Acme, Inc.","Eng, Sr"\nBeta,"Line1\nLine2"');
		expect(table[1]).toEqual(["Acme, Inc.", "Eng, Sr"]);
		expect(table[2]).toEqual(["Beta", "Line1\nLine2"]);
	});
});

describe("mapCsvToApplications", () => {
	it("maps aliased headers and coerces status/tags", () => {
		const csv =
			'Company,Job Title,Stage,Stage Date,Salary,Tags,Contact Name,Contact Email,Contact Phone\nStripe,Frontend,Interview,2026-07-01,$180k,"remote;react",Jane Doe,jane@example.com,+1 555 0100';
		const { rows, recognized } = mapCsvToApplications(parseCsv(csv));
		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({
			company: "Stripe",
			role: "Frontend",
			status: "interview",
			stageEnteredAt: "2026-07-01",
			salary: "$180k",
			tags: ["remote", "react"],
			contacts: [{ name: "Jane Doe", role: "", type: "", email: "jane@example.com", phone: "+1 555 0100" }],
		});
		expect(recognized).toEqual(
			expect.arrayContaining(["company", "role", "status", "stageEnteredAt", "salary", "tags", "contactEmail"]),
		);
	});

	it("skips rows missing company or role and drops invalid status", () => {
		const csv =
			"company,role,status,stage date\nStripe,Eng,bogus,2026-99-99\n,NoCompany,applied,2026-07-01\nAcme,,saved,2026-07-01";
		const { rows, skipped } = mapCsvToApplications(parseCsv(csv));
		expect(rows).toHaveLength(1);
		expect(rows[0]?.status).toBeUndefined(); // "bogus" dropped
		expect(rows[0]?.stageEnteredAt).toBeUndefined(); // invalid date dropped
		expect(skipped).toBe(2);
	});

	it("keeps the application and drops only the contact when the email is malformed", () => {
		const { rows, skipped, contactsSkipped } = mapCsvToApplications(
			parseCsv("Company,Role,Contact Name,Contact Email\nStripe,Eng,Jane Doe,not-an-email"),
		);

		expect(rows).toHaveLength(1);
		expect(rows[0]?.company).toBe("Stripe");
		expect(rows[0]?.contacts).toBeUndefined();
		expect(skipped).toBe(0);
		expect(contactsSkipped).toBe(1);
	});
});

describe("column matching", () => {
	const table = parseCsv(
		"Employer,Job Title,Status,Archived,Mystery\nAcme,Designer,rejected,false,x\nKiln,Engineer,applied,true,y\n,No company,saved,false,z",
	);

	it("uses the confirmed match, reads retired stages as closed, and keeps skipped rows to download", () => {
		const result = mapCsvToApplications(table, ["company", "role", "status", "archived", "notes"]);

		expect(result.rows.map((row) => [row.company, row.status, row.notes])).toEqual([
			["Acme", "closed", "x"],
			["Kiln", "closed", "y"],
		]);
		expect(result.skippedRows).toEqual([["", "No company", "saved", "false", "z"]]);
		expect(rowsToCsv(["Company", "Role"], [["", 'Say "hi"']])).toBe('"Company","Role"\r\n"","Say ""hi"""\r\n');
	});
});
