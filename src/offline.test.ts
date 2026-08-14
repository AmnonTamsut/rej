import { execFile } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { beforeAll, describe, expect, it } from "vitest";
import { loadEmbedder } from "./router/embedder.js";

const srcDir = fileURLToPath(new URL(".", import.meta.url));
const repoRoot = path.dirname(srcDir);
const run = promisify(execFile);

const sourceFiles = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return entry.isFile() && entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts")
      ? [full]
      : [];
  });

/**
 * Routing is free and offline in this ticket. Escalation (ticket 02) will make
 * one call through the `LLMClient` seam and will have to change these tests
 * deliberately — which is the point of having them.
 */
describe("running with no key and no network", () => {
  beforeAll(async () => {
    // Warm the model cache, so the run below is a normal one rather than a first run.
    await loadEmbedder();
  });

  it("routes a Question with every outbound connection blocked", async () => {
    // A dead proxy: anything attempting HTTP(S) fails to connect. Verified to
    // have teeth — the same run against an empty model cache fails here.
    const { stdout } = await run("npx", ["tsx", "src/cli.ts", "What's our cash position right now?"], {
      cwd: repoRoot,
      env: {
        ...process.env,
        NODE_USE_ENV_PROXY: "1",
        HTTP_PROXY: "http://127.0.0.1:1",
        HTTPS_PROXY: "http://127.0.0.1:1",
      },
    });

    expect(stdout).toMatch(/Route:\s+finance/);
  });

  it("needs no API key: nothing in the system reads one from the environment", () => {
    const sources = sourceFiles(srcDir).map((file) => readFileSync(file, "utf8"));

    expect(sources.some((source) => /API_KEY|ANTHROPIC/i.test(source))).toBe(false);
  });

  it("carries no first-party code that can reach the network", () => {
    // Narrow by design: this sees only our own source, not our dependencies.
    // The runtime check above is what actually proves nothing dials out.
    const offenders = sourceFiles(srcDir).flatMap((file) => {
      const source = readFileSync(file, "utf8");
      return ["fetch(", "node:http", "node:https", "XMLHttpRequest", "@anthropic-ai"]
        .filter((needle) => source.includes(needle))
        .map((needle) => `${path.relative(repoRoot, file)} contains ${needle}`);
    });

    expect(offenders).toEqual([]);
  });

  it("does not yet depend on an API client", () => {
    const manifest: { dependencies?: Record<string, string> } = JSON.parse(
      readFileSync(path.join(repoRoot, "package.json"), "utf8"),
    );

    expect(Object.keys(manifest.dependencies ?? {})).not.toContain("@anthropic-ai/sdk");
  });
});
