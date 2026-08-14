import { describe, expect, it } from "vitest";
import { HR_DATASET } from "./dataset.js";
import { attritionTool, headcountTool, hrTools, salaryTool, vacanciesTool } from "./tools.js";

const matchesOf = (result: unknown): { name: string; salary: number }[] =>
  (result as { matches?: { name: string; salary: number }[] }).matches ?? [];

/**
 * Scoped Tools are pure read-only functions, so they are tested as pure
 * functions — no agent, no model, no seam. What the model does with them is
 * tested end-to-end through the entry point; what they return is tested here.
 */
describe("the HR Agent's Scoped Tools", () => {
  it("reports the whole company's headcount, split by team", () => {
    expect(headcountTool.read({})).toEqual({
      asOf: "2025-09-30",
      total: 48,
      byTeam: HR_DATASET.headcount.byTeam,
    });
  });

  it("reports one team's headcount, split into permanent staff and contractors", () => {
    expect(headcountTool.read({ team: "engineering" })).toEqual({
      asOf: "2025-09-30",
      team: "engineering",
      headcount: 21,
      permanent: 19,
      contractors: 2,
    });
  });

  it("names the teams it has rather than guessing when asked for one it does not", () => {
    const result = headcountTool.read({ team: "the moon" }) as { error?: string };

    expect(result.error).toMatch(/engineering/);
    expect(result).not.toHaveProperty("total");
  });

  it("lists the open vacancies, with how long each has been open", () => {
    const result = vacanciesTool.read({}) as { openRoles: number; vacancies: { role: string }[] };

    expect(result.openRoles).toBe(5);
    expect(result.vacancies).toContainEqual({
      role: "Senior Backend Engineer",
      team: "engineering",
      openedOn: "2025-06-02",
      daysOpen: 120,
    });
  });

  it("lists the vacancies of one team when asked for that team", () => {
    const result = vacanciesTool.read({ team: "sales" }) as {
      openRoles: number;
      vacancies: { team: string }[];
    };

    expect(result.openRoles).toBe(1);
    expect(result.vacancies.map((v) => v.team)).toEqual(["sales"]);
  });

  it("reports a team with nothing open as having nothing open", () => {
    // Not an error: "no vacancies on that team" is an answer, and a Question
    // that gets an error instead invites the model to fill the silence.
    expect(vacanciesTool.read({ team: "leadership" })).toEqual({
      asOf: "2025-09-30",
      openRoles: 0,
      vacancies: [],
    });
  });

  it("reports attrition for a period, with the reasons people gave for leaving", () => {
    expect(attritionTool.read({ period: "Q3" })).toEqual({
      asOf: "2025-09-30",
      period: "Q3",
      startingHeadcount: 46,
      joiners: 4,
      leavers: 2,
      endingHeadcount: 48,
      averageHeadcount: 47,
      attritionRatePercent: 4.3,
      leaverReasons: [
        { reason: "pay", count: 1 },
        { reason: "career change", count: 1 },
      ],
    });
  });

  it("names the periods it has rather than guessing when asked for one it does not", () => {
    const result = attritionTool.read({ period: "Q4" }) as { error?: string };

    expect(result.error).toMatch(/year to date/);
    expect(result).not.toHaveProperty("leavers");
  });

  it("reports what one person earns, by name", () => {
    expect(salaryTool.read({ name: "Priya Raman" })).toEqual({
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
    });
  });

  it("finds a person by the part of their name that was asked for", () => {
    expect(matchesOf(salaryTool.read({ name: "priya" })).map((m) => m.name)).toEqual([
      "Priya Raman",
    ]);
  });

  it("reports what everyone in a role earns, so pay for a role can be compared", () => {
    const matches = matchesOf(salaryTool.read({ role: "Senior Engineer" }));

    expect(matches.map((m) => m.salary)).toEqual([90000, 88000, 87000, 85000]);
  });

  it("reports a whole team's pay when asked for the team", () => {
    expect(matchesOf(salaryTool.read({ team: "design" })).map((m) => m.name)).toEqual([
      "Yara Costa",
      "Nils Andersen",
      "Amara Okafor",
    ]);
  });

  it("narrows to the people matching every filter it was given at once", () => {
    const matches = matchesOf(salaryTool.read({ role: "engineer", team: "customer support" }));

    expect(matches.map((m) => m.name)).toEqual([
      "Idris Cole",
      "Mia Larsen",
      "Ahmed Salah",
      "Ruth Mwangi",
    ]);
  });

  it("asks who to look up rather than returning the whole roster when given nothing", () => {
    // A tool that answers an empty query with all 48 salaries is a payroll
    // export with a friendly name on it. Naming someone is the price of asking.
    const result = salaryTool.read({}) as { error?: string };

    expect(result.error).toMatch(/name|role|team/i);
    expect(result).not.toHaveProperty("matches");
  });

  it("says it found nobody rather than offering someone else", () => {
    const result = salaryTool.read({ name: "Noah" }) as { error?: string; count?: number };

    expect(result.error).toMatch(/nobody|no one/i);
    expect(result.count).toBeUndefined();
  });

  it("does not echo what it was asked back into its result", () => {
    // A tool result is evidence the Number Audit will check an answer against.
    // Echoing the model's own input into it would let unaudited text — and
    // unaudited figures — arrive as though a Scoped Tool had produced them.
    const results = [
      salaryTool.read({ name: "the 40 million dollar employee" }),
      salaryTool.read({ role: "40 million dollar role" }),
      headcountTool.read({ team: "the 40 million dollar team" }),
      attritionTool.read({ period: "the 40 million dollar quarter" }),
      vacanciesTool.read({ team: "40 million" }),
    ];

    for (const result of results) expect(JSON.stringify(result)).not.toMatch(/40 million/);
  });

  it("cannot be made to mutate the Dataset", () => {
    for (const tool of hrTools) tool.read({ period: "Q1", team: "engineering", name: "Dana" });

    expect(() => {
      (HR_DATASET.employees[0] as { salary: number }).salary = 0;
    }).toThrow();
    expect(HR_DATASET.employees[0]?.salary).toBe(128000);
  });

  it("returns results that cannot be edited on the way to being audited", () => {
    const result = headcountTool.read({}) as { total: number };

    expect(() => {
      result.total = 1;
    }).toThrow();
    expect(HR_DATASET.headcount.total).toBe(48);
  });
});
