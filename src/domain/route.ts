/**
 * The Router's verdict on a Question.
 *
 * `unclear` is reachable only through Escalation — never from the Local Pass,
 * which abstains instead. See `LocalRoute` and ADR 0005.
 */
export type Route = "finance" | "hr" | "both" | "unclear";

/**
 * The subset of Routes the Local Pass can place a Question as.
 *
 * `unclear` is deliberately absent: the Local Pass declining to place a
 * Question is an Abstention, which is a different thing and never reaches the
 * operator. Keeping `unclear` out of this type makes conflating the two a type
 * error rather than a judgement call.
 */
export type LocalRoute = Exclude<Route, "unclear">;

/** Every Route, as data — the list Escalation reads a verdict against. */
export const ROUTES: readonly Route[] = ["finance", "hr", "both", "unclear"];

export const LOCAL_ROUTES: readonly LocalRoute[] = ["finance", "hr", "both"];
