import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const srcDir = fileURLToPath(new URL(".", import.meta.url));
const repoRoot = path.dirname(srcDir);

const sourceFiles = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return entry.isFile() && entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts")
      ? [full]
      : [];
  });

/**
 * Routing is free and offline in this ticket, and the cheapest way to keep it
 * that way is to assert that nothing in the system can reach the network at
 * all. Escalation (ticket 02) will make one call through the `LLMClient` seam
 * and will have to change this test deliberately — which is the point.
 */
describe("the system as shipped in this ticket", () => {
  it("holds no code that can reach the network", () => {
    const offenders = sourceFiles(srcDir).flatMap((file) => {
      const source = readFileSync(file, "utf8");
      const found = ["fetch(", "node:http", "node:https", "XMLHttpRequest", "@anthropic-ai"].filter(
        (needle) => source.includes(needle),
      );
      return found.map((needle) => `${path.relative(repoRoot, file)} contains ${needle}`);
    });

    expect(offenders).toEqual([]);
  });

  it("depends on nothing but the local embedding runtime", () => {
    const manifest: { dependencies?: Record<string, string> } = JSON.parse(
      readFileSync(path.join(repoRoot, "package.json"), "utf8"),
    );

    expect(Object.keys(manifest.dependencies ?? {})).toEqual(["@huggingface/transformers"]);
  });

  it("needs no API key: the entry point never reads one from the environment", () => {
    const sources = sourceFiles(srcDir).map((file) => readFileSync(file, "utf8"));

    expect(sources.some((source) => /API_KEY|ANTHROPIC/i.test(source))).toBe(false);
  });
});
