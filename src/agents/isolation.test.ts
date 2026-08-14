import { describe, expect, it } from "vitest";
import { FINANCE_DATASET } from "./finance/dataset.js";
import { financeAgent } from "./finance/agent.js";
import { HR_DATASET } from "./hr/dataset.js";
import { hrAgent } from "./hr/agent.js";
import { objectsIn } from "./testing.js";

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

describe("the two Specialist Agents", () => {
  it("share no tool instance", () => {
    // Identity, not name. Two agents holding the same function object would
    // read one Dataset between them however the schemas were labelled, and that
    // is the failure ADR 0004 exists to make impossible — so it is the failure
    // this asserts against, rather than a resemblance of it.
    for (const financeTool of financeAgent.tools) {
      for (const hrTool of hrAgent.tools) {
        const pair = `${financeTool.schema.name} and ${hrTool.schema.name}`;

        expect(financeTool, pair).not.toBe(hrTool);
        expect(financeTool.read, `the read function behind ${pair}`).not.toBe(hrTool.read);
        expect(financeTool.schema, `the schema of ${pair}`).not.toBe(hrTool.schema);
      }
    }
  });

  it("share no tool name, so neither can be reached by guessing at the other's", () => {
    const names = agents.flatMap((agent) => agent.tools.map((tool) => tool.schema.name));

    expect(new Set(names).size, `tool names: ${names.join(", ")}`).toBe(names.length);
  });

  it("hold Datasets with no object in common", () => {
    // The shape "no shared Dataset and no shared data layer" takes when you go
    // looking for it: every object and array inside one Dataset, against every
    // object and array inside the other, by identity. Two files, two parses,
    // nothing held in common — so there is no object a change to one Dataset
    // could reach the other agent through.
    const financeObjects = new Set(objectsIn(FINANCE_DATASET));
    const hrObjects = objectsIn(HR_DATASET);

    // Both sides counted first, so an empty comparison cannot pass for a clean one.
    expect(financeObjects.size).toBeGreaterThan(0);
    expect(hrObjects.length).toBeGreaterThan(0);

    for (const held of hrObjects) {
      expect(financeObjects.has(held), `shared object: ${JSON.stringify(held).slice(0, 60)}`).toBe(
        false,
      );
    }
  });
});
