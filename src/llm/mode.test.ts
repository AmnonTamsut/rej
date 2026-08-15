import { describe, expect, it } from "vitest";
import { oneShot } from "./client.js";
import { DEFAULT_FIXTURES_DIR } from "./fixtures.js";
import { LIVE_FLAG } from "./flags.js";
import { chooseMode, clientFor, environmentFrom } from "./mode.js";
import { scratchFixturesDir } from "./testing.js";

const KEY = "sk-ant-not-a-real-key";

describe("choosing between Replay Mode and Live Mode", () => {
  it("runs in Replay Mode by default, with no key in the environment", () => {
    expect(chooseMode({ live: false, apiKey: undefined }).mode).toBe("replay");
  });

  it("runs in Live Mode when the flag and the key are both present", () => {
    expect(chooseMode({ live: true, apiKey: KEY }).mode).toBe("live");
  });

  it("refuses Live Mode when the flag is passed without a key", () => {
    expect(() => chooseMode({ live: true, apiKey: undefined })).toThrow(/ANTHROPIC_API_KEY/);
  });

  it("stays in Replay Mode when a key is present but the flag is not, and says so", () => {
    // A key in the environment must not, on its own, start spending: an
    // operator with `ANTHROPIC_API_KEY` exported gets the free path unless they
    // ask for the other one. The notice is there so the choice is not silent.
    const choice = chooseMode({ live: false, apiKey: KEY });

    expect(choice.mode).toBe("replay");
    expect(choice.notice).toContain(LIVE_FLAG);
  });

  it("says nothing when the default was the only thing on offer", () => {
    expect(chooseMode({ live: false, apiKey: undefined }).notice).toBeNull();
  });
});

describe("the environment a run reads", () => {
  it("takes the key from ANTHROPIC_API_KEY", () => {
    expect(environmentFrom({ ANTHROPIC_API_KEY: KEY }).apiKey).toBe(KEY);
  });

  it("treats an empty key as no key, so a blank export cannot arm Live Mode", () => {
    expect(environmentFrom({ ANTHROPIC_API_KEY: "  " }).apiKey).toBeUndefined();
  });

  it("reads Fixtures from the shipped directory unless told otherwise", () => {
    expect(environmentFrom({}).fixturesDir).toBe(DEFAULT_FIXTURES_DIR);
    expect(environmentFrom({ FIXTURES_DIR: "/tmp/elsewhere" }).fixturesDir).toBe("/tmp/elsewhere");
  });
});

describe("the client a run gets", () => {
  it("is the replay adapter in Replay Mode: a miss is an error, not a call", async () => {
    const dir = scratchFixturesDir();
    const client = clientFor({ mode: "replay", notice: null }, { apiKey: undefined, fixturesDir: dir });

    await expect(client.complete(oneShot("Place it.", "Anything?"))).rejects.toThrow(/no Fixture/i);
  });

  it("refuses to build a Live Mode client without a key", () => {
    expect(() =>
      clientFor({ mode: "live", notice: null }, { apiKey: undefined, fixturesDir: "unused" }),
    ).toThrow(/ANTHROPIC_API_KEY/);
  });
});
