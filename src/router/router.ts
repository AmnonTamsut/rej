import type { Route } from "../domain/route.js";
import type { LLMClient } from "../llm/client.js";
import { escalate } from "./escalation.js";
import { localPass, type BankScores } from "./local-pass.js";

/** Which stage of the Router produced a Route — a free verdict or a paid one. */
export type RoutingStage = "local-pass" | "escalation";

/**
 * What the Router hands back: always a Route, and always the stage that reached
 * it.
 *
 * An Abstention is not here. It is the Local Pass declining, it is consumed by
 * Escalation, and it never reaches the operator — whereas `unclear` is a Route
 * and arrives only with `stage: "escalation"`. Keeping the two apart is ADR
 * 0005's rule and this type is where it is enforced.
 */
export type RouterVerdict = {
  readonly route: Route;
  readonly stage: RoutingStage;
  readonly scores: BankScores;
};

/**
 * Map a Question to a Route without answering it.
 *
 * The Local Pass runs first and settles most Questions for nothing. Only an
 * Abstention reaches the model, which is the whole point of the ordering: spend
 * is confined to exactly the Questions a local Router would have failed on.
 * There is no flag that skips either stage.
 */
export const routeQuestion = async (question: string, client: LLMClient): Promise<RouterVerdict> => {
  const verdict = await localPass(question);
  if (verdict.outcome === "placed") {
    return { route: verdict.route, stage: "local-pass", scores: verdict.scores };
  }

  return { route: await escalate(question, client), stage: "escalation", scores: verdict.scores };
};
