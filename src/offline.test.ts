import { execFile } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { beforeAll, describe, expect, it } from "vitest";
import { API_KEY_VARIABLE } from "./llm/mode.js";
import { asksFor, says, scratchFixturesDir, scriptedClient, standInClient } from "./llm/testing.js";
import { recordFixtures } from "./record.js";
import { loadEmbedder } from "./router/embedder.js";

const srcDir = fileURLToPath(new URL(".", import.meta.url));
const repoRoot = path.dirname(srcDir);
const run = promisify(execFile);

/** A dead proxy: anything attempting HTTP(S) fails to connect. */
const NO_NETWORK = {
  NODE_USE_ENV_PROXY: "1",
  HTTP_PROXY: "http://127.0.0.1:1",
  HTTPS_PROXY: "http://127.0.0.1:1",
};

const sourceFiles = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return entry.isFile() && entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts")
      ? [full]
      : [];
  });

const filesContaining = (needle: string): string[] =>
  sourceFiles(srcDir)
    .filter((file) => readFileSync(file, "utf8").includes(needle))
    .map((file) => path.relative(repoRoot, file));

/**
 * Escalation makes this the first ticket in which the system can spend. These
 * tests are the guard on that: the default path still runs with no key, and the
 * only route to the API is the one file that is allowed to have it.
 */
describe("running with no key and no network", () => {
  beforeAll(async () => {
    // Warm the model cache, so the runs below are normal ones rather than first runs.
    await loadEmbedder();
  });

  it("answers a money Question end to end with every outbound connection blocked", async () => {
    // Verified to have teeth — the same run against an empty model cache fails
    // here. The Local Pass routes locally and the Finance Agent's whole turn,
    // tool calls and all, replays from Fixtures: no key, no spend, no network.
    const question = "What's our cash position right now?";
    const fixturesDir = scratchFixturesDir();
    await recordFixtures(
      [question],
      scriptedClient([
        asksFor("finance_cash_position"),
        says("You hold 1,248,000 USD, with 13 months of runway."),
      ]),
      fixturesDir,
    );

    const { stdout } = await run("npx", ["tsx", "src/cli.ts", question], {
      cwd: repoRoot,
      env: { ...process.env, ...NO_NETWORK, FIXTURES_DIR: fixturesDir },
    });

    expect(stdout).toMatch(/Route:\s+finance/);
    expect(stdout).toContain("1,248,000 USD");
  });

  it("holds a whole Agent Meeting with every outbound connection blocked", async () => {
    // The most expensive path in the system — two agent turns and a synthesis —
    // run with no key and nothing to dial. A meeting is where a stray live call
    // would be easiest to miss, since a Fixture served for the agents' turns
    // would leave only the synthesis reaching out.
    const question = "Should we hire more people?";
    const fixturesDir = scratchFixturesDir();
    await recordFixtures(
      [question],
      scriptedClient([
        asksFor("finance_cash_position"),
        says("You are holding 1,248,000 USD."),
        asksFor("hr_headcount"),
        says("There are 48 people here."),
        says(
          "Hire one engineer. The HR Agent reports 48 people; the Finance Agent reports " +
            "1,248,000 USD in the bank.",
        ),
      ]),
      fixturesDir,
    );

    const { stdout } = await run("npx", ["tsx", "src/cli.ts", question], {
      cwd: repoRoot,
      env: { ...process.env, ...NO_NETWORK, FIXTURES_DIR: fixturesDir },
    });

    expect(stdout).toMatch(/Route:\s+both/);
    expect(stdout).toMatch(/Meeting:\s+Finance Agent, HR Agent/);
    expect(stdout).toContain("The HR Agent reports 48 people");
  });

  it("serves an Escalation from a Fixture with every outbound connection blocked", async () => {
    const question = "Write me a poem about a cat.";
    const fixturesDir = scratchFixturesDir();
    await recordFixtures([question], standInClient("hr"), fixturesDir);

    const { stdout } = await run("npx", ["tsx", "src/cli.ts", question], {
      cwd: repoRoot,
      env: { ...process.env, ...NO_NETWORK, FIXTURES_DIR: fixturesDir },
    });

    expect(stdout).toMatch(/Route:\s+hr/);
    expect(stdout).toMatch(/Escalation/);
  });

  it("reads the API key in exactly one place, so what can spend is one file's worth of reading", () => {
    expect(filesContaining(API_KEY_VARIABLE)).toEqual(["src/llm/mode.ts"]);
  });

  it("reaches the SDK from the live adapter alone; nothing else can call the API", () => {
    expect(filesContaining("@anthropic-ai/sdk")).toEqual(["src/llm/live-client.ts"]);
  });

  it("carries no other first-party code that can reach the network", () => {
    // Narrow by design: this sees only our own source, not our dependencies.
    // The runtime checks above are what actually prove nothing dials out.
    const offenders = sourceFiles(srcDir).flatMap((file) => {
      const source = readFileSync(file, "utf8");
      return ["fetch(", "node:http", "node:https", "XMLHttpRequest"]
        .filter((needle) => source.includes(needle))
        .map((needle) => `${path.relative(repoRoot, file)} contains ${needle}`);
    });

    expect(offenders).toEqual([]);
  });
});
