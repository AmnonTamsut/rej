import { runCli } from "./cli.js";
import { type CliResult, runAsCommand } from "./command.js";
import type { Route } from "./domain/route.js";
import { RECORD_DEMO_COMMAND } from "./llm/fixtures.js";
import type { RoutingStage } from "./router/router.js";

/**
 * The Questions this system demonstrates itself with, and the command that runs
 * them.
 *
 * Choosing this set is a design decision rather than an afterthought: it is what
 * a reviewer sees first, and it is also the Fixture set, so it decides what one
 * deliberate recording pass has to buy. Every entry is here to show something
 * the next one does not — between them they cover all four Routes, both Router
 * stages, an out-of-domain refusal, and the Agent Meeting the assessment names.
 *
 * Adding a Question here means re-recording (`npm run record -- --demo`), which
 * is the project's only sanctioned spend. That is the reason the set is short.
 */

/** What comes back at the end of a run — the thing a reviewer reads. */
export type DemoOutcome =
  /** One Specialist Agent answered from its own Scoped Tools. */
  | "answer"
  /** The agent that was asked declined: no tool of its answers the Question. */
  | "refusal"
  /** An Agent Meeting produced one joint recommendation. */
  | "meeting"
  /** Neither Router stage could place it, so the operator is asked to rephrase. */
  | "clarification";

export type DemoQuestion = {
  readonly question: string;
  /** Why this Question is in the set, in the words the demo prints above it. */
  readonly shows: string;
  readonly route: Route;
  readonly stage: RoutingStage;
  readonly outcome: DemoOutcome;
};

export const DEMO_QUESTIONS: readonly DemoQuestion[] = [
  {
    question: "How much cash is left in the bank?",
    shows: "a plain money Question: placed by the Local Pass for nothing, answered by the Finance Agent from one Scoped Tool, and audited.",
    route: "finance",
    stage: "local-pass",
    outcome: "answer",
  },
  {
    // Names the quarter rather than saying "last quarter": the Finance Dataset
    // holds Q1, Q2, Q3 and year to date, so an agent asked about "last quarter"
    // rightly asks which one is meant — a good answer to give an operator, and a
    // demo that never reaches the boundary it exists to show.
    question: "How much did we spend on payroll in Q3?",
    shows: "the isolation guarantee from the money side: payroll reaches the Finance Agent only as an aggregate, because no tool it holds returns anything finer.",
    route: "finance",
    stage: "local-pass",
    outcome: "answer",
  },
  {
    question: "What does Priya Raman earn?",
    shows: "the same boundary from the people side: an individual's salary is the HR Agent's to see and no one else's — and a Question that names a person rather than a role, which the Exemplar Banks were widened for.",
    route: "hr",
    stage: "local-pass",
    outcome: "answer",
  },
  {
    question: "Should we hire more people?",
    // The second half of this describes what the shipped recording contains, not
    // what the meeting must do — the Finance Agent worked out an operating loss
    // and a percentage from figures its tools returned separately, and the audit
    // named both. It is kept rather than re-rolled for a cleaner sample: the
    // audit exists because a prompt telling an agent not to derive figures is a
    // request, and this is the run where the request was not honoured. A
    // re-recording that comes back clean will fail the test in `demo.test.ts`
    // that pins this, which is the prompt to rewrite this line.
    shows: "the Agent Meeting: a Question neither Dataset answers alone, examined by each agent through its own tools and combined into one attributable recommendation — and the Number Audit over that recommendation, which in this recording fails and names the two figures no Scoped Tool returned.",
    route: "both",
    stage: "local-pass",
    outcome: "meeting",
  },
  {
    // This Question is in the set because the Banks do not cover it, which makes
    // the demo depend on a gap. That gap is a decision, not an oversight —
    // `docs/exemplar-bank-coverage.md` records terse name-plus-verb phrasings as
    // deliberately left to Escalation, and why widening for them was rejected.
    // If that decision is ever reversed, this Question stops abstaining and the
    // Local Pass test below goes red: replace it here with another Question that
    // abstains, rather than quietly demoting the one that shows Escalation.
    question: "When did Ben Carter start?",
    shows: "Escalation earning its cost: a phrasing too terse for the Exemplar Banks abstains, one small model call places it, and the HR Agent answers it anyway.",
    route: "hr",
    stage: "escalation",
    outcome: "answer",
  },
  {
    question: "Who won the customer of the year award?",
    shows: "a misroute degrading well: the Local Pass places this on the HR Agent, which holds no tool that answers it and says so instead of inventing a winner.",
    route: "hr",
    stage: "local-pass",
    outcome: "refusal",
  },
  {
    question: "How do I fix the printer?",
    shows: "the end of the line: no Dataset owns this, the Local Pass abstains, Escalation declines to place it, and the operator is asked to rephrase rather than handed a confident answer.",
    route: "unclear",
    stage: "escalation",
    outcome: "clarification",
  },
];

const USAGE = [
  "Usage: npm run demo",
  "",
  "Runs the demo Question set through the same entry point `npm run ask` uses,",
  "one Question after another, in Replay Mode: no key, no spend.",
].join("\n");

/**
 * The rule between one Question's output and the next.
 *
 * Exported because it is a boundary, not decoration: it is what separates one
 * Question's run from another's in a single stream of text, so a test reading
 * the demo's output splits on this rather than knowing the width by heart.
 */
export const SEPARATOR = "".padEnd(78, "─");

const heading = (index: number, demo: DemoQuestion): string =>
  [SEPARATOR, `Demo ${index + 1} of ${DEMO_QUESTIONS.length} — ${demo.shows}`, SEPARATOR, ""].join(
    "\n",
  );

/**
 * Run the whole set through the command-line entry point.
 *
 * It calls `runCli` rather than reaching past it, so the demo shows exactly what
 * a reviewer sees when they run a Question themselves — including the Fixture
 * miss, if a prompt has moved since the recording pass. A failing run is
 * reported as a failing run: the exit code is non-zero, because a demo that
 * exits 0 with a miss in the middle of it is worse than no demo.
 */
export const runDemo = async (env: Record<string, string | undefined>): Promise<CliResult> => {
  const sections: string[] = [];
  let failed = 0;

  for (const [index, demo] of DEMO_QUESTIONS.entries()) {
    const { exitCode, output } = await runCli([demo.question], env);
    if (exitCode !== 0) failed += 1;
    sections.push(`${heading(index, demo)}${output}`);
  }

  return {
    exitCode: failed === 0 ? 0 : 1,
    output: [
      ...sections,
      SEPARATOR,
      failed === 0
        ? `All ${DEMO_QUESTIONS.length} demo Questions ran from recorded Fixtures — no key, no spend.`
        : `${failed} of ${DEMO_QUESTIONS.length} demo Questions failed. Re-record with:  ${RECORD_DEMO_COMMAND}`,
    ].join("\n\n"),
    notice: null,
  };
};

export const runDemoCommand = async (
  argv: readonly string[],
  env: Record<string, string | undefined>,
): Promise<CliResult> =>
  argv.length > 0 ? { exitCode: 1, output: USAGE, notice: null } : runDemo(env);

await runAsCommand(import.meta.url, () => runDemoCommand(process.argv.slice(2), process.env));
