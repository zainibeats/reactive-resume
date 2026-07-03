import { beforeEach, describe, expect, it, vi } from "vitest";

const limitMock = vi.fn();
const fromMock = vi.fn(() => ({ limit: limitMock }));
const selectMock = vi.fn(() => ({ from: fromMock }));

vi.mock("@reactive-resume/db/client", () => ({ db: { select: selectMock } }));
vi.mock("@reactive-resume/db/schema", () => ({ user: { id: "user.id" } }));

const { ensureOwnerSlotAvailable } = await import("./single-owner");

describe("ensureOwnerSlotAvailable", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("allows the first owner to be created", async () => {
		limitMock.mockResolvedValueOnce([]);

		await expect(ensureOwnerSlotAvailable()).resolves.toBeUndefined();
		expect(selectMock).toHaveBeenCalledWith({ id: "user.id" });
		expect(limitMock).toHaveBeenCalledWith(1);
	});

	it("rejects another user after an owner exists", async () => {
		limitMock.mockResolvedValueOnce([{ id: "owner" }]);

		await expect(ensureOwnerSlotAvailable()).rejects.toMatchObject({
			status: "FORBIDDEN",
			body: { message: "This instance already has an owner." },
		});
	});
});
