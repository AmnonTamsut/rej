import { describe, expect, it } from "vitest";
import { MODEL, oneShot, type LLMRequest } from "./client.js";
import { fromApiContent, toApiRequest } from "./live-client.js";

describe("the live adapter's translation to the API", () => {
  it("sends the model, the system prompt, and the Question", () => {
    const params = toApiRequest(oneShot("Place the Question.", "Should we hire more people?"));

    expect(params.model).toBe(MODEL);
    expect(params.system).toBe("Place the Question.");
    expect(params.messages).toEqual([
      { role: "user", content: [{ type: "text", text: "Should we hire more people?" }] },
    ]);
  });

  it("sends no tools at all when the request carries none, rather than an empty list", () => {
    // Escalation sends no tools; an empty `tools` array is a different request
    // to the API than an absent one, and the absent one is what is meant.
    expect(toApiRequest(oneShot("Place it.", "Anything?")).tools).toBeUndefined();
  });

  it("sends tool schemas under the names the API uses", () => {
    const request: LLMRequest = {
      ...oneShot("Answer money Questions.", "What is our cash position?"),
      tools: [
        {
          name: "cash_position",
          description: "The current cash position.",
          inputSchema: { type: "object", properties: {} },
        },
      ],
    };

    expect(toApiRequest(request).tools).toEqual([
      {
        name: "cash_position",
        description: "The current cash position.",
        input_schema: { type: "object", properties: {} },
      },
    ]);
  });

  it("sends a tool result back under the tool_use it answers", () => {
    const request: LLMRequest = {
      ...oneShot("Answer money Questions.", "What is our cash position?"),
      messages: [
        { role: "user", content: [{ type: "text", text: "What is our cash position?" }] },
        {
          role: "assistant",
          content: [{ type: "tool_use", id: "tu_1", name: "cash_position", input: {} }],
        },
        {
          role: "user",
          content: [{ type: "tool_result", toolUseId: "tu_1", content: "412000" }],
        },
      ],
    };

    expect(toApiRequest(request).messages[2]).toEqual({
      role: "user",
      content: [{ type: "tool_result", tool_use_id: "tu_1", content: "412000" }],
    });
  });
});

describe("the live adapter's translation back from the API", () => {
  it("carries text through", () => {
    const response = fromApiContent([{ type: "text", text: "finance", citations: null }]);

    expect(response.content).toEqual([{ type: "text", text: "finance" }]);
  });

  it("carries a tool request through rather than flattening the answer to text", () => {
    const response = fromApiContent([
      { type: "text", text: "Let me look.", citations: null },
      {
        type: "tool_use",
        id: "tu_1",
        name: "cash_position",
        input: { asOf: "today" },
        caller: { type: "direct" },
      },
    ]);

    expect(response.content).toEqual([
      { type: "text", text: "Let me look." },
      { type: "tool_use", id: "tu_1", name: "cash_position", input: { asOf: "today" } },
    ]);
  });

  it("drops block kinds this system never asks for, so they cannot reach a Fixture", () => {
    const response = fromApiContent([
      { type: "thinking", thinking: "hmm", signature: "sig" },
      { type: "text", text: "hr", citations: null },
    ]);

    expect(response.content).toEqual([{ type: "text", text: "hr" }]);
  });
});
