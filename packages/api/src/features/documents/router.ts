import z from "zod";
import { protectedProcedure } from "../../context";
import { documentsDto } from "../../dto/documents";
import { resumeMutationRateLimit } from "../../middleware/rate-limit";
import { paginate } from "../../pagination";
import { documentsService } from "./service";

const route = (
	method: "GET" | "POST" | "DELETE",
	path: `/${string}`,
	operationId: string,
	summary: string,
	description: string,
) => ({
	method,
	path,
	tags: ["Documents"],
	operationId,
	summary,
	description: `${description} Requires authentication.`,
});

/** The resume library: list, count, rename, tag, lock, and Trash. */
export const documentsRouter = {
	purgeExpired: protectedProcedure
		.route(
			route(
				"DELETE",
				"/documents/trash/expired",
				"purgeExpiredDocuments",
				"Delete expired Trash",
				"Permanently deletes resumes in this account that have been in Trash more than 30 days.",
			),
		)
		.input(z.object({}).optional())
		.output(z.void())
		.use(resumeMutationRateLimit)
		.handler(({ context }) => documentsService.purgeExpired(context.user.id)),

	list: protectedProcedure
		.route(
			route(
				"GET",
				"/documents",
				"listDocuments",
				"List documents",
				"Returns the user's resumes (or those in Trash), newest edit first.",
			),
		)
		.input(documentsDto.list.input)
		.output(documentsDto.list.output)
		.handler(async ({ context, input }) =>
			paginate(
				await documentsService.list({ userId: context.user.id, trashed: input.trashed }),
				input,
				context.resHeaders,
			),
		),

	counts: protectedProcedure
		.route(
			route(
				"GET",
				"/documents/counts",
				"countDocuments",
				"Count documents",
				"Counts live resumes, and the resumes in Trash.",
			),
		)
		.input(z.object({}).optional())
		.output(documentsDto.counts.output)
		.handler(({ context }) => documentsService.counts({ userId: context.user.id })),

	rename: protectedProcedure
		.route(route("POST", "/documents/rename", "renameDocument", "Rename a document", "Renames a resume."))
		.input(documentsDto.rename.input)
		.use(resumeMutationRateLimit)
		.output(documentsDto.rename.output)
		.handler(({ context, input }) => documentsService.rename({ ...input, userId: context.user.id })),

	setTags: protectedProcedure
		.route(route("POST", "/documents/tags", "setDocumentTags", "Set a document's tags", "Replaces a resume's tags."))
		.input(documentsDto.setTags.input)
		.use(resumeMutationRateLimit)
		.output(documentsDto.setTags.output)
		.handler(({ context, input }) => documentsService.setTags({ ...input, userId: context.user.id })),

	setLocked: protectedProcedure
		.route(
			route(
				"POST",
				"/documents/lock",
				"lockDocument",
				"Lock or unlock a document",
				"Locks a resume against edits and Trash, or unlocks it.",
			),
		)
		.input(documentsDto.setLocked.input)
		.use(resumeMutationRateLimit)
		.output(documentsDto.setLocked.output)
		.handler(({ context, input }) => documentsService.setLocked({ ...input, userId: context.user.id })),

	trash: protectedProcedure
		.route(
			route(
				"POST",
				"/documents/trash",
				"trashDocument",
				"Move a document to Trash",
				"Moves a resume to Trash, where it stays for 30 days. A resume in Trash isn't shared. Locked resumes can't be moved.",
			),
		)
		.input(documentsDto.trash.input)
		.use(resumeMutationRateLimit)
		.output(documentsDto.trash.output)
		.handler(({ context, input }) => documentsService.trash({ ...input, userId: context.user.id })),

	restore: protectedProcedure
		.route(
			route("POST", "/documents/restore", "restoreDocument", "Restore a document", "Brings a resume back from Trash."),
		)
		.input(documentsDto.restore.input)
		.use(resumeMutationRateLimit)
		.output(documentsDto.restore.output)
		.handler(({ context, input }) => documentsService.restore({ ...input, userId: context.user.id })),

	purge: protectedProcedure
		.route(
			route(
				"POST",
				"/documents/purge",
				"purgeDocument",
				"Delete a document now",
				"Permanently deletes a resume that is already in Trash.",
			),
		)
		.input(documentsDto.purge.input)
		.use(resumeMutationRateLimit)
		.output(documentsDto.purge.output)
		.handler(({ context, input }) => documentsService.purge({ ...input, userId: context.user.id })),
};
