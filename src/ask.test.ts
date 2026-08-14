import { beforeAll, describe, expect, it } from "vitest";
import { AGENT_FOR, askQuestion } from "./ask.js";
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

  it("never sends a Question to an agent that does not own its Route", () => {
    expect(AGENT_FOR["unclear"]).toBeUndefined();
    expect(AGENT_FOR["finance"]?.name).toBe("Finance Agent");
  });
});
