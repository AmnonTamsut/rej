import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { runCli } from "./cli.js";
import { DEMO_QUESTIONS } from "./demo.js";
import { LIVE_ASK_COMMAND } from "./llm/fixtures.js";
import { LIVE_FLAG } from "./llm/live-flag.js";
import { API_KEY_VARIABLE } from "./llm/mode.js";
import { EMBEDDING_MODEL, EMBEDDING_MODEL_DOWNLOAD_MB, loadEmbedder } from "./router/embedder.js";
import { SCORE_FLOOR, TOP_TWO_MARGIN } from "./router/thresholds.js";
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

/**
 * The marker a shortened transcript ends with, on a line of its own.
 *
 * A README long enough to go unread is its own kind of wrong, so a transcript is
 * allowed to stop early. What is not allowed is stopping early invisibly: the
 * marker is what tells a reader the run continued, and it is what lets the check
 * below stay exact about the part that is shown.
 */
const ELISION_MARKER = "…";

/**
 * Whether a transcript shown in the README is a faithful view of a real run.
 *
 * A whole transcript must match the run to the character, as before. A
 * transcript ending in the marker must be a *line-wise prefix* of the run —
 * every line shown was printed by the run, whole and in order, and only the tail
 * is missing. The rule is deliberately one-sided: it buys brevity without buying
 * the ability to show output the system never produced, which is the only thing
 * this check was ever protecting.
 *
 * Line-wise rather than character-wise on purpose. A raw string prefix would
 * accept a line cut off in the middle, which is how a figure becomes a different
 * figure — "$1,248,000" shortened to "$1,248" is a prefix and a lie.
 *
 * Two degenerate shortenings fail. A marker with nothing shown above it claims
 * to be a transcript of a run it does not quote at all, and a marker with the
 * whole run above it promises output the run never had — both are lies about the
 * run in the same way an invented line is.
 */
const isFaithfulTranscript = (shown: string, actual: string): boolean => {
  const lines = shown.split("\n");
  if (lines[lines.length - 1] !== ELISION_MARKER) return shown === actual;

  const quoted = lines.slice(0, -1);
  while (quoted[quoted.length - 1] === "") quoted.pop();
  const printed = actual.split("\n");

  return (
    quoted.length > 0 &&
    quoted.length < printed.length &&
    quoted.every((line, index) => line === printed[index])
  );
};

describe("reading a transcript the README shortened", () => {
  const run = ["Question: How much cash?", "", "Route:    finance   (Local Pass)", "$1,248,000"].join(
    "\n",
  );

  it("accepts a transcript shown whole", () => {
    expect(isFaithfulTranscript(run, run)).toBe(true);
  });

  it("rejects a transcript that differs from the run", () => {
    expect(isFaithfulTranscript(run.replace("$1,248,000", "$2,000,000"), run)).toBe(false);
  });

  const shortenedTo = (...lines: string[]): string => [...lines, "", ELISION_MARKER].join("\n");

  it("accepts a shortened transcript whose shown lines were really printed", () => {
    const shown = shortenedTo("Question: How much cash?", "", "Route:    finance   (Local Pass)");

    expect(isFaithfulTranscript(shown, run)).toBe(true);
  });

  it("rejects a shortened transcript whose shown lines were edited", () => {
    const shown = shortenedTo("Question: How much cash?", "", "Route:    hr        (Local Pass)");

    expect(isFaithfulTranscript(shown, run)).toBe(false);
  });

  it("rejects a line cut off mid-way, which is how a figure becomes another figure", () => {
    const shown = shortenedTo("Question: How much cash?", "", "Route:    fin");

    expect(isFaithfulTranscript(shown, run)).toBe(false);
  });

  it("rejects an elision that elides nothing", () => {
    expect(isFaithfulTranscript(`${run}\n\n${ELISION_MARKER}`, run)).toBe(false);
  });

  it("rejects a marker quoting no output at all", () => {
    expect(isFaithfulTranscript(ELISION_MARKER, run)).toBe(false);
  });

  it("does not treat a marker inside a line as an elision", () => {
    expect(isFaithfulTranscript(`Question: how much…`, run)).toBe(false);
  });
});

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

  it("shows the live invocation the code itself hands out on a Fixture miss", () => {
    // Two copies of one command line: this one, and the one a miss prints. A
    // reader who follows the README and a reader who follows the error should
    // type the same thing, and the way to keep that true is to fail here when
    // they diverge.
    expect(readme()).toContain(LIVE_ASK_COMMAND.replace('"<the Question>"', ""));
  });

  it("names both things a Live Mode run needs", () => {
    // What it costs is deliberately not asserted, and deliberately not stated.
    // The recording bill is this project's figure, not a reader's: someone
    // running this brings their own key, and the figures they would want are
    // per-Question ones nobody has measured. `docs/recording-pass.md` owns what
    // was actually spent, and the repository map points at it.
    const text = readme();

    expect(text).toContain(LIVE_FLAG);
    expect(text).toContain(API_KEY_VARIABLE);
  });

  it("explains the first-run model download, at the size the embedder reports", () => {
    expect(readme()).toMatch(new RegExp(`~?${EMBEDDING_MODEL_DOWNLOAD_MB}\\s?MB`, "i"));
  });

  it("names the embedding model the Local Pass is actually calibrated against", () => {
    // The thresholds below are this model's numbers — `thresholds.ts` says so.
    // Swapping the model without revisiting them would leave the README naming
    // one model and quoting another's floor.
    expect(readme()).toContain(EMBEDDING_MODEL);
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
      // Whole or shortened, everything shown was printed by the run — see
      // `isFaithfulTranscript` for what shortening is allowed to hide.
      expect(isFaithfulTranscript(shown, output.trim()), question).toBe(true);
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

  it("quotes the two thresholds at the values the Local Pass actually uses", () => {
    // Quoted from the module that owns them, not from themselves. Tuning is
    // meant to be a one-number edit in `thresholds.ts`, and a README still
    // naming the old floor would describe a Router nobody has any more.
    const text = readme();

    expect(text).toContain(`\`${SCORE_FLOOR}\``);
    expect(text).toContain(`\`${TOP_TWO_MARGIN}\``);
  });

  it("lists the next steps that were deliberately not built", () => {
    expect(readme()).toMatch(/^## Next steps/m);
  });
});
