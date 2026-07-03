import { beforeEach, describe, expect, it, vi } from "vitest";

const envMock = vi.hoisted(() => ({
	FLAG_DISABLE_SIGNUPS: false,
	FLAG_DISABLE_EMAIL_AUTH: false,
}));
const limitMock = vi.hoisted(() => vi.fn());
const fromMock = vi.hoisted(() => vi.fn(() => ({ limit: limitMock })));
const selectMock = vi.hoisted(() => vi.fn(() => ({ from: fromMock })));

vi.mock("@reactive-resume/db/client", () => ({ db: { select: selectMock } }));
vi.mock("@reactive-resume/db/schema", () => ({ user: { id: "user.id" } }));
vi.mock("@reactive-resume/env/server", () => ({ env: envMock }));

const { flagsService } = await import("./service");

describe("flagsService.getFlags", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		envMock.FLAG_DISABLE_SIGNUPS = false;
		envMock.FLAG_DISABLE_EMAIL_AUTH = false;
		limitMock.mockResolvedValue([]);
	});

	it("allows signup while the instance has no owner", async () => {
		await expect(flagsService.getFlags()).resolves.toEqual({
			disableSignups: false,
			disableEmailAuth: false,
		});
		expect(limitMock).toHaveBeenCalledWith(1);
	});

	it("disables signup after the owner exists", async () => {
		limitMock.mockResolvedValueOnce([{ id: "owner" }]);

		await expect(flagsService.getFlags()).resolves.toEqual({
			disableSignups: true,
			disableEmailAuth: false,
		});
	});

	it("honors explicit authentication flags before owner setup", async () => {
		envMock.FLAG_DISABLE_SIGNUPS = true;
		envMock.FLAG_DISABLE_EMAIL_AUTH = true;

		await expect(flagsService.getFlags()).resolves.toEqual({
			disableSignups: true,
			disableEmailAuth: true,
		});
	});
});
