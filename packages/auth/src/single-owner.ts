import { APIError } from "better-auth";
import { db } from "@reactive-resume/db/client";
import * as schema from "@reactive-resume/db/schema";

export async function ensureOwnerSlotAvailable() {
	const existingOwner = await db.select({ id: schema.user.id }).from(schema.user).limit(1);

	if (existingOwner.length > 0) {
		throw new APIError("FORBIDDEN", { message: "This instance already has an owner." });
	}
}
