import { describe, expect, it } from "vitest";
import { MODEL } from "../llm/client.js";
import { standInClient } from "../llm/testing.js";
import { escalate } from "./escalation.js";

describe("Escalation", () => {
  it("places a Question as the Route the model names", async () => {
    expect(await escalate("Are we burning cash?", standInClient("finance"))).toBe("finance");
    expect(await escalate("Who is leaving?", standInClient("hr"))).toBe("hr");
    expect(await escalate("Can we afford a hire?", standInClient("both"))).toBe("both");
  });

  it("returns `unclear` when the model declines to place the Question", async () => {
    expect(await escalate("Write me a poem about a cat.", standInClient("unclear"))).toBe("unclear");
  });

  it("reads a Route out of a wordier answer than it asked for", async () => {
    expect(await escalate("Are we burning cash?", standInClient("Finance."))).toBe("finance");
  });

  it("falls to `unclear` rather than guessing when the answer names no single Route", async () => {
    // The safe direction is a clarification request, not a domain picked at
    // random: a wrong Route sends the Question to an agent that cannot answer it.
    expect(await escalate("Are we burning cash?", standInClient("finance or hr"))).toBe("unclear");
    expect(await escalate("Are we burning cash?", standInClient("I'd rather not say"))).toBe("unclear");
  });

  it("sends the Question, with no tools and no message history", async () => {
    const client = standInClient("both");

    await escalate("Should we hire more people?", client);

    const [request] = client.asked;
    expect(client.asked).toHaveLength(1);
    expect(request?.tools).toEqual([]);
    expect(request?.messages).toEqual([
      { role: "user", content: [{ type: "text", text: "Should we hire more people?" }] },
    ]);
  });

  it("runs against the model the project records against", async () => {
    const client = standInClient("hr");

    await escalate("Who is leaving?", client);

    expect(client.asked[0]?.model).toBe(MODEL);
  });
});
