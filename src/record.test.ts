import { readdirSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { askQuestion } from "./ask.js";
import { replayClient } from "./llm/fixtures.js";
import { API_KEY_VARIABLE } from "./llm/mode.js";
import { asksFor, says, scratchFixturesDir, scriptedClient, standInClient } from "./llm/testing.js";
import { recordFixtures, runRecord } from "./record.js";
import { loadEmbedder } from "./router/embedder.js";
import { routeQuestion } from "./router/router.js";

const PLACED = "How much did we spend on payroll last quarter?";
const UNPLACEABLE = "Write me a poem about a cat.";

/** A recorded finance turn: the agent reads one Scoped Tool, then answers. */
const FINANCE_TURN = [
  asksFor("finance_payroll_cost", { period: "Q3" }),
  says("Payroll cost 1,096,000 USD in Q3."),
];

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

  it("records a Specialist Agent's whole turn, so Replay Mode can serve it back", async () => {
    // A turn is several exchanges, and a recording that caught only the routing
    // would replay as a Fixture miss halfway through the answer.
    const dir = scratchFixturesDir();

    await recordFixtures([PLACED], scriptedClient(FINANCE_TURN), dir);
    const { answer } = await askQuestion(PLACED, replayClient(dir));

    expect(answer?.agent).toBe("Finance Agent");
    expect(answer?.answer).toBe("Payroll cost 1,096,000 USD in Q3.");
  });

  it("never escalates a Question the Local Pass places, even now that answering costs calls", async () => {
    // The failure this guards is silent and expensive: escalating on every
    // Question passes every other test in the suite while spending on each run.
    // A recorded run reports the stage that placed each Question, and only a
    // Question that reached Escalation can come back as one — so the report is
    // the evidence, without reaching into what was sent.
    const dir = scratchFixturesDir();

    const [run] = await recordFixtures([PLACED], scriptedClient(FINANCE_TURN), dir);

    expect(run?.stage).toBe("local-pass");
  });

  it("records nothing for a Question no agent answers and the Local Pass places", async () => {
    // A `both` Question, until the Agent Meeting that answers one is built:
    // placed locally, owned by no agent, and so free from end to end.
    const dir = scratchFixturesDir();

    await recordFixtures(["Should we hire more people?"], standInClient("both"), dir);

    expect(fixtureCount(dir)).toBe(0);
  });

  it("reports what each Question cost, so a recording pass can be counted", async () => {
    const dir = scratchFixturesDir();

    const report = await recordFixtures(
      [PLACED, UNPLACEABLE],
      scriptedClient([...FINANCE_TURN, says("unclear")]),
      dir,
    );

    expect(report).toEqual([
      { question: PLACED, route: "finance", stage: "local-pass", calls: 2 },
      { question: UNPLACEABLE, route: "unclear", stage: "escalation", calls: 1 },
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
