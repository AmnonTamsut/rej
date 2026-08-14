import { beforeAll, describe, expect, it } from "vitest";
import { askQuestion } from "./ask.js";
import { textOf } from "./llm/client.js";
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

const HIRE = "Should we hire more people?";

const CASH_CONTRIBUTION =
  "You are holding 1,248,000 USD as of 2025-09-30, against a burn of 96,000 USD a month — " +
  "13 months of runway.";

const HEADCOUNT_CONTRIBUTION =
  "There are 48 people here as of 2025-09-30, 21 of them in engineering.";

const RECOMMENDATION =
  "Hire, but for engineering only. The HR Agent reports 48 people as of 2025-09-30, 21 of them " +
  "in engineering; the Finance Agent reports 1,248,000 USD in the bank against a burn of " +
  "96,000 USD a month, which is 13 months of runway.";

/**
 * A whole Agent Meeting: the Finance Agent's turn, the HR Agent's turn, and
 * then the synthesis — one script, because it is one run of the entry point.
 */
const meetingScript = (recommendation: string) => [
  asksFor("finance_cash_position"),
  says(CASH_CONTRIBUTION),
  asksFor("hr_headcount"),
  says(HEADCOUNT_CONTRIBUTION),
  says(recommendation),
];

describe("an Agent Meeting on a cross-cutting Question", () => {
  beforeAll(async () => {
    await loadEmbedder();
  });

  it("opens instead of handing the Question to one Specialist Agent", async () => {
    const { verdict, answer, meeting } = await askQuestion(
      HIRE,
      scriptedClient(meetingScript(RECOMMENDATION)),
    );

    expect(verdict.route).toBe("both");
    expect(answer).toBeNull();
    expect(meeting?.contributions.map((contribution) => contribution.agent)).toEqual([
      "Finance Agent",
      "HR Agent",
    ]);
  });

  it("ends in one joint recommendation carrying both domains, not two answers side by side", async () => {
    const { meeting } = await askQuestion(HIRE, scriptedClient(meetingScript(RECOMMENDATION)));

    expect(meeting?.recommendation).toBe(RECOMMENDATION);
    // The cash position came from one Dataset and the headcount from the other,
    // and both are in the one text the operator reads.
    expect(meeting?.recommendation).toMatch(/1,248,000/);
    expect(meeting?.recommendation).toMatch(/48 people/);
  });

  it("attributes each fact to the domain that supplied it", async () => {
    // What this pins is the path, not the model's judgement — in Replay Mode the
    // recommendation is whatever was recorded. That it names its sources at all
    // is the synthesis prompt's job.
    const { meeting } = await askQuestion(HIRE, scriptedClient(meetingScript(RECOMMENDATION)));

    expect(meeting?.recommendation).toMatch(/HR Agent reports 48/);
    expect(meeting?.recommendation).toMatch(/Finance Agent reports 1,248,000/);
  });

  it("gives each attendee its own Scoped Tools and no others", async () => {
    // The Finance Agent reaches across the boundary mid-meeting and is told what
    // it actually holds. A meeting is two scoped views combined, not a licence
    // for either agent to read wider than it can outside one.
    const client = scriptedClient([
      asksFor("hr_headcount"),
      says("I cannot see headcount. That is the HR Agent's domain."),
      asksFor("hr_headcount"),
      says(HEADCOUNT_CONTRIBUTION),
      says(RECOMMENDATION),
    ]);

    const { meeting } = await askQuestion(HIRE, client);

    expect(meeting?.contributions[0]?.toolResults[0]?.result).toEqual({
      error:
        "The Finance Agent has no tool named hr_headcount. It holds only: finance_revenue, " +
        "finance_expenses, finance_cash_position, finance_payroll_cost.",
    });
    expect(meeting?.contributions[1]?.toolResults[0]?.result).toMatchObject({ total: 48 });
  });

  it("never puts both agents' tools in one request, so nothing widens inside a meeting", async () => {
    // The failure this guards is the tempting one: a meeting that answers a
    // cross-cutting Question by handing somebody every tool. No request in the
    // whole run carries tools from more than one domain — the agents' turns
    // carry their own, and the synthesis carries none.
    const client = scriptedClient(meetingScript(RECOMMENDATION));

    await askQuestion(HIRE, client);

    for (const request of client.asked) {
      const named = request.tools.map((tool) => tool.name);
      const domains = new Set(named.map((name) => name.split("_")[0]));

      expect(domains.size, `one request carried ${named.join(", ")}`).toBeLessThan(2);
    }
  });

  it("hands the synthesis no tools, so it can only combine what the agents said", async () => {
    // The one component in the meeting that sees both domains is the one that
    // reads no Dataset at all: there is no tool in the request, so there is no
    // path from here to either agent's data.
    const client = scriptedClient(meetingScript(RECOMMENDATION));

    await askQuestion(HIRE, client);

    expect(client.asked.at(-1)?.tools).toEqual([]);
  });

  it("hands the synthesis every contribution, so neither domain can be dropped on the way", async () => {
    // The one thing a recorded recommendation cannot show. In Replay Mode the
    // recommendation is whatever was recorded, so a meeting that quietly asked
    // for a synthesis of one contribution would still produce a text mentioning
    // both — and would keep producing it for a Question whose answer had come to
    // depend on the contribution that was dropped. What both domains reaching
    // the synthesis looks like from outside is this: both are in what it was
    // asked.
    const client = scriptedClient(meetingScript(RECOMMENDATION));

    await askQuestion(HIRE, client);

    const brief = textOf({ content: client.asked.at(-1)?.messages[0]?.content ?? [] });
    expect(brief).toContain(CASH_CONTRIBUTION);
    expect(brief).toContain(HEADCOUNT_CONTRIBUTION);
    expect(brief).toContain(HIRE);
  });

  it("audits each contribution against the Scoped Tool results behind it", async () => {
    const client = scriptedClient([
      asksFor("finance_cash_position"),
      says("You are holding 2,400,000 USD."),
      asksFor("hr_headcount"),
      says(HEADCOUNT_CONTRIBUTION),
      says(RECOMMENDATION),
    ]);

    const { meeting } = await askQuestion(HIRE, client);

    expect(meeting?.contributions[0]?.audit).toEqual({ passed: false, unaccounted: ["2,400,000"] });
    expect(meeting?.contributions[1]?.audit.passed).toBe(true);
  });

  it("audits the joint recommendation against both attendees' tool results", async () => {
    // Every figure in the recommendation came from a Scoped Tool — the cash from
    // one agent's, the headcount from the other's — so the synthesis is
    // accounted for only if the audit reads both agents' evidence.
    const { meeting } = await askQuestion(HIRE, scriptedClient(meetingScript(RECOMMENDATION)));

    expect(meeting?.audit).toEqual({ passed: true, unaccounted: [] });
  });

  it("fails the audit on a figure in the recommendation that neither agent's tools returned", async () => {
    const invented =
      "Hire two engineers. The Finance Agent reports 1,248,000 USD in the bank, which covers " +
      "the 260,000 USD a year they would cost.";

    const { meeting } = await askQuestion(HIRE, scriptedClient(meetingScript(invented)));

    expect(meeting?.audit.passed).toBe(false);
    expect(meeting?.audit.unaccounted).toEqual(["260,000"]);
  });
});
