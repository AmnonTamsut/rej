import { type CliResult, runAsCommand } from "./command.js";
import type { LocalRoute } from "./domain/route.js";
import { localPass, rankBanks } from "./router/local-pass.js";

/**
 * The Abstention survey: how much of a realistic day's Questions the Local Pass
 * places for free, and how much of it goes to Escalation and spends.
 *
 * Escalation is the only routing cost in the system, so the Abstention rate over
 * a set of Questions is the routing bill for that set. Widening an Exemplar Bank
 * is meant to lower it — this command is how that is shown rather than assumed.
 * Run it before and after a Bank edit and compare.
 *
 * The Questions below are the ones the demo Question set will be drawn from
 * (ticket 07 makes that choice), written as an operator would type them. None is
 * copied verbatim from an Exemplar Bank, and a test holds them to that: a
 * Question lifted from a Bank scores about 1.0 against itself and would flatter
 * the rate into meaning nothing. That is also why this set is not the demo set —
 * the demo says "Should we hire more people?" in the assessment's own words,
 * which is an exemplar, so the survey asks it the way an operator would instead.
 *
 * Some of these are meant to abstain — see `docs/exemplar-bank-coverage.md` for
 * which and why. The rate is not expected to reach zero.
 *
 * Several of these Questions also sit in the routing table in
 * `local-pass.test.ts`, which is deliberate rather than redundant: the table
 * pins what each Question is placed as, and this set prices what the same
 * Questions cost. A Bank edit can hold every verdict and still raise the bill.
 */
export const SURVEY_QUESTIONS: readonly string[] = [
  // money
  "How did revenue do last quarter?",
  "Are we profitable yet?",
  "How much cash is left in the bank?",
  "What's our burn rate?",
  "How much did we spend on marketing last month?",
  // people, by role or in aggregate
  "How many of us are there now?",
  "How many roles are we trying to fill?",
  "What is making people leave?",
  "What does our head of engineering earn?",
  // people, by name
  "What does Priya Raman earn?",
  "How much does Yuki Tanaka get paid?",
  "How long has Zoe Hart worked here?",
  "Which team is Clara Bennett on?",
  "Is Mei Lin a contractor?",
  // people, by superlative
  "Who is our highest paid employee?",
  "Who is our most expensive person?",
  // cross-cutting
  "Should we be hiring right now?",
  "Could we afford one more engineer?",
  "Would raising everyone's salary hurt our runway?",
  "Is losing people costing us money?",
  // nothing here answers these
  "What time does the office open?",
  "What is our holiday policy?",
  "How do I fix the printer?",
  "Combien de personnes travaillent ici ?",
  "Write me a poem about a cat.",
];

/**
 * What the Local Pass did with one Question, and how close it was.
 *
 * `abstention` sits beside the Routes rather than among them, and `unclear` is
 * absent, because neither is something the Local Pass can return — the same
 * distinction `LocalRoute` exists to make a type error rather than a judgement
 * call.
 */
export type SurveyRow = {
  readonly question: string;
  readonly outcome: LocalRoute | "abstention";
  readonly best: number;
  readonly gap: number;
};

export type Survey = {
  readonly rows: readonly SurveyRow[];
  /** The share of the survey that reaches Escalation, and so the share that spends. */
  readonly abstentionRate: number;
};

/**
 * Run the Local Pass over a set of Questions.
 *
 * Nothing here calls the model — an Abstention is counted, not escalated. The
 * point is to measure what routing would cost, which is not a reason to spend.
 */
export const survey = async (): Promise<Survey> => {
  const rows: SurveyRow[] = [];
  for (const question of SURVEY_QUESTIONS) {
    const verdict = await localPass(question);
    const ranked = rankBanks(verdict.scores);
    rows.push({
      question,
      outcome: verdict.outcome === "placed" ? verdict.route : "abstention",
      best: ranked[0]?.score ?? 0,
      gap: (ranked[0]?.score ?? 0) - (ranked[1]?.score ?? 0),
    });
  }

  return { rows, abstentionRate: abstentionsIn(rows).length / rows.length };
};

/** The Questions the Local Pass declined to place, and so the Questions that spend. */
export const abstentionsIn = (rows: readonly SurveyRow[]): readonly string[] =>
  rows.filter((row) => row.outcome === "abstention").map((row) => row.question);

/** The survey as a table an operator reads, worst news last. */
export const formatSurvey = ({ rows, abstentionRate }: Survey): string =>
  [
    ...rows.map(
      (row) =>
        `${row.outcome.padEnd(10)} ${row.best.toFixed(3)}  gap ${row.gap.toFixed(3)}  ${row.question}`,
    ),
    "",
    `${abstentionsIn(rows).length} of ${rows.length} Questions abstained and would reach Escalation ` +
      `— an Abstention rate of ${(abstentionRate * 100).toFixed(0)}%.`,
  ].join("\n");

export const runSurvey = async (): Promise<CliResult> => ({
  exitCode: 0,
  output: formatSurvey(await survey()),
  notice: null,
});

await runAsCommand(import.meta.url, runSurvey);
