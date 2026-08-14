/**
 * The two thresholds that carry the Local Pass's hard cases.
 *
 * Both are adjustable here and nowhere else. Tuning routing means changing a
 * number in this file or adding a phrasing to an Exemplar Bank — never editing
 * Router logic.
 */

/**
 * The score floor. A Question whose best bank similarity falls below this is
 * not placed at all: the Local Pass abstains.
 *
 * Calibrated against `all-MiniLM-L6-v2`, where an on-topic Question scores
 * roughly 0.5–0.8 against its own bank and an off-topic one scores under 0.3.
 */
export const SCORE_FLOOR = 0.4;

/**
 * The top-two margin. When the best two banks are separated by less than this,
 * the Question is not decided in favour of the winner — it is cross-cutting,
 * and the Route is `both`.
 */
export const TOP_TWO_MARGIN = 0.06;
