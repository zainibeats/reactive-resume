import type { ResumeData } from "@reactive-resume/schema/resume/data";
import type { JsonPatchError, Operation } from "fast-json-patch";
import jsonpatch from "fast-json-patch";
import z from "zod";
import { resumeDataSchema } from "@reactive-resume/schema/resume/data";

/**
 * A Zod schema that models JSON Patch (RFC 6902) operations as a discriminated union on `op`.
 * This ensures required fields (`value` for add/replace/test, `from` for move/copy) are
 * validated at the request boundary rather than failing later at the `fast-json-patch` layer.
 */
export const jsonPatchOperationSchema = z.discriminatedUnion("op", [
	z.object({ op: z.literal("add"), path: z.string(), value: z.unknown() }),
	z.object({ op: z.literal("remove"), path: z.string() }),
	z.object({ op: z.literal("replace"), path: z.string(), value: z.unknown() }),
	z.object({ op: z.literal("move"), path: z.string(), from: z.string() }),
	z.object({ op: z.literal("copy"), path: z.string(), from: z.string() }),
	z.object({ op: z.literal("test"), path: z.string(), value: z.unknown() }),
]);

export type JsonPatchOperation = z.infer<typeof jsonPatchOperationSchema>;

type RebasedResumePatchOperation = {
	baseOperation: JsonPatchOperation;
	operation: JsonPatchOperation;
};

export function createResumePatches(previous: ResumeData, next: ResumeData): JsonPatchOperation[] {
	return z.array(jsonPatchOperationSchema).parse(jsonpatch.compare(previous, next));
}

function decodeJsonPointerSegment(segment: string): string {
	return segment.replaceAll("~1", "/").replaceAll("~0", "~");
}

function getJsonPointerParent(path: string): string {
	if (path === "") return "";

	const index = path.lastIndexOf("/");
	return index <= 0 ? "" : path.slice(0, index);
}

function encodeJsonPointerSegment(segment: string): string {
	return segment.replaceAll("~", "~0").replaceAll("/", "~1");
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

function valuesEqual(left: unknown, right: unknown): boolean {
	return JSON.stringify(left) === JSON.stringify(right);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function findItemIndexById(items: unknown, id: unknown): number | null {
	if (!Array.isArray(items) || typeof id !== "string") return null;

	const index = items.findIndex((item) => isRecord(item) && item.id === id);
	return index === -1 ? null : index;
}

function rebaseStandardSectionItemPath(input: {
	base: ResumeData;
	target: ResumeData;
	segments: string[];
}): string | null {
	const [, section, itemsKey, itemIndex, ...rest] = input.segments;
	if (section === undefined || itemsKey !== "items" || itemIndex === undefined) return null;

	const baseItems = getValueAtJsonPointer(input.base, `/sections/${encodeJsonPointerSegment(section)}/items`);
	const targetItems = getValueAtJsonPointer(input.target, `/sections/${encodeJsonPointerSegment(section)}/items`);
	const baseItem = Array.isArray(baseItems) ? baseItems[Number(itemIndex)] : undefined;
	const targetIndex = findItemIndexById(targetItems, isRecord(baseItem) ? baseItem.id : undefined);

	if (targetIndex === null) return null;

	return ["", "sections", section, "items", String(targetIndex), ...rest]
		.map((segment, index) => (index === 0 ? segment : encodeJsonPointerSegment(segment)))
		.join("/");
}

function rebaseCustomSectionItemPath(input: {
	base: ResumeData;
	target: ResumeData;
	segments: string[];
}): string | null {
	const [, sectionIndex, itemsKey, itemIndex, ...rest] = input.segments;
	if (sectionIndex === undefined || itemsKey !== "items" || itemIndex === undefined) return null;

	const baseSection = input.base.customSections[Number(sectionIndex)];
	if (!baseSection) return null;

	const targetSectionIndex = input.target.customSections.findIndex((section) => section.id === baseSection.id);
	if (targetSectionIndex === -1) return null;

	const baseItem = baseSection.items[Number(itemIndex)];
	const targetIndex = findItemIndexById(input.target.customSections[targetSectionIndex]?.items, baseItem?.id);
	if (targetIndex === null) return null;

	return ["", "customSections", String(targetSectionIndex), "items", String(targetIndex), ...rest]
		.map((segment, index) => (index === 0 ? segment : encodeJsonPointerSegment(segment)))
		.join("/");
}

function rebaseResumeItemPath(input: { base: ResumeData; target: ResumeData; path: string }): string {
	if (!input.path.startsWith("/")) return input.path;

	const segments = input.path.slice(1).split("/").map(decodeJsonPointerSegment);
	const [root] = segments;
	const rebased =
		root === "sections"
			? rebaseStandardSectionItemPath({ base: input.base, target: input.target, segments })
			: root === "customSections"
				? rebaseCustomSectionItemPath({ base: input.base, target: input.target, segments })
				: null;

	return rebased ?? input.path;
}

function rebaseResumePatchOperation(input: {
	base: ResumeData;
	target: ResumeData;
	operation: JsonPatchOperation;
}): JsonPatchOperation {
	const path = rebaseResumeItemPath({ base: input.base, target: input.target, path: input.operation.path });

	if (input.operation.op === "copy" || input.operation.op === "move") {
		return {
			...input.operation,
			path,
			from: rebaseResumeItemPath({ base: input.base, target: input.target, path: input.operation.from }),
		};
	}

	return { ...input.operation, path };
}

export function rebaseResumePatchOperations(input: {
	base: ResumeData;
	target: ResumeData;
	operations: JsonPatchOperation[];
}): RebasedResumePatchOperation[] {
	return input.operations.map((operation) => ({
		baseOperation: operation,
		operation: rebaseResumePatchOperation({ base: input.base, target: input.target, operation }),
	}));
}

function conflictPathForOperation(operation: JsonPatchOperation): string {
	switch (operation.op) {
		case "add":
			return getJsonPointerParent(operation.path);
		case "copy":
		case "move":
			return operation.from;
		case "remove":
		case "replace":
		case "test":
			return operation.path;
	}
}

export function findResumePatchConflicts(input: {
	base: ResumeData;
	target: ResumeData;
	operations: JsonPatchOperation[];
}): string[] {
	const conflictPaths = new Set<string>();

	for (const operation of input.operations) {
		const conflictPath = conflictPathForOperation(operation);
		const baseValue = getValueAtJsonPointer(input.base, conflictPath);
		const targetValue = getValueAtJsonPointer(input.target, conflictPath);

		if (!valuesEqual(baseValue, targetValue)) conflictPaths.add(conflictPath);
	}

	return Array.from(conflictPaths).sort((a, b) => a.localeCompare(b));
}

export function findRebasedResumePatchConflicts(input: {
	base: ResumeData;
	target: ResumeData;
	operations: RebasedResumePatchOperation[];
}): string[] {
	const conflictPaths = new Set<string>();

	for (const { baseOperation, operation } of input.operations) {
		const baseConflictPath = conflictPathForOperation(baseOperation);
		const targetConflictPath = conflictPathForOperation(operation);
		const baseValue = getValueAtJsonPointer(input.base, baseConflictPath);
		const targetValue = getValueAtJsonPointer(input.target, targetConflictPath);

		if (!valuesEqual(baseValue, targetValue)) conflictPaths.add(targetConflictPath);
	}

	return Array.from(conflictPaths).sort((a, b) => a.localeCompare(b));
}

/**
 * A structured error thrown when a JSON Patch operation fails.
 * Contains only the relevant details -- never the full document tree.
 */
export class ResumePatchError extends Error {
	/** The error code from `fast-json-patch`, e.g. `TEST_OPERATION_FAILED`. */
	code: string;
	/** The zero-based index of the failing operation in the operations array. */
	index: number;
	/** The operation object that caused the failure. */
	operation: Operation;

	constructor(code: string, message: string, index: number, operation: Operation) {
		super(message);
		this.name = "ResumePatchError";
		this.code = code;
		this.index = index;
		this.operation = operation;
	}
}

/**
 * Human-readable messages for each `fast-json-patch` error code.
 * These are returned to the API consumer instead of the raw library output.
 */
const patchErrorMessages: Record<string, string> = {
	SEQUENCE_NOT_AN_ARRAY: "Patch sequence must be an array.",
	OPERATION_NOT_AN_OBJECT: "Operation is not an object.",
	OPERATION_OP_INVALID: "Operation `op` property is not one of the operations defined in RFC 6902.",
	OPERATION_PATH_INVALID: "Operation `path` property is not a valid JSON Pointer string.",
	OPERATION_FROM_REQUIRED: "Operation `from` property is required for `move` and `copy` operations.",
	OPERATION_VALUE_REQUIRED: "Operation `value` property is required for `add`, `replace`, and `test` operations.",
	OPERATION_VALUE_CANNOT_CONTAIN_UNDEFINED:
		"Operation `value` contains an `undefined` value, which is not valid in JSON.",
	OPERATION_PATH_CANNOT_ADD: "Cannot perform an `add` operation at the desired path.",
	OPERATION_PATH_UNRESOLVABLE: "Cannot perform the operation at a path that does not exist.",
	OPERATION_FROM_UNRESOLVABLE: "Cannot perform the operation from a path that does not exist.",
	OPERATION_PATH_ILLEGAL_ARRAY_INDEX: "Array index in path must be an unsigned base-10 integer.",
	OPERATION_VALUE_OUT_OF_BOUNDS: "The specified array index is greater than the number of elements in the array.",
	TEST_OPERATION_FAILED: "Test operation failed -- the value at the given path did not match the expected value.",
};

/**
 * Checks whether an error is a `JsonPatchError` from `fast-json-patch`.
 * The library doesn't export the class directly, so we duck-type it.
 */
function isJsonPatchError(error: unknown): error is JsonPatchError {
	return error instanceof Error && "index" in error && "operation" in error;
}

/**
 * Converts a `JsonPatchError` into a clean `ResumePatchError` that omits the document tree.
 */
function toResumePatchError(error: JsonPatchError): ResumePatchError {
	const code = error.name;
	const message = patchErrorMessages[code] ?? error.message;
	const index = error.index ?? 0;
	const operation = error.operation as Operation;

	return new ResumePatchError(code, message, index, operation);
}

/**
 * Applies an array of JSON Patch (RFC 6902) operations to a `ResumeData` object.
 *
 * This function validates the operations before applying them, then validates the
 * resulting document against the `resumeDataSchema` to ensure the patched data is
 * still a valid resume.
 *
 * The original `data` object is not mutated; a deep clone is created internally.
 *
 * @see https://docs.rxresu.me/guides/using-the-patch-api - for usage examples and API details.
 * @see https://datatracker.ietf.org/doc/html/rfc6902 - JSON Patch specification.
 *
 * @param data - The current resume data to patch.
 * @param operations - An array of JSON Patch operations to apply.
 * @returns The patched and validated `ResumeData` object.
 * @throws {ResumePatchError} If the operations are structurally invalid or target non-existent paths.
 * @throws {ResumePatchError} If a `test` operation does not match.
 * @throws {Error} If the patched document does not conform to the `ResumeData` schema.
 */
export function applyResumePatches(data: ResumeData, operations: Operation[]): ResumeData {
	// Validate operations structurally before applying.
	const validationError = jsonpatch.validate(operations, data);
	if (validationError) throw toResumePatchError(validationError);

	// Apply operations. applyPatch throws on `test` failures.
	let patched: ResumeData;

	try {
		const result = jsonpatch.applyPatch(data, operations, false, false);
		patched = result.newDocument;
	} catch (error: unknown) {
		if (isJsonPatchError(error)) throw toResumePatchError(error);
		throw error;
	}

	// Validate the result still conforms to ResumeData.
	const parsed = resumeDataSchema.safeParse(patched);
	if (!parsed.success) throw new Error(`Patch produced invalid resume data: ${parsed.error.message}`);

	return parsed.data;
}
