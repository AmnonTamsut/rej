import { askQuestion } from "./ask.js";
import { type CliResult, runAsCommand, unknownFlagResult, unknownFlags } from "./command.js";
import { DEMO_QUESTIONS } from "./demo.js";
import type { LLMClient } from "./llm/client.js";
import { recordingClient } from "./llm/fixtures.js";
import { liveClient } from "./llm/live-client.js";
import { API_KEY_VARIABLE, environmentFrom } from "./llm/mode.js";
import { addUsage, formatSpend, NO_USAGE, type Usage } from "./llm/pricing.js";
import type { RouterVerdict } from "./router/router.js";

/**
 * The record command: a Live Mode run whose purpose is to write Fixtures.
 *
 * It is the only sanctioned spend in the project, which is why it is a separate
 * command rather than a flag on the ask path — recording is a decision someone
 * makes, not something a run can drift into.
 */

/** The flag that records the demo set: the one deliberate pass, named. */
export const DEMO_FLAG = "--demo";

const USAGE = [
  `Usage: npm run record -- ${DEMO_FLAG}`,
  '       npm run record -- "<Question>" ["<Question>" ...]',
  "",
  `${DEMO_FLAG} records the whole demo Question set in one pass, which is how the`,
  "shipped Fixtures were made. Naming Questions instead records just those.",
  "",
  "Either way this is a Live Mode run: it calls the API, spends real budget, and",
  `needs ${API_KEY_VARIABLE}. It is the only command in the project that spends money.`,
].join("\n");

const NO_KEY = [
  `Recording is a Live Mode run and needs ${API_KEY_VARIABLE}, which is not set.`,
  "",
  "Nothing was recorded and nothing was spent.",
].join("\n");

export type RecordedRun = {
  readonly question: string;
  readonly route: RouterVerdict["route"];
  readonly stage: RouterVerdict["stage"];
  /** How many model calls this Question cost, and so how many Fixtures it left behind. */
  readonly calls: number;
};

/**
 * Run each Question through the real system with a recording client in place.
 *
 * The whole path is recorded, not just the routing: an Escalation is one call
 * and a Specialist Agent's turn is several, and Replay Mode needs all of them
 * to serve the same run afterwards. Questions the Local Pass places and no
 * agent answers cost nothing and record nothing — recording captures what the
 * system actually asks the model, so the free path stays absent from the
 * Fixture set rather than being recorded for symmetry.
 */
export const recordFixtures = async (
  questions: readonly string[],
  client: LLMClient,
  fixturesDir: string,
): Promise<RecordedRun[]> => {
  const recorder = recordingClient(client, fixturesDir);
  const runs: RecordedRun[] = [];

  for (const question of questions) {
    let calls = 0;
    const counted: LLMClient = {
      complete: async (request) => {
        calls += 1;
        return recorder.complete(request);
      },
    };

    const { verdict } = await askQuestion(question, counted);
    runs.push({ question, route: verdict.route, stage: verdict.stage, calls });
  }

  return runs;
};

/**
 * What the pass did and what it cost.
 *
 * The spend line is the point: the project runs under a hard cap, and a cap
 * nobody measures against is a hope. The figure printed here is what
 * `docs/recording-pass.md` records.
 */
const summarize = (runs: readonly RecordedRun[], fixturesDir: string, usage: Usage): string => {
  const calls = runs.reduce((total, run) => total + run.calls, 0);
  const paid = runs.filter((run) => run.calls > 0).length;

  return [
    ...runs.map(
      (run) =>
        `${run.calls > 0 ? `${run.calls} call${run.calls === 1 ? " " : "s"}` : "free   "}  ` +
        `${run.route.padEnd(8)}${run.question}`,
    ),
    "",
    `${paid} of ${runs.length} Questions reached the model, for ${calls} calls in total; ` +
      `Fixtures are in ${fixturesDir}`,
    `This pass used ${formatSpend(usage)}`,
  ].join("\n");
};

export const runRecord = async (
  argv: readonly string[],
  env: Record<string, string | undefined>,
): Promise<CliResult> => {
  const args = argv.map((arg) => arg.trim()).filter((arg) => arg !== "");
  // A misspelt flag here would otherwise be recorded as a Question, which spends
  // money to file a Fixture nobody will ever ask for.
  const unknown = unknownFlags(args, [DEMO_FLAG]);
  if (unknown.length > 0) return unknownFlagResult(unknown, USAGE);

  const named = args.filter((arg) => !arg.startsWith("--"));
  if (args.includes(DEMO_FLAG) && named.length > 0) {
    // Recording the demo set and dropping the Questions beside it would be the
    // same fault as the one above, one step over: the operator asked for two
    // things, paid for one, and is told nothing about the other.
    return {
      exitCode: 1,
      output: [
        `${DEMO_FLAG} records the whole demo set, so it cannot be combined with a Question.`,
        `Drop ${DEMO_FLAG} to record ${named.map((question) => `"${question}"`).join(", ")},`,
        `or run ${DEMO_FLAG} on its own.`,
        "",
        USAGE,
      ].join("\n"),
      notice: null,
    };
  }

  const questions = args.includes(DEMO_FLAG) ? DEMO_QUESTIONS.map((demo) => demo.question) : named;
  if (questions.length === 0) return { exitCode: 1, output: USAGE, notice: null };

  const environment = environmentFrom(env);
  if (environment.apiKey === undefined) return { exitCode: 1, output: NO_KEY, notice: null };

  let usage = NO_USAGE;
  const runs = await recordFixtures(
    questions,
    liveClient(environment.apiKey, (one) => {
      usage = addUsage(usage, one);
    }),
    environment.fixturesDir,
  );

  return {
    exitCode: 0,
    output: summarize(runs, environment.fixturesDir, usage),
    notice: "Live Mode: this run called the API and spent real budget.",
  };
};

await runAsCommand(import.meta.url, () => runRecord(process.argv.slice(2), process.env));
