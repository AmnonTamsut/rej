import { describe, expect, it } from "vitest";
import { FINANCE_DATASET } from "./finance/dataset.js";
import { financeAgent } from "./finance/agent.js";
import { HR_DATASET } from "./hr/dataset.js";
import { hrAgent } from "./hr/agent.js";
import type { ScopedTool } from "./specialist-agent.js";

/**
 * The half of the isolation guarantee that needs both Specialist Agents to
 * exist before it can be stated: that they share nothing.
 *
 * Each agent's own half is asserted next to that agent — `finance/isolation.test.ts`
 * shows the Finance Agent cannot reach an individual, `hr/isolation.test.ts`
 * shows the HR Agent cannot reach the books. This file is the seam between
 * them, and it is the only place in the suite that imports both.
 */

const agents = [financeAgent, hrAgent];

const toolsOf = (agent: (typeof agents)[number]): readonly ScopedTool[] => agent.tools;

describe("the two Specialist Agents", () => {
  it("share no tool instance", () => {
    // Identity, not name. Two agents holding the same function object would
    // read one Dataset between them however the schemas were labelled, and that
    // is the failure ADR 0004 exists to make impossible — so it is the failure
    // this asserts against, rather than a resemblance of it.
    for (const financeTool of toolsOf(financeAgent)) {
      for (const hrTool of toolsOf(hrAgent)) {
        const pair = `${financeTool.schema.name} and ${hrTool.schema.name}`;

        expect(financeTool, pair).not.toBe(hrTool);
        expect(financeTool.read, `the read function behind ${pair}`).not.toBe(hrTool.read);
        expect(financeTool.schema, `the schema of ${pair}`).not.toBe(hrTool.schema);
      }
    }
  });

  it("share no tool name, so neither can be reached by guessing at the other's", () => {
    const names = agents.flatMap((agent) => toolsOf(agent).map((tool) => tool.schema.name));

    expect(new Set(names).size, `tool names: ${names.join(", ")}`).toBe(names.length);
  });

  it("hold Datasets with nothing in common but the company they describe", () => {
    // No shared Dataset and no shared data layer: two separate objects, loaded
    // from two separate files, with no reference held in common. The company
    // name and the currency are strings that happen to match, which is what
    // "describing the same company" looks like when nothing is shared.
    expect(FINANCE_DATASET as object).not.toBe(HR_DATASET as object);
    expect(Object.keys(FINANCE_DATASET)).not.toEqual(Object.keys(HR_DATASET));
    expect(HR_DATASET.company).toBe(FINANCE_DATASET.company);
  });

  it("describe one company consistently, so a Question answered by both agrees with itself", () => {
    // Not a runtime link — nothing in the running system reads both Datasets,
    // and this is the only file in the suite that does. It is a check on
    // invented data: the Agent Meeting will put a headcount from one Dataset
    // next to a payroll figure from the other, and two figures that quietly
    // contradict each other would make the joint recommendation nonsense.
    const q3Payroll = FINANCE_DATASET.payroll.find((row) => row.period === "Q3");

    expect(HR_DATASET.headcount.total).toBe(q3Payroll?.headcountCovered);

    // The roster's annual base pay, grossed up by the employer contribution
    // rate the books carry, should land on what the books say payroll costs.
    // Slightly above it, because the roster is the company as of quarter end
    // and four of those people joined partway through the quarter.
    const rosterBasePay = HR_DATASET.employees.reduce((total, e) => total + e.salary, 0);
    const quarterlyBase = (q3Payroll?.totalCost ?? 0) - (q3Payroll?.employerContributions ?? 0);

    expect(rosterBasePay / (quarterlyBase * 4)).toBeGreaterThan(1);
    expect(rosterBasePay / (quarterlyBase * 4)).toBeLessThan(1.02);
  });
});
