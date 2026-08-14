import { execFile } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { beforeAll, describe, expect, it } from "vitest";
import { runCli } from "./cli.js";
import { loadEmbedder } from "./router/embedder.js";

const run = async (...argv: string[]) => runCli(argv);

describe("the command-line entry point", () => {
  beforeAll(async () => {
    await loadEmbedder();
  });

  it("reports the Route it assigned a money Question", async () => {
    const { exitCode, output } = await run("How much did we spend on payroll last quarter?");

    expect(exitCode).toBe(0);
    expect(output).toMatch(/Route:\s+finance/);
  });

  it("reports the Route it assigned a people Question", async () => {
    const { output } = await run("How many people work in the sales team?");

    expect(output).toMatch(/Route:\s+hr/);
  });

  it("reports `both` for a cross-cutting Question", async () => {
    const { output } = await run("Should we hire more people?");

    expect(output).toMatch(/Route:\s+both/);
  });

  it("prints the per-bank similarity scores behind every verdict", async () => {
    const { output } = await run("What's our cash position right now?");

    for (const bank of ["finance", "hr", "both"]) {
      expect(output, `expected a score line for the ${bank} bank`).toMatch(
        new RegExp(`${bank}\\s+0\\.\\d+`),
      );
    }
  });

  it("returns a clarification request when the Local Pass abstains", async () => {
    const { exitCode, output } = await run("Write me a poem about a cat.");

    expect(exitCode).toBe(0);
    expect(output).toMatch(/rephrase|clarif/i);
    // An Abstention is not a Route, so no Route is reported — and `unclear`
    // is a Route, so it must not appear either. It needs Escalation, which
    // does not exist yet.
    expect(output).not.toMatch(/Route:\s+\w/);
    expect(output).not.toContain("unclear");
  });

  it("still shows the scores when it asks for clarification, so the miss is debuggable", async () => {
    const { output } = await run("Write me a poem about a cat.");

    expect(output).toMatch(/finance\s+0\.\d+/);
  });

  it("explains itself when given no Question", async () => {
    const { exitCode, output } = await run();

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
