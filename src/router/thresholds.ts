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
 * more than usual?" at 0.436 and "What time does the office open?" at 0.340, so
 * 0.4 sits in a real gap rather than on top of a cluster.
 *
 * This floor is what a Question naming an individual has to clear, and the
 * reason the hr Exemplar Bank carries phrasings with names in them: an unknown
 * name is noise to the embedding model, so a short Question built around one
 * scores low against every bank. Widening the bank lifted those Questions over
 * the floor; lowering the floor to reach them would have brought "What time
 * does the office open?" with them. See `docs/exemplar-bank-coverage.md`.
 */
export const SCORE_FLOOR = 0.4;

/**
 * The top-two margin. When the best two banks are separated by less than this,
 * the Question is not decided in favour of the winner — it is cross-cutting,
 * and the Route is `both`.
 *
 * The nearest Questions either side are "What are we paying the engineering
 * team in total?" at a gap of 0.012 (cross-cutting, so `both`) and "How much of
 * our monthly spend goes on salaries for the sales team?" at 0.062 (aggregate
 * spend, so `finance`). That is a narrow band: raising this much above 0.05
 * starts pulling single-domain Questions into `both`.
 *
 * Widening the hr bank moved the first of those from 0.015 to 0.012 and left
 * the second where it was, which is the thing to watch when adding exemplars: a
 * phrasing added to one bank moves the margins of Questions the edit was not
 * aimed at. The routing table is therefore checked whole after a Bank edit, not
 * only where the new phrasings landed.
 */
export const TOP_TWO_MARGIN = 0.05;
