import { db } from "@reactive-resume/db/client";
import * as schema from "@reactive-resume/db/schema";
import { env } from "@reactive-resume/env/server";

export type FeatureFlags = {
	disableSignups: boolean;
	disableEmailAuth: boolean;
};

export const flagsService = {
	getFlags: async (): Promise<FeatureFlags> => {
		const existingOwner = await db.select({ id: schema.user.id }).from(schema.user).limit(1);

		return {
			disableSignups: env.FLAG_DISABLE_SIGNUPS || existingOwner.length > 0,
			disableEmailAuth: env.FLAG_DISABLE_EMAIL_AUTH,
		};
	},
};
