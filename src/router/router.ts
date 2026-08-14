import { localPass, type LocalPassVerdict } from "./local-pass.js";

/**
 * What the Router hands back to the entry point.
 *
 * Today it is exactly the Local Pass's verdict, because the Local Pass is all
 * the Router has. When Escalation lands (ticket 02) this widens to carry the
 * `unclear` Route and which stage decided; the Abstention stops being visible
 * here at all, because Escalation will consume it.
 */
export type RouterVerdict = LocalPassVerdict;

/**
 * Map a Question to a Route without answering it.
 *
 * The Router is the one component the entry point talks to, so that adding
 * Escalation is a change here rather than a change at every call site. Today
 * that makes it a thin delegate, and no network call happens on any path.
 */
export const routeQuestion = (question: string): Promise<RouterVerdict> => localPass(question);
