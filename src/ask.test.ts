import { beforeAll, describe, expect, it } from "vitest";
import { askQuestion } from "./ask.js";
import { asksFor, says, scriptedClient } from "./llm/testing.js";
import { loadEmbedder } from "./router/embedder.js";

const CASH = "What's our cash position right now?";

describe("asking the system a Question", () => {
  beforeAll(async () => {
    await loadEmbedder();
  });

  it("hands a money Question to the Finance Agent and answers with what it said", async () => {
    const client = scriptedClient([
      asksFor("finance_cash_position"),
      says("You hold 1,248,000 USD, with 13 months of runway at the current burn."),
    ]);

    const { verdict, answer } = await askQuestion(CASH, client);

    expect(verdict.route).toBe("finance");
    expect(answer?.agent).toBe("Finance Agent");
    expect(answer?.answer).toMatch(/1,248,000/);
  });

  it("retains the Scoped Tool results the answer was built from", async () => {
    // The Number Audit checks the figures in an answer against exactly these.
    // An answer that arrives without them cannot be audited at all.
    const client = scriptedClient([
      asksFor("finance_payroll_cost", { period: "Q3" }),
      says("Payroll cost 1,096,000 USD in Q3, covering 48 people."),
    ]);

    const { answer } = await askQuestion("What did payroll cost us last quarter?", client);

    expect(answer?.toolResults).toEqual([
      {
        tool: "finance_payroll_cost",
        input: { period: "Q3" },
        result: {
          period: "Q3",
          currency: "USD",
          totalCost: 1096000,
          employerContributions: 239000,
          headcountCovered: 48,
        },
      },
    ]);
  });

  it("hands a people Question to the HR Agent through the same entry point", async () => {
    // The same call as the money Question above, with nothing selecting the
    // agent: the operator asks, and the table in `ask.ts` decides.
    const client = scriptedClient([
      asksFor("hr_headcount"),
      says("There are 48 people here as of 2025-09-30, 21 of them in engineering."),
    ]);

    const { verdict, answer } = await askQuestion("How many people work here?", client);

    expect(verdict.route).toBe("hr");
    expect(answer?.agent).toBe("HR Agent");
    expect(answer?.answer).toMatch(/48 people/);
  });

  it("grounds a people answer in what an HR Scoped Tool actually returned", async () => {
    const client = scriptedClient([
      asksFor("hr_salary", { role: "Head of Engineering" }),
      says("Priya Raman, your Head of Engineering, is on 114,000 USD a year."),
    ]);

    const { answer } = await askQuestion("What does our head of engineering earn?", client);

    expect(answer?.toolResults).toEqual([
      {
        tool: "hr_salary",
        input: { role: "Head of Engineering" },
        result: {
          asOf: "2025-09-30",
          currency: "USD",
          count: 1,
          matches: [
            {
              name: "Priya Raman",
              role: "Head of Engineering",
              team: "engineering",
              employmentType: "permanent",
              salary: 114000,
              startedOn: "2020-02-17",
            },
          ],
        },
      },
    ]);
  });

  it("meets a Question outside the people domain with a refusal, not an invented answer", async () => {
    // A Router mistake played out end to end: Escalation places a Question that
    // belongs to neither domain as `hr`, the model reaches for a tool it has
    // heard of but does not hold, and is told what it actually has. What
    // reaches the operator is the refusal.
    //
    // What this pins is the path, not the model's judgement — in Replay Mode
    // the refusal is whatever was recorded. That the agent refuses at all is
    // the system prompt's job (`HR_SYSTEM_PROMPT`, asserted in
    // `hr/isolation.test.ts`).
    const refusal =
      "I cannot answer that. I can see headcount, vacancies, attrition, and what individuals " +
      "are paid, and nothing about the company's money.";
    const client = scriptedClient([
      says("hr"),
      asksFor("finance_cash_position"),
      says(refusal),
    ]);

    const { verdict, answer } = await askQuestion("Write me a poem about a cat.", client);

    expect(verdict.stage).toBe("escalation");
    expect(answer?.agent).toBe("HR Agent");
    expect(answer?.answer).toBe(refusal);
    expect(answer?.toolResults[0]?.result).toEqual({
      error:
        "The HR Agent has no tool named finance_cash_position. It holds only: hr_headcount, " +
        "hr_vacancies, hr_attrition, hr_salary.",
    });
  });

  it("routes but does not answer a Route no Specialist Agent owns", async () => {
    // Escalation returns `unclear` for a Question neither domain owns, and no
    // agent is invoked on it — the entry point asks the operator to rephrase.
    const { verdict, answer } = await askQuestion(
      "Write me a poem about a cat.",
      scriptedClient([says("unclear")]),
    );

    expect(verdict.route).toBe("unclear");
    expect(answer).toBeNull();
  });
});
