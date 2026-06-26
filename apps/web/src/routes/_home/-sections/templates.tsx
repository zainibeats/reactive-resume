import type { TemplateMetadata } from "@/dialogs/resume/template/data";
import { Trans } from "@lingui/react/macro";
import { templates } from "@/dialogs/resume/template/data";

type TemplateItemProps = {
	metadata: TemplateMetadata;
};

export function Templates() {
	return (
		<section id="templates" className="p-4 md:p-8">
			<div className="mb-4 flex items-center justify-between gap-4">
				<h2 className="font-semibold text-2xl tracking-tight">
					<Trans>Templates</Trans>
				</h2>
			</div>

			<div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
				{Object.entries(templates).map(([template, metadata]) => (
					<TemplateItem key={template} metadata={metadata} />
				))}
			</div>
		</section>
	);
}

function TemplateItem({ metadata }: TemplateItemProps) {
	return (
		<figure className="space-y-2">
			<img
				src={metadata.imageUrl}
				alt={metadata.name}
				className="aspect-page w-full rounded-md border bg-card object-cover shadow-sm"
				loading="lazy"
			/>

			<figcaption className="truncate text-muted-foreground text-sm">{metadata.name}</figcaption>
		</figure>
	);
}
