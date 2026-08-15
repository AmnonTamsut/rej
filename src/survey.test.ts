import { beforeAll, describe, expect, it } from "vitest";
import { EXEMPLAR_BANKS } from "./router/exemplar-banks/index.js";
import { loadEmbedder } from "./router/embedder.js";
import { abstentionsIn, formatSurvey, runSurvey, survey, SURVEY_QUESTIONS } from "./survey.js";

/**
 * The Questions the survey is expected to abstain on — the whole routing bill,
 * written down.
 *
 * Every one of them is deliberate: no Scoped Tool answers office hours, the
 * holiday policy, or the printer, and the embedding model is English-only, so
 * these are Questions that should reach Escalation rather than be placed
 * confidently on an agent that cannot serve them. `docs/exemplar-bank-coverage.md`
 * says so at more length.
 *
 * One of them is a demo Question — "When did Ben Carter start?" is in the demo
 * set precisely because it abstains, which is how Escalation gets to be visible
 * in front of a reviewer. It costs one small call per run and returns the right
 * Route; `docs/exemplar-bank-coverage.md` records what closing that gap was
 * measured to cost and why it was not paid.
 *
 * A Question arriving in this list is a Bank that got thinner or a threshold
 * that moved, and it costs a model call on every run from then on. That is the
 * failure ADR 0005 warns is quiet — it shows up as spend, not as a misroute —
 * so it is asserted here rather than left to be noticed. The routing table says
 * what a Question is placed as; this says what the set costs, which is why one
 * of these is pinned in both places.
 */
const EXPECTED_ABSTENTIONS: readonly string[] = [
  "When did Ben Carter start?",
  "What time does the office open?",
  "What is our holiday policy?",
  "How do I fix the printer?",
  "Combien de personnes travaillent ici ?",
  "Write me a poem about a cat.",
];

describe("the Abstention survey", () => {
  beforeAll(async () => {
    await loadEmbedder();
  });

  it("abstains on exactly the Questions no Dataset answers, and places the rest for free", async () => {
    const measured = await survey();

    expect(abstentionsIn(measured.rows), formatSurvey(measured)).toEqual(EXPECTED_ABSTENTIONS);
  });

  it("reports every Question it asked, and the rate, to whoever ran the command", async () => {
    const { exitCode, output, notice } = await runSurvey();

    expect(exitCode).toBe(0);
    // Nothing to say on stderr: the survey reads the Banks and spends nothing,
    // so there is no mode to warn about.
    expect(notice).toBeNull();
    for (const question of SURVEY_QUESTIONS) expect(output).toContain(question);
    expect(output).toContain(
      `${EXPECTED_ABSTENTIONS.length} of ${SURVEY_QUESTIONS.length} Questions abstained`,
    );
    expect(output).toContain("Abstention rate of 21%");
  });

  it("asks the Questions in an operator's words rather than the Banks' own", () => {
    // The survey measures how routing does on phrasings nobody tuned it for. A
    // Question copied from an Exemplar Bank scores ~1.0 against itself and would
    // flatter the Abstention rate into meaning nothing.
    const exemplars = new Set(EXEMPLAR_BANKS.flatMap((bank) => bank.exemplars));

    expect(SURVEY_QUESTIONS.filter((question) => exemplars.has(question))).toEqual([]);
  });
});
