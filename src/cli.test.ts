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

const CASH_ANSWER =
  "You are holding 1,248,000 USD as of 2025-09-30, burning 96,000 USD a month, " +
  "which is 13 months of runway.";

/** A finance turn: the agent reads the cash position, then answers from it. */
const CASH_TURN = [asksFor("finance_cash_position"), says(CASH_ANSWER)];

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

  it("reports `both` for a cross-cutting Question", async () => {
    const { output } = await ask("Should we hire more people?");

    expect(output).toMatch(/Route:\s+both/);
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

  it("never escalates a Question the Local Pass places: an empty Fixture set is enough", async () => {
    // With no Fixtures on disk, any call through the seam would fail loudly.
    // That this run succeeds is the assertion — the free path stayed free. The
    // Question is a cross-cutting one because the Agent Meeting that answers
    // `both` is a later ticket, so routing it costs nothing at all; the same
    // property for a Question an agent does answer is asserted on the recorded
    // Fixtures in `record.test.ts`, where an Escalation would be visible as a
    // recording of its own.
    const { exitCode, output } = await ask("Should we hire more people?");

    expect(exitCode).toBe(0);
    expect(output).toMatch(/Route:\s+both/);
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
