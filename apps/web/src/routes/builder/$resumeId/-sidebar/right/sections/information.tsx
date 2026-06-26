import { Trans } from "@lingui/react/macro";
import { Button } from "@reactive-resume/ui/components/button";
import { SectionBase } from "../shared/section-base";

export function InformationSectionBuilder() {
	return (
		<SectionBase type="information" className="space-y-4">
			<div className="space-y-2 rounded-md border bg-secondary p-4">
				<h4 className="font-medium tracking-tight">
					<Trans>Project resources</Trans>
				</h4>

				<p className="text-muted-foreground text-xs leading-normal">
					<Trans>
						Find setup guides, source code, issue tracking, and translation resources for this self-hostable resume
						builder.
					</Trans>
				</p>
			</div>

			<div className="flex flex-wrap gap-0.5">
				<Button
					size="sm"
					variant="link"
					className="text-xs"
					nativeButton={false}
					render={
						<a href="https://docs.rxresu.me" target="_blank" rel="noopener noreferrer">
							<Trans>Documentation</Trans>
						</a>
					}
				/>

				<Button
					size="sm"
					variant="link"
					className="text-xs"
					nativeButton={false}
					render={
						<a href="https://github.com/amruthpillai/reactive-resume" target="_blank" rel="noopener noreferrer">
							<Trans>Source Code</Trans>
						</a>
					}
				/>

				<Button
					size="sm"
					variant="link"
					className="text-xs"
					nativeButton={false}
					render={
						<a href="https://github.com/amruthpillai/reactive-resume/issues" target="_blank" rel="noopener noreferrer">
							<Trans>Report a Bug</Trans>
						</a>
					}
				/>

				<Button
					size="sm"
					variant="link"
					className="text-xs"
					nativeButton={false}
					render={
						<a href="https://crowdin.com/project/reactive-resume" target="_blank" rel="noopener noreferrer">
							<Trans>Translations</Trans>
						</a>
					}
				/>
			</div>
		</SectionBase>
	);
}
