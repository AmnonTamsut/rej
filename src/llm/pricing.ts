/**
 * What a Live Mode run costs, so the spend is measured rather than asserted.
 *
 * Recording is the only sanctioned spend here, so the record command reports
 * what it spent as it spends it. Everything needed to price a run is in this
 * file: two rates.
 */

/**
 * List price for `claude-sonnet-5`, in US dollars per million tokens, as
 * published on 2026-08-14.
 *
 * These are the standard rates. An introductory discount (2.00 in / 10.00 out)
 * applies through 2026-08-31, so a run priced here is an upper bound on what is
 * actually billed — which is the direction an estimate should err in. Rates
 * move; a figure quoted in a document does not. Re-check them here rather than
 * anywhere else if the model or the pricing changes.
 */
const RATE_USD_PER_MILLION = { input: 3.0, output: 15.0 } as const;

/** What one call read and wrote, as the API reported it. */
export type Usage = {
  readonly inputTokens: number;
  readonly outputTokens: number;
};

export const NO_USAGE: Usage = { inputTokens: 0, outputTokens: 0 };

export const addUsage = (total: Usage, one: Usage): Usage => ({
  inputTokens: total.inputTokens + one.inputTokens,
  outputTokens: total.outputTokens + one.outputTokens,
});

const costOf = ({ inputTokens, outputTokens }: Usage): number =>
  (inputTokens * RATE_USD_PER_MILLION.input + outputTokens * RATE_USD_PER_MILLION.output) / 1_000_000;

/**
 * The spend line an operator reads after a recording pass.
 *
 * It names the rates as well as the cost, because a total with no rate behind it
 * cannot be re-derived when the pricing moves. Cents are shown to four places: a
 * pass that costs a fifth of a cent should say so rather than round to "$0.00"
 * and read as free.
 */
export const formatSpend = (usage: Usage): string => {
  const cost = costOf(usage);

  return (
    `${usage.inputTokens.toLocaleString("en-US")} input and ` +
    `${usage.outputTokens.toLocaleString("en-US")} output tokens, ` +
    `costing about $${cost.toFixed(4)} at $${RATE_USD_PER_MILLION.input.toFixed(2)}/$${RATE_USD_PER_MILLION.output.toFixed(2)} ` +
    `per million.`
  );
};
