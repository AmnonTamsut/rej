import { execFile } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { beforeAll, describe, expect, it } from "vitest";
import { runCli } from "./cli.js";
import type { LLMResponse } from "./llm/client.js";
import { RECORD_COMMAND } from "./llm/fixtures.js";
import { API_KEY_VARIABLE, LIVE_FLAG } from "./llm/mode.js";
import { asksFor, says, scratchFixturesDir, scriptedClient } from "./llm/testing.js";
import { recordFixtures } from "./record.js";
import { loadEmbedder } from "./router/embedder.js";

const UNPLACEABLE = "Write me a poem about a cat.";
const CASH = "What's our cash position right now?";
const HIRE = "Should we hire more people?";

const CASH_ANSWER =
  "You are holding 1,248,000 USD as of 2025-09-30, burning 96,000 USD a month, " +
  "which is 13 months of runway.";

/** A finance turn: the agent reads the cash position, then answers from it. */
const CASH_TURN = [asksFor("finance_cash_position"), says(CASH_ANSWER)];

const CASH_CONTRIBUTION = "You are holding 1,248,000 USD as of 2025-09-30, burning 96,000 a month.";
const HEADCOUNT_CONTRIBUTION = "There are 48 people here as of 2025-09-30.";

const RECOMMENDATION =
  "Hire one engineer. The HR Agent reports 48 people as of 2025-09-30; the Finance Agent " +
  "reports 1,248,000 USD in the bank against a burn of 96,000 a month.";

/** A whole Agent Meeting: the Finance Agent's turn, the HR Agent's turn, then the synthesis. */
const meetingTurns = (recommendation: string) => [
  asksFor("finance_cash_position"),
  says(CASH_CONTRIBUTION),
  asksFor("hr_headcount"),
  says(HEADCOUNT_CONTRIBUTION),
  says(recommendation),
];

/**
 * A fixtures directory holding a real recording of this Question's model calls,
 * written by the record command rather than by hand.
 */
const recorded = async (
  question: string,
  responses: readonly LLMResponse[],
): Promise<string> => {
  const dir = scratchFixturesDir();
  await recordFixtures([question], scriptedClient(responses), dir);
  return dir;
};

const ask = (question: string, env: Record<string, string | undefined> = {}) =>
  runCli([question], { ...env, FIXTURES_DIR: env["FIXTURES_DIR"] ?? scratchFixturesDir() });

/** Ask a Question with its own model calls already recorded — the ordinary Replay Mode run. */
const askRecorded = async (
  question: string,
  responses: readonly LLMResponse[],
  env: Record<string, string | undefined> = {},
) => ask(question, { ...env, FIXTURES_DIR: await recorded(question, responses) });

describe("the command-line entry point", () => {
  beforeAll(async () => {
    await loadEmbedder();
  });

  it("answers a money Question, naming the Route and the agent that answered", async () => {
    const question = "How much did we spend on payroll last quarter?";
    const { exitCode, output } = await askRecorded(question, [
      asksFor("finance_payroll_cost", { period: "Q3" }),
      says("Payroll cost 1,096,000 USD in Q3, covering 48 people."),
    ]);

    expect(exitCode).toBe(0);
    expect(output).toMatch(/Route:\s+finance/);
    expect(output).toMatch(/Agent:\s+Finance Agent/);
    expect(output).toContain("Payroll cost 1,096,000 USD in Q3, covering 48 people.");
  });

  it("grounds the answer in what a Scoped Tool actually returned", async () => {
    // The figure in the answer is the figure in `dataset.json`, having travelled
    // through the real tool: the Fixture holds what the model said, but the
    // number it was given came from the Finance Agent's own Dataset.
    const { output } = await askRecorded(CASH, CASH_TURN);

    expect(output).toContain("1,248,000");
    expect(output).toContain("13 months of runway");
  });

  it("reports the Number Audit alongside an answer whose figures all check out", async () => {
    const { output } = await askRecorded(CASH, CASH_TURN);

    expect(output).toMatch(/Number Audit: passed/);
  });

  it("marks an answer as unaudited when a figure in it came from nowhere, and names the figure", async () => {
    // The failure this whole check exists for, driven through the entry point:
    // a recorded turn in which the model states a figure the Scoped Tool never
    // returned. The operator is told which figure it was, and is told before
    // acting on it — the answer is never presented as though it passed.
    const { exitCode, output } = await askRecorded(CASH, [
      asksFor("finance_cash_position"),
      says("You are holding 2,400,000 USD, which is 13 months of runway."),
    ]);

    expect(exitCode).toBe(0);
    expect(output).toMatch(/Number Audit: FAILED/);
    expect(output).toContain("2,400,000");
    expect(output).toMatch(/unaudited/i);
    expect(output).not.toMatch(/Number Audit: passed/);
  });

  it("answers a people Question through the same entry point, naming the agent that answered", async () => {
    // The operator's whole interface to both domains: the same command, the
    // same output, and no flag selecting an agent. The Route names which
    // Specialist Agent spoke; nothing asks the operator to know in advance.
    const question = "How many people work in the sales team?";
    const { exitCode, output } = await askRecorded(question, [
      asksFor("hr_headcount", { team: "sales" }),
      says("Sales is 7 people, all permanent, as of 2025-09-30."),
    ]);

    expect(exitCode).toBe(0);
    expect(output).toMatch(/Route:\s+hr/);
    expect(output).toMatch(/Agent:\s+HR Agent/);
    expect(output).toContain("Sales is 7 people, all permanent, as of 2025-09-30.");
  });

  it("answers a cross-cutting Question with one joint recommendation, naming who met", async () => {
    const { exitCode, output } = await askRecorded(HIRE, meetingTurns(RECOMMENDATION));

    expect(exitCode).toBe(0);
    expect(output).toMatch(/Route:\s+both/);
    expect(output).toMatch(/Meeting:\s+Finance Agent, HR Agent/);
    expect(output).toContain(RECOMMENDATION);
  });

  it("prints the recommendation and not the two contributions behind it", async () => {
    // The operator asked a Question, not for a transcript. Both domains are in
    // the recommendation — the cash position from one Dataset and the headcount
    // from the other — and neither contribution is pasted in beside it.
    const { output } = await askRecorded(HIRE, meetingTurns(RECOMMENDATION));

    expect(output).toContain("1,248,000");
    expect(output).toContain("48 people");
    expect(output).not.toContain(CASH_CONTRIBUTION);
    expect(output).not.toContain(HEADCOUNT_CONTRIBUTION);
  });

  it("reports a Number Audit that names each contribution and the recommendation", async () => {
    const { output } = await askRecorded(HIRE, meetingTurns(RECOMMENDATION));

    expect(output).toMatch(/Number Audit: passed/);
    expect(output).toMatch(/Finance Agent's contribution/);
    expect(output).toMatch(/HR Agent's contribution/);
    expect(output).toMatch(/joint recommendation/);
  });

  it("marks a recommendation unaudited when it states a figure neither agent's tools returned", async () => {
    // The Agent Meeting's version of the failure the whole check exists for: a
    // figure that is in neither Dataset, in the one text the operator reads.
    const invented =
      "Hire two engineers. The Finance Agent reports 1,248,000 USD in the bank, which covers " +
      "the 260,000 they would cost.";
    const { exitCode, output } = await askRecorded(HIRE, meetingTurns(invented));

    expect(exitCode).toBe(0);
    expect(output).toMatch(/Number Audit: FAILED/);
    expect(output).toContain("260,000");
    expect(output).toMatch(/joint recommendation/);
    expect(output).toMatch(/unaudited/i);
    expect(output).not.toMatch(/Number Audit: passed/);
  });

  it("names the attendee whose own contribution failed the audit, even when the recommendation passes", async () => {
    // A contribution is audited against its own agent's Scoped Tool results and
    // reported under that agent's name, so an invented figure is attributable to
    // the domain that invented it rather than lost inside the meeting.
    const { output } = await askRecorded(HIRE, [
      asksFor("finance_cash_position"),
      says("You are holding 2,400,000 USD."),
      asksFor("hr_headcount"),
      says(HEADCOUNT_CONTRIBUTION),
      says(RECOMMENDATION),
    ]);

    expect(output).toMatch(/Number Audit: FAILED.*2,400,000.*Finance Agent's contribution/);
  });

  it("prints the per-bank similarity scores behind every verdict", async () => {
    const { output } = await askRecorded(CASH, CASH_TURN);

    for (const bank of ["finance", "hr", "both"]) {
      expect(output, `expected a score line for the ${bank} bank`).toMatch(
        new RegExp(`${bank}\\s+0\\.\\d+`),
      );
    }
  });

  it("names the Local Pass as the stage when it placed the Question itself", async () => {
    const { output } = await askRecorded(CASH, CASH_TURN);

    expect(output).toMatch(/Local Pass/);
    expect(output).not.toMatch(/Escalation/);
  });

  it("never escalates a Question the Local Pass places: the recorded calls are enough", async () => {
    // The Fixtures hold exactly the calls the recording run made — an Agent
    // Meeting's two turns and its synthesis, and no Escalation, because the
    // Local Pass placed the Question. A run that escalated would be asking for a
    // Fixture nobody recorded and would fail loudly, so a clean run is the
    // assertion: the free path stayed free.
    const { exitCode, output } = await askRecorded(HIRE, meetingTurns(RECOMMENDATION));

    expect(exitCode).toBe(0);
    expect(output).toMatch(/Route:\s+both/);
    expect(output).not.toMatch(/Escalation/);
  });

  it("escalates an Abstention and reports the Route Escalation placed it as", async () => {
    // Two recordings, not one: Escalation's verdict, and then the turn of the
    // agent that verdict handed the Question to.
    const { exitCode, output } = await askRecorded(UNPLACEABLE, [
      says("hr"),
      says("I answer people Questions, and that is not one."),
    ]);

    expect(exitCode).toBe(0);
    expect(output).toMatch(/Route:\s+hr/);
    expect(output).toMatch(/Escalation/);
  });

  it("hands a misrouted Question to the agent, and reports the refusal as the answer", async () => {
    // A Router mistake, played out end to end: Escalation places a Question
    // that belongs to neither domain as `finance`, and the Finance Agent's
    // refusal reaches the operator as the answer.
    //
    // What this pins is the path, not the model's judgement — in Replay Mode
    // the refusal is whatever was recorded. That the agent refuses at all is
    // the system prompt's job (`FINANCE_SYSTEM_PROMPT`, asserted in
    // `isolation.test.ts`), and it is a recorded Live Mode turn in the demo set
    // that shows it happening for real.
    const refusal =
      "That is not something I can answer. I can see this company's revenue, expenses, cash " +
      "position, and total payroll cost, and nothing else.";
    const { exitCode, output } = await askRecorded(UNPLACEABLE, [says("finance"), says(refusal)]);

    expect(exitCode).toBe(0);
    expect(output).toMatch(/Agent:\s+Finance Agent/);
    expect(output).toContain(refusal);
    expect(output).not.toMatch(/\$\d|\d{3},\d{3}/);
  });

  it("asks for clarification when Escalation returns `unclear`", async () => {
    const { exitCode, output } = await askRecorded(UNPLACEABLE, [says("unclear")]);

    expect(exitCode).toBe(0);
    expect(output).toMatch(/Route:\s+unclear/);
    expect(output).toMatch(/rephrase|clarif/i);
  });

  it("still shows the scores when it asks for clarification, so the miss is debuggable", async () => {
    const { output } = await askRecorded(UNPLACEABLE, [says("unclear")]);

    expect(output).toMatch(/finance\s+0\.\d+/);
  });

  it("fails loudly on a Fixture miss, pointing at the record command", async () => {
    const { exitCode, output } = await ask(UNPLACEABLE);

    expect(exitCode).toBe(1);
    expect(output).toMatch(/no Fixture/i);
    expect(output).toContain(RECORD_COMMAND);
  });

  it("has no flag that turns Escalation off", async () => {
    // Escalation is unconditional (ADR 0005). An opt-out flag would be an
    // unknown option, and an unknown option stops the run rather than being
    // swallowed into the Question.
    for (const flag of ["--no-escalation", "--local", "--offline", "--replay"]) {
      const { exitCode, output } = await runCli([flag, UNPLACEABLE], {});

      expect(exitCode, `${flag} should not be accepted`).toBe(1);
      expect(output).toMatch(new RegExp(`unknown option.*${flag}`, "i"));
    }
  });

  it("refuses Live Mode without a key, rather than falling back to Replay quietly", async () => {
    const { exitCode, output } = await runCli([LIVE_FLAG, "What's our cash position?"], {});

    expect(exitCode).toBe(1);
    expect(output).toContain(API_KEY_VARIABLE);
  });

  it("stays in Replay Mode when only a key is set, and says so", async () => {
    const { exitCode, notice } = await askRecorded(CASH, CASH_TURN, {
      [API_KEY_VARIABLE]: "sk-ant-not-a-real-key",
    });

    expect(exitCode).toBe(0);
    expect(notice).toContain(LIVE_FLAG);
  });

  it("explains itself when given no Question", async () => {
    const { exitCode, output } = await runCli([], {});

    expect(exitCode).toBe(1);
    expect(output).toMatch(/usage/i);
  });

  it("answers from a clean shell with no API key present", async () => {
    const cliPath = fileURLToPath(new URL("./cli.ts", import.meta.url));
    const repoRoot = path.dirname(path.dirname(cliPath));
    const env: Record<string, string | undefined> = {
      ...process.env,
      FIXTURES_DIR: await recorded(CASH, CASH_TURN),
    };
    for (const key of Object.keys(env)) {
      if (/API_KEY|ANTHROPIC/i.test(key)) delete env[key];
    }

    const { stdout } = await promisify(execFile)("npx", ["tsx", cliPath, CASH], {
      cwd: repoRoot,
      env,
    });

    expect(stdout).toMatch(/Route:\s+finance/);
    expect(stdout).toContain(CASH_ANSWER);
  });
});
