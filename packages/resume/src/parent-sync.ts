import type { JsonPatchOperation, RebasedResumePatchOperation } from "./patch";
import type { ResumeData } from "@reactive-resume/schema/resume/data";
import {
	createResumePatches,
	findRebasedResumePatchConflicts,
	getValueAtJsonPointer,
	rebaseResumePatchOperations,
} from "./patch";

/** One parent change shown to the author: the parent-side path and the values before and after. */
export type ResumeSyncDiff = {
	op: JsonPatchOperation["op"];
	path: string;
	from: string | null;
	hasPrevious: boolean;
	hasNext: boolean;
	previous: unknown | null;
	next: unknown | null;
	hasConflict: boolean;
};

export type ParentSyncPlan = {
	/** Parent operations (`baseOperation`) paired with the same operation rebased onto the child (`operation`). */
	entries: RebasedResumePatchOperation[];
	/** The rebased operations, ready to apply to the child. */
	operations: JsonPatchOperation[];
	/** Child paths whose value differs from the last reviewed parent snapshot. */
	conflicts: string[];
	diffs: ResumeSyncDiff[];
	hasConflicts: boolean;
};

export type ParentSyncSelection = {
	entries: RebasedResumePatchOperation[];
	hasConflicts: boolean;
	/** True when every pending parent operation is selected, so the child catches up to the parent revision. */
	isComplete: boolean;
};

/** True when `path` is a conflict path or sits under one. */
export function isConflictingPath(path: string, conflicts: string[]): boolean {
	return conflicts.some((conflict) => path === conflict || path.startsWith(`${conflict}/`));
}

/**
 * Plans how to bring a child resume up to date with its parent: diffs the last reviewed parent snapshot
 * against the current parent, rebases those operations onto the independently edited child, and flags
 * operations that overlap child edits.
 */
export function planParentSync(input: {
	parentData: ResumeData;
	parentSnapshot: ResumeData;
	childData: ResumeData;
}): ParentSyncPlan {
	const parentOperations = createResumePatches(input.parentSnapshot, input.parentData);
	const entries = rebaseResumePatchOperations({
		base: input.parentSnapshot,
		target: input.childData,
		operations: parentOperations,
	});
	const conflicts = findRebasedResumePatchConflicts({
		base: input.parentSnapshot,
		target: input.childData,
		operations: entries,
	});

	return {
		entries,
		operations: entries.map(({ operation }) => operation),
		conflicts,
		diffs: entries.map(({ baseOperation, operation }) =>
			toSyncDiff({
				baseOperation,
				operation,
				conflicts,
				previousData: input.parentSnapshot,
				nextData: input.parentData,
			}),
		),
		hasConflicts: conflicts.length > 0,
	};
}

/** Picks the plan entries whose parent-side path is in `paths`; `undefined` selects everything. */
export function selectParentSyncEntries(plan: ParentSyncPlan, paths?: string[]): ParentSyncSelection {
	const selectedPaths = paths ? new Set(paths) : null;
	const entries = selectedPaths
		? plan.entries.filter(({ baseOperation }) => selectedPaths.has(baseOperation.path))
		: plan.entries;

	return {
		entries,
		hasConflicts: entries.some(({ operation }) => isConflictingPath(operation.path, plan.conflicts)),
		isComplete: entries.length === plan.entries.length,
	};
}

function toSyncDiff(input: {
	baseOperation: JsonPatchOperation;
	operation: JsonPatchOperation;
	conflicts: string[];
	previousData: ResumeData;
	nextData: ResumeData;
}): ResumeSyncDiff {
	const { baseOperation } = input;
	const previous = getValueAtJsonPointer(input.previousData, baseOperation.path);
	const next = getValueAtJsonPointer(input.nextData, baseOperation.path);
	const hasPrevious = baseOperation.op !== "add" && previous !== undefined;
	const hasNext = baseOperation.op !== "remove" && next !== undefined;

	return {
		op: baseOperation.op,
		path: baseOperation.path,
		from: "from" in baseOperation ? baseOperation.from : null,
		hasPrevious,
		hasNext,
		previous: hasPrevious ? previous : null,
		next: hasNext ? next : null,
		hasConflict: isConflictingPath(input.operation.path, input.conflicts),
	};
}
