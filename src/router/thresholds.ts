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
 * Calibrated against the quantized `all-MiniLM-L6-v2`. Measured on the
 * routing table, the nearest Questions either side are "Is anyone quitting
 * more than usual?" at 0.44 and "What time does the office open?" at 0.34, so
 * 0.4 sits in a real gap rather than on top of a cluster.
 */
export const SCORE_FLOOR = 0.4;

/**
 * The top-two margin. When the best two banks are separated by less than this,
 * the Question is not decided in favour of the winner — it is cross-cutting,
 * and the Route is `both`.
 *
 * The nearest Questions either side are "What are we paying the engineering
 * team in total?" at a gap of 0.015 (cross-cutting, so `both`) and "How many
 * roles are we trying to fill?" at 0.061 (vacancies, so `hr`). That is a
 * narrow band: raising this much above 0.05 starts pulling single-domain
 * Questions into `both`.
 */
export const TOP_TWO_MARGIN = 0.05;
