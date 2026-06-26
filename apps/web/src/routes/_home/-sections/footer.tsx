import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { m } from "motion/react";
import { useState } from "react";
import { BrandIcon } from "@reactive-resume/ui/components/brand-icon";
import { Copyright } from "@/components/ui/copyright";

type FooterLinkItem = {
	url: string;
	label: string;
};

type FooterLinkGroupProps = {
	title: string;
	links: FooterLinkItem[];
};

const getResourceLinks = (): FooterLinkItem[] => [
	{ url: "https://docs.rxresu.me", label: t`Documentation` },
	{ url: "https://docs.rxresu.me/self-hosting/docker", label: t`Self-hosting` },
	{ url: "https://github.com/amruthpillai/reactive-resume", label: t`Source Code` },
	{ url: "https://docs.rxresu.me/changelog", label: t`Changelog` },
];

const getSupportLinks = (): FooterLinkItem[] => [
	{ url: "https://github.com/amruthpillai/reactive-resume/issues", label: t`Report an issue` },
	{ url: "https://crowdin.com/project/reactive-resume", label: t`Translations` },
];

export function Footer() {
	return (
		<m.footer
			id="footer"
			className="p-4 pb-8 will-change-[opacity] md:p-8 md:pb-12"
			initial={{ opacity: 0 }}
			whileInView={{ opacity: 1 }}
			viewport={{ once: true }}
			transition={{ duration: 0.45 }}
		>
			<div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
				{/* Brand Column */}
				<div className="space-y-4 sm:col-span-2 lg:col-span-1">
					<BrandIcon variant="logo" className="size-10" />

					<div className="space-y-2">
						<h2 className="font-semibold text-lg tracking-tight">Reactive Resume</h2>
						<p className="max-w-xs text-muted-foreground text-sm leading-relaxed">
							<Trans>A focused resume builder for creating, editing, exporting, and sharing your resume.</Trans>
						</p>
					</div>
				</div>

				{/* Resources Column */}
				<FooterLinkGroup title={t`Resources`} links={getResourceLinks()} />

				{/* Support Column */}
				<FooterLinkGroup title={t`Support`} links={getSupportLinks()} />

				{/* Copyright Column */}
				<div className="space-y-4 sm:col-span-2 lg:col-span-1">
					<Copyright />
				</div>
			</div>
		</m.footer>
	);
}

function FooterLinkGroup({ title, links }: FooterLinkGroupProps) {
	return (
		<div className="space-y-4">
			<h2 className="font-medium text-muted-foreground text-sm tracking-tight">{title}</h2>

			<ul className="space-y-3">
				{links.map((link) => (
					<FooterLink key={link.url} url={link.url} label={link.label} />
				))}
			</ul>
		</div>
	);
}

function FooterLink({ url, label }: FooterLinkItem) {
	const [isHovered, setIsHovered] = useState(false);

	return (
		<li className="relative">
			<a
				href={url}
				target="_blank"
				rel="noopener noreferrer"
				className="relative inline-block text-sm transition-colors hover:text-foreground"
				onMouseEnter={() => setIsHovered(true)}
				onMouseLeave={() => setIsHovered(false)}
			>
				{label}

				<span className="sr-only">
					<Trans>(opens in new tab)</Trans>
				</span>

				<m.div
					aria-hidden="true"
					initial={{ width: 0, opacity: 0 }}
					animate={isHovered ? { width: "100%", opacity: 1 } : { width: 0, opacity: 0 }}
					transition={{ duration: 0.2, ease: "easeOut" }}
					className="pointer-events-none absolute inset-s-0 -bottom-0.5 h-px rounded-md bg-primary will-change-[width,opacity]"
				/>
			</a>
		</li>
	);
}
