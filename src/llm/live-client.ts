import Anthropic from "@anthropic-ai/sdk";
import type { ContentBlock, JsonObject, LLMClient, LLMMessage, LLMRequest, LLMResponse } from "./client.js";
import type { Usage } from "./pricing.js";

/**
 * The live adapter: the only file in the system that imports the SDK.
 *
 * It is deliberately thin — translate, call, translate back. Everything worth
 * testing about it is in the two translations, which are exported and pure, so
 * they are covered without a key and without spending.
 */

/**
 * Room enough for a Specialist Agent's answer. Escalation returns a single word
 * and costs a fraction of this; the ceiling exists so a runaway answer cannot.
 */
export const MAX_TOKENS = 1024;

const toApiBlock = (block: ContentBlock): Anthropic.ContentBlockParam => {
  switch (block.type) {
    case "text":
      return { type: "text", text: block.text };
    case "tool_use":
      return { type: "tool_use", id: block.id, name: block.name, input: block.input };
    case "tool_result":
      return { type: "tool_result", tool_use_id: block.toolUseId, content: block.content };
  }
};

const toApiMessage = (message: LLMMessage): Anthropic.MessageParam => ({
  role: message.role,
  content: message.content.map(toApiBlock),
});

export const toApiRequest = (request: LLMRequest): Anthropic.MessageCreateParamsNonStreaming => ({
  model: request.model,
  max_tokens: MAX_TOKENS,
  system: request.system,
  messages: request.messages.map(toApiMessage),
  // Absent rather than empty: a request with no tools is what Escalation means,
  // and it is a different request to the API than one offering none.
  ...(request.tools.length > 0
    ? {
        tools: request.tools.map((tool) => ({
          name: tool.name,
          description: tool.description,
          // Our schemas are JSON Schema objects; the SDK's type is narrower
          // than `JsonObject` in ways only its own literals satisfy.
          input_schema: tool.inputSchema as Anthropic.Tool.InputSchema,
        })),
      }
    : {}),
});

/**
 * What came back, narrowed to the two block kinds this system asks for.
 *
 * Anything else the API can return — thinking, server-side tool results — is
 * dropped rather than carried, because nothing here requests it and a Fixture
 * should record what was asked for.
 */
export const fromApiContent = (content: readonly Anthropic.ContentBlock[]): LLMResponse => ({
  content: content.flatMap((block): ContentBlock[] => {
    if (block.type === "text") return [{ type: "text", text: block.text }];
    if (block.type === "tool_use") {
      return [{ type: "tool_use", id: block.id, name: block.name, input: block.input as JsonObject }];
    }
    return [];
  }),
});

/**
 * Live Mode: the adapter that spends money. Built only where a key is in hand.
 *
 * `onUsage` is how the record command knows what a recording pass cost. It is a
 * side channel rather than a field on `LLMResponse` on purpose: what a call cost
 * is a fact about Live Mode, and putting it on the seam would carry token counts
 * into every Fixture and past every agent, neither of which has any use for
 * them. Nothing above the seam is offered it.
 */
export const liveClient = (apiKey: string, onUsage?: (usage: Usage) => void): LLMClient => {
  const anthropic = new Anthropic({ apiKey });

  return {
    complete: async (request) => {
      const message = await anthropic.messages.create(toApiRequest(request));
      onUsage?.({
        inputTokens: message.usage.input_tokens,
        outputTokens: message.usage.output_tokens,
      });

      return fromApiContent(message.content);
    },
  };
};
