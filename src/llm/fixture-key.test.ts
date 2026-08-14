import { describe, expect, it } from "vitest";
import type { LLMRequest } from "./client.js";
import { fixtureKey } from "./fixture-key.js";

const REQUEST: LLMRequest = {
  model: "claude-sonnet-5",
  system: "Place the Question against one of four Routes.",
  messages: [{ role: "user", content: [{ type: "text", text: "Should we hire more people?" }] }],
  tools: [],
};

const WITH_TOOL: LLMRequest = {
  ...REQUEST,
  tools: [
    {
      name: "cash_position",
      description: "The current cash position.",
      inputSchema: { type: "object", properties: {} },
    },
  ],
};

describe("the Fixture key", () => {
  it("is the same for the same request, so a recording is found again", () => {
    expect(fixtureKey(REQUEST)).toBe(fixtureKey({ ...REQUEST }));
  });

  it("does not depend on the order the request was built in", () => {
    const reordered: LLMRequest = {
      tools: REQUEST.tools,
      messages: REQUEST.messages,
      system: REQUEST.system,
      model: REQUEST.model,
    };

    expect(fixtureKey(reordered)).toBe(fixtureKey(REQUEST));
  });

  it("changes when the system prompt is edited, invalidating the recording it produced", () => {
    const edited: LLMRequest = { ...REQUEST, system: `${REQUEST.system} Answer in one word.` };

    expect(fixtureKey(edited)).not.toBe(fixtureKey(REQUEST));
  });

  it("changes when a tool schema is edited", () => {
    const edited: LLMRequest = {
      ...WITH_TOOL,
      tools: [{ ...WITH_TOOL.tools[0]!, description: "The cash position, in pounds." }],
    };

    expect(fixtureKey(edited)).not.toBe(fixtureKey(WITH_TOOL));
  });

  it("changes when a tool is added", () => {
    expect(fixtureKey(WITH_TOOL)).not.toBe(fixtureKey(REQUEST));
  });

  it("changes when the model changes", () => {
    expect(fixtureKey({ ...REQUEST, model: "claude-haiku-4-5" })).not.toBe(fixtureKey(REQUEST));
  });

  it("changes when the message history changes", () => {
    const followUp: LLMRequest = {
      ...REQUEST,
      messages: [
        ...REQUEST.messages,
        { role: "assistant", content: [{ type: "text", text: "both" }] },
      ],
    };

    expect(fixtureKey(followUp)).not.toBe(fixtureKey(REQUEST));
  });

  it("is a hex digest, so it names a file on any filesystem", () => {
    expect(fixtureKey(REQUEST)).toMatch(/^[0-9a-f]{64}$/);
  });
});
