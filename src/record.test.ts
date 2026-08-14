import { readdirSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { replayClient } from "./llm/fixtures.js";
import { API_KEY_VARIABLE } from "./llm/mode.js";
import { scratchFixturesDir, standInClient } from "./llm/testing.js";
import { recordFixtures, runRecord } from "./record.js";
import { loadEmbedder } from "./router/embedder.js";
import { routeQuestion } from "./router/router.js";

const PLACED = "How much did we spend on payroll last quarter?";
const UNPLACEABLE = "Write me a poem about a cat.";

const fixtureCount = (dir: string) => readdirSync(dir).filter((f) => f.endsWith(".json")).length;

describe("the record command", () => {
  beforeAll(async () => {
    await loadEmbedder();
  });

  it("records a Fixture that Replay Mode then serves for the same Question", async () => {
    const dir = scratchFixturesDir();

    await recordFixtures([UNPLACEABLE], standInClient("hr"), dir);
    const verdict = await routeQuestion(UNPLACEABLE, replayClient(dir));

    expect(verdict.route).toBe("hr");
    expect(verdict.stage).toBe("escalation");
  });

  it("records nothing for a Question the Local Pass places, because nothing was asked", async () => {
    const dir = scratchFixturesDir();

    await recordFixtures([PLACED], standInClient("hr"), dir);

    expect(fixtureCount(dir)).toBe(0);
  });

  it("reports what each Question cost, so a recording pass can be counted", async () => {
    const dir = scratchFixturesDir();

    const report = await recordFixtures([PLACED, UNPLACEABLE], standInClient("hr"), dir);

    expect(report).toEqual([
      { question: PLACED, route: "finance", stage: "local-pass", recorded: false },
      { question: UNPLACEABLE, route: "hr", stage: "escalation", recorded: true },
    ]);
  });
});

describe("running the record command", () => {
  it("refuses without a key, recording nothing and spending nothing", async () => {
    const dir = scratchFixturesDir();

    const { exitCode, output } = await runRecord([UNPLACEABLE], { FIXTURES_DIR: dir });

    expect(exitCode).toBe(1);
    expect(output).toContain(API_KEY_VARIABLE);
    expect(fixtureCount(dir)).toBe(0);
  });

  it("explains itself when given no Question", async () => {
    const { exitCode, output } = await runRecord([], { [API_KEY_VARIABLE]: "sk-ant-not-a-real-key" });

    expect(exitCode).toBe(1);
    expect(output).toMatch(/usage/i);
  });
});
