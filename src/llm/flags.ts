/**
 * The flag that opts a run into spending.
 *
 * It sits in a leaf of its own rather than beside the code that reads it.
 * `mode.ts` decides which side of the seam a run is on and imports `fixtures.ts`
 * to serve the replay side; `fixtures.ts` reports a miss and has to name the flag
 * that would have answered the Question instead. Holding the name here is what
 * lets both files print the same string without importing each other.
 *
 * `API_KEY_VARIABLE` deliberately did not move here with it. `mode.ts` is the one
 * file that reads the environment for a key, `offline.test.ts` asserts that it is
 * the only one, and a miss has no business naming the key: a run that reaches
 * `mode.ts` without one already gets told, in the file that knows.
 */
export const LIVE_FLAG = "--live";
