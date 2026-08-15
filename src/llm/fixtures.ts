import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { JsonValue, LLMClient, LLMRequest, LLMResponse } from "./client.js";
import { canonicalJson, fixtureKey, sha256 } from "./fixture-key.js";
import { LIVE_FLAG } from "./flags.js";

/**
 * How a contributor gets a Fixture: by recording it, never by writing it.
 *
 * This is the Question form on purpose, because this is the text a miss is
 * reported with, and a miss is nearly always one Question's. Pointing a missing
 * Question at the demo pass instead would send someone to record seven other
 * Questions and hit the same miss again with nothing to explain it.
 */
export const RECORD_COMMAND = 'npm run record -- "<the Question>"';

/**
 * How someone who typed their own Question gets an answer to it.
 *
 * This is the first thing a miss offers, because it is what the person hitting
 * the miss almost always wants. Recording is the other way to reach the same
 * answer, and it spends on a stored copy nobody asked for — so it is offered
 * second, to the narrower case of someone who wants the Question replayable.
 */
export const LIVE_ASK_COMMAND = `npm run ask -- ${LIVE_FLAG} "<the Question>"`;

/** The whole demo set in one pass — how the recordings in `fixtures/` were made. */
export const RECORD_DEMO_COMMAND = "npm run record -- --demo";

/**
 * The recorded-not-written rule, carried in every recording.
 *
 * The rule is in `fixtures/README.md` and in ADR 0001, and neither is open on
 * the screen of someone about to change a number in a JSON file until a test
 * goes green. This line is, which is the whole reason it exists.
 *
 * A recording keeps the note it was made with. Editing the wording here changes
 * what new recordings say and leaves existing ones alone, which is what being a
 * recording means — the note is outside the key and outside the seal, so an
 * older wording serves and verifies exactly as it did the day it was written.
 */
export const FIXTURE_NOTE =
  "Recorded from a real Claude API call. Fixtures are recorded, never written or edited " +
  `by hand — see fixtures/README.md. To refresh this one, re-record the Question behind it ` +
  `(${RECORD_COMMAND}), or the whole demo set with ${RECORD_DEMO_COMMAND}.`;

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));

/** Where recordings live. Overridable so a test can record into a scratch directory. */
export const DEFAULT_FIXTURES_DIR = path.join(repoRoot, "fixtures");

/**
 * A recording of one exchange with the API.
 *
 * The request is stored beside the response for two reasons: a reader can see
 * what was asked without decoding the key, and the store can check the key it
 * was filed under still matches the request it holds.
 */
type Fixture = {
  /** The rule, where the person editing the file will read it. Documentation, not data. */
  readonly note: string;
  readonly key: string;
  readonly recordedAt: string;
  readonly request: LLMRequest;
  readonly response: LLMResponse;
  readonly integrity: string;
};

/**
 * The seal over a recording.
 *
 * It is not a defence against a determined forger — anyone who reads this file
 * can recompute it. It is a defence against the thing that actually happens: a
 * Fixture nudged by hand until a test goes green. That edit now fails loudly
 * instead of quietly passing, which is what ADR 0001's recorded-not-written
 * rule needs in order to mean anything.
 */
const seal = (key: string, request: LLMRequest, response: LLMResponse): string =>
  sha256(canonicalJson({ key, request, response } as unknown as JsonValue));

const fixturePath = (dir: string, key: string): string => path.join(dir, `${key}.json`);

const missMessage = (key: string, file: string): string =>
  [
    `No Fixture for key ${key}.`,
    "",
    `Replay Mode serves recordings only — it never falls through to the API and`,
    `never invents an answer. Expected: ${file}`,
    "",
    `Ask it live:  ${LIVE_ASK_COMMAND}`,
    "",
    `Or record it, to have it served here from now on:  ${RECORD_COMMAND}`,
    `Or re-record the whole demo set:  ${RECORD_DEMO_COMMAND}`,
    "",
    "A Fixture is keyed by the whole request, so editing a system prompt or a",
    "tool schema moves the key and the recording it produced stops being served.",
    "If this key is new after a prompt edit, that is why.",
  ].join("\n");

const tamperedMessage = (file: string, detail: string): string =>
  [
    `Fixture ${file} does not match its own recording: ${detail}.`,
    "",
    "Fixtures are recorded, never written by hand — that is the whole basis of",
    "the demo, per ADR 0001. Restore the file, or re-record it with:",
    `  ${RECORD_COMMAND}`,
    `  ${RECORD_DEMO_COMMAND}   (if it is one of the demo set's)`,
  ].join("\n");

const parseFixture = (file: string): Fixture => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(file, "utf8"));
  } catch (cause) {
    throw new Error(tamperedMessage(file, "it is not valid JSON"), { cause });
  }

  const fixture = parsed as Partial<Fixture>;
  if (
    typeof fixture.key !== "string" ||
    typeof fixture.integrity !== "string" ||
    typeof fixture.request !== "object" ||
    fixture.request === null ||
    typeof fixture.response !== "object" ||
    fixture.response === null
  ) {
    throw new Error(tamperedMessage(file, "it is not shaped like a recording"));
  }

  return fixture as Fixture;
};

/**
 * Read the Fixture filed under a request, checking it is the recording it
 * claims to be: filed under the key its own request digests to, and unedited
 * since it was written.
 */
const readFixture = (dir: string, request: LLMRequest): LLMResponse => {
  const key = fixtureKey(request);
  const file = fixturePath(dir, key);
  if (!existsSync(file)) throw new Error(missMessage(key, file));

  const fixture = parseFixture(file);
  if (fixture.key !== key || fixtureKey(fixture.request) !== key) {
    throw new Error(tamperedMessage(file, "the request it holds is not the request it is filed under"));
  }
  if (seal(fixture.key, fixture.request, fixture.response) !== fixture.integrity) {
    throw new Error(tamperedMessage(file, "the recorded answer has been changed"));
  }

  return fixture.response;
};

const writeFixture = (dir: string, request: LLMRequest, response: LLMResponse): void => {
  const key = fixtureKey(request);
  const fixture: Fixture = {
    // First, so it is the first line of the file and cannot be scrolled past.
    // Outside the seal deliberately: it says nothing about what the model
    // returned, so sealing it would make removing a comment look like tampering
    // with an answer.
    note: FIXTURE_NOTE,
    key,
    recordedAt: new Date().toISOString(),
    request,
    response,
    integrity: seal(key, request, response),
  };

  mkdirSync(dir, { recursive: true });
  writeFileSync(fixturePath(dir, key), `${JSON.stringify(fixture, null, 2)}\n`);
};

/**
 * Replay Mode: the default `LLMClient`, serving recorded Fixtures.
 *
 * A miss is a hard error. The alternative designs — quietly calling the API, or
 * answering with something plausible — are the two ways a replay layer stops
 * being evidence of anything, so neither is available here.
 */
export const replayClient = (dir: string): LLMClient => ({
  complete: async (request) => readFixture(dir, request),
});

/**
 * The recording wrapper: calls the client behind it and writes what came back.
 *
 * Only the record command builds one of these, and it wraps the live adapter,
 * so a Fixture can only ever come from a real Live Mode call.
 */
export const recordingClient = (inner: LLMClient, dir: string): LLMClient => ({
  complete: async (request) => {
    const response = await inner.complete(request);
    writeFixture(dir, request, response);
    return response;
  },
});
