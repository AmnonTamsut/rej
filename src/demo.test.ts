import { beforeAll, describe, expect, it } from "vitest";
import { STAGE_LABEL } from "./cli.js";
import { DEMO_QUESTIONS, SEPARATOR, runDemo } from "./demo.js";
import { ROUTES } from "./domain/route.js";
import { loadEmbedder } from "./router/embedder.js";
import { EXEMPLAR_BANKS } from "./router/exemplar-banks/index.js";
import { localPass } from "./router/local-pass.js";
import { SURVEY_QUESTIONS } from "./survey.js";

/**
 * The demo set is a design decision, so it is asserted rather than described:
 * these are the properties ticket 07 asks the set to have, in the order it asks
 * for them. A Question dropped from the set fails a test here rather than going
 * unnoticed until a reviewer opens the repo.
 */
describe("the demo Question set", () => {
  it("covers every Route the Router can return", () => {
    expect([...new Set(DEMO_QUESTIONS.map((demo) => demo.route))].sort()).toEqual([...ROUTES].sort());
  });

  it("includes a Question the Local Pass abstains on, so Escalation is visible", () => {
    const escalated = DEMO_QUESTIONS.filter((demo) => demo.stage === "escalation");

    expect(escalated.length).toBeGreaterThan(0);
    // And one of them is rescued rather than declined: an Escalation that only
    // ever produced `unclear` would demonstrate the cost without the benefit.
    expect(escalated.some((demo) => demo.route !== "unclear")).toBe(true);
  });

  it("includes an out-of-domain Question that produces a refusal", () => {
    expect(DEMO_QUESTIONS.some((demo) => demo.outcome === "refusal")).toBe(true);
  });

  it("includes the Agent Meeting the assessment calls out by name", () => {
    const hire = DEMO_QUESTIONS.find((demo) => demo.question === "Should we hire more people?");

    expect(hire?.route).toBe("both");
    expect(hire?.outcome).toBe("meeting");
  });

  it("says what each Question is in the set to show", () => {
    expect(DEMO_QUESTIONS.filter((demo) => demo.shows.trim() === "")).toEqual([]);
  });
});

describe("the demo set and the Abstention survey", () => {
  /**
   * Ticket 09 measured the Abstention rate over a candidate set and asked that
   * the two be brought into step once the demo set was chosen. This is that
   * step: every demo Question is priced by `npm run survey`, so the routing bill
   * is measured over what the demo actually asks.
   *
   * The one allowed absence is a Question that is itself an exemplar. The survey
   * refuses those on purpose — a Question copied from a Bank scores about 1.0
   * against itself and would flatter the rate into meaning nothing — so the
   * survey carries an operator's-words counterpart instead ("Should we be hiring
   * right now?" for the demo's "Should we hire more people?").
   */
  it("prices every demo Question that is not itself an exemplar", () => {
    const exemplars = new Set(EXEMPLAR_BANKS.flatMap((bank) => bank.exemplars));
    const surveyed = new Set(SURVEY_QUESTIONS);

    const unpriced = DEMO_QUESTIONS.map((demo) => demo.question).filter(
      (question) => !surveyed.has(question) && !exemplars.has(question),
    );

    expect(unpriced).toEqual([]);
  });
});

describe("the Local Pass on the demo set", () => {
  beforeAll(async () => {
    await loadEmbedder();
  });

  /**
   * Half of each declaration is checkable for free, and this is that half: a
   * Question declared as placed must be placed as that Route, and a Question
   * declared as escalating must abstain. The other half — what Escalation says,
   * and what the agents answer — is pinned by the end-to-end test below, which
   * needs the recorded Fixtures.
   */
  for (const demo of DEMO_QUESTIONS) {
    const behaviour =
      demo.stage === "local-pass"
        ? `places "${demo.question}" as ${demo.route} for nothing`
        : `abstains on "${demo.question}", so Escalation is what places it`;

    it(behaviour, async () => {
      const verdict = await localPass(demo.question);

      if (demo.stage === "local-pass") {
        expect(verdict.outcome === "placed" && verdict.route).toBe(demo.route);
      } else {
        expect(verdict.outcome).toBe("abstained");
      }
    });
  }
});

/** One Question's slice of the demo output, between the separators around it. */
const sectionFor = (question: string, output: string): string =>
  output.split(SEPARATOR).find((part) => part.includes(`Question: ${question}`)) ?? "";

describe("running the demo", () => {
  beforeAll(async () => {
    await loadEmbedder();
  });

  /**
   * The whole demo, run from the shipped Fixtures in Replay Mode with no key.
   *
   * This is the test that a clean clone can actually show what the README
   * claims: a missing or stale Fixture fails here as a Fixture miss, naming the
   * record command, rather than at the demo itself.
   */
  it("runs every Question from the shipped Fixtures, with no key and no spend", async () => {
    const { exitCode, output } = await runDemo({});

    expect(output).not.toContain("No Fixture for key");
    expect(exitCode).toBe(0);

    for (const demo of DEMO_QUESTIONS) {
      expect(output).toContain(demo.question);
      expect(output).toContain(demo.shows);
    }
  }, 60_000);

  it("reports the declared Route and stage for every Question", async () => {
    const { output } = await runDemo({});

    for (const demo of DEMO_QUESTIONS) {
      // The operator-facing stage name comes from the CLI's own map: a test that
      // spelled "Local Pass" itself would keep passing after the CLI renamed it.
      const stage = STAGE_LABEL[demo.stage];
      expect(output).toMatch(new RegExp(`Route:\\s+${demo.route}\\s+\\(${stage}\\)`));
    }
  }, 60_000);

  it("produces each Question's declared outcome, in that Question's own section", async () => {
    // Read out of each Question's own section rather than from the whole output,
    // so a refusal one Question produced cannot stand in for the refusal another
    // is in the set to show. `outcome` is the half of the declaration the Local
    // Pass cannot check — this is where it is checked.
    const { output } = await runDemo({});

    for (const demo of DEMO_QUESTIONS) {
      const section = sectionFor(demo.question, output);
      const declines = /cannot|can't|can not|do not|don't|does not|doesn't|unable|no tool/i;

      switch (demo.outcome) {
        case "answer":
          // An answer is a Specialist Agent's, carries a figure, and does not
          // decline. The last clause is the one that matters: without it a
          // recording that came back "I can't see that" would pass as an answer.
          expect(section).toMatch(/Agent:\s+\w/);
          expect(section).toMatch(/\d/);
          expect(section).not.toMatch(declines);
          break;
        case "refusal":
          expect(section).toMatch(/Agent:\s+\w/);
          expect(section).toMatch(declines);
          break;
        case "meeting":
          expect(section).toMatch(/Meeting:\s+Finance Agent, HR Agent/);
          break;
        case "clarification":
          expect(section).toContain("Could you rephrase it");
          break;
      }
    }
  }, 60_000);

  it("shows the Number Audit failing on the recorded meeting, as that Question says it does", async () => {
    // Not a property the meeting must have — a property this recording has. The
    // Finance Agent worked out an operating loss and a percentage share from
    // figures its tools returned separately, and the audit named both. It ships
    // that way on purpose: the audit exists because a prompt telling an agent
    // not to derive figures is a request, and this is a run where the request
    // was not honoured. Re-recording until a clean sample came back would
    // demonstrate the prompt rather than the check, and would quietly make the
    // demo a curated set of good runs.
    //
    // So if a re-recording does come back clean, this test fails. Rewrite the
    // `shows` line in `demo.ts` to match what the new recording holds; do not
    // delete the test to make the demo agree with itself.
    const { output } = await runDemo({});
    const meeting = sectionFor("Should we hire more people?", output);

    expect(meeting).toContain("Number Audit: FAILED");
    expect(meeting).toContain("1,021,000");
  }, 60_000);
});
