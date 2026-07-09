import { flattenError, ZodError } from "zod";

/** Rethrows a ZodError as a serialized string error; re-throws other errors as-is. */
export function rethrowAsImportError(error: unknown): never {
	if (error instanceof ZodError) {
		throw new Error(JSON.stringify(flattenError(error)));
	}
	throw error;
}
