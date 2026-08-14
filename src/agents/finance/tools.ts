import type { JsonObject, JsonValue } from "../../llm/client.js";
import type { ScopedTool } from "../specialist-agent.js";
import {
  FINANCE_DATASET,
  PERIODS,
  rowFor,
  type ExpenseRow,
  type PayrollRow,
  type Period,
  type RevenueRow,
} from "./dataset.js";

/**
 * The Finance Agent's Scoped Tools: the only path by which it reads anything.
 *
 * Four read-only lookups over the Finance Dataset — revenue, expenses, cash
 * position, and payroll cost. Each returns a row of the Dataset as it stands,
 * so every figure an answer can be built from is a figure someone can find in
 * `dataset.json`. Nothing here computes, and nothing here reaches outside this
 * one Dataset.
 *
 * These functions are exposed to exactly one agent (ADR 0004). Reusing one from
 * the HR Agent would not be a shortcut, it would be the end of the guarantee.
 */

/** The currency every figure in this Dataset is in, carried on each result so a figure is never bare. */
const { currency } = FINANCE_DATASET;

/**
 * The answer to a period this Dataset does not have.
 *
 * A constant, so the model's own words cannot travel into a tool result. A tool
 * result is what the Number Audit checks an answer's figures against; text that
 * came from the model rather than the Dataset has no business arriving there
 * dressed as evidence.
 */
const NO_SUCH_PERIOD: JsonObject = {
  error: `No figures for that period. Ask for one of: ${PERIODS.join(", ")}.`,
};

const periodIn = (input: JsonObject): Period | undefined =>
  PERIODS.find((known) => known === input["period"]);

/** A period-taking tool: look the row up, or say which periods exist. */
const byPeriod = <T extends { readonly period: Period }>(
  rows: readonly T[],
  input: JsonObject,
): JsonValue => {
  const period = periodIn(input);
  if (period === undefined) return NO_SUCH_PERIOD;

  const row = rowFor(rows, period);
  return row === undefined ? NO_SUCH_PERIOD : { ...row, currency };
};

const periodInput = (what: string): JsonObject => ({
  type: "object",
  properties: {
    period: {
      type: "string",
      enum: [...PERIODS],
      description: `Which period to report ${what} for.`,
    },
  },
  required: ["period"],
  additionalProperties: false,
});

export const revenueTool: ScopedTool = {
  schema: {
    name: "finance_revenue",
    description:
      "Revenue for a quarter or the year to date, split into recurring revenue and services revenue.",
    inputSchema: periodInput("revenue"),
  },
  read: (input): JsonValue => byPeriod<RevenueRow>(FINANCE_DATASET.revenue, input),
};

export const expensesTool: ScopedTool = {
  schema: {
    name: "finance_expenses",
    description:
      "Company expenses for a quarter or the year to date: the total, and the breakdown by " +
      "category (payroll, hosting, marketing, software, office, other).",
    inputSchema: periodInput("expenses"),
  },
  read: (input): JsonValue => byPeriod<ExpenseRow>(FINANCE_DATASET.expenses, input),
};

export const cashPositionTool: ScopedTool = {
  schema: {
    name: "finance_cash_position",
    description:
      "The current cash position: bank balance, monthly net burn, and the runway in months " +
      "that follows from them, as of the date on the result.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  read: (): JsonValue => ({ ...FINANCE_DATASET.cash, currency }),
};

export const payrollCostTool: ScopedTool = {
  schema: {
    name: "finance_payroll_cost",
    description:
      "What payroll costs the company in a period: the company-wide total cost, the employer " +
      "contributions within it, and how many people that total covers. This is the only view of " +
      "payroll available anywhere in finance — there is no breakdown by person, team, or role, " +
      "and no tool that reports what any individual earns.",
    inputSchema: periodInput("payroll cost"),
  },
  read: (input): JsonValue => byPeriod<PayrollRow>(FINANCE_DATASET.payroll, input),
};

/**
 * The Finance Agent's whole tool set.
 *
 * This list is the isolation guarantee in its literal form: what an agent can
 * read is what is in this array, and adding to it is a visible edit rather than
 * a configuration change somewhere else.
 */
export const financeTools: readonly ScopedTool[] = [
  revenueTool,
  expensesTool,
  cashPositionTool,
  payrollCostTool,
];
