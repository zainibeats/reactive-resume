import type { RouterOutput } from "@/libs/orpc/client";
import { CreateResumeCard } from "./cards/create-card";
import { ImportResumeCard } from "./cards/import-card";
import { ResumeCard } from "./cards/resume-card";

type Resume = RouterOutput["resume"]["list"][number];

type Props = {
	resumes: Resume[];
};

export function GridView({ resumes }: Props) {
	return (
		<div className="grid 3xl:grid-cols-6 grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
			<CreateResumeCard />

			<ImportResumeCard />

			{resumes.map((resume) => (
				<ResumeCard key={resume.id} resume={resume} />
			))}
		</div>
	);
}
