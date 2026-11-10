import { ORPCError } from "@orpc/server";
import { createSelectSchema } from "drizzle-zod";
import z from "zod";
import { auth } from "@reactive-resume/auth/config";
import * as schema from "@reactive-resume/db/schema";
import { env } from "@reactive-resume/env/server";
import { accountBackupLimits, accountUploadSkipReasons } from "@reactive-resume/utils/account-zip";
import { protectedProcedure, publicProcedure } from "../../context";
import { resumeDto } from "../../dto/resume";
import { authService } from "./service";

// Sessions last a week; creating an API key, or deleting the account, needs a sign-in from the last day.
const RECENT_SIGN_IN_MS = 24 * 60 * 60 * 1000;

async function assertRecentSignIn(headers: Headers | undefined) {
	const session = headers ? await auth.api.getSession({ headers, query: { disableCookieCache: true } }) : null;
	const signedInAt = session ? new Date(session.session.createdAt).getTime() : 0;
	if (Date.now() - signedInAt > RECENT_SIGN_IN_MS)
		throw new ORPCError("FORBIDDEN", { message: "For your security, sign out and sign in again, then try again." });
}

export const authRouter = {
	providers: {
		list: publicProcedure
			.route({
				method: "GET",
				path: "/auth/providers",
				tags: ["Authentication"],
				operationId: "listAuthProviders",
				summary: "List authentication providers",
				description:
					"Returns a list of all authentication providers enabled on this Reactive Resume instance, along with their display names. Possible providers include password-based credentials, Google, GitHub, LinkedIn, and custom OAuth. No authentication required.",
				successDescription: "A map of enabled authentication provider identifiers to their display names.",
			})
			.input(z.object({}).optional())
			.output(z.partialRecord(z.enum(["credential", "passkey", "google", "github", "linkedin", "custom"]), z.string()))
			.handler(() => authService.providers.list()),
	},

	createApiKey: protectedProcedure
		.route({
			method: "POST",
			path: "/auth/api-keys",
			tags: ["Authentication"],
			operationId: "createScopedApiKey",
			summary: "Create an API key",
			description:
				"Create a read-only or full-access API key. Requires a browser session; keys and OAuth tokens cannot create credentials.",
		})
		.input(
			z.object({
				name: z.string().trim().min(1).max(64),
				expiresIn: z.number().int().positive().nullable(),
				access: z.enum(["read", "full"]),
			}),
		)
		.output(z.object({ key: z.string() }))
		.handler(async ({ context, input }) => {
			if (context.authentication?.method !== "session")
				throw new ORPCError("FORBIDDEN", { message: "Create API keys from Settings in a web browser." });
			await assertRecentSignIn(context.reqHeaders);
			const result = await auth.api.createApiKey({
				body: {
					userId: context.user.id,
					name: input.name,
					expiresIn: input.expiresIn,
					permissions: { api: input.access === "read" ? ["read"] : ["read", "write", "delete"] },
				},
			});
			return { key: result.key };
		}),

	setPassword: protectedProcedure
		.route({
			// Session only: keys and OAuth tokens can't add a password.
			spec: (operation) => ({ ...operation, security: [{ cookieAuth: [] }] }),
			method: "POST",
			path: "/auth/password",
			tags: ["Authentication"],
			operationId: "setPassword",
			summary: "Set a password",
			description:
				"Adds a password to an account that signs in another way (a social account or passkey). Unlike a password reset, it keeps other devices signed in and keeps API keys, passkeys and connected apps. Requires a recent browser session.",
		})
		.input(z.object({ newPassword: z.string().min(8).max(64) }))
		.output(z.void())
		.handler(async ({ context, input }) => {
			if (context.authentication?.method !== "session")
				throw new ORPCError("FORBIDDEN", { message: "Set a password from Settings in a web browser." });
			if (env.FLAG_DISABLE_EMAIL_AUTH)
				throw new ORPCError("FORBIDDEN", { message: "Password sign-in is turned off on this server." });
			await assertRecentSignIn(context.reqHeaders);
			await auth.api.setPassword({
				body: { newPassword: input.newPassword },
				headers: context.reqHeaders ?? new Headers(),
			});
		}),

	exportData: protectedProcedure
		.route({
			method: "GET",
			path: "/auth/account/export",
			tags: ["Authentication"],
			operationId: "exportAccountData",
			summary: "Export user account data",
			description:
				"Returns the authenticated user's profile fields, resumes and their version histories. Set includeUploads to include bounded base64 bytes for files the exported resumes reference, with explicit omissions; external URLs are not fetched. Secrets such as password hashes, tokens and API keys are never included. Requires authentication.",
			successDescription: "The user's exported account data.",
		})
		.input(z.object({ includeUploads: z.union([z.boolean(), z.literal("")]).optional() }).optional())
		.output(
			z.object({
				exportedAt: z.string(),
				uploads: z
					.object({
						files: z
							.array(
								z.object({ key: z.string(), base64: z.string().max(Math.ceil(accountBackupLimits.fileBytes / 3) * 4) }),
							)
							.max(accountBackupLimits.files),
						skipped: z.array(z.object({ key: z.string(), reason: z.enum(accountUploadSkipReasons) })),
					})
					.optional(),
				documentVersions: z
					.object({
						resumes: z.array(
							z.object({
								id: z.string(),
								resumeId: z.string(),
								kind: z.enum(schema.RESUME_VERSION_KINDS),
								name: z.string().nullable(),
								data: resumeDto.getById.output.shape.data,
								createdAt: z.date(),
							}),
						),
					})
					.optional(),
				user: createSelectSchema(schema.user).pick({
					id: true,
					name: true,
					email: true,
					username: true,
					displayUsername: true,
					image: true,
					emailVerified: true,
					createdAt: true,
					updatedAt: true,
				}),
				resumes: z.array(
					resumeDto.getById.output.omit({
						hasPassword: true,
						// Child-resume lineage is instance-local; an imported backup starts unlinked.
						revision: true,
						parentId: true,
						parentRevision: true,
					}),
				),
			}),
		)
		.handler(({ context, input, signal }) =>
			authService.exportData({ userId: context.user.id, includeUploads: input?.includeUploads === true, signal }),
		),

	deleteAccount: protectedProcedure
		.route({
			spec: (operation) => ({ ...operation, security: [{ cookieAuth: [] }] }),
			method: "DELETE",
			path: "/auth/account",
			tags: ["Authentication"],
			operationId: "deleteAccount",
			summary: "Delete user account",
			description:
				"Permanently deletes the authenticated user's account, including all resumes, uploaded files (profile pictures, screenshots, PDFs), and associated data. This action is irreversible. Requires a browser session; keys and OAuth tokens cannot delete accounts.",
			successDescription: "The user account and all associated data have been successfully deleted.",
		})
		.input(z.object({}).optional())
		.output(z.void())
		.handler(async ({ context }) => {
			if (context.authentication?.method !== "session")
				throw new ORPCError("FORBIDDEN", { message: "Delete your account from Settings in a web browser." });
			await assertRecentSignIn(context.reqHeaders);
			await authService.deleteAccount({ userId: context.user.id });
		}),
};
