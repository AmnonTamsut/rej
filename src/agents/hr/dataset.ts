import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * The HR Agent's Dataset: the company's people records, and nothing else.
 *
 * There is one of these per Specialist Agent and no shared one, per ADR 0004.
 * What is absent matters as much as what is here — there is no revenue figure,
 * no expense line, no cash balance, and no payroll total anywhere in this file.
 * The HR Agent cannot report what the company spends because its Dataset does
 * not know: the isolation guarantee is that shape, not a filter over a richer
 * store.
 *
 * The mirror image of the Finance Dataset, and deliberately so. That one holds
 * company-wide money and no person; this one holds people and their individual
 * pay, and no company money. Each agent's blind spot is the other's subject.
 */

/** The teams the company is organised into. Every employee belongs to exactly one. */
export type Team =
  | "engineering"
  | "customer support"
  | "sales"
  | "marketing"
  | "design"
  | "operations"
  | "leadership";

export const TEAMS: readonly Team[] = [
  "engineering",
  "customer support",
  "sales",
  "marketing",
  "design",
  "operations",
  "leadership",
];

/**
 * The periods the attrition tool accepts.
 *
 * The same period names the books use, declared here rather than imported from
 * the Finance Dataset. The two Datasets share a vocabulary because they
 * describe one company's year; they share no code, and importing this from
 * across the boundary would be the first thread of the shared data layer ADR
 * 0004 rules out.
 */
export type Period = "Q1" | "Q2" | "Q3" | "year to date";

export const PERIODS: readonly Period[] = ["Q1", "Q2", "Q3", "year to date"];

export type EmploymentType = "permanent" | "contractor";

export type TeamHeadcount = {
  readonly team: Team;
  readonly headcount: number;
  readonly permanent: number;
  readonly contractors: number;
};

export type Headcount = {
  readonly total: number;
  readonly byTeam: readonly TeamHeadcount[];
};

export type Vacancy = {
  readonly role: string;
  readonly team: Team;
  readonly openedOn: string;
  /** Days open as of the Dataset's `asOf` date, carried rather than computed so a tool stays a lookup. */
  readonly daysOpen: number;
};

/** Why the people who left gave as their reason, counted. The answer to "why are people leaving?". */
export type LeaverReason = {
  readonly reason: string;
  readonly count: number;
};

export type AttritionRow = {
  readonly period: Period;
  readonly startingHeadcount: number;
  readonly joiners: number;
  readonly leavers: number;
  readonly endingHeadcount: number;
  readonly averageHeadcount: number;
  readonly attritionRatePercent: number;
  readonly leaverReasons: readonly LeaverReason[];
};

/**
 * One person on the roster, pay included.
 *
 * This is the record the Finance Agent has no tool to reach and no field to
 * receive: its payroll tool reports a company-wide total and the number of
 * people it covers, and there is nothing on that result an individual's pay
 * could arrive in. Individual pay exists in exactly one place in this system,
 * and it is here.
 */
export type Employee = {
  readonly name: string;
  readonly role: string;
  readonly team: Team;
  readonly employmentType: EmploymentType;
  /** Annual base pay, in the Dataset's currency. */
  readonly salary: number;
  readonly startedOn: string;
};

export type HrDataset = {
  readonly company: string;
  readonly currency: string;
  readonly asOf: string;
  readonly headcount: Headcount;
  readonly vacancies: readonly Vacancy[];
  readonly attrition: readonly AttritionRow[];
  readonly employees: readonly Employee[];
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
 * parts that would actually break an answer, which are the sums.
 */
export const HR_DATASET: HrDataset = deepFreeze(
  JSON.parse(readFileSync(datasetFile, "utf8")) as HrDataset,
);

/** The attrition row for a period, or `undefined` when the period is not one of `PERIODS`. */
export const attritionFor = (period: Period): AttritionRow | undefined =>
  HR_DATASET.attrition.find((row) => row.period === period);

/** The headcount row for a team, or `undefined` when the team is not one of `TEAMS`. */
export const headcountFor = (team: Team): TeamHeadcount | undefined =>
  HR_DATASET.headcount.byTeam.find((row) => row.team === team);
