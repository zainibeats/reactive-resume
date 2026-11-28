import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const dbMock = vi.hoisted(() => ({ select: vi.fn(), update: vi.fn() }));
const resumeServiceMock = vi.hoisted(() => ({ delete: vi.fn(), setLocked: vi.fn() }));
vi.mock("@reactive-resume/db/client", () => ({ db: dbMock }));
vi.mock("../resume/service", () => ({ resumeService: resumeServiceMock, notifyResumeUpdated: vi.fn() }));

const { documentsService } = await import("./service");

// `select().from().where()` resolving to `rows`.
const rows = (result: unknown[]) => ({ from: () => ({ where: () => Promise.resolve(result) }) });

const updates = (returned: unknown[] = [{ id: "r1", updatedAt: new Date() }]) => {
	const set = vi.fn((_changes: Record<string, unknown>) => ({
		where: () => ({ returning: async () => returned }),
	}));
	dbMock.update.mockReturnValue({ set });
	return set;
};

beforeEach(() => {
	for (const mock of [...Object.values(dbMock), ...Object.values(resumeServiceMock)]) mock.mockReset();
});

describe("Trash", () => {
	it("won't move a locked document, and keeps the resume's error code", async () => {
		// The guarded UPDATE matches no row because the resume is locked.
		updates([]);
		dbMock.select.mockReturnValueOnce(rows([{ isLocked: true, trashedAt: null }]));

		await expect(documentsService.trash({ userId: "u1", id: "r1" })).rejects.toMatchObject({
			code: "RESUME_LOCKED",
			status: 403,
		});
	});

	it("reports a missing document as not found", async () => {
		updates([]);
		dbMock.select.mockReturnValueOnce(rows([]));

		await expect(documentsService.trash({ userId: "u1", id: "r1" })).rejects.toMatchObject({ code: "NOT_FOUND" });
	});

	it("deletes for good only what is already in Trash", async () => {
		dbMock.select.mockReturnValueOnce(rows([{ isLocked: false, trashedAt: null }]));
		await expect(documentsService.purge({ userId: "u1", id: "r1" })).rejects.toMatchObject({
			code: "BAD_REQUEST",
		});

		dbMock.select.mockReturnValueOnce(rows([{ isLocked: false, trashedAt: new Date() }]));
		await documentsService.purge({ userId: "u1", id: "r1" });
		expect(resumeServiceMock.delete).toHaveBeenCalledWith({ id: "r1", userId: "u1" });
	});
});

describe("library", () => {
	it("lists resumes as documents, newest edit first", async () => {
		const older = { id: "r1", name: "Older", updatedAt: new Date("2026-01-01") };
		const newer = { id: "r2", name: "Newer", updatedAt: new Date("2026-02-01") };
		dbMock.select.mockReturnValueOnce(rows([older, newer]));

		await expect(documentsService.list({ userId: "u1", trashed: false })).resolves.toEqual([
			{ type: "resume", ...newer },
			{ type: "resume", ...older },
		]);
	});

	it("counts live resumes and Trash", async () => {
		dbMock.select.mockReturnValueOnce(rows([{ total: 3 }])).mockReturnValueOnce(rows([{ total: 1 }]));

		await expect(documentsService.counts({ userId: "u1" })).resolves.toEqual({ resume: 3, trash: 1 });
	});

	it("ends automatic naming when a resume is renamed by hand", async () => {
		const set = updates();

		await documentsService.rename({ userId: "u1", id: "r1", name: "Mine" });

		expect(set).toHaveBeenCalledWith(expect.objectContaining({ name: "Mine", autoName: false }));
		expect(set.mock.calls[0]?.[0]).toHaveProperty("revision");
	});
});
