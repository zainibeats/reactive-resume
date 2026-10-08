import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { execute, healthcheck, ping } = vi.hoisted(() => ({ execute: vi.fn(), healthcheck: vi.fn(), ping: vi.fn() }));

vi.mock("@reactive-resume/db/client", () => ({ db: { execute } }));
vi.mock("@reactive-resume/api/features/storage", () => ({ getStorageService: () => ({ healthcheck }) }));
vi.mock("@reactive-resume/db/redis", () => ({ getRedis: () => ({ ping }) }));

import { handleHealth } from "./health";

describe("health failure reporting", () => {
	beforeEach(() => {
		execute.mockResolvedValue([]);
		healthcheck.mockResolvedValue({ status: "healthy" });
		ping.mockResolvedValue("PONG");
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it.each(["database", "storage", "redis"])("keeps thrown %s error details in server logs only", async (dependency) => {
		const detail = "Connection failed for private-user at internal.example:5432";
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		({ database: execute, storage: healthcheck, redis: ping })[dependency]?.mockRejectedValueOnce(new Error(detail));

		const response = await handleHealth();
		const body = await response.json();

		expect(response.status).toBe(503);
		expect(JSON.stringify(body)).not.toContain(detail);
		expect(body[dependency]).toMatchObject({
			status: "unhealthy",
			error: expect.stringContaining("health check failed"),
		});
		expect(warn).toHaveBeenCalledWith(
			"[Healthcheck]",
			expect.objectContaining({
				[dependency]: expect.objectContaining({ error: detail }),
			}),
		);
	});

	it("redacts returned storage failures while preserving diagnostics in server logs", async () => {
		const detail = "Access denied to bucket private-bucket on internal.example";
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		healthcheck.mockResolvedValueOnce({
			status: "unhealthy",
			type: "s3",
			message: detail,
			error: detail,
			internalDetail: detail,
		});

		const response = await handleHealth();
		const body = await response.json();

		expect(response.status).toBe(503);
		expect(body.storage).toEqual({
			status: "unhealthy",
			type: "s3",
			latencyMs: expect.any(Number),
			error: "Storage health check failed.",
		});
		expect(JSON.stringify(body)).not.toContain(detail);
		expect(warn).toHaveBeenCalledWith(
			"[Healthcheck]",
			expect.objectContaining({ storage: expect.objectContaining({ error: detail, message: detail }) }),
		);
	});
});
