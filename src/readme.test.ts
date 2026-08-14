import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { runCli } from "./cli.js";
import { DEMO_QUESTIONS } from "./demo.js";
import { API_KEY_VARIABLE, LIVE_FLAG } from "./llm/mode.js";
import { BUDGET_CAP_USD } from "./llm/pricing.js";
import { EMBEDDING_MODEL_DOWNLOAD_MB, loadEmbedder } from "./router/embedder.js";
import { abstentionsIn, survey } from "./survey.js";

/**
 * The README is a deliverable, so the claims in it that can go stale are
 * checked here rather than left to a reviewer to discover as lies.
 *
 * Only the checkable half is tested: the commands it tells a reader to run, the
 * files it points at, the figures it quotes from the code, and the transcripts
 * it shows as real runs. Whether the prose explains the architecture well is not
 * something a test can say, and this file does not pretend otherwise — what it
 * can say is that the run instructions still work and the sample output is still
 * what the system prints.
 *
 * The figures are pinned to their sources rather than to themselves, which
 * matters most for the ones an Exemplar Bank edit moves: widening a Bank is
 * meant to change the Abstention rate, and a README quoting the old one would
 * otherwise go quietly wrong at exactly the moment someone improved the Router.
 */

const srcDir = fileURLToPath(new URL(".", import.meta.url));
const repoRoot = path.dirname(srcDir);
const readme = (): string => readFileSync(path.join(repoRoot, "README.md"), "utf8");

type PackageJson = { readonly scripts: Readonly<Record<string, string>> };

const packageScripts = (): Readonly<Record<string, string>> =>
  (JSON.parse(readFileSync(path.join(repoRoot, "package.json"), "utf8")) as PackageJson).scripts;

/** Every fenced code block in the README, without its fences. */
const fencedBlocks = (markdown: string): string[] =>
  [...markdown.matchAll(/```[a-z]*\n([\s\S]*?)```/g)].map((match) => match[1] ?? "");

describe("the README's run instructions", () => {
  /** What `npm` itself provides, so telling a reader to run it needs no script. */
  const BUILT_IN = ["install", "test", "ci"];

  it("names only commands that npm or package.json actually provides", () => {
    const scripts = packageScripts();
    const named = [...readme().matchAll(/\bnpm (?:run )?([a-z-]+)/g)].map((match) => match[1] ?? "");

    expect(named.length).toBeGreaterThan(0);
    expect(
      [...new Set(named)].filter(
        (command) => scripts[command] === undefined && !BUILT_IN.includes(command),
      ),
    ).toEqual([]);
  });

  it("points only at files that exist", () => {
    const referenced = [...readme().matchAll(/\b(?:src|docs|fixtures)\/[\w./-]*[\w/]/g)].map(
      (match) => match[0],
    );

    expect(referenced.length).toBeGreaterThan(0);
    expect(referenced.filter((file) => !existsSync(path.join(repoRoot, file)))).toEqual([]);
  });

  it("says Live Mode needs both the flag and the key, and what a run costs", () => {
    const text = readme();

    expect(text).toContain(LIVE_FLAG);
    expect(text).toContain(API_KEY_VARIABLE);
    expect(text).toContain(`$${BUDGET_CAP_USD}`);
    // The recorded pass's own figure, quoted from the document that owns it, so
    // the two cannot drift into disagreeing about what the demo set cost.
    const recordingPass = readFileSync(path.join(repoRoot, "docs/recording-pass.md"), "utf8");
    expect(recordingPass).toContain("$0.1172");
    expect(text).toContain("$0.1172");
  });

  it("explains the first-run model download, at the size the embedder reports", () => {
    expect(readme()).toMatch(new RegExp(`~?${EMBEDDING_MODEL_DOWNLOAD_MB}\\s?MB`, "i"));
  });
});

describe("the README's sample runs", () => {
  beforeAll(async () => {
    await loadEmbedder();
  });

  /**
   * A transcript in the README is a fenced block whose first line is the entry
   * point's own — so a reader can tell a run from an instruction, and so this
   * file can find every one of them rather than the one it was told about.
   */
  const transcripts = (): { question: string; shown: string }[] =>
    fencedBlocks(readme())
      .map((block) => ({
        block,
        match: /^Question: (.+)$/m.exec(block.trim().split("\n")[0] ?? ""),
      }))
      .flatMap(({ block, match }) =>
        match === null ? [] : [{ question: match[1] ?? "", shown: block.trim() }],
      );

  it("shows at least one run, and only Questions the demo set asks", () => {
    const shown = transcripts();

    expect(shown.length).toBeGreaterThan(0);
    const asked = DEMO_QUESTIONS.map((demo) => demo.question);
    expect(shown.map(({ question }) => question).filter((one) => !asked.includes(one))).toEqual([]);
  });

  it("shows the output Replay Mode actually produces, to the character", async () => {
    for (const { question, shown } of transcripts()) {
      const { exitCode, output } = await runCli([question], {});

      expect(exitCode, question).toBe(0);
      expect(shown, question).toBe(output.trim());
    }
  });

  it("counts the demo Questions the way the demo does", () => {
    expect(readme()).toContain(`the seven demo Questions`);
    expect(DEMO_QUESTIONS.length).toBe(7);
  });
});

describe("the README's figures from the Abstention survey", () => {
  beforeAll(async () => {
    await loadEmbedder();
  });

  it("quotes the Abstention rate the survey currently measures", async () => {
    const { rows, abstentionRate } = await survey();

    expect(abstentionsIn(rows).length).toBeGreaterThan(0);
    expect(readme()).toContain(`${(abstentionRate * 100).toFixed(0)}%`);
  });

  it("quotes the score the French Question actually gets", async () => {
    const { rows } = await survey();
    const french = rows.find((row) => row.question.startsWith("Combien"));

    expect(french).toBeDefined();
    expect(readme()).toContain((french?.best ?? 0).toFixed(3));
  });
});

describe("the README's account of the design", () => {
  it("uses the vocabulary CONTEXT.md settles", () => {
    const text = readme();

    for (const term of [
      "Question",
      "Route",
      "Router",
      "Local Pass",
      "Escalation",
      "Abstention",
      "Exemplar Bank",
      "Specialist Agent",
      "Finance Agent",
      "HR Agent",
      "Dataset",
      "Scoped Tool",
      "Agent Meeting",
      "Number Audit",
      "Replay Mode",
      "Live Mode",
      "Fixture",
    ]) {
      expect(text).toContain(term);
    }
  });

  it("carries the department theming, which belongs in prose", () => {
    // The other half of this rule — that the names are never code identifiers —
    // is a rule about the source tree, and is asserted in `vocabulary.test.ts`.
    expect(readme()).toMatch(/\b(Noah|Eva)\b/);
  });

  it("names the two limitations a reviewer would otherwise meet as bugs", () => {
    const limitations = readme().split(/^## /m).find((section) => section.startsWith("Limitations"));

    expect(limitations).toBeDefined();
    // The Router's vocabulary limit, and that a thin Bank reads as spend.
    expect(limitations).toMatch(/Exemplar Bank/);
    // Ambiguity is no longer free, and which stage is which.
    expect(limitations).toMatch(/Escalation/);
    expect(limitations).toMatch(/deterministic/);
  });

  it("describes the growth path as the four things a third Specialist Agent needs", () => {
    const growth = readme()
      .split(/^## /m)
      .find((section) => /^Adding a (third )?Specialist Agent/.test(section));

    expect(growth).toBeDefined();
    for (const part of ["Dataset", "Scoped Tool", "prompt", "Exemplar Bank"]) {
      expect(growth).toContain(part);
    }
  });

  it("lists the next steps that were deliberately not built", () => {
    expect(readme()).toMatch(/^## Next steps/m);
  });
});
