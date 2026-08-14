/**
 * The one seam through which everything in this system reaches the model.
 *
 * Per ADR 0003 there is exactly one provider and exactly one path to it: no
 * Specialist Agent and no Router stage touches the SDK directly. That is what
 * lets Replay Mode exist at all — the replay adapter and the live adapter are
 * two implementations of `LLMClient`, and nothing above the seam can tell which
 * one it is holding.
 */

/** JSON, as it travels through tool schemas and tool inputs. */
export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
export type JsonObject = { [key: string]: JsonValue };

/**
 * A Scoped Tool as the model sees it. The schema is part of the Fixture key, so
 * editing one here invalidates the recordings it produced.
 */
export type ToolSchema = {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: JsonObject;
};

/**
 * A piece of a message, in the shape the API works in.
 *
 * Escalation only ever sends and reads `text`. The other two are here because
 * the live adapter must carry back what the model actually returned rather than
 * a text-only summary of it; the tool-calling loop that consumes them is a
 * later ticket.
 */
export type ContentBlock =
  | { readonly type: "text"; readonly text: string }
  | { readonly type: "tool_use"; readonly id: string; readonly name: string; readonly input: JsonObject }
  | { readonly type: "tool_result"; readonly toolUseId: string; readonly content: string };

export type LLMMessage = {
  readonly role: "user" | "assistant";
  readonly content: readonly ContentBlock[];
};

/**
 * Everything that decides what the model is being asked.
 *
 * The whole request is the Fixture key (see `fixtureKey`), so there is nothing
 * in here that can change without invalidating the recording it produced — the
 * type and the key are deliberately the same shape.
 */
export type LLMRequest = {
  readonly model: string;
  readonly system: string;
  readonly messages: readonly LLMMessage[];
  readonly tools: readonly ToolSchema[];
};

export type LLMResponse = {
  readonly content: readonly ContentBlock[];
};

export type LLMClient = {
  readonly complete: (request: LLMRequest) => Promise<LLMResponse>;
};

/** The model the project runs against, per ADR 0001. */
export const MODEL = "claude-sonnet-5";

/** The text of a response, with any tool_use blocks left out. */
export const textOf = (response: LLMResponse): string =>
  response.content
    .filter((block): block is Extract<ContentBlock, { type: "text" }> => block.type === "text")
    .map((block) => block.text)
    .join("")
    .trim();

/** A single-turn request with no history — what Escalation sends. */
export const oneShot = (system: string, question: string): LLMRequest => ({
  model: MODEL,
  system,
  messages: [{ role: "user", content: [{ type: "text", text: question }] }],
  tools: [],
});
