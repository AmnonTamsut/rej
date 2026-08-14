import type { ToolResult } from "../agents/specialist-agent.js";

/**
 * The Number Audit: every figure in an answer must appear in the Scoped Tool
 * results that answer was built from.
 *
 * This is the check that stops an invented figure reaching the operator. It is
 * a pure function over an answer and its evidence — no client, no Dataset, no
 * IO — so it can be tested on an answer written by hand rather than on a
 * recording that happens to hallucinate, and so it says the same thing about
 * the same answer every time it is asked.
 *
 * What it does not do is decide whether an answer is right. A figure that
 * appears in a tool result is accounted for even if the sentence around it is
 * nonsense. The audit answers one question — where did this number come from —
 * and an operator who has it can go and check the rest.
 *
 * # The rule
 *
 * Both sides are read the same way: a figure is a run of digits, optionally
 * grouped in thousands and optionally with a decimal part. The answer's figures
 * are compared by value against the figures in the rendered tool results, and
 * anything left over is reported.
 *
 * Reading both sides with one rule is what makes the tolerances below fall out
 * rather than accumulate as special cases.
 *
 * # The tolerances, decided rather than discovered
 *
 * Change one of these and this comment is the thing to change with it.
 *
 * - **Currency symbols and thousands separators are formatting.** `$1,248,000`,
 *   `1248000`, and `1,248,000.00` are one figure, because the Dataset holds one
 *   number and an answer will write it every one of those ways. An audit that
 *   failed a well-formatted answer would be ignored within a day.
 * - **Sign is ignored**, for the same reason: "a burn of 96,000" and `-96000`
 *   are the same figure with different prose around them.
 * - **Values are compared exactly.** A figure the agent rounded or rescaled —
 *   "roughly 1.2 million" for 1,248,000 — is a figure no tool returned, and is
 *   reported. Both system prompts already tell the agent never to round,
 *   rescale, or infer a figure; this is that instruction enforced rather than
 *   hoped for.
 * - **A percentage passes only if a tool returned it.** A percentage the agent
 *   worked out from two audited figures — "payroll was 62% of expenses" — is
 *   reported like any other unaccounted figure. The alternative was to accept
 *   any percentage equal to the ratio of two figures in the results, and it was
 *   rejected: with a dozen figures in evidence there are over a hundred such
 *   ratios, so almost any percentage between 0 and 100 would find a pair to
 *   justify it, and percentages would become the one place an invented figure
 *   passed unchallenged. The audit checks provenance, not arithmetic. ADR 0006
 *   carries the reasoning.
 * - **Dates are read in parts on both sides.** `2025-09-30` in a tool result
 *   accounts for 2025, 9, and 30, so an answer that writes it as "30 September
 *   2025" is not reported as having invented a year. The cost is that a date
 *   puts small integers into evidence, which makes a small invented figure
 *   cheaper to account for than a large one. That is the right way round: the
 *   figures worth inventing are the money.
 * - **Numbers written as words are not audited.** "forty-eight people" contains
 *   no figure and is not checked. Extending the audit to words would mean
 *   parsing English number phrases on both sides, which is a larger and less
 *   certain piece of machinery than the one it would protect.
 *
 * # What counts as evidence
 *
 * The `result` a Scoped Tool returned, and nothing else. In particular not the
 * input the model asked with: a model that named a figure in a tool call, took
 * the error the tool returned, and then stated that figure would otherwise have
 * laundered it into an answer through the audit's own evidence.
 */

/**
 * A figure in prose: digits, optional thousands groups, optional decimal part.
 *
 * Deliberately does not match a leading sign or a trailing `%` — both are prose
 * around the figure, and both are read the same way on either side by being
 * left out of the match.
 */
const FIGURE = /\d+(?:,\d{3})*(?:\.\d+)?/g;

/** Every figure in a piece of text, as written and as a number. */
const figuresIn = (text: string): { written: string; value: number }[] =>
  [...text.matchAll(FIGURE)].map((match) => ({
    written: match[0],
    value: Number(match[0].replace(/,/g, "")),
  }));

export type NumberAudit = {
  readonly passed: boolean;
  /**
   * The figures in the answer that no Scoped Tool result accounts for, as the
   * answer wrote them.
   *
   * As written rather than as parsed, because this is what the operator is
   * shown: a figure they can find in the paragraph above by reading it.
   */
  readonly unaccounted: readonly string[];
};

/**
 * Audit an answer against the Scoped Tool results it was built from.
 *
 * Takes the answer as text rather than an `AgentAnswer` so that an Agent
 * Meeting can hold each contribution and its synthesis to the same check.
 */
export const auditNumbers = (
  answer: string,
  toolResults: readonly ToolResult[],
): NumberAudit => {
  const accounted = new Set(
    toolResults.flatMap((result) =>
      figuresIn(JSON.stringify(result.result)).map((figure) => figure.value),
    ),
  );

  const unaccounted: string[] = [];
  const reported = new Set<number>();
  for (const { written, value } of figuresIn(answer)) {
    if (accounted.has(value) || reported.has(value)) continue;
    reported.add(value);
    unaccounted.push(written);
  }

  return { passed: unaccounted.length === 0, unaccounted };
};
