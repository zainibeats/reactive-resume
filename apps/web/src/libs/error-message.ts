import { ORPCError } from "@orpc/client";

export function getReadableErrorMessage(error: unknown, fallback: string): string {
	if (typeof error === "string" && error) return error;
	if (error instanceof Error && error.message) return error.message;
	// Better Auth client errors are plain objects ({ code, message, status }), not Error instances.
	if (typeof error === "object" && error !== null && "message" in error) {
		const { message } = error as { message?: unknown };
		if (typeof message === "string" && message) return message;
	}
	return fallback;
}

type ErrorMessageByCode = Record<string, string>;

export function getOrpcErrorMessage(
	error: unknown,
	options: {
		fallback: string;
		byCode?: ErrorMessageByCode;
		allowServerMessage?: boolean;
	},
): string {
	if (!(error instanceof ORPCError)) return getReadableErrorMessage(error, options.fallback);

	const mappedMessage = options.byCode?.[error.code];
	if (mappedMessage) return mappedMessage;

	if (options.allowServerMessage && error.message) return error.message;
	return options.fallback;
}

export function getResumeErrorMessage(error: unknown): string {
	return getOrpcErrorMessage(error, {
		byCode: {
			RESUME_SLUG_ALREADY_EXISTS: "A resume with this slug already exists.",
			RESUME_LOCKED: "This resume is locked. Unlock it first to make changes.",
			RESUME_HAS_NO_PARENT: "This resume is not linked to a parent resume.",
			RESUME_PARENT_NOT_FOUND: "The parent resume no longer exists.",
			RESUME_SYNC_CONFLICT: "Some updates overlap your own edits. Select them again to replace your version.",
		},
		fallback: "Something went wrong. Please try again.",
	});
}
