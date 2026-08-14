import { beforeAll, describe, expect, it } from "vitest";
import { standInClient } from "../llm/testing.js";
import { loadEmbedder } from "./embedder.js";
import { routeQuestion } from "./router.js";

const PLACED = "How much did we spend on payroll last quarter?";
const UNPLACEABLE = "Write me a poem about a cat.";

describe("the Router", () => {
  beforeAll(async () => {
    await loadEmbedder();
  });

  it("places a Question the Local Pass can place, and says which stage placed it", async () => {
    const verdict = await routeQuestion(PLACED, standInClient("hr"));

    expect(verdict.route).toBe("finance");
    expect(verdict.stage).toBe("local-pass");
  });

  it("never escalates a Question the Local Pass places, so the free path stays free", async () => {
    // The failure this guards is silent and expensive: escalating on every
    // Question passes every other test in the suite while spending on each run.
    const client = standInClient("hr");

    await routeQuestion(PLACED, client);

    expect(client.asked).toEqual([]);
  });

  it("escalates an Abstention and reports the Route Escalation placed it as", async () => {
    const client = standInClient("hr");

    const verdict = await routeQuestion(UNPLACEABLE, client);

    expect(verdict.route).toBe("hr");
    expect(verdict.stage).toBe("escalation");
    expect(client.asked).toHaveLength(1);
  });

  it("returns `unclear` when Escalation also declines to place the Question", async () => {
    const verdict = await routeQuestion(UNPLACEABLE, standInClient("unclear"));

    expect(verdict.route).toBe("unclear");
    expect(verdict.stage).toBe("escalation");
  });

  it("carries the per-bank scores whichever stage decided, so a verdict shows its working", async () => {
    const escalated = await routeQuestion(UNPLACEABLE, standInClient("unclear"));
    const placed = await routeQuestion(PLACED, standInClient("unclear"));

    expect(Object.keys(escalated.scores).sort()).toEqual(["both", "finance", "hr"]);
    expect(Object.keys(placed.scores).sort()).toEqual(["both", "finance", "hr"]);
  });
});
