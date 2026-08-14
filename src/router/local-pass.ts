import type { LocalRoute } from "../domain/route.js";
import { cosineSimilarity, embed } from "./embedder.js";
import { EXEMPLAR_BANKS, type ExemplarBank } from "./exemplar-banks/index.js";
import { SCORE_FLOOR, TOP_TWO_MARGIN } from "./thresholds.js";

/** The Local Pass's similarity to each Exemplar Bank — the best-matching exemplar wins. */
export type BankScores = Record<LocalRoute, number>;

/**
 * The outcome of the Local Pass.
 *
 * An Abstention is its own shape, not a Route. `unclear` cannot appear here at
 * all — it is a Route only Escalation can reach (ADR 0005), and Escalation does
 * not exist yet.
 */
export type LocalPassVerdict =
  | { readonly outcome: "placed"; readonly route: LocalRoute; readonly scores: BankScores }
  | { readonly outcome: "abstained"; readonly scores: BankScores };

type EmbeddedBank = { readonly route: LocalRoute; readonly vectors: readonly number[][] };

/**
 * Bank vectors, embedded at most once per set of banks. The default banks are a
 * module constant, so in a normal run this embeds them on the first Question and
 * never again.
 */
const embeddedBanks = new WeakMap<readonly ExemplarBank[], Promise<EmbeddedBank[]>>();

const embedBanks = (banks: readonly ExemplarBank[]): Promise<EmbeddedBank[]> => {
  let embedded = embeddedBanks.get(banks);
  if (embedded === undefined) {
    embedded = Promise.all(
      banks.map(async (bank) => ({ route: bank.route, vectors: await embed(bank.exemplars) })),
    );
    embeddedBanks.set(banks, embedded);
  }
  return embedded;
};

/**
 * Place a Question against a given set of Exemplar Banks.
 *
 * The banks are the only input beyond the Question: routing is tuned by editing
 * bank data or the two thresholds, never by editing the logic below.
 */
export const localPassAgainst = async (
  question: string,
  banks: readonly ExemplarBank[],
): Promise<LocalPassVerdict> => {
  const embedded = await embedBanks(banks);
  const [questionVector] = await embed([question]);
  if (questionVector === undefined) throw new Error("Embedding the Question produced no vector");

  const ranked = embedded
    .map((bank) => ({
      route: bank.route,
      score: Math.max(...bank.vectors.map((vector) => cosineSimilarity(questionVector, vector))),
    }))
    .sort((a, b) => b.score - a.score);

  const scores = Object.fromEntries(ranked.map((r) => [r.route, r.score])) as BankScores;
  const [best, runnerUp] = ranked;
  if (best === undefined || runnerUp === undefined) {
    throw new Error("The Local Pass needs at least two Exemplar Banks to compare");
  }

  // Below the floor, nothing is close enough to place: the Local Pass abstains.
  if (best.score < SCORE_FLOOR) return { outcome: "abstained", scores };
  // Inside the margin, no bank won outright — the Question is cross-cutting.
  if (best.score - runnerUp.score < TOP_TWO_MARGIN) {
    return { outcome: "placed", route: "both", scores };
  }
  return { outcome: "placed", route: best.route, scores };
};

/**
 * The Router's first stage: place a Question against the shipped Exemplar Banks
 * without leaving the machine or spending anything.
 */
export const localPass = (question: string): Promise<LocalPassVerdict> =>
  localPassAgainst(question, EXEMPLAR_BANKS);
