import type { LocalRoute } from "../domain/route.js";
import { localPass, type BankScores } from "./local-pass.js";

/**
 * What the Router hands back to the entry point.
 *
 * `abstained` is the Local Pass declining, and it is deliberately not a Route.
 * Once Escalation exists (ADR 0005) the Router will consume the Abstention
 * itself and return a Route — possibly `unclear` — instead of surfacing it.
 */
export type RouterVerdict =
  | { readonly outcome: "routed"; readonly route: LocalRoute; readonly scores: BankScores }
  | { readonly outcome: "abstained"; readonly scores: BankScores };

/**
 * Map a Question to a Route without answering it.
 *
 * Today the Router is the Local Pass alone: local, deterministic, free, and
 * making no network call on any path. Escalation is the second stage and lands
 * in ticket 02; it belongs here, on the Abstention branch, and nowhere else.
 */
export const routeQuestion = async (question: string): Promise<RouterVerdict> => {
  const verdict = await localPass(question);

  if (verdict.outcome === "abstained") {
    return { outcome: "abstained", scores: verdict.scores };
  }
  return { outcome: "routed", route: verdict.route, scores: verdict.scores };
};
