import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { FINANCE_SYSTEM_PROMPT } from "./agents/finance/agent.js";
import { HR_SYSTEM_PROMPT } from "./agents/hr/agent.js";
import { sourceFiles } from "./testing.js";

/**
 * The one rule in `CONTEXT.md` that is about the source tree rather than about
 * any single module, asserted where it belongs: over the whole tree.
 *
 * Noah and Eva are the platform's names for the Finance & Billing and HR
 * departments. They are theming, allowed in prose and in prompts — where they
 * are what the operator's own platform calls these departments — and nowhere
 * else. A code identifier named after one of them would put a name that means
 * nothing outside this company's branding into the vocabulary of everyone
 * reading the code afterwards.
 *
 * The rule is checked by shape rather than against a list of files, so a third
 * Specialist Agent whose prompt names its own department passes without an edit
 * here. Adding an agent should be a Dataset, a tool set, a prompt, and an
 * Exemplar Bank — a test that had to be updated too would be a fifth thing
 * nobody mentioned.
 */

const srcDir = fileURLToPath(new URL(".", import.meta.url));
const repoRoot = path.dirname(srcDir);

const THEMED = /\b(Noah|Eva)\b/;

/** A Specialist Agent's own definition — the one kind of source file that may name its department. */
const AGENT_DEFINITION = /^src\/agents\/[\w-]+\/agent\.ts$/;

const relative = (file: string): string => path.relative(repoRoot, file);

describe("the themed department names", () => {
  it("name the departments in the two system prompts", () => {
    expect(FINANCE_SYSTEM_PROMPT).toContain("Noah");
    expect(HR_SYSTEM_PROMPT).toContain("Eva");
  });

  it("appear in no source file but a Specialist Agent's own definition", () => {
    const mentioning = sourceFiles(srcDir)
      .filter((file) => THEMED.test(readFileSync(file, "utf8")))
      .map(relative);

    expect(mentioning.filter((file) => !AGENT_DEFINITION.test(file))).toEqual([]);
    // And the two that do are prompts, so the rule above is being met rather
    // than vacuously passing on a tree that stopped mentioning them at all.
    expect(mentioning.length).toBe(2);
  });

  it("are never code identifiers, in tests either", () => {
    // Declared as one, called or assigned as one, or read off something as a
    // field. Prose in a prompt says "the department the platform calls Noah."
    // and matches none of these, which is the distinction the rule draws.
    const asIdentifier = [
      /\b(const|let|var|type|interface|class|function|enum)\s+\w*(Noah|Eva)\w*/,
      /\b(Noah|Eva)\w*\s*[=(]/,
      /\.\s*(Noah|Eva)\w*/,
    ];

    // This file names them in a regex, which is neither prose nor a prompt, so
    // it excludes itself by its own path rather than by being listed anywhere.
    const scanned = sourceFiles(srcDir, { includeTests: true }).filter(
      (file) => file !== fileURLToPath(import.meta.url),
    );

    for (const file of scanned) {
      const source = readFileSync(file, "utf8");
      for (const pattern of asIdentifier) expect(source, relative(file)).not.toMatch(pattern);
    }
  });
});
