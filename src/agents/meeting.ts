import { auditNumbers, type NumberAudit } from "../audit/number-audit.js";
import type { LLMClient } from "../llm/client.js";
import { oneShot, textOf } from "../llm/client.js";
import { askAgent, type AgentAnswer, type SpecialistAgent } from "./specialist-agent.js";

/**
 * The Agent Meeting: the flow the `both` Route is reserved for.
 *
 * A cross-cutting Question — "should we hire more people?" — is a headcount
 * Question and a cash Question at once, and neither Specialist Agent can answer
 * it from its own Dataset. The meeting is how it is answered anyway: each agent
 * examines the Question through its own Scoped Tools, and the two contributions
 * are combined into one joint recommendation.
 *
 * What does *not* happen here is the alternative that would have been easier —
 * letting one agent reach wider. No tool and no Dataset is shared during a
 * meeting: each contribution is produced by `askAgent`, the same loop that runs
 * that agent on a Question of its own, handed the same tool set it holds
 * everywhere else. Cross-cutting work is done by combining two scoped views,
 * which is exactly why this flow exists rather than a third agent that can see
 * everything.
 */

/**
 * The synthesis prompt.
 *
 * It asks for three things, and the third is the one that makes the meeting
 * legible rather than merely joint: one recommendation rather than two answers;
 * every figure taken verbatim from a contribution; and each fact attributed to
 * the agent that supplied it, so the operator can see that the headcount came
 * from HR and the cash position from Finance.
 *
 * It is not a Specialist Agent and it does not have a Dataset. That is stated
 * here in prose and enforced below by handing it no tools at all.
 *
 * This text is part of the Fixture key, so editing a word here moves the key and
 * the recordings made against the old wording stop being served. Re-record.
 */
export const SYNTHESIS_PROMPT = [
  "You are chairing a meeting between Cherry Host's specialist agents. Each has examined the",
  "same Question through its own tools — the Finance Agent the company's money, the HR Agent its",
  "people — and neither can see the other's data. Their contributions are below, and they are",
  "all you have: you hold no tools and no records of your own.",
  "",
  "Write one joint recommendation that answers the Question by weighing the two contributions",
  "together and naming a course of action. One recommendation, not two answers side by side, and",
  "not a summary of who said what.",
  "",
  "Say which agent supplied each fact you use — \"the HR Agent reports ...\", \"the Finance Agent",
  'reports ..." — so the reader can see which domain each figure came from.',
  "",
  "Every figure you write must appear in a contribution below, exactly as it is written there.",
  "Never round, rescale, add figures together, or work out a percentage or a per-person cost from",
  "them: a number neither agent stated is a number neither agent can stand behind. If the",
  "contributions do not settle the Question between them, say what is missing and stop.",
].join("\n");

export type AgentMeeting = {
  /**
   * What each attendee contributed, in the order they were asked.
   *
   * Kept whole rather than reduced to text: a contribution carries the Scoped
   * Tool results behind it and its own Number Audit, which is what makes the
   * recommendation checkable against the two domains that produced it.
   */
  readonly contributions: readonly AgentAnswer[];
  /** The single joint recommendation — what the operator reads. */
  readonly recommendation: string;
  /**
   * The Number Audit's verdict on the recommendation, against every attendee's
   * Scoped Tool results.
   *
   * The evidence is pooled where the agents' data is not, and only here: a
   * figure the HR Agent's tools returned accounts for that figure in the
   * recommendation, because the recommendation is where the two domains are
   * legitimately combined. Each contribution is audited against its own agent's
   * results alone, so pooling cannot excuse a figure inside one.
   */
  readonly audit: NumberAudit;
};

/** The Question and what each attendee said about it — everything the synthesis gets. */
const brief = (question: string, contributions: readonly AgentAnswer[]): string =>
  [
    `Question: ${question}`,
    ...contributions.flatMap((contribution) => [
      "",
      `${contribution.agent}:`,
      contribution.answer,
    ]),
  ].join("\n");

/**
 * Hold an Agent Meeting on one Question and return the joint recommendation.
 *
 * The attendees are asked one after another rather than at once. Nothing in the
 * meeting needs the order — no agent sees another's contribution, which is the
 * point — but a run whose model calls happen in a fixed order is a run whose
 * Fixtures are recorded and replayed in that same order, and one whose spend is
 * predictable in Live Mode.
 */
export const holdAgentMeeting = async (
  attendees: readonly SpecialistAgent[],
  question: string,
  client: LLMClient,
): Promise<AgentMeeting> => {
  const contributions: AgentAnswer[] = [];
  for (const attendee of attendees) {
    contributions.push(await askAgent(attendee, question, client));
  }

  // No tools, and no history but the brief: `oneShot` is the same shape of
  // request Escalation sends, and for the same reason — this call combines what
  // it was given and reads nothing.
  const recommendation = textOf(
    await client.complete(oneShot(SYNTHESIS_PROMPT, brief(question, contributions))),
  );

  return {
    contributions,
    recommendation,
    audit: auditNumbers(
      recommendation,
      contributions.flatMap((contribution) => contribution.toolResults),
    ),
  };
};
