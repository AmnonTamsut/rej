import { readdirSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { askQuestion } from "./ask.js";
import { DEMO_QUESTIONS } from "./demo.js";
import { replayClient } from "./llm/fixtures.js";
import { API_KEY_VARIABLE } from "./llm/mode.js";
import { BUDGET_CAP_USD, formatSpend } from "./llm/pricing.js";
import { asksFor, says, scratchFixturesDir, scriptedClient, standInClient } from "./llm/testing.js";
import { DEMO_FLAG, recordFixtures, runRecord } from "./record.js";
import { loadEmbedder } from "./router/embedder.js";
import { routeQuestion } from "./router/router.js";

const PLACED = "How much did we spend on payroll last quarter?";
const UNPLACEABLE = "Write me a poem about a cat.";
const HIRE = "Should we hire more people?";

/** A recorded finance turn: the agent reads one Scoped Tool, then answers. */
const FINANCE_TURN = [
  asksFor("finance_payroll_cost", { period: "Q3" }),
  says("Payroll cost 1,096,000 USD in Q3."),
];

const RECOMMENDATION =
  "Hire one engineer. The HR Agent reports 48 people; the Finance Agent reports 1,248,000 USD " +
  "in the bank.";

/** A recorded Agent Meeting: a turn for each attendee, and then the synthesis. */
const MEETING_TURNS = [
  asksFor("finance_cash_position"),
  says("You are holding 1,248,000 USD."),
  asksFor("hr_headcount"),
  says("There are 48 people here."),
  says(RECOMMENDATION),
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

  it("records a whole Agent Meeting, so Replay Mode can serve the meeting back", async () => {
    // A meeting is three recordings in one Question — a turn per attendee and
    // the synthesis — and a recording that caught only part of it would replay
    // as a Fixture miss halfway through the meeting.
    const dir = scratchFixturesDir();

    const [run] = await recordFixtures([HIRE], scriptedClient(MEETING_TURNS), dir);
    const { meeting } = await askQuestion(HIRE, replayClient(dir));

    expect(run?.calls).toBe(MEETING_TURNS.length);
    expect(meeting?.contributions.map((contribution) => contribution.agent)).toEqual([
      "Finance Agent",
      "HR Agent",
    ]);
    expect(meeting?.recommendation).toBe(RECOMMENDATION);
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

  it("refuses a flag it does not know rather than recording it as a Question", async () => {
    // Spending money to file a Fixture for "--dmeo" is the failure here.
    const dir = scratchFixturesDir();

    const { exitCode, output } = await runRecord(["--dmeo"], {
      [API_KEY_VARIABLE]: "sk-ant-not-a-real-key",
      FIXTURES_DIR: dir,
    });

    expect(exitCode).toBe(1);
    expect(output).toContain("Unknown option --dmeo");
    expect(fixtureCount(dir)).toBe(0);
  });

  it(`refuses ${DEMO_FLAG} beside a Question rather than recording the set and dropping it`, async () => {
    // The same fault as the unknown flag above, one step over: the operator
    // asked for two things and would have paid for one, with nothing said about
    // the other. Which of the two they meant is theirs to say, not ours to pick.
    const dir = scratchFixturesDir();

    const { exitCode, output } = await runRecord([DEMO_FLAG, PLACED], {
      [API_KEY_VARIABLE]: "sk-ant-not-a-real-key",
      FIXTURES_DIR: dir,
    });

    expect(exitCode).toBe(1);
    expect(output).toContain(PLACED);
    expect(fixtureCount(dir)).toBe(0);
  });

  it(`offers ${DEMO_FLAG} as the one deliberate pass, and says what it records`, () => {
    // The set is named by the flag rather than typed out by whoever records, so
    // the shipped Fixtures and the demo cannot drift apart by a copy-paste.
    expect(DEMO_FLAG).toBe("--demo");
    expect(DEMO_QUESTIONS.length).toBeGreaterThan(0);
  });
});

describe("what a recording pass reports about its spend", () => {
  it("prices the pass against the project's cap", () => {
    // 10,000 input at $3/M and 2,000 output at $15/M is $0.06.
    const line = formatSpend({ inputTokens: 10_000, outputTokens: 2_000 });

    expect(line).toContain("10,000 input");
    expect(line).toContain("2,000 output");
    expect(line).toContain("$0.0600");
    expect(line).toContain(`$${BUDGET_CAP_USD} project cap`);
  });

  it("shows a fraction of a cent as a fraction of a cent, rather than as free", () => {
    // A pass that rounds to "$0.00" reads as costing nothing, which is the one
    // thing a spend report must never say about spend.
    expect(formatSpend({ inputTokens: 100, outputTokens: 20 })).toContain("$0.0006");
  });
});
