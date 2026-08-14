import { describe, expect, it } from "vitest";
import type { JsonObject, JsonValue } from "../../llm/client.js";
import { countsIn, keysOf, leavesOf } from "../testing.js";
import { hrAgent, HR_SYSTEM_PROMPT } from "./agent.js";
import { HR_DATASET, PERIODS, TEAMS } from "./dataset.js";

/**
 * The isolation guarantee, HR half, asserted where ADR 0004 says it lives: in
 * the wiring. There is no filter logic to test because the system has none — an
 * agent cannot ask for data it holds no tool for.
 *
 * The argument these tests make together is a closed one. The HR Agent reads
 * only through the four Scoped Tools below; those tools are lookups over the HR
 * Dataset; and the HR Dataset holds no company money at all — no revenue, no
 * expense line, no cash balance, no payroll total. So there is no input,
 * hostile or otherwise, that returns what the company earns or spends — not
 * because a check rejects it, but because no such figure exists on this side of
 * the boundary.
 *
 * The Finance Agent's half of the same argument is in `finance/isolation.test.ts`,
 * and the assertion that needs both agents at once is in `../isolation.test.ts`.
 */

/**
 * Every field the HR Dataset is allowed to contain.
 *
 * The list is the point: `salary` is on it because individual pay is this
 * agent's subject, and there is no `revenue`, `expenses`, `cash`, `burn`, or
 * `totalCost` on it because company money is not. A field a company financial
 * figure could arrive in does not exist, so no tool can return one.
 */
const DATASET_FIELDS = [
  "company",
  "currency",
  "asOf",
  "headcount",
  "total",
  "byTeam",
  "team",
  "permanent",
  "contractors",
  "vacancies",
  "role",
  "openedOn",
  "daysOpen",
  "attrition",
  "period",
  "startingHeadcount",
  "joiners",
  "leavers",
  "endingHeadcount",
  "averageHeadcount",
  "attritionRatePercent",
  "leaverReasons",
  "reason",
  "count",
  "employees",
  "name",
  "employmentType",
  "salary",
  "startedOn",
];

/**
 * Inputs to try against every tool: everything its own schema allows, plus the
 * shapes someone would reach for if they were trying to get the company's books
 * out of it.
 */
const ATTEMPTS: readonly JsonObject[] = [
  {},
  ...TEAMS.map((team) => ({ team })),
  ...PERIODS.map((period) => ({ period })),
  { name: "Dana Levi" },
  { role: "engineer" },
  { team: "everyone" },
  { period: "Q4" },
  { period: "FY2025" },
  { name: "", role: "", team: "" },
  { includeCompanyTotals: true },
  { team: "engineering", groupBy: "cost" },
  { role: "engineer", sum: true },
  { metric: "revenue" },
  { metric: "payroll", period: "Q3" },
  { name: ["Dana Levi"] },
  { team: null },
];

const everyResult = (): JsonValue[] =>
  hrAgent.tools.flatMap((tool) => ATTEMPTS.map((input) => tool.read(input)));

describe("HR Agent isolation", () => {
  it("holds exactly its own four Scoped Tools", () => {
    // Pinned deliberately: a fifth tool is a decision someone has to come here
    // and record, not something that arrives with a diff elsewhere.
    expect(hrAgent.tools.map((tool) => tool.schema.name)).toEqual([
      "hr_headcount",
      "hr_vacancies",
      "hr_attrition",
      "hr_salary",
    ]);
  });

  it("holds no tool that names a company financial anywhere in its schema", () => {
    // The schemas are what the model is shown. A parameter or a description
    // mentioning revenue would invite a Question this agent cannot answer, and
    // an agent that is invited to answer is an agent that may try.
    for (const tool of hrAgent.tools) {
      expect(tool.schema.name.startsWith("hr_"), `${tool.schema.name} is not an HR tool`).toBe(true);
      expect(JSON.stringify(tool.schema), `schema of ${tool.schema.name}`).not.toMatch(
        /revenue|expenses|cash|runway|burn|profit|payroll|what the company spends/i,
      );
    }
  });

  it("reads a Dataset with no field a company financial figure could arrive in", () => {
    expect([...new Set(keysOf(HR_DATASET as unknown as JsonValue))].sort()).toEqual(
      [...DATASET_FIELDS].sort(),
    );
  });

  it("returns Dataset figures, and the one thing it computes is how many rows it just returned", () => {
    // The exception is deliberate rather than an oversight. `openRoles` and
    // `count` are the lengths of the lists in the same result, and they are
    // there so that an answer saying "five roles are open" has a tool result to
    // be audited against. Everything else a tool returns is a figure someone
    // can find in `dataset.json` — a tool does no other arithmetic.
    const datasetNumbers = new Set(
      leavesOf(HR_DATASET as unknown as JsonValue).filter((leaf) => typeof leaf === "number"),
    );

    const escaped = everyResult().flatMap((result) => {
      const rowCounts = new Set(countsIn(result));
      return leavesOf(result).filter(
        (leaf) => typeof leaf === "number" && !datasetNumbers.has(leaf) && !rowCounts.has(leaf),
      );
    });

    expect(escaped).toEqual([]);
  });

  it("cannot be made to return any text but the Dataset's own labels", () => {
    // The only strings a tool can produce are the Dataset's own text and its
    // own fixed refusals. Nothing the model sends comes back out, so nothing it
    // invents can be mistaken for something a tool returned.
    const datasetText = new Set(
      leavesOf(HR_DATASET as unknown as JsonValue).filter(
        (leaf): leaf is string => typeof leaf === "string",
      ),
    );
    const refusals = /^(No such team|No figures for that period|Nobody on the roster|Say who to look up)/;

    for (const text of new Set(
      everyResult()
        .flatMap(leavesOf)
        .filter((leaf): leaf is string => typeof leaf === "string"),
    )) {
      expect(
        datasetText.has(text) || refusals.test(text),
        `a Scoped Tool returned unexpected text: ${text}`,
      ).toBe(true);
    }
  });

  it("will not hand back the whole roster to an empty Question", () => {
    // Individual pay lives here and nowhere else in the system, so the way it
    // leaves is the way it leaves. Someone has to be asked about by name, role,
    // or team; there is no input that means "all of them, with salaries".
    const salaryTool = hrAgent.tools.find((tool) => tool.schema.name === "hr_salary");
    const bulk: readonly JsonObject[] = [{}, { name: "" }, { role: "" }, { name: "*" }, { role: "%" }];

    for (const input of bulk) {
      const asked = `hr_salary given ${JSON.stringify(input)}`;

      expect(salaryTool?.read(input), asked).toHaveProperty("error");
      expect(salaryTool?.read(input), asked).not.toHaveProperty("matches");
    }
  });

  it("states its domain and what it cannot see, so a misroute meets a refusal", () => {
    expect(HR_SYSTEM_PROMPT).toMatch(/headcount|attrition|vacanc/i);
    expect(HR_SYSTEM_PROMPT).toMatch(/cannot see/i);
    expect(HR_SYSTEM_PROMPT).toMatch(/revenue, expenses/i);
    expect(HR_SYSTEM_PROMPT).toMatch(/do not add salaries together/i);
    expect(HR_SYSTEM_PROMPT).toMatch(/refus|say so plainly/i);
  });
});
