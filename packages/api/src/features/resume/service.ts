import type { JsonPatchOperation } from "@reactive-resume/resume/patch";
import type { StoredResumeAnalysis } from "@reactive-resume/schema/resume/analysis";
import type { ResumeData } from "@reactive-resume/schema/resume/data";
import type { Locale } from "@reactive-resume/utils/locale";
import type { ResumeUpdatedEvent } from "./events";
import { ORPCError } from "@orpc/client";
import { compare, hash } from "bcrypt";
import { and, arrayContains, asc, desc, eq, isNotNull, sql } from "drizzle-orm";
import { get } from "es-toolkit/compat";
import { match } from "ts-pattern";
import { db } from "@reactive-resume/db/client";
import * as schema from "@reactive-resume/db/schema";
import {
	applyResumePatches,
	createResumePatches,
	findRebasedResumePatchConflicts,
	ResumePatchError,
	rebaseResumePatchOperations,
} from "@reactive-resume/resume/patch";
import { defaultResumeData } from "@reactive-resume/schema/resume/default";
import { generateId } from "@reactive-resume/utils/string";
import { getStorageService } from "../storage/service";
import { grantResumeAccess, hasResumeAccess } from "./access";
import { assertCanView, isOwner, redactResumeForViewer, shouldCountForStatistics } from "./access-policy";
import { publishResumeUpdated } from "./events";

type DbOrTx = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

type ResumeSyncDiff = {
	op: JsonPatchOperation["op"];
	path: string;
	from: string | null;
	hasPrevious: boolean;
	hasNext: boolean;
	previous: unknown | null;
	next: unknown | null;
	hasConflict: boolean;
};

function resumeVersionConflict(updatedAt: Date) {
	return new ORPCError("RESUME_VERSION_CONFLICT", {
		status: 409,
		message: "The resume changed after this patch was generated.",
		data: { updatedAt: updatedAt.toISOString() },
	});
}

async function applyResumePatchTx(
	client: DbOrTx,
	input: { id: string; userId: string; operations: JsonPatchOperation[]; expectedUpdatedAt?: Date },
) {
	const [existing] = await client
		.select({
			data: schema.resume.data,
			isLocked: schema.resume.isLocked,
			updatedAt: schema.resume.updatedAt,
		})
		.from(schema.resume)
		.where(and(eq(schema.resume.id, input.id), eq(schema.resume.userId, input.userId)))
		.for("update");

	if (!existing) throw new ORPCError("NOT_FOUND");
	if (existing.isLocked) throw new ORPCError("RESUME_LOCKED");
	if (input.expectedUpdatedAt && existing.updatedAt.getTime() !== input.expectedUpdatedAt.getTime()) {
		throw resumeVersionConflict(existing.updatedAt);
	}

	let patchedData: ResumeData;

	try {
		patchedData = applyResumePatches(existing.data, input.operations);
	} catch (error) {
		if (error instanceof ResumePatchError) {
			throw new ORPCError("INVALID_PATCH_OPERATIONS", {
				status: 400,
				message: error.message,
				data: { code: error.code, index: error.index, operation: error.operation },
			});
		}

		throw new ORPCError("INVALID_PATCH_OPERATIONS", {
			status: 400,
			message: error instanceof Error ? error.message : "Failed to apply patch operations",
		});
	}

	const [resume] = await client
		.update(schema.resume)
		.set({ data: patchedData, revision: sql`${schema.resume.revision} + 1` })
		.where(
			and(
				eq(schema.resume.id, input.id),
				eq(schema.resume.isLocked, false),
				eq(schema.resume.userId, input.userId),
				...(input.expectedUpdatedAt ? [eq(schema.resume.updatedAt, input.expectedUpdatedAt)] : []),
			),
		)
		.returning({
			id: schema.resume.id,
			name: schema.resume.name,
			slug: schema.resume.slug,
			tags: schema.resume.tags,
			data: schema.resume.data,
			revision: schema.resume.revision,
			parentId: schema.resume.parentId,
			parentRevision: schema.resume.parentRevision,
			isPublic: schema.resume.isPublic,
			isLocked: schema.resume.isLocked,
			updatedAt: schema.resume.updatedAt,
			hasPassword: sql<boolean>`${schema.resume.password} IS NOT NULL`,
		});

	if (!resume) {
		if (input.expectedUpdatedAt) throw resumeVersionConflict(existing.updatedAt);
		throw new ORPCError("NOT_FOUND");
	}

	return resume;
}

const tags = {
	list: async (input: { userId: string }) => {
		const result = await db
			.select({ tags: schema.resume.tags })
			.from(schema.resume)
			.where(eq(schema.resume.userId, input.userId));

		const uniqueTags = new Set(result.flatMap((tag) => tag.tags));
		const sortedTags = Array.from(uniqueTags).sort((a, b) => a.localeCompare(b));

		return sortedTags;
	},
};

const statistics = {
	getById: async (input: { id: string; userId: string }) => {
		const [statistics] = await db
			.select({
				isPublic: schema.resume.isPublic,
				views: schema.resumeStatistics.views,
				downloads: schema.resumeStatistics.downloads,
				lastViewedAt: schema.resumeStatistics.lastViewedAt,
				lastDownloadedAt: schema.resumeStatistics.lastDownloadedAt,
			})
			.from(schema.resumeStatistics)
			.rightJoin(schema.resume, eq(schema.resumeStatistics.resumeId, schema.resume.id))
			.where(and(eq(schema.resume.id, input.id), eq(schema.resume.userId, input.userId)));

		if (!statistics) throw new ORPCError("NOT_FOUND");

		return {
			isPublic: statistics.isPublic,
			views: statistics.views ?? 0,
			downloads: statistics.downloads ?? 0,
			lastViewedAt: statistics.lastViewedAt,
			lastDownloadedAt: statistics.lastDownloadedAt,
		};
	},

	increment: async (input: { id: string; views?: boolean; downloads?: boolean }) => {
		const views = input.views ? 1 : 0;
		const downloads = input.downloads ? 1 : 0;
		const lastViewedAt = input.views ? sql`now()` : undefined;
		const lastDownloadedAt = input.downloads ? sql`now()` : undefined;

		await db
			.insert(schema.resumeStatistics)
			.values({
				resumeId: input.id,
				views,
				downloads,
				lastViewedAt,
				lastDownloadedAt,
			})
			.onConflictDoUpdate({
				target: [schema.resumeStatistics.resumeId],
				set: {
					views: sql`${schema.resumeStatistics.views} + ${views}`,
					downloads: sql`${schema.resumeStatistics.downloads} + ${downloads}`,
					lastViewedAt,
					lastDownloadedAt,
				},
			});
	},
};

const analysis = {
	getById: async (input: { id: string; userId: string }) => {
		const [result] = await db
			.select({ analysis: schema.resumeAnalysis.analysis })
			.from(schema.resume)
			.leftJoin(schema.resumeAnalysis, eq(schema.resumeAnalysis.resumeId, schema.resume.id))
			.where(and(eq(schema.resume.id, input.id), eq(schema.resume.userId, input.userId)));

		if (!result) throw new ORPCError("NOT_FOUND");

		return result.analysis ?? null;
	},

	upsert: async (input: { id: string; userId: string; analysis: StoredResumeAnalysis }) => {
		const [resume] = await db
			.select({ id: schema.resume.id })
			.from(schema.resume)
			.where(and(eq(schema.resume.id, input.id), eq(schema.resume.userId, input.userId)));

		if (!resume) throw new ORPCError("NOT_FOUND");

		await db
			.insert(schema.resumeAnalysis)
			.values({
				resumeId: input.id,
				analysis: input.analysis,
			})
			.onConflictDoUpdate({
				target: [schema.resumeAnalysis.resumeId],
				set: {
					analysis: input.analysis,
				},
			});

		return input.analysis;
	},
};

function toSharedResumeResponse(
	resume: {
		id: string;
		name: string;
		slug: string;
		tags: string[];
		data: ResumeData;
		isPublic: boolean;
		isLocked: boolean;
	},
	hasPassword: boolean,
) {
	return {
		id: resume.id,
		name: resume.name,
		slug: resume.slug,
		tags: resume.tags,
		data: resume.data,
		isPublic: resume.isPublic,
		isLocked: resume.isLocked,
		hasPassword,
	};
}

async function notifyResumeUpdated(event: ResumeUpdatedEvent) {
	try {
		await publishResumeUpdated(event);
	} catch (error) {
		console.warn("Failed to publish resume.updated event:", error);
	}
}

function getSyncPlan(input: { parentData: ResumeData; parentSnapshot: ResumeData; childData: ResumeData }) {
	const parentOperations = createResumePatches(input.parentSnapshot, input.parentData);
	const rebasedOperations = rebaseResumePatchOperations({
		base: input.parentSnapshot,
		target: input.childData,
		operations: parentOperations,
	});
	const operations = rebasedOperations.map(({ operation }) => operation);
	const conflicts = findRebasedResumePatchConflicts({
		base: input.parentSnapshot,
		target: input.childData,
		operations: rebasedOperations,
	});

	return {
		operations,
		conflicts,
		diffs: createResumeSyncDiffs({
			operations: parentOperations,
			conflicts,
			previousData: input.parentSnapshot,
			nextData: input.parentData,
		}),
		hasConflicts: conflicts.length > 0,
	};
}

function decodeJsonPointerSegment(segment: string): string {
	return segment.replaceAll("~1", "/").replaceAll("~0", "~");
}

function getValueAtJsonPointer(document: unknown, path: string): unknown {
	if (path === "") return document;
	if (!path.startsWith("/")) return undefined;

	return path
		.slice(1)
		.split("/")
		.map(decodeJsonPointerSegment)
		.reduce<unknown>((value, segment) => {
			if (value === undefined || value === null) return undefined;
			if (Array.isArray(value)) return value[segment === "-" ? value.length : Number(segment)];
			if (typeof value === "object") return (value as Record<string, unknown>)[segment];
			return undefined;
		}, document);
}

function createResumeSyncDiffs(input: {
	operations: JsonPatchOperation[];
	conflicts: string[];
	previousData: ResumeData;
	nextData: ResumeData;
}): ResumeSyncDiff[] {
	return input.operations.map((operation) => {
		const previous = getValueAtJsonPointer(input.previousData, operation.path);
		const next = getValueAtJsonPointer(input.nextData, operation.path);

		return {
			op: operation.op,
			path: operation.path,
			from: "from" in operation ? operation.from : null,
			hasPrevious: operation.op !== "add" && previous !== undefined,
			hasNext: operation.op !== "remove" && next !== undefined,
			previous: operation.op !== "add" && previous !== undefined ? previous : null,
			next: operation.op !== "remove" && next !== undefined ? next : null,
			hasConflict: input.conflicts.some(
				(conflict) => operation.path === conflict || operation.path.startsWith(`${conflict}/`),
			),
		};
	});
}

export const resumeService = {
	tags,
	statistics,
	analysis,

	list: async (input: { userId: string; tags: string[]; sort: "lastUpdatedAt" | "createdAt" | "name" }) => {
		return await db
			.select({
				id: schema.resume.id,
				name: schema.resume.name,
				slug: schema.resume.slug,
				tags: schema.resume.tags,
				isPublic: schema.resume.isPublic,
				isLocked: schema.resume.isLocked,
				revision: schema.resume.revision,
				parentId: schema.resume.parentId,
				parentRevision: schema.resume.parentRevision,
				createdAt: schema.resume.createdAt,
				updatedAt: schema.resume.updatedAt,
			})
			.from(schema.resume)
			.where(
				and(
					eq(schema.resume.userId, input.userId),
					match(input.tags.length)
						.with(0, () => undefined)
						.otherwise(() => arrayContains(schema.resume.tags, input.tags)),
				),
			)
			.orderBy(
				match(input.sort)
					.with("lastUpdatedAt", () => desc(schema.resume.updatedAt))
					.with("createdAt", () => asc(schema.resume.createdAt))
					.with("name", () => asc(schema.resume.name))
					.exhaustive(),
			);
	},

	getById: async (input: { id: string; userId: string }) => {
		const [resume] = await db
			.select({
				id: schema.resume.id,
				name: schema.resume.name,
				slug: schema.resume.slug,
				tags: schema.resume.tags,
				data: schema.resume.data,
				revision: schema.resume.revision,
				parentId: schema.resume.parentId,
				parentRevision: schema.resume.parentRevision,
				isPublic: schema.resume.isPublic,
				isLocked: schema.resume.isLocked,
				updatedAt: schema.resume.updatedAt,
				hasPassword: sql<boolean>`${schema.resume.password} IS NOT NULL`,
			})
			.from(schema.resume)
			.where(and(eq(schema.resume.id, input.id), eq(schema.resume.userId, input.userId)));

		if (!resume) throw new ORPCError("NOT_FOUND");

		return resume;
	},

	getBySlug: async (input: { username: string; slug: string; requestHeaders: Headers; currentUserId?: string }) => {
		const [resume] = await db
			.select({
				id: schema.resume.id,
				userId: schema.resume.userId,
				name: schema.resume.name,
				slug: schema.resume.slug,
				tags: schema.resume.tags,
				data: schema.resume.data,
				isPublic: schema.resume.isPublic,
				isLocked: schema.resume.isLocked,
				passwordHash: schema.resume.password,
				hasPassword: sql<boolean>`${schema.resume.password} IS NOT NULL`,
			})
			.from(schema.resume)
			.innerJoin(schema.user, eq(schema.resume.userId, schema.user.id))
			.where(and(eq(schema.resume.slug, input.slug), eq(schema.user.username, input.username)));

		if (!resume) throw new ORPCError("NOT_FOUND");

		const viewer = input.currentUserId ? { id: input.currentUserId } : null;
		assertCanView(resume, viewer);

		if (resume.hasPassword && !hasResumeAccess(input.requestHeaders, resume.id, resume.passwordHash)) {
			throw new ORPCError("NEED_PASSWORD", {
				status: 401,
				data: { username: input.username, slug: input.slug },
			});
		}

		if (shouldCountForStatistics(resume, viewer)) {
			await resumeService.statistics.increment({ id: resume.id, views: true });
		}

		return toSharedResumeResponse(redactResumeForViewer(resume, isOwner(resume, viewer)), resume.hasPassword);
	},

	create: async (input: {
		userId: string;
		name: string;
		slug: string;
		tags: string[];
		locale: Locale;
		data?: ResumeData;
	}) => {
		const id = generateId();
		const data = input.data ?? defaultResumeData;
		data.metadata.page.locale = input.locale;

		try {
			await db.insert(schema.resume).values({
				id,
				name: input.name,
				slug: input.slug,
				tags: input.tags,
				userId: input.userId,
				data,
				revision: 1,
			});

			await notifyResumeUpdated({
				type: "resume.updated",
				resumeId: id,
				userId: input.userId,
				updatedAt: new Date().toISOString(),
				mutation: "create",
			});

			return id;
		} catch (error) {
			const constraint = get(error, "cause.constraint") as string | undefined;

			if (constraint === "resume_slug_user_id_unique") {
				throw new ORPCError("RESUME_SLUG_ALREADY_EXISTS", { status: 400 });
			}

			console.error("Failed to create resume:", error);
			throw new ORPCError("INTERNAL_SERVER_ERROR", { message: "Failed to create resume" });
		}
	},

	createDerived: async (input: { id: string; userId: string; name: string; slug: string; tags: string[] }) => {
		const [parent] = await db
			.select({
				data: schema.resume.data,
				revision: schema.resume.revision,
			})
			.from(schema.resume)
			.where(and(eq(schema.resume.id, input.id), eq(schema.resume.userId, input.userId)));

		if (!parent) throw new ORPCError("NOT_FOUND");

		const id = generateId();

		try {
			await db.insert(schema.resume).values({
				id,
				name: input.name,
				slug: input.slug,
				tags: input.tags,
				userId: input.userId,
				data: parent.data,
				revision: 1,
				parentId: input.id,
				parentRevision: parent.revision,
				parentData: parent.data,
			});

			await notifyResumeUpdated({
				type: "resume.updated",
				resumeId: id,
				userId: input.userId,
				updatedAt: new Date().toISOString(),
				mutation: "create",
			});

			return id;
		} catch (error) {
			if (get(error, "cause.constraint") === "resume_slug_user_id_unique") {
				throw new ORPCError("RESUME_SLUG_ALREADY_EXISTS", { status: 400 });
			}

			console.error("Failed to create derived resume:", error);
			throw new ORPCError("INTERNAL_SERVER_ERROR", { message: "Failed to create derived resume" });
		}
	},

	getSyncStatus: async (input: { id: string; userId: string }) => {
		const [child] = await db
			.select({
				id: schema.resume.id,
				revision: schema.resume.revision,
				parentId: schema.resume.parentId,
				parentRevision: schema.resume.parentRevision,
				parentData: schema.resume.parentData,
				data: schema.resume.data,
			})
			.from(schema.resume)
			.where(and(eq(schema.resume.id, input.id), eq(schema.resume.userId, input.userId)));

		if (!child) throw new ORPCError("NOT_FOUND");

		if (!child.parentId || !child.parentData) {
			return {
				hasParent: false,
				parent: null,
				childRevision: child.revision,
				lastSyncedParentRevision: null,
				isBehind: false,
				operationCount: 0,
				operations: [],
				diffs: [],
				conflicts: [],
				hasConflicts: false,
			};
		}

		const [parent] = await db
			.select({
				id: schema.resume.id,
				name: schema.resume.name,
				revision: schema.resume.revision,
				updatedAt: schema.resume.updatedAt,
				data: schema.resume.data,
			})
			.from(schema.resume)
			.where(and(eq(schema.resume.id, child.parentId), eq(schema.resume.userId, input.userId)));

		if (!parent) {
			return {
				hasParent: false,
				parent: null,
				childRevision: child.revision,
				lastSyncedParentRevision: child.parentRevision,
				isBehind: false,
				operationCount: 0,
				operations: [],
				diffs: [],
				conflicts: [],
				hasConflicts: false,
			};
		}

		const plan = getSyncPlan({
			parentData: parent.data,
			parentSnapshot: child.parentData,
			childData: child.data,
		});

		return {
			hasParent: true,
			parent: {
				id: parent.id,
				name: parent.name,
				revision: parent.revision,
				updatedAt: parent.updatedAt,
			},
			childRevision: child.revision,
			lastSyncedParentRevision: child.parentRevision,
			isBehind: plan.operations.length > 0 || child.parentRevision !== parent.revision,
			operationCount: plan.operations.length,
			operations: plan.operations,
			diffs: plan.diffs,
			conflicts: plan.conflicts,
			hasConflicts: plan.hasConflicts,
		};
	},

	applyParentUpdates: async (input: { id: string; userId: string; force?: boolean }) => {
		const resume = await db.transaction(async (tx) => {
			const [child] = await tx
				.select({
					id: schema.resume.id,
					data: schema.resume.data,
					isLocked: schema.resume.isLocked,
					parentId: schema.resume.parentId,
					parentData: schema.resume.parentData,
				})
				.from(schema.resume)
				.where(and(eq(schema.resume.id, input.id), eq(schema.resume.userId, input.userId)))
				.for("update");

			if (!child) throw new ORPCError("NOT_FOUND");
			if (child.isLocked) throw new ORPCError("RESUME_LOCKED");
			if (!child.parentId || !child.parentData) throw new ORPCError("RESUME_HAS_NO_PARENT", { status: 400 });

			const [parent] = await tx
				.select({
					data: schema.resume.data,
					revision: schema.resume.revision,
				})
				.from(schema.resume)
				.where(and(eq(schema.resume.id, child.parentId), eq(schema.resume.userId, input.userId)));

			if (!parent) throw new ORPCError("RESUME_PARENT_NOT_FOUND", { status: 404 });

			const plan = getSyncPlan({
				parentData: parent.data,
				parentSnapshot: child.parentData,
				childData: child.data,
			});

			if (plan.hasConflicts && !input.force) {
				throw new ORPCError("RESUME_SYNC_CONFLICT", {
					status: 409,
					message: "The child resume has changes that overlap with parent updates.",
					data: { conflicts: plan.conflicts },
				});
			}

			let data = child.data;

			if (plan.operations.length > 0) {
				data = applyResumePatches(child.data, plan.operations);
			}

			const [resume] = await tx
				.update(schema.resume)
				.set({
					data,
					parentData: parent.data,
					parentRevision: parent.revision,
					revision: plan.operations.length > 0 ? sql`${schema.resume.revision} + 1` : sql`${schema.resume.revision}`,
				})
				.where(and(eq(schema.resume.id, input.id), eq(schema.resume.userId, input.userId)))
				.returning({
					id: schema.resume.id,
					name: schema.resume.name,
					slug: schema.resume.slug,
					tags: schema.resume.tags,
					data: schema.resume.data,
					revision: schema.resume.revision,
					parentId: schema.resume.parentId,
					parentRevision: schema.resume.parentRevision,
					isPublic: schema.resume.isPublic,
					isLocked: schema.resume.isLocked,
					updatedAt: schema.resume.updatedAt,
					hasPassword: sql<boolean>`${schema.resume.password} IS NOT NULL`,
				});

			if (!resume) throw new ORPCError("NOT_FOUND");

			return resume;
		});

		await notifyResumeUpdated({
			type: "resume.updated",
			resumeId: resume.id,
			userId: input.userId,
			updatedAt: resume.updatedAt.toISOString(),
			mutation: "sync",
		});

		return resume;
	},

	dismissParentUpdates: async (input: { id: string; userId: string }) => {
		const resume = await db.transaction(async (tx) => {
			const [child] = await tx
				.select({
					id: schema.resume.id,
					isLocked: schema.resume.isLocked,
					parentId: schema.resume.parentId,
				})
				.from(schema.resume)
				.where(and(eq(schema.resume.id, input.id), eq(schema.resume.userId, input.userId)))
				.for("update");

			if (!child) throw new ORPCError("NOT_FOUND");
			if (child.isLocked) throw new ORPCError("RESUME_LOCKED");
			if (!child.parentId) throw new ORPCError("RESUME_HAS_NO_PARENT", { status: 400 });

			const [parent] = await tx
				.select({
					data: schema.resume.data,
					revision: schema.resume.revision,
				})
				.from(schema.resume)
				.where(and(eq(schema.resume.id, child.parentId), eq(schema.resume.userId, input.userId)));

			if (!parent) throw new ORPCError("RESUME_PARENT_NOT_FOUND", { status: 404 });

			const [resume] = await tx
				.update(schema.resume)
				.set({
					parentData: parent.data,
					parentRevision: parent.revision,
				})
				.where(and(eq(schema.resume.id, input.id), eq(schema.resume.userId, input.userId)))
				.returning({
					id: schema.resume.id,
					name: schema.resume.name,
					slug: schema.resume.slug,
					tags: schema.resume.tags,
					data: schema.resume.data,
					revision: schema.resume.revision,
					parentId: schema.resume.parentId,
					parentRevision: schema.resume.parentRevision,
					isPublic: schema.resume.isPublic,
					isLocked: schema.resume.isLocked,
					updatedAt: schema.resume.updatedAt,
					hasPassword: sql<boolean>`${schema.resume.password} IS NOT NULL`,
				});

			if (!resume) throw new ORPCError("NOT_FOUND");

			return resume;
		});

		await notifyResumeUpdated({
			type: "resume.updated",
			resumeId: resume.id,
			userId: input.userId,
			updatedAt: resume.updatedAt.toISOString(),
			mutation: "sync",
		});

		return resume;
	},

	update: async (input: {
		id: string;
		userId: string;
		name?: string;
		slug?: string;
		tags?: string[];
		data?: ResumeData;
		isPublic?: boolean;
	}) => {
		const [resume] = await db
			.select({ isLocked: schema.resume.isLocked })
			.from(schema.resume)
			.where(and(eq(schema.resume.id, input.id), eq(schema.resume.userId, input.userId)));

		if (resume?.isLocked) throw new ORPCError("RESUME_LOCKED");

		const updateData: Partial<typeof schema.resume.$inferSelect> = {
			...(input.name !== undefined ? { name: input.name } : {}),
			...(input.slug !== undefined ? { slug: input.slug } : {}),
			...(input.tags !== undefined ? { tags: input.tags } : {}),
			...(input.data !== undefined ? { data: input.data } : {}),
			...(input.isPublic !== undefined ? { isPublic: input.isPublic } : {}),
		};

		try {
			const [resume] = await db
				.update(schema.resume)
				.set({ ...updateData, revision: sql`${schema.resume.revision} + 1` })
				.where(
					and(
						eq(schema.resume.id, input.id),
						eq(schema.resume.isLocked, false),
						eq(schema.resume.userId, input.userId),
					),
				)
				.returning({
					id: schema.resume.id,
					name: schema.resume.name,
					slug: schema.resume.slug,
					tags: schema.resume.tags,
					data: schema.resume.data,
					revision: schema.resume.revision,
					parentId: schema.resume.parentId,
					parentRevision: schema.resume.parentRevision,
					isPublic: schema.resume.isPublic,
					isLocked: schema.resume.isLocked,
					updatedAt: schema.resume.updatedAt,
					hasPassword: sql<boolean>`${schema.resume.password} IS NOT NULL`,
				});

			if (!resume) throw new ORPCError("NOT_FOUND");

			await notifyResumeUpdated({
				type: "resume.updated",
				resumeId: resume.id,
				userId: input.userId,
				updatedAt: resume.updatedAt.toISOString(),
				mutation: "update",
			});

			return resume;
		} catch (error) {
			if (error instanceof ORPCError) throw error;

			if (get(error, "cause.constraint") === "resume_slug_user_id_unique") {
				throw new ORPCError("RESUME_SLUG_ALREADY_EXISTS", { status: 400 });
			}

			console.error("Failed to update resume:", error);
			throw new ORPCError("INTERNAL_SERVER_ERROR", { message: "Failed to update resume" });
		}
	},

	patch: async (input: { id: string; userId: string; operations: JsonPatchOperation[]; expectedUpdatedAt?: Date }) => {
		const resume = await applyResumePatchTx(db, input);

		await notifyResumeUpdated({
			type: "resume.updated",
			resumeId: resume.id,
			userId: input.userId,
			updatedAt: resume.updatedAt.toISOString(),
			mutation: "patch",
		});

		return resume;
	},

	patchInTransaction: applyResumePatchTx,

	notifyResumePatched: async (input: { resumeId: string; userId: string; updatedAt: Date }) => {
		await notifyResumeUpdated({
			type: "resume.updated",
			resumeId: input.resumeId,
			userId: input.userId,
			updatedAt: input.updatedAt.toISOString(),
			mutation: "patch",
		});
	},

	setLocked: async (input: { id: string; userId: string; isLocked: boolean }) => {
		const [resume] = await db
			.update(schema.resume)
			.set({ isLocked: input.isLocked })
			.where(and(eq(schema.resume.id, input.id), eq(schema.resume.userId, input.userId)))
			.returning({ id: schema.resume.id, updatedAt: schema.resume.updatedAt });

		if (!resume) return;

		await notifyResumeUpdated({
			type: "resume.updated",
			resumeId: resume.id,
			userId: input.userId,
			updatedAt: resume.updatedAt.toISOString(),
			mutation: "lock",
		});
	},

	setPassword: async (input: { id: string; userId: string; password: string }) => {
		const hashedPassword = await hash(input.password, 10);

		const [resume] = await db
			.update(schema.resume)
			.set({ password: hashedPassword })
			.where(and(eq(schema.resume.id, input.id), eq(schema.resume.userId, input.userId)))
			.returning({ id: schema.resume.id, updatedAt: schema.resume.updatedAt });

		if (!resume) return;

		await notifyResumeUpdated({
			type: "resume.updated",
			resumeId: resume.id,
			userId: input.userId,
			updatedAt: resume.updatedAt.toISOString(),
			mutation: "password",
		});
	},

	verifyPassword: async (input: { slug: string; username: string; password: string; responseHeaders?: Headers }) => {
		const [resume] = await db
			.select({ id: schema.resume.id, password: schema.resume.password })
			.from(schema.resume)
			.innerJoin(schema.user, eq(schema.resume.userId, schema.user.id))
			.where(
				and(
					isNotNull(schema.resume.password),
					eq(schema.resume.slug, input.slug),
					eq(schema.user.username, input.username),
				),
			);

		if (!resume) throw new ORPCError("INVALID_PASSWORD", { status: 401 });

		const passwordHash = resume.password as string;
		const isValid = await compare(input.password, passwordHash);

		if (!isValid) throw new ORPCError("INVALID_PASSWORD", { status: 401 });

		if (input.responseHeaders) grantResumeAccess(input.responseHeaders, resume.id, passwordHash);

		return true;
	},

	removePassword: async (input: { id: string; userId: string }) => {
		const [resume] = await db
			.update(schema.resume)
			.set({ password: null })
			.where(and(eq(schema.resume.id, input.id), eq(schema.resume.userId, input.userId)))
			.returning({ id: schema.resume.id, updatedAt: schema.resume.updatedAt });

		if (!resume) return;

		await notifyResumeUpdated({
			type: "resume.updated",
			resumeId: resume.id,
			userId: input.userId,
			updatedAt: resume.updatedAt.toISOString(),
			mutation: "password",
		});
	},

	delete: async (input: { id: string; userId: string }) => {
		await db.transaction(async (tx) => {
			const [resume] = await tx
				.select({ isLocked: schema.resume.isLocked })
				.from(schema.resume)
				.where(and(eq(schema.resume.id, input.id), eq(schema.resume.userId, input.userId)));

			if (!resume) throw new ORPCError("NOT_FOUND");
			if (resume.isLocked) throw new ORPCError("RESUME_LOCKED");

			await tx.delete(schema.resume).where(and(eq(schema.resume.id, input.id), eq(schema.resume.userId, input.userId)));
		});

		// Clean up storage files after the DB transaction succeeds
		const storageService = getStorageService();
		await Promise.allSettled([
			storageService.delete(`uploads/${input.userId}/screenshots/${input.id}`),
			storageService.delete(`uploads/${input.userId}/pdfs/${input.id}`),
		]);

		await notifyResumeUpdated({
			type: "resume.updated",
			resumeId: input.id,
			userId: input.userId,
			updatedAt: new Date().toISOString(),
			mutation: "delete",
		});
	},
};
