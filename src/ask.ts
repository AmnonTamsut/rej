import { financeAgent } from "./agents/finance/agent.js";
import { hrAgent } from "./agents/hr/agent.js";
import { askAgent, type AgentAnswer, type SpecialistAgent } from "./agents/specialist-agent.js";
import type { Route } from "./domain/route.js";
import type { LLMClient } from "./llm/client.js";
import { routeQuestion, type RouterVerdict } from "./router/router.js";

/**
 * A Question in, a Route and an answer out — the whole system in one function.
 *
 * The command-line entry point formats what this returns and the record command
 * runs it to capture Fixtures, so both commands exercise the same path. Nothing
 * here knows whether the client behind it is Replay Mode or Live Mode.
 */

/**
 * Which Specialist Agent owns which Route.
 *
 * The growth path is this table: a new Specialist Agent is a Dataset, a tool
 * set, a prompt, an Exemplar Bank, and one line here. The HR Agent arrived as
 * exactly that and no more — the loop above it is the one the Finance Agent
 * already used. Routes with no entry are routed and reported but not answered:
 * `unclear` never reaches an agent by design, and `both` opens an Agent
 * Meeting, which is a later ticket.
 *
 * The operator never chooses between these. A Question goes to the entry point
 * and this table decides, which is the difference between a system and two
 * agents with a human in the middle.
 */
const AGENT_FOR: Partial<Record<Route, SpecialistAgent>> = {
  finance: financeAgent,
  hr: hrAgent,
};

/**
 * The Routes a Specialist Agent answers today, read off the table itself.
 *
 * The entry point tells the operator this rather than leaving a Route with a
 * silent absence where its answer should be. Filling the table in is the only
 * edit that changes what it says.
 */
export const ANSWERED_ROUTES: readonly Route[] = Object.keys(AGENT_FOR) as Route[];

export type AnsweredQuestion = {
  readonly question: string;
  readonly verdict: RouterVerdict;
  /** The answer, or `null` when no Specialist Agent owns the Route. */
  readonly answer: AgentAnswer | null;
};

export const askQuestion = async (
  question: string,
  client: LLMClient,
): Promise<AnsweredQuestion> => {
  const verdict = await routeQuestion(question, client);
  const agent = AGENT_FOR[verdict.route];

  return {
    question,
    verdict,
    answer: agent === undefined ? null : await askAgent(agent, question, client),
  };
};
