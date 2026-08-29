// biome-ignore-all lint/style/noNonNullAssertion: These tests assert registered tool names before exercising handlers.

import { beforeEach, describe, expect, it, vi } from "vitest";
import { ORPCError } from "@orpc/server";

const mocks = vi.hoisted(() => ({
	resolveUserFromRequestHeaders: vi.fn(),
	createResumePdfDownloadUrl: vi.fn(),
}));

vi.mock("@reactive-resume/api/context", () => ({
	resolveUserFromRequestHeaders: mocks.resolveUserFromRequestHeaders,
}));

vi.mock("@reactive-resume/api/features/resume/export", () => ({
	MAX_PDF_DOWNLOAD_URL_TTL_SECONDS: 600,
	createResumePdfDownloadUrl: mocks.createResumePdfDownloadUrl,
}));

vi.mock("@reactive-resume/env/server", () => ({
	env: {
		APP_URL: "https://example.com",
	},
}));

const { MCP_TOOL_NAME } = await import("./mcp-tool-names");
const { registerTools } = await import("./tools");

type ToolHandler = (input: Record<string, unknown>) => Promise<{
	content: Array<{ type: "text"; text: string }>;
	isError?: boolean;
}>;

type Registration = {
	name: string;
	config: {
		title?: string;
		description?: string;
		inputSchema?: unknown;
	};
	handler: ToolHandler;
};

const makeFakeServer = () => {
	const registered: Registration[] = [];
	const server = {
		registerTool: vi.fn((name: string, config: Registration["config"], handler: ToolHandler) => {
			registered.push({ name, config, handler });
		}),
	};
	return { server, registered };
};

const clientMock = {
	resume: {
		getById: vi.fn(),
		list: vi.fn(),
		tags: { list: vi.fn() },
		create: vi.fn(),
		import: vi.fn(),
		duplicate: vi.fn(),
		patch: vi.fn(),
		update: vi.fn(),
		delete: vi.fn(),
		setLocked: vi.fn(),
		statistics: { getById: vi.fn() },
	},
};

describe("registerTools", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("registers a PDF download URL tool that validates access before signing", async () => {
		clientMock.resume.getById.mockResolvedValueOnce({ id: "resume-1", name: "Scizor" });
		mocks.resolveUserFromRequestHeaders.mockResolvedValueOnce({ id: "user-1" });
		mocks.createResumePdfDownloadUrl.mockReturnValueOnce({
			url: "https://example.com/api/resumes/resume-1/pdf?token=signed",
			expiresAt: "2026-06-01T10:10:00.000Z",
			expiresInSeconds: 600,
		});

		const requestHeaders = new Headers({ "x-api-key": "key" });
		const { server, registered } = makeFakeServer();
		registerTools(server as never, clientMock as never, requestHeaders);

		const tool = registered.find((item) => item.name === "download_resume_pdf")!;
		const result = await tool.handler({ id: "resume-1" });
		const payload = JSON.parse(result.content[0]!.text);

		expect(tool.config.title).toBe("Download Resume PDF");
		expect(clientMock.resume.getById).toHaveBeenCalledWith({ id: "resume-1" });
		expect(mocks.resolveUserFromRequestHeaders).toHaveBeenCalledWith(requestHeaders);
		expect(mocks.createResumePdfDownloadUrl).toHaveBeenCalledWith({
			resumeId: "resume-1",
			userId: "user-1",
			target: "resume",
		});
		expect(payload).toEqual({
			resumeId: "resume-1",
			target: "resume",
			name: "Scizor",
			downloadUrl: "https://example.com/api/resumes/resume-1/pdf?token=signed",
			expiresAt: "2026-06-01T10:10:00.000Z",
			expiresInSeconds: 600,
			contentType: "application/pdf",
		});
	});

	it("creates a cover-letter PDF URL and reports cover-letter metadata", async () => {
		clientMock.resume.getById.mockResolvedValueOnce({
			id: "resume-1",
			name: "Scizor",
			data: { customSections: [{ type: "cover-letter", hidden: false, items: [{ hidden: false }] }] },
		});
		mocks.resolveUserFromRequestHeaders.mockResolvedValueOnce({ id: "user-1" });
		mocks.createResumePdfDownloadUrl.mockReturnValueOnce({
			url: "https://example.com/api/resumes/resume-1/pdf?token=signed&target=cover-letter",
			expiresAt: "2026-06-01T10:10:00.000Z",
			expiresInSeconds: 600,
		});

		const { server, registered } = makeFakeServer();
		registerTools(server as never, clientMock as never, new Headers());

		const tool = registered.find((item) => item.name === "download_resume_pdf")!;
		const result = await tool.handler({ id: "resume-1", target: "cover-letter" });

		expect(mocks.createResumePdfDownloadUrl).toHaveBeenCalledWith({
			resumeId: "resume-1",
			userId: "user-1",
			target: "cover-letter",
		});
		expect(JSON.parse(result.content[0]!.text)).toEqual({
			resumeId: "resume-1",
			target: "cover-letter",
			name: "Scizor Cover Letter",
			downloadUrl: "https://example.com/api/resumes/resume-1/pdf?token=signed&target=cover-letter",
			expiresAt: "2026-06-01T10:10:00.000Z",
			expiresInSeconds: 600,
			contentType: "application/pdf",
		});
	});

	for (const [name, data] of [
		["missing", { customSections: [] }],
		["hidden", { customSections: [{ type: "cover-letter", hidden: true, items: [{ hidden: false }] }] }],
	] as const) {
		it(`does not create a cover-letter URL when the cover letter is ${name}`, async () => {
			clientMock.resume.getById.mockResolvedValueOnce({ id: "resume-1", name: "Scizor", data });
			mocks.resolveUserFromRequestHeaders.mockResolvedValueOnce({ id: "user-1" });

			const { server, registered } = makeFakeServer();
			registerTools(server as never, clientMock as never, new Headers());

			const tool = registered.find((item) => item.name === "download_resume_pdf")!;
			const result = await tool.handler({ id: "resume-1", target: "cover-letter" });

			expect(result.isError).toBe(true);
			expect(result.content[0]?.text).toContain("No visible cover letter found for this resume.");
			expect(mocks.createResumePdfDownloadUrl).not.toHaveBeenCalled();
		});
	}

	it("keeps the tool name stable", () => {
		expect(MCP_TOOL_NAME.downloadResumePdf).toBe("download_resume_pdf");
	});

	it("points a failed patch at the document structure rather than the tool schema", async () => {
		clientMock.resume.patch.mockRejectedValueOnce(
			new ORPCError("INVALID_PATCH_OPERATIONS", {
				status: 400,
				message: "Cannot perform the operation at a path that does not exist. Path: /sections/summary/content.",
			}),
		);

		const { server, registered } = makeFakeServer();
		registerTools(server as never, clientMock as never, new Headers());

		const tool = registered.find((item) => item.name === "apply_resume_patch")!;
		const result = await tool.handler({
			id: "resume-1",
			operations: [{ op: "replace", path: "/sections/summary/content", value: "x" }],
		});

		expect(result.isError).toBe(true);
		expect(result.content[0]?.text).toContain("deepest path that exists");
		expect(result.content[0]?.text).not.toContain("Check the input parameters against the tool's schema");
	});
});
