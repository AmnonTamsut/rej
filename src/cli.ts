import type { AgentMeeting } from "./agents/meeting.js";
import { askQuestion } from "./ask.js";
import type { NumberAudit } from "./audit/number-audit.js";
import { type CliResult, runAsCommand } from "./command.js";
import { API_KEY_VARIABLE, chooseMode, clientFor, environmentFrom, LIVE_FLAG } from "./llm/mode.js";
import { rankBanks, type BankScores } from "./router/local-pass.js";
import type { RoutingStage } from "./router/router.js";
import { SCORE_FLOOR } from "./router/thresholds.js";

const USAGE = [
  `Usage: npm run ask -- [${LIVE_FLAG}] "<Question>"`,
  "",
  "Answers a Question, reporting the Route the Router assigned it, which of the",
  "Router's two stages produced that Route, which Specialist Agent answered — or",
  "which agents met, for a cross-cutting Question — and the per-bank similarity",
  "scores behind the verdict.",
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

/**
 * One piece of text the Number Audit ran on, and what it said about it.
 *
 * A single agent's answer is one of these; an Agent Meeting is three — a
 * contribution from each attendee and the joint recommendation. Naming the
 * piece is what makes the meeting's audit worth reading: "no Scoped Tool result
 * accounts for 2,400,000" is a different problem depending on whether the
 * figure was the Finance Agent's or the meeting's own.
 */
type Audited = {
  readonly of: string;
  readonly audit: NumberAudit;
};

/** "a", "a and b", "a, b, and c" — a list an operator reads rather than parses. */
const listing = (items: readonly string[]): string =>
  items.length < 3
    ? items.join(" and ")
    : `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;

/**
 * What the Number Audit's verdict looks like to the operator.
 *
 * Reported on every answer, not only on a failure. A check that is invisible
 * when it passes is a check nobody knows they are relying on, and the line that
 * matters — the failure — reads as an exception to something rather than as an
 * unfamiliar warning. The pass line names everything that was checked for the
 * same reason: an audit that says "passed" without saying what it read is worth
 * as little as no audit at all.
 *
 * A failure does not change the exit code. The run did what it was asked and
 * the answer is worth reading; what it is not is worth acting on the numbers
 * of, and that is what the words say. Hiding the answer would leave an operator
 * unable to see what the agent claimed and where it went wrong.
 */
const auditReport = (audited: readonly Audited[]): string => {
  const failed = audited.filter(({ audit }) => !audit.passed);
  if (failed.length === 0) {
    return (
      `Number Audit: passed — every figure in ${listing(audited.map(({ of }) => of))} ` +
      "appears in a Scoped Tool result."
    );
  }

  return [
    ...failed.map(
      ({ of, audit }) =>
        `Number Audit: FAILED — no Scoped Tool result accounts for ` +
        `${audit.unaccounted.join(", ")} in ${of}.`,
    ),
    "What you are reading is unaudited: it rests on a figure this run cannot point at a source",
    "for, so do not act on its numbers.",
  ].join("\n");
};

/**
 * What an Agent Meeting looks like to the operator: who met, and one
 * recommendation.
 *
 * The contributions are audited and named but not printed. The meeting exists
 * to produce a decision rather than a transcript, and the recommendation
 * already says which domain supplied which fact — printing both contributions
 * beside it would hand back the two pasted answers the meeting was built to
 * replace. A contribution that failed its own audit is still named in the
 * audit report, so nothing goes unreported for being unprinted.
 */
const meetingReport = (meeting: AgentMeeting): string[] => [
  `Meeting:  ${meeting.contributions.map((contribution) => contribution.agent).join(", ")}`,
  "",
  meeting.recommendation,
  "",
  auditReport([
    ...meeting.contributions.map((contribution) => ({
      of: `the ${contribution.agent}'s contribution`,
      audit: contribution.audit,
    })),
    { of: "the joint recommendation", audit: meeting.audit },
  ]),
];

const CLARIFICATION = [
  "Neither the Local Pass nor Escalation could place this Question, so I would",
  "rather ask than guess. Could you rephrase it, saying whether you are asking",
  "about money (revenue, expenses, cash, payroll cost) or about people",
  "(headcount, salaries, vacancies, attrition) — or both?",
].join("\n");

/**
 * The top of the system: a Question in, and the Route, the agent that answered,
 * and the answer out.
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
    const { verdict, answer, meeting } = await askQuestion(question, clientFor(choice, environment));

    const lines = [
      `Question: ${question}`,
      "",
      `Route:    ${verdict.route.padEnd(8)}  (${STAGE_LABEL[verdict.stage]})`,
    ];
    // The three things a Route can produce, and all it can produce: one agent's
    // answer, an Agent Meeting's recommendation, or — for `unclear` — the
    // request for clarification below. No Route reaches the operator with a
    // silence where its answer should be.
    if (answer !== null) {
      lines.push(
        `Agent:    ${answer.agent}`,
        "",
        answer.answer,
        "",
        auditReport([{ of: "the answer above", audit: answer.audit }]),
      );
    } else if (meeting !== null) {
      lines.push(...meetingReport(meeting));
    }
    lines.push("", "Similarity scores by Exemplar Bank:", formatScores(verdict.scores));
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
