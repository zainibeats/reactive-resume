import type { Plugin, ProxyOptions } from "vite-plus";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { lingui } from "@lingui/vite-plugin";
import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import viteReact, { reactCompilerPreset } from "@vitejs/plugin-react";
import { defineConfig } from "vite-plus";

const rootPackageJsonPath = new URL("../../package.json", import.meta.url);
const rootPackageJson = JSON.parse(readFileSync(rootPackageJsonPath, "utf-8")) as { version: string | undefined };
const appVersion = JSON.stringify(rootPackageJson.version ?? "0.0.0");
const workspaceRoot = fileURLToPath(new URL("../..", import.meta.url));

// Each Phosphor icon module carries all six weights, and every page loads the ~165 icons of the Icon registry
// (packages/ui/src/components/icon.tsx). The app renders only regular (the default, also set by IconContext) and
// fill, so the other four are cut from the source. A new weight must be added to `keptWeights`.
const keptWeights = new Set(["regular", "fill"]);
const phosphorWeightsPlugin = (): Plugin => ({
	name: "phosphor-weights",
	transform: {
		filter: { id: /@phosphor-icons[\\/]react[\\/]dist[\\/]defs[\\/]/ },
		handler(code, id) {
			// Entries look like `\n  [\n    "bold",\n    …\n  ]`; their content is indented deeper.
			const kept = new Set<string>();
			const result = code.replaceAll(/\n {2}\[\n {4}"(\w+)",[\s\S]*?\n {2}\],?/g, (entry, weight: string) => {
				if (!keptWeights.has(weight)) return "";
				kept.add(weight);
				return entry;
			});
			if (kept.size !== keptWeights.size || result.length === code.length)
				throw new Error(`Unexpected Phosphor icon format in ${id}; update phosphorWeightsPlugin`);
			return { code: result, map: null };
		},
	},
});

// TanStack Router loads `route.tsx?tsr-split=…`. The native parser infers syntax from the filename,
// and the query hides `.tsx`, so JSX is parsed as JS.
const linguiPlugin = () =>
	lingui({ macroTransform: { parser: { syntax: "typescript", tsx: true, decorators: true } } });

const serverPaths = ["/api", "/mcp", "/uploads", "/.well-known", "/schema.json"] as const;

const serverProxy = serverPaths.reduce(
	(acc, path) => {
		acc[path] = {
			target: `http://localhost:${process.env.SERVER_PORT ?? "3001"}`,
			changeOrigin: true,
		};
		return acc;
	},
	{} as Record<string, ProxyOptions>,
);

export default defineConfig({
	envDir: workspaceRoot,

	resolve: {
		tsconfigPaths: true,
	},

	define: {
		__APP_VERSION__: appVersion,
	},

	build: {
		chunkSizeWarningLimit: 10 * 1024, // 10 MB
		rolldownOptions: {
			external: ["bcryptjs", "sharp", "@aws-sdk/client-s3", "ioredis", "linkedom"],
			// Every page loads the libraries the entry imports statically, so they ship as two files instead of ~80:
			// React, the router, Query and Lingui, which rarely change and stay cached across deploys, and the rest.
			// Libraries only lazy routes import split by the import graph. App modules stay split to keep their
			// execution order.
			output: {
				codeSplitting: {
					groups: [
						{
							name: "framework",
							test: /[\\/]node_modules[\\/](?:react|react-dom|scheduler|use-sync-external-store|@tanstack[\\/](?:history|store|react-store|router-core|react-router|query-core|react-query)|@lingui[\\/](?:core|react))[\\/]/,
							tags: ["$initial"],
							priority: 1,
						},
						{ name: "vendor", test: /[\\/]node_modules[\\/]/, tags: ["$initial"] },
					],
				},
			},
		},
	},

	// The PDF worker renders templates with translated section titles, so it needs the catalogs and macros too.
	worker: {
		format: "es",
		plugins: () => [linguiPlugin()],
	},

	server: {
		host: true,
		strictPort: true,
		port: Number.parseInt(process.env.PORT ?? "3000", 10),
		proxy: serverProxy,
	},

	plugins: [
		phosphorWeightsPlugin(),
		{
			name: "cloudflare-rocket-loader-bootstrap",
			transformIndexHtml: {
				order: "post",
				handler: (html) =>
					html.replace(
						/<script\b(?=[^>]*\btype="module")(?=[^>]*\bsrc="\/assets\/[^"]+")(?![^>]*\bdata-cfasync=)[^>]*>/,
						(script) => script.replace('src="', 'data-cfasync="false" src="'),
					),
			},
		},
		devtools(),
		tailwindcss(),
		tanstackRouter({
			target: "react",
			semicolons: true,
			quoteStyle: "double",
			autoCodeSplitting: true,
		}),
		viteReact(),
		linguiPlugin(),
		// Keep @babel/core on 7: under Babel 8, React Compiler 1.0 skips every function with a destructuring default
		// (guarded by src/react-compiler.test.ts).
		babel({ presets: [reactCompilerPreset()] }),
	],
});
