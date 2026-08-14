import { describe, expect, it } from "vitest";
import type { JsonObject, JsonValue } from "../../llm/client.js";
import { leavesOf } from "../testing.js";
import { financeAgent, FINANCE_SYSTEM_PROMPT } from "./agent.js";
import { FINANCE_DATASET, PERIODS } from "./dataset.js";

/**
 * The isolation guarantee, asserted where ADR 0004 says it lives: in the
 * wiring. There is no filter logic to test because the system has none — an
 * agent cannot ask for data it holds no tool for.
 *
 * The argument these tests make together is a closed one. The Finance Agent
 * reads only through the four Scoped Tools below; those tools are lookups over
 * the Finance Dataset; and the Finance Dataset contains no individual at all.
 * So there is no input, hostile or otherwise, that returns one person's pay —
 * not because a check rejects it, but because no such figure exists on this
 * side of the boundary.
 */

/** Every label the Finance Dataset is allowed to contain. A person's name is not one. */
const DATASET_LABELS = [
  "Cherry Host",
  "USD",
  "FY2025",
  "Q1",
  "Q2",
  "Q3",
  "year to date",
  "2025-09-30",
];

const datasetLeaves = leavesOf(FINANCE_DATASET as unknown as JsonValue);
const datasetNumbers = new Set(datasetLeaves.filter((leaf) => typeof leaf === "number"));

/**
 * Inputs to try against every tool: everything its own schema allows, plus the
 * shapes someone would reach for if they were trying to get a person out of it.
 */
const ATTEMPTS: readonly JsonObject[] = [
  {},
  ...PERIODS.map((period) => ({ period })),
  { period: "Q4" },
  { period: "Dana Levi" },
  { employee: "Dana Levi" },
  { person: "Dana Levi", period: "Q3" },
  { period: "Q3", team: "engineering" },
  { period: "Q3", groupBy: "person" },
  { period: "Q3", includeIndividuals: true },
  { period: ["Q1", "Q2"] },
  { period: null },
];

const everyResult = (): JsonValue[] =>
  financeAgent.tools.flatMap((tool) => ATTEMPTS.map((input) => tool.read(input)));

describe("Finance Agent isolation", () => {
  it("holds exactly its own four Scoped Tools", () => {
    // Pinned deliberately: a fifth tool is a decision someone has to come here
    // and record, not something that arrives with a diff elsewhere.
    expect(financeAgent.tools.map((tool) => tool.schema.name)).toEqual([
      "finance_revenue",
      "finance_expenses",
      "finance_cash_position",
      "finance_payroll_cost",
    ]);
  });

  it("holds no tool that takes a person, a team, or any other slice of the workforce", () => {
    // A payroll total is only an aggregate while it covers the whole company.
    // A tool that could narrow it to a team could narrow it to a team of one,
    // so the parameter that would do it does not exist.
    for (const tool of financeAgent.tools) {
      const properties = (tool.schema.inputSchema["properties"] ?? {}) as JsonObject;

      expect(Object.keys(properties), `parameters of ${tool.schema.name}`).toEqual(
        tool.schema.name === "finance_cash_position" ? [] : ["period"],
      );
    }
  });

  it("reads a Dataset that holds no individual to return", () => {
    // Every figure is company-wide and every label is one of these. A person's
    // name is a string, so it would have to appear here to exist at all.
    const labels = datasetLeaves.filter((leaf) => typeof leaf === "string");

    expect([...new Set(labels)].sort()).toEqual([...DATASET_LABELS].sort());
  });

  it("cannot be made to return a figure that is not a company-wide Dataset figure", () => {
    const escaped = everyResult()
      .flatMap(leavesOf)
      .filter((leaf) => typeof leaf === "number" && !datasetNumbers.has(leaf));

    expect(escaped).toEqual([]);
  });

  it("cannot be made to return any text but the Dataset's own labels", () => {
    // The only strings a tool can produce are the Dataset's labels and its own
    // fixed "no such period" message. Nothing the model sends comes back out,
    // so nothing it invents can be mistaken for something a tool returned.
    const strings = everyResult()
      .flatMap(leavesOf)
      .filter((leaf): leaf is string => typeof leaf === "string");

    for (const text of new Set(strings)) {
      expect(
        DATASET_LABELS.includes(text) || text.startsWith("No figures for that period"),
        `a Scoped Tool returned unexpected text: ${text}`,
      ).toBe(true);
    }
    expect(strings).not.toContain("Dana Levi");
  });

  it("states its domain and what it cannot see, so a misroute meets a refusal", () => {
    expect(FINANCE_SYSTEM_PROMPT).toMatch(/revenue|expenses|cash/i);
    expect(FINANCE_SYSTEM_PROMPT).toMatch(/cannot see/i);
    expect(FINANCE_SYSTEM_PROMPT).toMatch(/what any individual earns/i);
    expect(FINANCE_SYSTEM_PROMPT).toMatch(/refus|say so plainly/i);
  });
});
