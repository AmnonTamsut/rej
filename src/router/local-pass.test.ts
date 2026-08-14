import { beforeAll, describe, expect, it } from "vitest";
import type { LocalRoute } from "../domain/route.js";
import { localPass, type BankScores, type LocalPassVerdict } from "./local-pass.js";
import { loadEmbedder } from "./embedder.js";
import { SCORE_FLOOR, TOP_TWO_MARGIN } from "./thresholds.js";

/**
 * What the Local Pass can produce. `abstention` is not a Route and there is no
 * `unclear` here at all — the Local Pass cannot reach it.
 */
type Expected = LocalRoute | "abstention";

type Case = {
  readonly question: string;
  readonly expected: Expected;
  /** Why this Question is in the table — boundary cases say which boundary. */
  readonly because: string;
};

const CASES: readonly Case[] = [
  // finance — money Questions
  { question: "How much did we spend on payroll last quarter?", expected: "finance", because: "payroll cost is a money Question" },
  { question: "What's our cash position right now?", expected: "finance", because: "cash is squarely finance" },
  { question: "Did revenue go up or down in Q3?", expected: "finance", because: "revenue is squarely finance" },
  { question: "Are we making more money than we're burning?", expected: "finance", because: "profitability phrased loosely" },

  // hr — people Questions
  { question: "How many people work in the sales team?", expected: "hr", because: "headcount is squarely hr" },
  { question: "What does our head of engineering get paid?", expected: "hr", because: "an individual salary is hr, never finance" },
  { question: "Is anyone quitting more than usual?", expected: "hr", because: "attrition phrased loosely" },

  // both — cross-cutting Questions
  { question: "Should we hire more people?", expected: "both", because: "the canonical cross-cutting Question" },
  { question: "Can we afford to bring on three more engineers?", expected: "both", because: "a hiring Question that is also a cash Question" },
  { question: "Would raising everyone's salary hurt our runway?", expected: "both", because: "pay and runway in one Question" },
  {
    question: "What are we paying the engineering team in total?",
    expected: "both",
    // finance ~0.71, hr ~0.68: neither bank wins outright, so the margin decides.
    because: "near the top-two margin — finance and hr are within it, so the Route is both",
  },

  // abstention — nothing to place
  { question: "Write me a poem about a cat.", expected: "abstention", because: "far below the score floor" },
  { question: "What is the capital of France?", expected: "abstention", because: "off-topic, below the score floor" },
  { question: "How do I fix the printer?", expected: "abstention", because: "workplace-flavoured but no Dataset answers it" },
  {
    question: "What time does the office open?",
    expected: "abstention",
    // ~0.35 against its best bank, just under the 0.4 floor.
    because: "near the score floor from below — sounds like an internal Question but neither domain owns it",
  },

  // near the boundaries from the other side — these must still be placed
  {
    question: "How many roles are we trying to fill?",
    expected: "hr",
    // top-two gap ~0.07, just wider than the margin.
    because: "near the top-two margin from above — vacancies stay hr rather than collapsing to both",
  },
  {
    question: "How much of our monthly spend goes on salaries for the sales team?",
    expected: "finance",
    // top-two gap ~0.07, just wider than the margin.
    because: "near the top-two margin from above — aggregate spend stays finance",
  },
];

/** Scores on every failure, so a boundary miss says how close it was. */
const diagnose = (question: string, expected: Expected, verdict: LocalPassVerdict): string => {
  const ranked = (Object.entries(verdict.scores) as [LocalRoute, number][]).sort((a, b) => b[1] - a[1]);
  const gap = (ranked[0]?.[1] ?? 0) - (ranked[1]?.[1] ?? 0);
  const actual = verdict.outcome === "placed" ? verdict.route : "abstention";

  return [
    `Question:  ${question}`,
    `Expected:  ${expected}`,
    `Actual:    ${actual}`,
    `Scores:    ${ranked.map(([route, score]) => `${route}=${score.toFixed(3)}`).join("  ")}`,
    `Top-two gap ${gap.toFixed(3)} vs margin ${TOP_TWO_MARGIN}; best ${(ranked[0]?.[1] ?? 0).toFixed(3)} vs floor ${SCORE_FLOOR}`,
  ].join("\n");
};

describe("Local Pass", () => {
  // Load once for the whole file, so no single case pays the model load.
  beforeAll(async () => {
    await loadEmbedder();
  });

  describe("places Questions against the Exemplar Banks", () => {
    for (const { question, expected, because } of CASES) {
      it(`${expected}: ${question} (${because})`, async () => {
        const verdict = await localPass(question);
        const actual: Expected = verdict.outcome === "placed" ? verdict.route : "abstention";

        expect(actual, diagnose(question, expected, verdict)).toBe(expected);
      });
    }
  });

  it("reports a score for every Exemplar Bank alongside its verdict", async () => {
    const verdict = await localPass("What's our cash position right now?");

    const scores: BankScores = verdict.scores;
    expect(Object.keys(scores).sort()).toEqual(["both", "finance", "hr"]);
    for (const score of Object.values(scores)) {
      expect(score).toBeGreaterThanOrEqual(-1);
      expect(score).toBeLessThanOrEqual(1);
    }
  });

  it("abstains rather than returning a Route when nothing clears the score floor", async () => {
    const verdict = await localPass("Write me a poem about a cat.");

    // The Abstention carries no Route at all — not `unclear`, not a low-confidence
    // guess. `unclear` is reachable only through Escalation (ADR 0005).
    expect(verdict.outcome).toBe("abstained");
    expect(verdict).not.toHaveProperty("route");
    expect(Math.max(...Object.values(verdict.scores))).toBeLessThan(SCORE_FLOOR);
  });
});
