import { describe, expect, it } from "vitest";
import type { JsonObject } from "../llm/client.js";
import { asksFor, says, scriptedClient } from "../llm/testing.js";
import { askAgent, MAX_TOOL_TURNS, type ScopedTool, type SpecialistAgent } from "./specialist-agent.js";

/**
 * A Specialist Agent built for this test, so the runtime is exercised without
 * either real agent standing in for it. What the Finance Agent does with the
 * loop is tested through the entry point; what the loop does is tested here.
 *
 * Every assertion below is on the `AgentAnswer` the loop returns. Nothing here
 * asserts on an assembled prompt, on the shape of a message sent to the model,
 * or on how many times the model was asked — those are the loop's private
 * business, and a suite that pins them cannot refactor it.
 */
const tool = (name: string, result: JsonObject): ScopedTool => ({
  schema: { name, description: `Returns ${name}.`, inputSchema: { type: "object" } },
  read: () => result,
});

const agentWith = (...tools: readonly ScopedTool[]): SpecialistAgent => ({
  name: "Test Agent",
  systemPrompt: "You answer test Questions.",
  tools,
});

describe("the agent runtime", () => {
  it("answers with the prose the model produces once it stops asking for tools", async () => {
    const agent = agentWith(tool("weather", { sky: "clear" }));
    const client = scriptedClient([asksFor("weather"), says("The sky is clear.")]);

    const answer = await askAgent(agent, "What is the sky doing?", client);

    expect(answer.answer).toBe("The sky is clear.");
    expect(answer.agent).toBe("Test Agent");
  });

  it("answers without calling anything when the model asks for nothing", async () => {
    const agent = agentWith(tool("weather", { sky: "clear" }));

    const answer = await askAgent(agent, "Who are you?", scriptedClient([says("A test agent.")]));

    expect(answer.answer).toBe("A test agent.");
    expect(answer.toolResults).toEqual([]);
  });

  it("retains every tool result from the turn, in the order they were read", async () => {
    // These are the evidence the Number Audit checks an answer against, so the
    // turn keeping them is not bookkeeping — it is the audit's whole input.
    const agent = agentWith(tool("first", { value: 1 }), tool("second", { value: 2 }));
    const client = scriptedClient([
      asksFor("first", { of: "things" }),
      asksFor("second"),
      says("One, then two."),
    ]);

    const { toolResults } = await askAgent(agent, "Read both.", client);

    expect(toolResults).toEqual([
      { tool: "first", input: { of: "things" }, result: { value: 1 } },
      { tool: "second", input: {}, result: { value: 2 } },
    ]);
  });

  it("runs every tool the model asks for in one go", async () => {
    const agent = agentWith(tool("first", { value: 1 }), tool("second", { value: 2 }));
    const client = scriptedClient([
      { content: [...asksFor("first").content, ...asksFor("second").content] },
      says("Both at once."),
    ]);

    const { toolResults } = await askAgent(agent, "Read both.", client);

    expect(toolResults.map((r) => r.tool)).toEqual(["first", "second"]);
  });

  it("does not run a tool the agent does not hold, and says what it does hold", async () => {
    // The isolation guarantee at the point it would actually be breached: a
    // model naming another agent's tool is answered, not served.
    const agent = agentWith(tool("finance_revenue", { total: 10 }));
    const client = scriptedClient([asksFor("hr_salary", { person: "anyone" }), says("I cannot.")]);

    const { toolResults } = await askAgent(agent, "What does anyone earn?", client);

    expect(toolResults).toHaveLength(1);
    expect(toolResults[0]?.result).toEqual({
      error: "The Test Agent has no tool named hr_salary. It holds only: finance_revenue.",
    });
  });

  it("abandons a turn that keeps asking for tools instead of running on", async () => {
    const agent = agentWith(tool("weather", { sky: "clear" }));
    const client = scriptedClient(Array.from({ length: MAX_TOOL_TURNS }, () => asksFor("weather")));

    await expect(askAgent(agent, "What is the sky doing?", client)).rejects.toThrow(/abandoned/);
  });
});
