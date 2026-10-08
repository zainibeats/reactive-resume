// @vitest-environment happy-dom

import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Dialog } from "@reactive-resume/ui/components/dialog";
import { NewDocumentDialog } from "./new-document-dialog";
import { orpc } from "@/libs/orpc/client";

vi.mock("@tanstack/react-router", () => ({ useNavigate: () => vi.fn() }));

it("offers importing, starting blank and a sample resume, and nothing but resumes", () => {
	i18n.loadAndActivate({ locale: "en-US", messages: {} });
	const queryClient = new QueryClient({
		defaultOptions: { queries: { staleTime: Number.POSITIVE_INFINITY, retry: false } },
	});
	queryClient.setQueryData(orpc.aiProviders.list.queryKey(), []);

	render(
		<I18nProvider i18n={i18n}>
			<QueryClientProvider client={queryClient}>
				<Dialog open>
					<NewDocumentDialog />
				</Dialog>
			</QueryClientProvider>
		</I18nProvider>,
	);

	expect(screen.getByRole("heading", { name: "New document" })).toBeVisible();
	expect(screen.getByRole("button", { name: /^Import a resume/ })).toBeEnabled();
	expect(screen.getByRole("button", { name: /^Start blank/ })).toBeEnabled();
	expect(screen.getByRole("button", { name: "Try with a sample resume" })).toBeEnabled();
	expect(screen.queryByRole("button", { name: /cover letter/i })).not.toBeInTheDocument();
	expect(screen.queryByRole("button", { name: /for a job/i })).not.toBeInTheDocument();
});
