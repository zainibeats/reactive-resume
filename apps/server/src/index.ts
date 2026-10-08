import { pathToFileURL } from "node:url";
import { serve } from "@hono/node-server";
import { env } from "@reactive-resume/env/server";
import { runStartupChecks } from "./startup/checks";

export async function main() {
	await runStartupChecks();

	// Load and initialize auth only after migrations have created the provider tables.
	const { createApp } = await import("./http/app");
	const { initializeAuth } = await import("@reactive-resume/auth/config");
	await initializeAuth();

	// Safety net: Node 24 crashes the whole process on an unhandled rejection. One request's
	// stray promise must not take the server down for everyone, so log and keep serving.
	// Registered after startup checks so a broken startup still fails loudly. (Left uncaught
	// exceptions on Node's default crash-and-restart, since process state is unsafe after one.)
	process.on("unhandledRejection", (reason) => {
		console.error("[unhandledRejection]", reason);
	});

	const port =
		process.env.NODE_ENV === "production" ? Number.parseInt(process.env.PORT ?? "3000", 10) : env.SERVER_PORT;

	const app = createApp();

	const server = serve(
		{
			fetch: app.fetch,
			port,
		},
		(info) => {
			console.info(`🚀 Up and running on http://localhost:${info.port}`);
		},
	);

	let shuttingDown = false;
	const shutdown = () => {
		if (shuttingDown) return;
		shuttingDown = true;
		// Stop accepting connections, then wait for active requests before exiting.
		server.close((error) => {
			if (error) {
				console.error("Failed to drain HTTP requests", error);
				process.exit(1);
			}
			process.exit(0);
		});
	};
	process.once("SIGTERM", shutdown);
	process.once("SIGINT", shutdown);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	main().catch((error) => {
		console.error(error);
		process.exit(1);
	});
}
