import type { LLMClient } from "./client.js";
import { LIVE_FLAG } from "./flags.js";
import { DEFAULT_FIXTURES_DIR, replayClient } from "./fixtures.js";
import { liveClient } from "./live-client.js";

/**
 * Which side of the seam a run is on, and how it got there.
 *
 * This is the only file that reads the environment for a key, so "what can make
 * this run spend money" is one file's worth of reading. The flag it is opted into
 * with is named in `flags.js`, because a Fixture miss has to print it too.
 */

/** The environment variable holding the key, named once. */
export const API_KEY_VARIABLE = "ANTHROPIC_API_KEY";

/** Where Fixtures are read from and written to, overridable for a scratch run. */
export const FIXTURES_DIR_VARIABLE = "FIXTURES_DIR";

export type Environment = {
  readonly apiKey: string | undefined;
  readonly fixturesDir: string;
};

export type ModeChoice = {
  readonly mode: "replay" | "live";
  /** Something worth saying on stderr about the choice, or `null` when not. */
  readonly notice: string | null;
};

const blankToUndefined = (value: string | undefined): string | undefined =>
  value === undefined || value.trim() === "" ? undefined : value.trim();

export const environmentFrom = (env: Record<string, string | undefined>): Environment => ({
  apiKey: blankToUndefined(env[API_KEY_VARIABLE]),
  fixturesDir: blankToUndefined(env[FIXTURES_DIR_VARIABLE]) ?? DEFAULT_FIXTURES_DIR,
});

const NO_KEY = [
  `${LIVE_FLAG} needs an API key, and ${API_KEY_VARIABLE} is not set.`,
  "",
  `Export ${API_KEY_VARIABLE} to run in Live Mode, or drop ${LIVE_FLAG} to run`,
  "in Replay Mode, which needs no key and spends nothing.",
].join("\n");

const KEY_BUT_NO_FLAG =
  `${API_KEY_VARIABLE} is set, but this run is in Replay Mode and will not spend: ` +
  `Live Mode also needs ${LIVE_FLAG}.`;

/**
 * Pick the mode for a run.
 *
 * Live Mode takes both halves — the flag and the key. Neither half alone gets
 * there, which is what stops a test run or a casual invocation from spending.
 * The two halves fail differently on purpose: asking for Live Mode without a
 * key is a mistake and stops the run, whereas a key sitting in the environment
 * of someone who did not ask to spend is not a mistake at all — it just does
 * not arm anything, and saying so is kinder than failing.
 */
export const chooseMode = ({
  live,
  apiKey,
}: {
  readonly live: boolean;
  readonly apiKey: string | undefined;
}): ModeChoice => {
  if (live && apiKey === undefined) throw new Error(NO_KEY);
  if (live) return { mode: "live", notice: null };

  return { mode: "replay", notice: apiKey === undefined ? null : KEY_BUT_NO_FLAG };
};

/** The `LLMClient` a chosen mode runs on. Nothing above the seam sees which. */
export const clientFor = (choice: ModeChoice, environment: Environment): LLMClient => {
  if (choice.mode === "replay") return replayClient(environment.fixturesDir);
  if (environment.apiKey === undefined) throw new Error(NO_KEY);

  return liveClient(environment.apiKey);
};
