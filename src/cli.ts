import { type CliResult, runAsCommand } from "./command.js";
import { API_KEY_VARIABLE, chooseMode, clientFor, environmentFrom, LIVE_FLAG } from "./llm/mode.js";
import { rankBanks, type BankScores } from "./router/local-pass.js";
import { routeQuestion, type RoutingStage } from "./router/router.js";
import { SCORE_FLOOR } from "./router/thresholds.js";

const USAGE = [
  `Usage: npm run ask -- [${LIVE_FLAG}] "<Question>"`,
  "",
  "Reports the Route the Router assigns a Question, which of its two stages",
  "produced that Route, and the per-bank similarity scores behind it.",
  "",
  `Runs in Replay Mode by default: no key, no spend. ${LIVE_FLAG} calls the API`,
  `and needs ${API_KEY_VARIABLE}.`,
].join("\n");

/** The stage names an operator reads, from `CONTEXT.md`. */
const STAGE_LABEL: Record<RoutingStage, string> = {
  "local-pass": "Local Pass",
  escalation: "Escalation",
};

/** Scores, best bank first, so a surprising verdict shows its working. */
const formatScores = (scores: BankScores): string =>
  rankBanks(scores)
    .map(({ route, score }) => `  ${route.padEnd(8)}${score.toFixed(3)}`)
    .join("\n");

const CLARIFICATION = [
  "Neither the Local Pass nor Escalation could place this Question, so I would",
  "rather ask than guess. Could you rephrase it, saying whether you are asking",
  "about money (revenue, expenses, cash, payroll cost) or about people",
  "(headcount, salaries, vacancies, attrition) — or both?",
].join("\n");

/**
 * The top of the system: a Question in, the Router's verdict out.
 *
 * Returns its output rather than printing it, so the tests can drive the real
 * entry point instead of a stand-in for it. It takes the environment as an
 * argument for the same reason — a test can point a run at a scratch Fixture
 * directory without reaching inside anything.
 */
export const runCli = async (
  argv: readonly string[],
  env: Record<string, string | undefined>,
): Promise<CliResult> => {
  const flags = argv.filter((arg) => arg.startsWith("--"));
  const unknown = flags.filter((flag) => flag !== LIVE_FLAG);
  if (unknown.length > 0) {
    // Deliberately fatal rather than folded into the Question: the flags people
    // reach for here are the ones that would turn Escalation off, and there is
    // no such flag (ADR 0005). Failing says so; silently routing "--local" as
    // part of the Question would not.
    return { exitCode: 1, output: `Unknown option ${unknown.join(", ")}\n\n${USAGE}`, notice: null };
  }

  const question = argv
    .filter((arg) => !arg.startsWith("--"))
    .join(" ")
    .trim();
  if (question === "") return { exitCode: 1, output: USAGE, notice: null };

  const environment = environmentFrom(env);
  let notice: string | null = null;
  try {
    const choice = chooseMode({ live: flags.includes(LIVE_FLAG), apiKey: environment.apiKey });
    notice = choice.notice;
    const verdict = await routeQuestion(question, clientFor(choice, environment));

    const lines = [
      `Question: ${question}`,
      "",
      `Route:    ${verdict.route.padEnd(8)}  (${STAGE_LABEL[verdict.stage]})`,
      "",
      "Similarity scores by Exemplar Bank:",
      formatScores(verdict.scores),
    ];
    if (verdict.stage === "escalation") {
      lines.push(
        "",
        `The Local Pass abstained — nothing cleared the ${SCORE_FLOOR} score floor —`,
        "so this Question went to Escalation, which is the only routing step that spends.",
      );
    }
    if (verdict.route === "unclear") lines.push("", CLARIFICATION);

    return { exitCode: 0, output: lines.join("\n"), notice };
  } catch (error) {
    // A Fixture miss and a missing key both land here. Both are things the
    // operator can act on, so they are reported as messages rather than as a
    // stack trace out of the middle of the Router.
    return { exitCode: 1, output: error instanceof Error ? error.message : String(error), notice };
  }
};

await runAsCommand(import.meta.url, () => runCli(process.argv.slice(2), process.env));
