import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { LLMRequest } from "./client.js";
import { oneShot } from "./client.js";
import { fixtureKey } from "./fixture-key.js";
import { LIVE_FLAG } from "./flags.js";
import {
  RECORD_COMMAND,
  RECORD_DEMO_COMMAND,
  recordingClient,
  replayClient,
} from "./fixtures.js";
import { scratchFixturesDir, standInClient } from "./testing.js";

const REQUEST = oneShot("Place the Question.", "Should we hire more people?");

/** Record through the real recording path — Fixtures are never written by hand. */
const recordInto = async (dir: string, request: LLMRequest, text: string): Promise<void> => {
  await recordingClient(standInClient(text), dir).complete(request);
};

const soleFixtureFile = (dir: string): string => {
  const [file] = readdirSync(dir).filter((name) => name.endsWith(".json"));
  if (file === undefined) throw new Error(`No Fixture was written into ${dir}`);
  return path.join(dir, file);
};

const messageFrom = async (promise: Promise<unknown>): Promise<string> => {
  const outcome = await promise.then(
    () => new Error("expected the call to fail, but it returned"),
    (error: unknown) => error,
  );
  return outcome instanceof Error ? outcome.message : String(outcome);
};

describe("Fixtures", () => {
  it("serves a recorded response back to the same request", async () => {
    const dir = scratchFixturesDir();
    await recordInto(dir, REQUEST, "both");

    const response = await replayClient(dir).complete(REQUEST);

    expect(response.content).toEqual([{ type: "text", text: "both" }]);
  });

  it("fails on a miss, naming the missing key and the record command", async () => {
    const dir = scratchFixturesDir();

    const message = await messageFrom(replayClient(dir).complete(REQUEST));

    expect(message).toContain(fixtureKey(REQUEST));
    expect(message).toContain(RECORD_COMMAND);
  });

  it("offers a miss the live flag before it offers recording, which spends", async () => {
    // Someone who typed their own Question in Replay Mode wants an answer to it,
    // and the way to get one is the flag. Leading with the record command sends
    // them to spend on a recording pass to reach the same answer the flag would
    // have got them, which is why the flag goes first and recording second.
    const dir = scratchFixturesDir();

    const message = await messageFrom(replayClient(dir).complete(REQUEST));

    expect(message).toContain(LIVE_FLAG);
    expect(message.indexOf(LIVE_FLAG)).toBeLessThan(message.indexOf(RECORD_COMMAND));
  });

  it("tells a miss to record the Question behind it, not the demo set instead of it", async () => {
    // A miss is nearly always one Question's, and the demo pass records seven
    // other Questions. Someone who follows an instruction to run `--demo` here
    // spends money and hits the same miss again with nothing to explain it, so
    // the Question form leads and the demo pass is offered second.
    const dir = scratchFixturesDir();

    const message = await messageFrom(replayClient(dir).complete(REQUEST));

    expect(RECORD_COMMAND).toContain("<the Question>");
    expect(message.indexOf(RECORD_COMMAND)).toBeLessThan(message.indexOf(RECORD_DEMO_COMMAND));
  });

  it("stops serving a recording once the system prompt it was recorded against is edited", async () => {
    const dir = scratchFixturesDir();
    await recordInto(dir, REQUEST, "both");
    const edited: LLMRequest = { ...REQUEST, system: `${REQUEST.system} Answer in one word.` };

    await expect(replayClient(dir).complete(edited)).rejects.toThrow(/no Fixture/i);
  });

  it("stops serving a recording once a tool schema it was recorded against is edited", async () => {
    const dir = scratchFixturesDir();
    const withTool: LLMRequest = {
      ...REQUEST,
      tools: [{ name: "cash_position", description: "Cash.", inputSchema: { type: "object" } }],
    };
    await recordInto(dir, withTool, "finance");
    const edited: LLMRequest = {
      ...withTool,
      tools: [{ ...withTool.tools[0]!, description: "Cash, in pounds." }],
    };

    await expect(replayClient(dir).complete(edited)).rejects.toThrow(/no Fixture/i);
  });

  it("refuses a Fixture whose recorded answer was edited by hand", async () => {
    const dir = scratchFixturesDir();
    await recordInto(dir, REQUEST, "both");
    const file = soleFixtureFile(dir);
    writeFileSync(file, readFileSync(file, "utf8").replace('"both"', '"finance"'));

    await expect(replayClient(dir).complete(REQUEST)).rejects.toThrow(/recorded, never written/i);
  });

  it("refuses a Fixture whose recorded request was edited by hand", async () => {
    const dir = scratchFixturesDir();
    await recordInto(dir, REQUEST, "both");
    const file = soleFixtureFile(dir);
    writeFileSync(file, readFileSync(file, "utf8").replace(REQUEST.system, "Something else."));

    await expect(replayClient(dir).complete(REQUEST)).rejects.toThrow(/recorded, never written/i);
  });

  it("states the recorded-not-written rule in the file itself, first", async () => {
    // The README says it and ADR 0001 says it; neither is open on the screen of
    // someone about to change a number here until a test goes green. This is.
    const dir = scratchFixturesDir();
    await recordInto(dir, REQUEST, "both");

    const file = readFileSync(soleFixtureFile(dir), "utf8");
    const [firstLine, secondLine] = file.split("\n");

    expect(firstLine).toBe("{");
    expect(secondLine).toContain("never written or edited by hand");
    // Read back through the parser rather than off the line, because the command
    // it names carries quotes and the file carries them escaped.
    expect(JSON.parse(file).note).toContain(RECORD_COMMAND);
  });

  it("keeps serving a Fixture whose note was removed, since a note is not an answer", async () => {
    // The seal covers what the model said, not the commentary around it: a
    // contributor who deletes the note has removed a comment, and calling that
    // tampering would spend the integrity check's credibility on a false alarm.
    const dir = scratchFixturesDir();
    await recordInto(dir, REQUEST, "both");
    const file = soleFixtureFile(dir);
    const { note, ...withoutNote } = JSON.parse(readFileSync(file, "utf8"));
    writeFileSync(file, JSON.stringify(withoutNote, null, 2));

    expect(note).toContain("never written");
    await expect(replayClient(dir).complete(REQUEST)).resolves.toBeDefined();
  });

  it("hands back what the client behind it answered while recording", async () => {
    const dir = scratchFixturesDir();

    const response = await recordingClient(standInClient("hr"), dir).complete(REQUEST);

    expect(response.content).toEqual([{ type: "text", text: "hr" }]);
  });
});
