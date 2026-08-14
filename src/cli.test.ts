import { execFile } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { beforeAll, describe, expect, it } from "vitest";
import { runCli } from "./cli.js";
import { RECORD_COMMAND } from "./llm/fixtures.js";
import { API_KEY_VARIABLE, LIVE_FLAG } from "./llm/mode.js";
import { scratchFixturesDir, standInClient } from "./llm/testing.js";
import { recordFixtures } from "./record.js";
import { loadEmbedder } from "./router/embedder.js";

const UNPLACEABLE = "Write me a poem about a cat.";

/**
 * A fixtures directory holding a real recording of this Question's Escalation,
 * written by the record command rather than by hand.
 */
const recorded = async (question: string, route: string): Promise<string> => {
  const dir = scratchFixturesDir();
  await recordFixtures([question], standInClient(route), dir);
  return dir;
};

const ask = (question: string, env: Record<string, string | undefined> = {}) =>
  runCli([question], { ...env, FIXTURES_DIR: env["FIXTURES_DIR"] ?? scratchFixturesDir() });

describe("the command-line entry point", () => {
  beforeAll(async () => {
    await loadEmbedder();
  });

  it("reports the Route it assigned a money Question", async () => {
    const { exitCode, output } = await ask("How much did we spend on payroll last quarter?");

    expect(exitCode).toBe(0);
    expect(output).toMatch(/Route:\s+finance/);
  });

  it("reports the Route it assigned a people Question", async () => {
    const { output } = await ask("How many people work in the sales team?");

    expect(output).toMatch(/Route:\s+hr/);
  });

  it("reports `both` for a cross-cutting Question", async () => {
    const { output } = await ask("Should we hire more people?");

    expect(output).toMatch(/Route:\s+both/);
  });

  it("prints the per-bank similarity scores behind every verdict", async () => {
    const { output } = await ask("What's our cash position right now?");

    for (const bank of ["finance", "hr", "both"]) {
      expect(output, `expected a score line for the ${bank} bank`).toMatch(
        new RegExp(`${bank}\\s+0\\.\\d+`),
      );
    }
  });

  it("names the Local Pass as the stage when it placed the Question itself", async () => {
    const { output } = await ask("What's our cash position right now?");

    expect(output).toMatch(/Local Pass/);
    expect(output).not.toMatch(/Escalation/);
  });

  it("never escalates a Question the Local Pass places: an empty Fixture set is enough", async () => {
    // With no Fixtures on disk, any call through the seam would fail loudly.
    // That this run succeeds is the assertion — the free path stayed free.
    const { exitCode, output } = await ask("Did revenue go up or down in Q3?");

    expect(exitCode).toBe(0);
    expect(output).toMatch(/Route:\s+finance/);
  });

  it("escalates an Abstention and reports the Route Escalation placed it as", async () => {
    const { exitCode, output } = await ask(UNPLACEABLE, {
      FIXTURES_DIR: await recorded(UNPLACEABLE, "hr"),
    });

    expect(exitCode).toBe(0);
    expect(output).toMatch(/Route:\s+hr/);
    expect(output).toMatch(/Escalation/);
  });

  it("asks for clarification when Escalation returns `unclear`", async () => {
    const { exitCode, output } = await ask(UNPLACEABLE, {
      FIXTURES_DIR: await recorded(UNPLACEABLE, "unclear"),
    });

    expect(exitCode).toBe(0);
    expect(output).toMatch(/Route:\s+unclear/);
    expect(output).toMatch(/rephrase|clarif/i);
  });

  it("still shows the scores when it asks for clarification, so the miss is debuggable", async () => {
    const { output } = await ask(UNPLACEABLE, {
      FIXTURES_DIR: await recorded(UNPLACEABLE, "unclear"),
    });

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
    const { exitCode, notice } = await ask("What's our cash position right now?", {
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

  it("runs from a clean shell with no API key present", async () => {
    const cliPath = fileURLToPath(new URL("./cli.ts", import.meta.url));
    const repoRoot = path.dirname(path.dirname(cliPath));
    const env = { ...process.env };
    for (const key of Object.keys(env)) {
      if (/API_KEY|ANTHROPIC/i.test(key)) delete env[key];
    }

    const { stdout } = await promisify(execFile)(
      "npx",
      ["tsx", cliPath, "What's our cash position right now?"],
      { cwd: repoRoot, env },
    );

    expect(stdout).toMatch(/Route:\s+finance/);
  });
});
