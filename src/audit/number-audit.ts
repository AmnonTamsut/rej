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
 * Both sides are read the same way, and reading them with one rule is what
 * makes the tolerances below fall out rather than accumulate as special cases.
 * Text is read as three things: dates, which are whole values however they were
 * written; period labels, which are names rather than figures; and numbers,
 * which are compared by value. Every figure in the answer must be matched by
 * one in the tool results, and anything left over is reported.
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
 * - **A date is one value, not three numbers.** `2025-09-30`, `30 September
 *   2025`, and `September 30, 2025` are the same date and each matches the
 *   Dataset's `asOf`; a date written only as far as its month matches a date in
 *   the same month. What a date is *not* is evidence for a bare number: an
 *   answer claiming "30 months of runway" is reported even though the day of
 *   the month is 30, which is the whole reason dates are read whole. The cost
 *   is that a date written in some form this does not recognise — a bare year,
 *   or a day and month with no year — reads as bare numbers and is reported.
 * - **A quarter label is a period name.** `Q3` is what the Datasets call a
 *   period, so it is read as a name on both sides rather than as the number 3.
 *   The Finance Agent's prompt asks it to name the period, and the cash
 *   position it is naming the period for carries a date rather than a quarter —
 *   without this, doing as it was told would fail the audit. The audit checks
 *   figures, not the labels an answer files them under; it would not catch a
 *   real figure attributed to the wrong quarter either way.
 * - **Numbers written as words are not audited.** "forty-eight people" contains
 *   no figure and is not checked. Extending the audit to words would mean
 *   parsing English number phrases on both sides, which is a larger and less
 *   certain piece of machinery than the one it would protect.
 *
 * # What counts as evidence
 *
 * The `result` a Scoped Tool returned, rendered whole — its field names and any
 * text it carries included, since a Scoped Tool's text is written from the
 * Dataset's own vocabulary and never from the model's words (see the error
 * constants in each agent's `tools.ts`).
 *
 * What is not evidence is the input the model asked with. A model that named a
 * figure in a tool call, took the error the tool returned, and then stated that
 * figure would otherwise have laundered it into an answer through the audit's
 * own evidence.
 */

/**
 * A value read out of text: a number, or a date.
 *
 * `value` is the form both sides are compared in — a number normalised
 * (`1248000`), or a date as far as it was written (`2025-09-30`, or `2025-09`
 * from "September 2025"). `written` is kept because it is what the operator is
 * shown: a figure they can find in the answer by reading it.
 */
type Figure = {
  readonly written: string;
  readonly value: string;
  readonly isDate: boolean;
};

/** What the Datasets call a period. A name, not a figure — see the tolerances above. */
const QUARTER = /\bQ[1-4]\b/gi;

const MONTHS = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];

/** Month names and their three-letter forms, full name first so the longer match wins. */
const MONTH = MONTHS.flatMap((month) => [month, month.slice(0, 3)]).join("|");

const twoDigits = (value: string): string => value.padStart(2, "0");

const monthNumber = (name: string): string =>
  twoDigits(
    String(MONTHS.findIndex((month) => month.startsWith(name.slice(0, 3).toLowerCase())) + 1),
  );

type DateForm = {
  readonly pattern: RegExp;
  /** The date the match names, as far as it was written. */
  readonly dateIn: (parts: readonly (string | undefined)[]) => string;
};

/**
 * The date forms both sides are read for, longest first.
 *
 * Order is load-bearing: a full date is taken before the month-and-year form
 * can take half of it. Each pattern requires a four-digit year, so a date is
 * recognised only when it is written in full — which is the point at which
 * calling it a date rather than a run of numbers is safe.
 */
const DATE_FORMS: readonly DateForm[] = [
  {
    pattern: /(\d{4})-(\d{2})-(\d{2})/g,
    dateIn: ([year = "", month = "", day = ""]) => `${year}-${month}-${day}`,
  },
  {
    pattern: new RegExp(
      `\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?\\b(${MONTH})\\b\\.?,?\\s+(\\d{4})\\b`,
      "gi",
    ),
    dateIn: ([day = "", month = "", year = ""]) =>
      `${year}-${monthNumber(month)}-${twoDigits(day)}`,
  },
  {
    pattern: new RegExp(`\\b(${MONTH})\\b\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s+(\\d{4})\\b`, "gi"),
    dateIn: ([month = "", day = "", year = ""]) =>
      `${year}-${monthNumber(month)}-${twoDigits(day)}`,
  },
  {
    pattern: new RegExp(`\\b(${MONTH})\\b\\.?\\s+(\\d{4})\\b`, "gi"),
    dateIn: ([month = "", year = ""]) => `${year}-${monthNumber(month)}`,
  },
];

/** A number in prose: digits, optional thousands groups, optional decimal part. */
const NUMBER = /\d+(?:,\d{3})*(?:\.\d+)?/g;

/**
 * Every figure in a piece of text.
 *
 * Dates are taken out of the text as they are recognised, so their parts cannot
 * come back as numbers afterwards. Period labels go the same way, and for the
 * same reason.
 */
const figuresIn = (text: string): Figure[] => {
  const figures: Figure[] = [];
  let rest = text.replace(QUARTER, " ");

  for (const { pattern, dateIn } of DATE_FORMS) {
    for (const match of rest.matchAll(pattern)) {
      figures.push({ written: match[0], value: dateIn(match.slice(1)), isDate: true });
    }
    rest = rest.replace(pattern, " ");
  }

  for (const match of rest.matchAll(NUMBER)) {
    figures.push({
      written: match[0],
      value: String(Number(match[0].replace(/,/g, ""))),
      isDate: false,
    });
  }

  return figures;
};

/**
 * Whether the tool results account for one figure of the answer.
 *
 * A date is matched by a date it names, so a month and year are accounted for
 * by any date within that month. A number is matched only by a number: a date
 * in the evidence never accounts for a bare figure in the answer.
 */
const accountedFor = (figure: Figure, evidence: readonly Figure[]): boolean =>
  evidence.some((known) =>
    figure.isDate
      ? known.isDate && known.value.startsWith(figure.value)
      : !known.isDate && known.value === figure.value,
  );

export type NumberAudit = {
  readonly passed: boolean;
  /** The figures in the answer that no Scoped Tool result accounts for, as the answer wrote them. */
  readonly unaccounted: readonly string[];
};

/**
 * Audit an answer against the Scoped Tool results it was built from.
 *
 * Takes the answer as text rather than an `AgentAnswer` so that an Agent
 * Meeting can hold each contribution and its synthesis to the same check.
 */
export const auditNumbers = (answer: string, toolResults: readonly ToolResult[]): NumberAudit => {
  const evidence = toolResults.flatMap((result) => figuresIn(JSON.stringify(result.result)));

  const unaccounted: string[] = [];
  const reported = new Set<string>();
  for (const figure of figuresIn(answer)) {
    if (accountedFor(figure, evidence) || reported.has(figure.value)) continue;
    reported.add(figure.value);
    unaccounted.push(figure.written);
  }

  return { passed: unaccounted.length === 0, unaccounted };
};
