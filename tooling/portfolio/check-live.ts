/**
 * Fetches the public resume JSON the czaini.net portfolio reads from R2 and checks it against the portfolio
 * contract. Run by the scheduled "Portfolio Contract" workflow; locally: `pnpm --filter @reactive-resume/tooling
 * portfolio:check`.
 */
import { checkPortfolioContract, PORTFOLIO_RESUME_URL } from "./contract";

let response: Response;
try {
	response = await fetch(PORTFOLIO_RESUME_URL, { headers: { accept: "application/json" } });
} catch (error) {
	console.error(`Fetching ${PORTFOLIO_RESUME_URL} failed: ${String(error)}`);
	process.exit(1);
}

if (!response.ok) {
	console.error(`Fetching ${PORTFOLIO_RESUME_URL} failed: HTTP ${response.status}`);
	process.exit(1);
}

let data: unknown;
try {
	data = await response.json();
} catch (error) {
	console.error(`${PORTFOLIO_RESUME_URL} is not valid JSON: ${String(error)}`);
	process.exit(1);
}

const problems = checkPortfolioContract(data, { requireMusicItem: true });

if (problems.length > 0) {
	console.error(`Live resume JSON breaks the portfolio contract:\n${problems.map((p) => `- ${p}`).join("\n")}`);
	process.exit(1);
}

console.log("Live resume JSON matches the portfolio contract.");
