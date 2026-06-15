import type { ResumeData } from "@reactive-resume/schema/resume/data";
import type { QueryClient, QueryKey } from "@tanstack/react-query";
import type { WritableDraft } from "immer";
import { t } from "@lingui/core/macro";
import { consumeEventIterator, ORPCError } from "@orpc/client";
import { useQueryClient } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";
import { debounce, isEqual } from "es-toolkit";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { immer } from "zustand/middleware/immer";
import { create } from "zustand/react";
import { orpc, streamClient } from "@/libs/orpc/client";

export type Resume = {
	id: string;
	name: string;
	slug: string;
	tags: string[];
	data: ResumeData;
	revision: number;
	parentId?: string | null;
	parentRevision?: number | null;
	isLocked: boolean;
	updatedAt: Date;
	hasPassword?: boolean;
	isPublic?: boolean;
};

type ResumeStoreState = {
	resume: Resume | null;
	resumeId?: string;
	isReady: boolean;
	undoStack: ResumeData[];
	redoStack: ResumeData[];
};

type ResumeStoreActions = {
	initialize: (resume: Resume | null) => void;
	reset: () => void;
	replaceResumeDraft: (resume: Resume) => void;
	replaceResumeFromServer: (resume: Resume) => void;
	updateResumeData: (fn: (draft: WritableDraft<ResumeData>) => void) => void;
	patchResume: (fn: (draft: WritableDraft<Resume>) => void) => void;
	mergeResumeMetadata: (resume: Resume) => void;
	undoResumeData: () => void;
	redoResumeData: () => void;
};

type ResumeStore = ResumeStoreState & ResumeStoreActions;

type Runtime = {
	abortController: AbortController;
	queryClient?: QueryClient;
	hasPendingLocalChanges: boolean;
	isSaving: boolean;
	pendingResume?: Resume;
	savingPromise?: Promise<void>;
	syncErrorToastId?: string | number;
	syncResume: ReturnType<typeof debounce<(resume: Resume) => void>>;
	beforeUnloadHandler?: () => void;
};

type ResumeUpdateSubscriptionOptions = {
	resumeId?: string;
	onUpdate: () => Promise<void> | void;
	onError?: (error: unknown) => void;
};

const SAVE_DEBOUNCE_MS = 500;
const MAX_RESUME_HISTORY = 100;
const runtimes = new Map<string, Runtime>();

let lockedToastId: string | number | undefined;

function getResumeQueryKey(id: string): QueryKey {
	return orpc.resume.getById.queryOptions({ input: { id } }).queryKey as QueryKey;
}

function cloneResumeData(data: ResumeData): ResumeData {
	return structuredClone(data);
}

function cloneResume(resume: Resume): Resume {
	return { ...resume, data: cloneResumeData(resume.data) };
}

function pushResumeHistory(stack: ResumeData[], data: ResumeData) {
	stack.push(cloneResumeData(data));
	if (stack.length > MAX_RESUME_HISTORY) stack.shift();
}

function createResumeUpdateEventIterator(resumeId: string) {
	return streamClient.resume.updates.subscribe({ id: resumeId });
}

function setRuntimeBaseline(resume: Resume) {
	const runtime = getRuntime(resume.id);
	runtime.hasPendingLocalChanges = false;
	runtime.pendingResume = undefined;
}

async function flushResumeSave(id: string) {
	const runtime = runtimes.get(id);
	if (!runtime?.pendingResume) return runtime?.savingPromise;
	if (runtime.isSaving) return runtime.savingPromise;

	const savingPromise = savePendingResume(id, runtime);
	runtime.savingPromise = savingPromise;

	try {
		await savingPromise;
	} finally {
		if (runtime.savingPromise === savingPromise) runtime.savingPromise = undefined;
	}
}

async function savePendingResume(id: string, runtime: Runtime) {
	const submitted = runtime.pendingResume;
	if (!submitted) return;

	const submittedData = cloneResumeData(submitted.data);
	runtime.pendingResume = undefined;
	runtime.isSaving = true;

	try {
		const updated = (await orpc.resume.update.call(
			{ id: submitted.id, data: submittedData },
			{ signal: runtime.abortController.signal },
		)) as Resume;

		runtime.queryClient?.setQueryData(getResumeQueryKey(submitted.id), updated);

		const currentResume = useResumeStore.getState().resume;
		const currentDataStillMatchesSubmission =
			currentResume?.id === submitted.id && isEqual(currentResume.data, submittedData);

		if (currentDataStillMatchesSubmission && !runtime.pendingResume) {
			runtime.hasPendingLocalChanges = false;
			useResumeStore.getState().replaceResumeFromServer(updated);
		} else {
			runtime.hasPendingLocalChanges = true;
			useResumeStore.getState().mergeResumeMetadata(updated);

			if (!runtime.pendingResume && currentResume?.id === submitted.id && !isEqual(currentResume.data, submittedData)) {
				runtime.syncResume.cancel();
				runtime.pendingResume = cloneResume(currentResume);
			}
		}

		if (runtime.syncErrorToastId !== undefined) {
			toast.dismiss(runtime.syncErrorToastId);
			runtime.syncErrorToastId = undefined;
		}
	} catch (error: unknown) {
		if (error instanceof DOMException && error.name === "AbortError") return;

		if (error instanceof ORPCError && error.code === "NOT_FOUND") {
			runtime.pendingResume = undefined;
			runtime.hasPendingLocalChanges = false;
			runtime.syncErrorToastId = toast.error(t`This resume could not be saved because it is no longer available.`, {
				id: runtime.syncErrorToastId,
				duration: Number.POSITIVE_INFINITY,
			});
			return;
		}

		runtime.pendingResume ??= submitted;
		runtime.hasPendingLocalChanges = true;
		runtime.syncErrorToastId = toast.error(t`Your latest changes could not be saved.`, {
			id: runtime.syncErrorToastId,
			duration: Number.POSITIVE_INFINITY,
		});
	} finally {
		runtime.isSaving = false;
		if (runtime.pendingResume && runtime.syncErrorToastId === undefined) void flushResumeSave(id);
	}
}

export async function flushPendingResumeSave(id: string) {
	const runtime = runtimes.get(id);
	if (!runtime) return;

	runtime.syncResume.flush();

	while (runtime.pendingResume || runtime.isSaving) {
		await flushResumeSave(id);

		if (runtime.syncErrorToastId !== undefined && runtime.pendingResume) {
			throw new Error("The resume has unsaved changes that could not be saved.");
		}
	}
}

function queueResumeSave(resume: Resume) {
	const runtime = getRuntime(resume.id);
	runtime.pendingResume = cloneResume(resume);
	runtime.hasPendingLocalChanges = true;
	void flushResumeSave(resume.id);
}

function createRuntime(): Runtime {
	const abortController = new AbortController();

	const syncResume = debounce(
		(resume: Resume) => {
			queueResumeSave(resume);
		},
		SAVE_DEBOUNCE_MS,
		{ signal: abortController.signal },
	);

	const runtime: Runtime = {
		abortController,
		hasPendingLocalChanges: false,
		isSaving: false,
		syncResume,
	};

	if (typeof window !== "undefined") {
		runtime.beforeUnloadHandler = () => runtime.syncResume.flush();
		window.addEventListener("beforeunload", runtime.beforeUnloadHandler);
	}

	return runtime;
}

function getRuntime(id: string): Runtime {
	const existing = runtimes.get(id);
	if (existing) return existing;

	const runtime = createRuntime();
	runtimes.set(id, runtime);
	return runtime;
}

function bindRuntimeQueryClient(id: string, queryClient: QueryClient) {
	getRuntime(id).queryClient = queryClient;
}

function hasPendingLocalChanges(id: string): boolean {
	return getRuntime(id).hasPendingLocalChanges;
}

function cleanupRuntime(id: string) {
	const runtime = runtimes.get(id);
	if (!runtime) return;

	runtime.syncResume.flush();
	runtime.abortController.abort();

	if (runtime.beforeUnloadHandler && typeof window !== "undefined") {
		window.removeEventListener("beforeunload", runtime.beforeUnloadHandler);
	}

	runtimes.delete(id);
}

function syncCurrentResume(id: string) {
	const resume = useResumeStore.getState().resume;
	if (!resume || resume.id !== id) return;

	getRuntime(id).syncResume(resume);
}

export const useResumeStore = create<ResumeStore>()(
	immer((set, get) => ({
		resume: null,
		resumeId: undefined,
		isReady: false,
		undoStack: [],
		redoStack: [],

		initialize: (resume) => {
			if (resume) setRuntimeBaseline(resume);

			set((state) => {
				state.resume = resume;
				state.resumeId = resume?.id;
				state.isReady = resume !== null;
				state.undoStack = [];
				state.redoStack = [];
			});
		},

		reset: () => {
			set((state) => {
				state.resume = null;
				state.resumeId = undefined;
				state.isReady = false;
				state.undoStack = [];
				state.redoStack = [];
			});
		},

		replaceResumeDraft: (resume) => {
			set((state) => {
				state.resume = resume;
				state.resumeId = resume.id;
				state.isReady = true;
				state.undoStack = [];
				state.redoStack = [];
			});
		},

		replaceResumeFromServer: (resume) => {
			setRuntimeBaseline(resume);
			const currentResume = get().resume;
			const historyEntry =
				currentResume?.id === resume.id && !isEqual(currentResume.data, resume.data)
					? cloneResumeData(currentResume.data)
					: null;

			set((state) => {
				if (historyEntry) {
					pushResumeHistory(state.undoStack, historyEntry);
					state.redoStack = [];
				}

				state.resume = resume;
				state.resumeId = resume.id;
				state.isReady = true;
			});
		},

		patchResume: (fn) => {
			set((state) => {
				if (!state.resume) return;
				fn(state.resume as WritableDraft<Resume>);
			});
		},

		mergeResumeMetadata: (resume) => {
			set((state) => {
				if (!state.resume || state.resume.id !== resume.id) return;

				state.resume.name = resume.name;
				state.resume.slug = resume.slug;
				state.resume.tags = resume.tags;
				state.resume.isLocked = resume.isLocked;
				state.resume.updatedAt = resume.updatedAt;
				state.resume.revision = resume.revision;
				state.resume.parentId = resume.parentId;
				state.resume.parentRevision = resume.parentRevision;
				state.resume.hasPassword = resume.hasPassword;
				state.resume.isPublic = resume.isPublic;
			});
		},

		updateResumeData: (fn) => {
			const currentResume = get().resume;
			if (!currentResume) return;

			if (currentResume.isLocked) {
				lockedToastId = toast.error(t`This resume is locked and cannot be updated.`, {
					id: lockedToastId,
				});
				return;
			}

			const before = cloneResumeData(currentResume.data);
			let didChange = false;

			set((state) => {
				if (!state.resume) return;
				fn(state.resume.data as WritableDraft<ResumeData>);

				if (!isEqual(before, state.resume.data)) {
					pushResumeHistory(state.undoStack, before);
					state.redoStack = [];
					didChange = true;
				}
			});

			if (didChange) {
				getRuntime(currentResume.id).hasPendingLocalChanges = true;
				syncCurrentResume(currentResume.id);
			}
		},

		undoResumeData: () => {
			const currentResume = get().resume;
			if (!currentResume) return;

			if (currentResume.isLocked) {
				lockedToastId = toast.error(t`This resume is locked and cannot be updated.`, {
					id: lockedToastId,
				});
				return;
			}

			const currentData = cloneResumeData(currentResume.data);
			let didChange = false;

			set((state) => {
				if (!state.resume || state.undoStack.length === 0) return;
				const previous = state.undoStack.pop();
				if (!previous) return;

				pushResumeHistory(state.redoStack, currentData);
				state.resume.data = previous;
				didChange = true;
			});

			if (didChange) {
				getRuntime(currentResume.id).hasPendingLocalChanges = true;
				syncCurrentResume(currentResume.id);
			}
		},

		redoResumeData: () => {
			const currentResume = get().resume;
			if (!currentResume) return;

			if (currentResume.isLocked) {
				lockedToastId = toast.error(t`This resume is locked and cannot be updated.`, {
					id: lockedToastId,
				});
				return;
			}

			const currentData = cloneResumeData(currentResume.data);
			let didChange = false;

			set((state) => {
				if (!state.resume || state.redoStack.length === 0) return;
				const next = state.redoStack.pop();
				if (!next) return;

				pushResumeHistory(state.undoStack, currentData);
				state.resume.data = next;
				didChange = true;
			});

			if (didChange) {
				getRuntime(currentResume.id).hasPendingLocalChanges = true;
				syncCurrentResume(currentResume.id);
			}
		},
	})),
);

export function useInitializeResumeStore() {
	return useResumeStore((state) => state.initialize);
}

function useResetResumeStore() {
	return useResumeStore((state) => state.reset);
}

export function useMergeResumeMetadata() {
	return useResumeStore((state) => state.mergeResumeMetadata);
}

export function usePatchResume() {
	return useResumeStore((state) => state.patchResume);
}

export function useCanUndoResumeData() {
	return useResumeStore((state) => state.undoStack.length > 0);
}

export function useCanRedoResumeData() {
	return useResumeStore((state) => state.redoStack.length > 0);
}

export function useUndoResumeData() {
	return useResumeStore((state) => state.undoResumeData);
}

export function useRedoResumeData() {
	return useResumeStore((state) => state.redoResumeData);
}

function useBuilderResumeSelector<T>(selector: (resume: Resume) => T): T | undefined {
	const params = useParams({ strict: false }) as { resumeId?: string };
	const resumeId = params.resumeId;

	return useResumeStore((state) => {
		if (!resumeId || !state.resume || state.resume.id !== resumeId) return undefined;
		return selector(state.resume);
	});
}

export function useCurrentBuilderResumeSelector<T>(selector: (resume: Resume) => T): T {
	const selected = useBuilderResumeSelector(selector);
	if (selected === undefined) throw new Error("Resume data is required before rendering this component.");
	return selected;
}

export function useResume(): Resume | undefined {
	return useBuilderResumeSelector((resume) => resume);
}

export function useCurrentResume(): Resume {
	const resume = useResume();
	if (!resume) throw new Error("Resume data is required before rendering this component.");
	return resume;
}

export function useResumeData(): ResumeData | undefined {
	return useBuilderResumeSelector((resume) => resume.data);
}

export function useUpdateResumeData() {
	const queryClient = useQueryClient();
	const params = useParams({ strict: false }) as { resumeId?: string };
	const resumeId = params.resumeId;
	const updateResumeData = useResumeStore((state) => state.updateResumeData);

	return useCallback(
		(fn: (draft: WritableDraft<ResumeData>) => void) => {
			if (!resumeId) return;
			bindRuntimeQueryClient(resumeId, queryClient);
			updateResumeData(fn);
		},
		[queryClient, resumeId, updateResumeData],
	);
}

export function useResumeUpdateSubscription({ resumeId, onUpdate, onError }: ResumeUpdateSubscriptionOptions) {
	const [_retryNonce, setRetryNonce] = useState(0);

	useEffect(() => {
		if (!resumeId) return;

		let didCancel = false;
		let retryTimer: number | undefined;
		const cancel = consumeEventIterator(createResumeUpdateEventIterator(resumeId), {
			onEvent: async () => {
				try {
					await onUpdate();
				} catch (error) {
					if (error instanceof DOMException && error.name === "AbortError") return;
					onError?.(error);
				}
			},
			onError: (error) => {
				if (didCancel) return;
				onError?.(error);
				retryTimer = window.setTimeout(() => setRetryNonce((value) => value + 1), 2500);
			},
		});

		return () => {
			didCancel = true;
			if (retryTimer) window.clearTimeout(retryTimer);
			void cancel().catch(() => {});
		};
	}, [onError, onUpdate, resumeId]);
}

export function useBuilderResumeUpdateSubscription() {
	const queryClient = useQueryClient();
	const replaceResumeFromServer = useResumeStore((state) => state.replaceResumeFromServer);
	const params = useParams({ strict: false }) as { resumeId?: string };
	const resumeId = params.resumeId;

	const onUpdate = useCallback(async () => {
		if (!resumeId) return;

		bindRuntimeQueryClient(resumeId, queryClient);
		const resume = (await orpc.resume.getById.call({ id: resumeId })) as Resume;

		queryClient.setQueryData(getResumeQueryKey(resumeId), resume);

		if (hasPendingLocalChanges(resumeId)) {
			useResumeStore.getState().mergeResumeMetadata(resume);
			return;
		}

		replaceResumeFromServer(resume);
	}, [queryClient, replaceResumeFromServer, resumeId]);

	const onError = useCallback((error: unknown) => {
		console.warn("Resume update stream failed, reconnecting:", error);
	}, []);

	useResumeUpdateSubscription({ resumeId, onUpdate, onError });
}

export function useResumeCleanup() {
	const params = useParams({ strict: false }) as { resumeId?: string };
	const resumeId = params.resumeId;
	const reset = useResetResumeStore();

	useEffect(() => {
		if (!resumeId) return;

		return () => {
			cleanupRuntime(resumeId);
			reset();
		};
	}, [resumeId, reset]);
}
