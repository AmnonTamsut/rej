import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * The Finance Agent's Dataset: the company's own books, and nothing else.
 *
 * There is one of these per Specialist Agent and no shared one, per ADR 0004.
 * What is absent matters as much as what is here — there is no person anywhere
 * in this file. Payroll is carried as company-wide totals per period, so the
 * Finance Agent's payroll tool has nothing finer to return than a total; the
 * isolation guarantee is that shape, not a filter over a richer store.
 *
 * The totals are company-wide for a second reason: an average over a small
 * enough group names the person in it. `headcountCovered` never drops below the
 * whole company, so no figure here is one payslip in disguise.
 */

/** The periods every period-taking Scoped Tool accepts. Quarters, plus the year so far. */
export type Period = "Q1" | "Q2" | "Q3" | "year to date";

export const PERIODS: readonly Period[] = ["Q1", "Q2", "Q3", "year to date"];

export type RevenueRow = {
  readonly period: Period;
  readonly total: number;
  readonly recurring: number;
  readonly services: number;
};

/** The expense lines, as the books keep them. `payroll` here is the same figure the payroll tool reports. */
export type ExpenseLines = {
  readonly payroll: number;
  readonly hosting: number;
  readonly marketing: number;
  readonly software: number;
  readonly office: number;
  readonly other: number;
};

export type ExpenseRow = {
  readonly period: Period;
  readonly total: number;
  readonly byLine: ExpenseLines;
};

export type CashPosition = {
  readonly asOf: string;
  readonly balance: number;
  readonly monthlyBurn: number;
  readonly runwayMonths: number;
};

/**
 * What payroll costs the company, and how many people that covers.
 *
 * These four fields are the whole vocabulary of payroll in this system's
 * finance half. There is no field an individual's salary could arrive in, which
 * is why the payroll tool cannot return one — see `financeTools`.
 */
export type PayrollRow = {
  readonly period: Period;
  readonly totalCost: number;
  readonly employerContributions: number;
  readonly headcountCovered: number;
};

export type FinanceDataset = {
  readonly company: string;
  readonly currency: string;
  readonly fiscalYear: string;
  readonly revenue: readonly RevenueRow[];
  readonly expenses: readonly ExpenseRow[];
  readonly cash: CashPosition;
  readonly payroll: readonly PayrollRow[];
};

/**
 * Freeze the Dataset through and through.
 *
 * `readonly` is a compile-time promise and disappears at runtime; freezing is
 * the runtime half. Scoped Tools are read-only functions (ADR 0004) and this is
 * what makes "no Question can mutate the Dataset" true of the running program
 * rather than only of the types.
 */
const deepFreeze = <T>(value: T): T => {
  if (value === null || typeof value !== "object") return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
};

const datasetFile = fileURLToPath(new URL("./dataset.json", import.meta.url));

/**
 * The Dataset is JSON on disk rather than a literal in code so that it reads as
 * data — the thing a Scoped Tool looks things up in, not something logic can
 * quietly compute. The cast below is a claim about a file that ships in this
 * repo, not about anything a caller supplies; `dataset.test.ts` holds it to the
 * part that would actually break an answer, which is the arithmetic.
 */
export const FINANCE_DATASET: FinanceDataset = deepFreeze(
  JSON.parse(readFileSync(datasetFile, "utf8")) as FinanceDataset,
);

/** The row for a period, or `undefined` when the period is not one of `PERIODS`. */
export const rowFor = <T extends { readonly period: Period }>(
  rows: readonly T[],
  period: Period,
): T | undefined => rows.find((row) => row.period === period);
