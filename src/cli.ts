import path from "node:path";
import { fileURLToPath } from "node:url";
import type { LocalRoute } from "./domain/route.js";
import { loadEmbedder } from "./router/embedder.js";
import type { BankScores } from "./router/local-pass.js";
import { routeQuestion } from "./router/router.js";
import { SCORE_FLOOR } from "./router/thresholds.js";

const USAGE = [
  "Usage: npm run ask -- \"<Question>\"",
  "",
  "Reports the Route the Router assigns a Question, with the per-bank",
  "similarity scores behind that verdict. Runs entirely locally: no API key,",
  "no network beyond the one-time embedding-model download.",
].join("\n");

/** Scores, best bank first, so a surprising verdict shows its working. */
const formatScores = (scores: BankScores): string =>
  (Object.entries(scores) as [LocalRoute, number][])
    .sort((a, b) => b[1] - a[1])
    .map(([route, score]) => `  ${route.padEnd(8)}${score.toFixed(3)}`)
    .join("\n");

const CLARIFICATION = [
  "I could not place this Question against any of the Exemplar Banks, so I",
  "would rather ask than guess. Could you rephrase it, saying whether you are",
  "asking about money (revenue, expenses, cash, payroll cost) or about people",
  "(headcount, salaries, vacancies, attrition) — or both?",
].join("\n");

export type CliResult = { readonly exitCode: number; readonly output: string };

/**
 * The top of the system: a Question in, the Router's verdict out.
 *
 * Returns its output rather than printing it, so the tests can drive the real
 * entry point instead of a stand-in for it.
 */
export const runCli = async (argv: readonly string[]): Promise<CliResult> => {
  const question = argv.join(" ").trim();
  if (question === "") return { exitCode: 1, output: USAGE };

  const verdict = await routeQuestion(question);

  const lines = [`Question: ${question}`, ""];
  if (verdict.outcome === "routed") {
    lines.push(`Route:    ${verdict.route}`);
  } else {
    // An Abstention is not a Route, so none is reported. It is also not
    // `unclear`, which only Escalation can reach.
    lines.push(`Route:    (none — the Local Pass abstained below the ${SCORE_FLOOR} score floor)`);
  }
  lines.push("", "Similarity scores by Exemplar Bank:", formatScores(verdict.scores));
  if (verdict.outcome === "abstained") lines.push("", CLARIFICATION);

  return { exitCode: 0, output: lines.join("\n") };
};

const invokedDirectly =
  process.argv[1] !== undefined &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  // Load the model — and announce the first-run download — before any output,
  // so a 25MB fetch never looks like the Router hanging on the Question.
  await loadEmbedder();
  const { exitCode, output } = await runCli(process.argv.slice(2));
  process.stdout.write(`${output}\n`);
  process.exitCode = exitCode;
}
