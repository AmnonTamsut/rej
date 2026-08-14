import { auditNumbers, type NumberAudit } from "../audit/number-audit.js";
import type {
  ContentBlock,
  JsonObject,
  JsonValue,
  LLMClient,
  LLMMessage,
  ToolSchema,
} from "../llm/client.js";
import { MODEL, textOf } from "../llm/client.js";

/**
 * The agent runtime: one tool-calling loop, shared by every Specialist Agent.
 *
 * An agent is data — a name, a system prompt, and a set of Scoped Tools — and
 * this file is the only thing that runs one. Adding a Specialist Agent is
 * therefore adding a Dataset, a tool set, a prompt, and an Exemplar Bank; it is
 * never adding a second loop.
 *
 * The isolation guarantee of ADR 0004 lives in one line below: the tools handed
 * to the model and the tools available to execute are the same list, `agent.tools`.
 * There is no registry to look a tool up in and no way to reach another agent's
 * tools from here, so an agent asking for a tool it does not hold gets told so
 * rather than served.
 */

/**
 * A read-only function over exactly one Dataset, and the schema the model sees
 * for it.
 *
 * `read` is synchronous and pure on purpose: a Scoped Tool is a lookup in
 * hardcoded JSON, so there is no IO to await and nothing to mutate. The type
 * says as much — anything that needed to await something would not fit here,
 * which is the point at which someone would have to come and argue for it.
 */
export type ScopedTool = {
  readonly schema: ToolSchema;
  readonly read: (input: JsonObject) => JsonValue;
};

export type SpecialistAgent = {
  /** How the agent is named to the operator, from `CONTEXT.md`: "Finance Agent". */
  readonly name: string;
  readonly systemPrompt: string;
  readonly tools: readonly ScopedTool[];
};

/** One Scoped Tool call and what it returned — the evidence a Number Audit checks against. */
export type ToolResult = {
  readonly tool: string;
  readonly input: JsonObject;
  readonly result: JsonValue;
};

export type AgentAnswer = {
  readonly agent: string;
  readonly answer: string;
  /**
   * Every Scoped Tool result from the turn, in the order they were read.
   *
   * Retained rather than discarded because the answer alone is not evidence of
   * anything: the Number Audit checks the figures in the answer against these.
   */
  readonly toolResults: readonly ToolResult[];
  /**
   * The Number Audit's verdict on this answer.
   *
   * Carried on the answer rather than run by whoever displays it, so there is
   * no path by which an answer reaches an operator un-audited: an
   * `AgentAnswer` that exists has been checked. The entry point's job is to
   * report the verdict, not to remember to ask for one.
   */
  readonly audit: NumberAudit;
};

/**
 * How many times round the loop before the turn is abandoned.
 *
 * Generous for an agent with four tools and a single Question, and finite so
 * that a model that keeps asking for tools cannot spend without bound in Live
 * Mode. Hitting it is a fault, not a fallback, so it throws.
 */
export const MAX_TOOL_TURNS = 6;

const isToolUse = (block: ContentBlock): block is Extract<ContentBlock, { type: "tool_use" }> =>
  block.type === "tool_use";

/**
 * Run a tool the agent holds, or explain that it does not hold it.
 *
 * The unheld case is deliberately an ordinary result rather than a thrown
 * error: a model that guesses at a tool name — including another agent's — gets
 * told what it actually has and can answer from that, which is a better failure
 * than a crashed turn. What it never gets is the tool.
 */
const runRequestedTool = (
  agent: SpecialistAgent,
  name: string,
  input: JsonObject,
): JsonValue => {
  const tool = agent.tools.find((candidate) => candidate.schema.name === name);
  if (tool === undefined) {
    return {
      error:
        `The ${agent.name} has no tool named ${name}. ` +
        `It holds only: ${agent.tools.map((held) => held.schema.name).join(", ")}.`,
    };
  }

  return tool.read(input);
};

/**
 * Ask a Specialist Agent a Question and run its tool-calling loop to an answer.
 *
 * The model is handed the agent's own tool schemas and nothing else, asks for
 * the tools it wants, and the results are fed back until it answers in prose.
 * Every call goes through the `LLMClient` seam, so the whole loop replays from
 * Fixtures with no key and no spend.
 */
export const askAgent = async (
  agent: SpecialistAgent,
  question: string,
  client: LLMClient,
): Promise<AgentAnswer> => {
  const messages: LLMMessage[] = [{ role: "user", content: [{ type: "text", text: question }] }];
  const toolResults: ToolResult[] = [];

  for (let turn = 0; turn < MAX_TOOL_TURNS; turn++) {
    const response = await client.complete({
      model: MODEL,
      system: agent.systemPrompt,
      messages,
      tools: agent.tools.map((tool) => tool.schema),
    });

    const requested = response.content.filter(isToolUse);
    if (requested.length === 0) {
      const answer = textOf(response);
      return { agent: agent.name, answer, toolResults, audit: auditNumbers(answer, toolResults) };
    }

    const results = requested.map((use) => {
      const result = runRequestedTool(agent, use.name, use.input);
      toolResults.push({ tool: use.name, input: use.input, result });
      return { use, result };
    });

    messages.push({ role: "assistant", content: response.content });
    messages.push({
      role: "user",
      content: results.map(({ use, result }) => ({
        type: "tool_result" as const,
        toolUseId: use.id,
        content: JSON.stringify(result),
      })),
    });
  }

  throw new Error(
    `The ${agent.name} asked for tools ${MAX_TOOL_TURNS} times without answering "${question}". ` +
      `The turn was abandoned rather than allowed to run on.`,
  );
};
