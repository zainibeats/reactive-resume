// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vite-plus/test";
import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const api = vi.hoisted(() => ({ status: vi.fn(), test: vi.fn(), saveSearxng: vi.fn() }));
vi.mock("@/libs/orpc/client", () => ({
	orpc: {
		webAccess: {
			status: { queryOptions: () => ({ queryKey: ["web-access"], queryFn: api.status }), key: () => ["web-access"] },
			save: { mutationOptions: (options: object) => ({ ...options, mutationFn: vi.fn() }) },
			delete: { mutationOptions: (options: object) => ({ ...options, mutationFn: vi.fn() }) },
			saveSearxng: { mutationOptions: (options: object) => ({ ...options, mutationFn: api.saveSearxng }) },
			deleteSearxng: { mutationOptions: (options: object) => ({ ...options, mutationFn: vi.fn() }) },
			test: { mutationOptions: () => ({ mutationFn: api.test }) },
		},
	},
}));
vi.mock("../integrations/hooks/use-has-usable-ai-provider", () => ({
	useHasUsableAiProvider: () => ({ hasUsableProvider: true, isUnavailable: false }),
}));

i18n.loadAndActivate({ locale: "en", messages: {} });
const { WebAccessSection } = await import("./web-access");

const status = (overrides: object) => ({
	builtInReader: true,
	configured: false,
	provider: null,
	managed: false,
	canSave: true,
	search: true,
	searxng: true,
	searxngManaged: true,
	searxngUrl: null,
	read: true,
	...overrides,
});

function renderSection() {
	render(
		<I18nProvider i18n={i18n}>
			<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
				<WebAccessSection />
			</QueryClientProvider>
		</I18nProvider>,
	);
}

afterEach(() => {
	cleanup();
	vi.clearAllMocks();
});

it("tests the server's search without a connection and leaves reading to the built-in reader", async () => {
	api.status.mockResolvedValue(status({}));
	api.test.mockResolvedValue({ search: { success: true }, read: { success: false, error: "unavailable" } });
	renderSection();

	expect(await screen.findByText(/SearXNG handles the assistant's searches/)).toBeTruthy();
	expect(screen.getByText(/Searches with SearXNG and reads links with the built-in reader/)).toBeTruthy();
	expect(screen.queryByText(/AI provider's own web search/)).toBeNull();
	fireEvent.click(screen.getByRole("button", { name: "Test search" }));

	expect(await screen.findByText("Search works.")).toBeTruthy();
	expect(screen.queryByText("Enhanced reading failed.")).toBeNull();
	expect(screen.getByText(/Search was tested with SearXNG. Links are read with the built-in reader./)).toBeTruthy();
});

it("names the server's search and the connection's reading separately", async () => {
	api.status.mockResolvedValue(status({ configured: true, provider: "tavily" }));
	api.test.mockResolvedValue({ search: { success: true }, read: { success: true } });
	renderSection();

	expect(await screen.findByText(/Searches with SearXNG and reads pages with Tavily/)).toBeTruthy();
	expect(screen.queryByRole("button", { name: "Test search" })).toBeNull();
	fireEvent.click(screen.getByRole("button", { name: "Test connection" }));

	expect(await screen.findByText("Reading works.")).toBeTruthy();
	expect(screen.getByText("Search was tested with SearXNG, and reading with Tavily.")).toBeTruthy();
});

it("keeps the connection's wording without SearXNG", async () => {
	api.status.mockResolvedValue(status({ configured: true, provider: "tavily", searxng: false, searxngManaged: false }));
	api.test.mockResolvedValue({ search: { success: true }, read: { success: true } });
	renderSection();

	expect(await screen.findByText(/Searches and reads pages with Tavily/)).toBeTruthy();
	expect(screen.queryByText(/SearXNG handles the assistant's searches/)).toBeNull();
	fireEvent.click(screen.getByRole("button", { name: "Test connection" }));
	expect(await screen.findByText("Tested with Tavily. Only this service was tested.")).toBeTruthy();
});

it("saves the user's own SearXNG address", async () => {
	api.status.mockResolvedValue(status({ search: false, searxng: false, searxngManaged: false }));
	api.saveSearxng.mockResolvedValue(undefined);
	renderSection();

	fireEvent.click(await screen.findByRole("button", { name: "Add SearXNG" }));
	fireEvent.change(screen.getByLabelText("Instance address"), { target: { value: "http://searxng:8080" } });
	fireEvent.click(screen.getByRole("button", { name: "Save" }));

	await vi.waitFor(() => expect(api.saveSearxng).toHaveBeenCalled());
	expect(api.saveSearxng.mock.calls[0]?.[0]).toEqual({ url: "http://searxng:8080" });
});

it("shows a saved SearXNG address and hides editing when the server manages it", async () => {
	api.status.mockResolvedValueOnce(status({ searxngManaged: false, searxngUrl: "http://searxng:8080" }));
	renderSection();
	expect(await screen.findByText("http://searxng:8080")).toBeTruthy();
	expect(screen.getByRole("button", { name: "Remove" })).toBeTruthy();
	cleanup();

	api.status.mockResolvedValueOnce(status({}));
	renderSection();
	expect(await screen.findAllByText("Managed by server")).toBeTruthy();
	expect(screen.queryByRole("button", { name: "Add SearXNG" })).toBeNull();
});
