import { financeAgent } from "./agents/finance/agent.js";
import { hrAgent } from "./agents/hr/agent.js";
import { holdAgentMeeting, type AgentMeeting } from "./agents/meeting.js";
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
 * already used. Routes with no entry are not answered by a single agent:
 * `unclear` never reaches an agent by design, and `both` opens an Agent
 * Meeting instead.
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
 * Who attends an Agent Meeting: every Specialist Agent the system has, read off
 * the same table.
 *
 * `both` is the Route for a Question no single domain owns, and with two
 * Specialist Agents "both domains" and "every agent" are the same list. A third
 * agent would need that sentence revisited — and it would need the Route
 * vocabulary revisited first, since `both` would no longer name a pair.
 */
const ATTENDEES: readonly SpecialistAgent[] = Object.values(AGENT_FOR).filter(
  (agent): agent is SpecialistAgent => agent !== undefined,
);

export type AnsweredQuestion = {
  readonly question: string;
  readonly verdict: RouterVerdict;
  /** One Specialist Agent's answer, or `null` when the Route is not one agent's to answer. */
  readonly answer: AgentAnswer | null;
  /** The Agent Meeting the `both` Route opened, or `null` for every other Route. */
  readonly meeting: AgentMeeting | null;
};

export const askQuestion = async (
  question: string,
  client: LLMClient,
): Promise<AnsweredQuestion> => {
  const verdict = await routeQuestion(question, client);

  // The two ways a Question gets answered, and the reason they are not one:
  // a meeting is not a Specialist Agent with a wider tool set, so it is not in
  // the table above and cannot be reached by adding a row to it.
  if (verdict.route === "both") {
    const meeting = await holdAgentMeeting(ATTENDEES, question, client);
    return { question, verdict, answer: null, meeting };
  }

  const agent = AGENT_FOR[verdict.route];

  return {
    question,
    verdict,
    answer: agent === undefined ? null : await askAgent(agent, question, client),
    meeting: null,
  };
};
