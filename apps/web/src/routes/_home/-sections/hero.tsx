import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { ArrowRightIcon, DownloadSimpleIcon, PlusIcon, SignInIcon } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import { m } from "motion/react";
import { Button } from "@reactive-resume/ui/components/button";

export function Hero() {
	return (
		<section id="hero" className="relative flex min-h-svh w-full items-center overflow-hidden border-b py-24">
			<div className="container mx-auto grid items-center gap-10 px-4 sm:px-6 md:grid-cols-[minmax(0,1fr)_minmax(280px,420px)] lg:px-12">
				<m.div
					className="will-change-[transform,opacity]"
					initial={{ opacity: 0, y: 24 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.45, ease: "easeOut" }}
				>
					<div className="max-w-2xl space-y-6">
						<div className="space-y-3">
							<h1 className="font-semibold text-4xl tracking-tight md:text-5xl lg:text-6xl">
								<Trans>A free and open-source resume builder</Trans>
							</h1>

							<p className="max-w-xl text-base text-muted-foreground leading-relaxed md:text-lg">
								<Trans>
									Reactive Resume is a free and open-source resume builder that simplifies the process of creating,
									updating, and sharing your resume.
								</Trans>
							</p>
						</div>

						<div className="grid max-w-xl gap-3 sm:grid-cols-2">
							<HomeAction
								icon={<PlusIcon />}
								title={<Trans>Create a new resume</Trans>}
								description={<Trans>Start building your resume from scratch</Trans>}
								to="/dashboard"
							/>
							<HomeAction
								icon={<DownloadSimpleIcon />}
								title={<Trans>Import an existing resume</Trans>}
								description={<Trans>Continue where you left off</Trans>}
								to="/dashboard"
							/>
						</div>

						<div className="flex flex-col gap-3 sm:flex-row">
							<Button
								nativeButton={false}
								className="gap-2"
								render={
									<Link to="/dashboard">
										<Trans>Get Started</Trans>
										<ArrowRightIcon aria-hidden="true" />
									</Link>
								}
							/>

							<Button
								variant="outline"
								nativeButton={false}
								className="gap-2"
								render={
									<Link to="/auth/login">
										<SignInIcon aria-hidden="true" />
										<Trans>Sign in</Trans>
									</Link>
								}
							/>
						</div>
					</div>
				</m.div>

				<m.div
					className="grid grid-cols-2 gap-3 will-change-[transform,opacity] sm:grid-cols-3 md:grid-cols-2"
					initial={{ opacity: 0, y: 24 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.45, delay: 0.12, ease: "easeOut" }}
					aria-label={t`Templates`}
				>
					<TemplatePreview name="Azurill" src="/templates/jpg/azurill.jpg" />
					<TemplatePreview name="Bronzor" src="/templates/jpg/bronzor.jpg" />
					<TemplatePreview name="Chikorita" src="/templates/jpg/chikorita.jpg" />
					<TemplatePreview name="Ditto" src="/templates/jpg/ditto.jpg" />
				</m.div>
			</div>
		</section>
	);
}

type HomeActionProps = {
	icon: React.ReactNode;
	title: React.ReactNode;
	description: React.ReactNode;
	to: React.ComponentProps<typeof Link>["to"];
};

function HomeAction({ icon, title, description, to }: HomeActionProps) {
	return (
		<Link
			to={to}
			className="group rounded-lg border bg-card p-4 text-start transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
		>
			<div className="mb-3 text-foreground transition-transform group-hover:translate-x-0.5">{icon}</div>
			<div className="font-medium text-sm">{title}</div>
			<div className="mt-1 text-muted-foreground text-xs">{description}</div>
		</Link>
	);
}

type TemplatePreviewProps = {
	name: string;
	src: string;
};

function TemplatePreview({ name, src }: TemplatePreviewProps) {
	return (
		<img
			src={src}
			alt={name}
			className="aspect-[210/297] w-full rounded-md border bg-muted object-cover shadow-sm"
			loading="eager"
		/>
	);
}
