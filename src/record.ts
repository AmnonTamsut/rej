import path from "node:path";
import { fileURLToPath } from "node:url";
import type { CliResult } from "./cli.js";
import type { LLMClient } from "./llm/client.js";
import { recordingClient } from "./llm/fixtures.js";
import { liveClient } from "./llm/live-client.js";
import { API_KEY_VARIABLE, environmentFrom } from "./llm/mode.js";
import { loadEmbedder } from "./router/embedder.js";
import { routeQuestion, type RouterVerdict } from "./router/router.js";

/**
 * The record command: a Live Mode run whose purpose is to write Fixtures.
 *
 * It is the only sanctioned spend in the project, which is why it is a separate
 * command rather than a flag on the ask path — recording is a decision someone
 * makes, not something a run can drift into.
 */

const USAGE = [
  'Usage: npm run record -- "<Question>" ["<Question>" ...]',
  "",
  "Runs the given Questions in Live Mode and records every model call as a",
  `Fixture, so Replay Mode can serve them afterwards. Needs ${API_KEY_VARIABLE}.`,
  "This is the only command in the project that spends money.",
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
  /** Whether this Question cost a call, and so left a Fixture behind. */
  readonly recorded: boolean;
};

/**
 * Run each Question through the real Router with a recording client in place.
 *
 * Questions the Local Pass places cost nothing and record nothing: recording
 * captures what the system actually asks the model, so the free path stays
 * absent from the Fixture set rather than being recorded for symmetry.
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

    const verdict = await routeQuestion(question, counted);
    runs.push({ question, route: verdict.route, stage: verdict.stage, recorded: calls > 0 });
  }

  return runs;
};

const summarize = (runs: readonly RecordedRun[], fixturesDir: string): string => {
  const recorded = runs.filter((run) => run.recorded).length;

  return [
    ...runs.map(
      (run) =>
        `${run.recorded ? "recorded" : "free    "}  ${run.route.padEnd(8)}${run.question}`,
    ),
    "",
    `${recorded} of ${runs.length} Questions reached the model; Fixtures are in ${fixturesDir}`,
  ].join("\n");
};

export const runRecord = async (
  argv: readonly string[],
  env: Record<string, string | undefined>,
): Promise<CliResult> => {
  const questions = argv.map((arg) => arg.trim()).filter((arg) => arg !== "");
  if (questions.length === 0) return { exitCode: 1, output: USAGE, notice: null };

  const environment = environmentFrom(env);
  if (environment.apiKey === undefined) return { exitCode: 1, output: NO_KEY, notice: null };

  const runs = await recordFixtures(
    questions,
    liveClient(environment.apiKey),
    environment.fixturesDir,
  );

  return { exitCode: 0, output: summarize(runs, environment.fixturesDir), notice: null };
};

const invokedDirectly =
  process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  process.stderr.write("Live Mode: this run calls the API and spends real budget.\n");
  await loadEmbedder();
  const { exitCode, output } = await runRecord(process.argv.slice(2), process.env);
  process.stdout.write(`${output}\n`);
  process.exitCode = exitCode;
}
