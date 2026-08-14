import type { Route } from "../domain/route.js";
import type { LLMClient } from "../llm/client.js";
import { oneShot, textOf } from "../llm/client.js";

/**
 * The Router's second stage: place a Question the Local Pass abstained on.
 *
 * One call, no tools, no history — the smallest request the API takes, because
 * this is the only routing step that spends and it runs under a hard budget
 * cap. It is always on: there is no flag that disables it and no pure-local
 * mode, per ADR 0005.
 */

const ROUTES: readonly Route[] = ["finance", "hr", "both", "unclear"];

/**
 * Escalation's system prompt.
 *
 * It is part of the Fixture key, so editing a word here invalidates every
 * Escalation recording and the next Replay run says so.
 */
export const ESCALATION_PROMPT = [
  "You route business Questions to one of two specialist agents: a finance agent",
  "and an HR agent. You do not answer the Question — you only place it.",
  "",
  "Reply with exactly one of these four words and nothing else:",
  "",
  "finance — money: revenue, expenses, cash position, total payroll cost",
  "hr — people: headcount, individual salaries, vacancies, attrition",
  "both — needs money and people together, such as whether a hire is affordable",
  "unclear — neither domain owns it, or the Question is too vague to place",
].join("\n");

/**
 * The Route named in an answer, or `unclear` when the answer names no single one.
 *
 * Deliberately forgiving of a trailing full stop or a capital letter, and
 * deliberately unforgiving of an answer naming two Routes or none: guessing a
 * domain sends the Question to an agent that cannot answer it, whereas
 * `unclear` asks the operator to rephrase, which is recoverable.
 */
const routeNamedIn = (answer: string): Route => {
  const named = ROUTES.filter((route) => new RegExp(`\\b${route}\\b`, "i").test(answer));

  return named.length === 1 ? named[0]! : "unclear";
};

export const escalate = async (question: string, client: LLMClient): Promise<Route> =>
  routeNamedIn(textOf(await client.complete(oneShot(ESCALATION_PROMPT, question))));
