import { mkdtempSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import type { LLMClient } from "./llm/client.js";
import { replayClient } from "./llm/fixtures.js";
import { loadEmbedder } from "./router/embedder.js";
import { routeQuestion } from "./router/router.js";
import { recordFixtures } from "./record.js";

const PLACED = "How much did we spend on payroll last quarter?";
const UNPLACEABLE = "Write me a poem about a cat.";

const fixturesDir = () => mkdtempSync(path.join(tmpdir(), "fixtures-"));
const fixtureCount = (dir: string) => readdirSync(dir).filter((f) => f.endsWith(".json")).length;

/** Stands in for the live adapter the record command really wraps. */
const answering = (text: string): LLMClient => ({
  complete: async () => ({ content: [{ type: "text", text }] }),
});

describe("the record command", () => {
  beforeAll(async () => {
    await loadEmbedder();
  });

  it("records a Fixture that Replay Mode then serves for the same Question", async () => {
    const dir = fixturesDir();

    await recordFixtures([UNPLACEABLE], answering("hr"), dir);
    const verdict = await routeQuestion(UNPLACEABLE, replayClient(dir));

    expect(verdict.route).toBe("hr");
    expect(verdict.stage).toBe("escalation");
  });

  it("records nothing for a Question the Local Pass places, because nothing was asked", async () => {
    const dir = fixturesDir();

    await recordFixtures([PLACED], answering("hr"), dir);

    expect(fixtureCount(dir)).toBe(0);
  });

  it("reports what each Question cost, so a recording pass can be counted", async () => {
    const dir = fixturesDir();

    const report = await recordFixtures([PLACED, UNPLACEABLE], answering("hr"), dir);

    expect(report).toEqual([
      { question: PLACED, route: "finance", stage: "local-pass", recorded: false },
      { question: UNPLACEABLE, route: "hr", stage: "escalation", recorded: true },
    ]);
  });
});
