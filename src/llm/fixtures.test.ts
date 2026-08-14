import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { LLMRequest } from "./client.js";
import { oneShot } from "./client.js";
import { fixtureKey } from "./fixture-key.js";
import { RECORD_COMMAND, recordingClient, replayClient } from "./fixtures.js";
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

  it("hands back what the client behind it answered while recording", async () => {
    const dir = scratchFixturesDir();

    const response = await recordingClient(standInClient("hr"), dir).complete(REQUEST);

    expect(response.content).toEqual([{ type: "text", text: "hr" }]);
  });
});
