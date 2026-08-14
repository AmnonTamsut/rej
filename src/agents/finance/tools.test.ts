import { describe, expect, it } from "vitest";
import { FINANCE_DATASET, PERIODS } from "./dataset.js";
import {
  cashPositionTool,
  expensesTool,
  financeTools,
  payrollCostTool,
  revenueTool,
} from "./tools.js";

/**
 * Scoped Tools are pure read-only functions, so they are tested as pure
 * functions — no agent, no model, no seam. What the model does with them is
 * tested end-to-end through the entry point; what they return is tested here.
 */
describe("the Finance Agent's Scoped Tools", () => {
  it("reports revenue for a quarter, split the way the books split it", () => {
    expect(revenueTool.read({ period: "Q3" })).toEqual({
      period: "Q3",
      currency: "USD",
      total: 1490000,
      recurring: 1305000,
      services: 185000,
    });
  });

  it("reports revenue for the year so far", () => {
    expect(revenueTool.read({ period: "year to date" })).toMatchObject({
      period: "year to date",
      total: 3990000,
    });
  });

  it("reports expenses broken down by category", () => {
    expect(expensesTool.read({ period: "Q2" })).toEqual({
      period: "Q2",
      currency: "USD",
      total: 1662000,
      byCategory: {
        payroll: 1024000,
        hosting: 226000,
        marketing: 198000,
        software: 101000,
        office: 62000,
        other: 51000,
      },
    });
  });

  it("reports the cash position, its burn, and the runway that follows from them", () => {
    expect(cashPositionTool.read({})).toEqual({
      currency: "USD",
      asOf: "2025-09-30",
      balance: 1248000,
      monthlyBurn: 96000,
      runwayMonths: 13,
    });
  });

  it("reports payroll as a company-wide total and the number of people it covers", () => {
    expect(payrollCostTool.read({ period: "Q3" })).toEqual({
      period: "Q3",
      currency: "USD",
      totalCost: 1096000,
      employerContributions: 239000,
      headcountCovered: 48,
    });
  });

  it("gives the payroll figure no field an individual's pay could arrive in", () => {
    // The isolation guarantee stated as a shape: these five keys are the whole
    // vocabulary of payroll here, and none of them is a person. See ADR 0004.
    for (const period of PERIODS) {
      expect(Object.keys(payrollCostTool.read({ period }) as object).sort()).toEqual([
        "currency",
        "employerContributions",
        "headcountCovered",
        "period",
        "totalCost",
      ]);
    }
  });

  it("names the periods it has rather than guessing when asked for one it does not", () => {
    const result = revenueTool.read({ period: "Q4" }) as { error?: string };

    expect(result.error).toMatch(/year to date/);
    expect(result).not.toHaveProperty("total");
  });

  it("asks for a period rather than picking one when the input has none", () => {
    expect(expensesTool.read({})).toHaveProperty("error");
  });

  it("does not echo what it was asked back into its result", () => {
    // A tool result is evidence the Number Audit will check an answer against.
    // Echoing the model's own input into it would let unaudited text — and
    // unaudited figures — arrive as though a Scoped Tool had produced them.
    const result = revenueTool.read({ period: "the 40 million dollar quarter" });

    expect(JSON.stringify(result)).not.toMatch(/40 million/);
  });

  it("cannot be made to mutate the Dataset", () => {
    for (const tool of financeTools) tool.read({ period: "Q1" });

    expect(() => {
      (FINANCE_DATASET.cash as { balance: number }).balance = 0;
    }).toThrow();
    expect(FINANCE_DATASET.cash.balance).toBe(1248000);
  });

  it("returns figures the caller cannot use to edit the Dataset behind them", () => {
    const before = FINANCE_DATASET.expenses[0]?.byCategory.payroll;
    const result = expensesTool.read({ period: "Q1" }) as { byCategory: { payroll: number } };

    expect(() => {
      result.byCategory.payroll = 1;
    }).toThrow();
    expect(FINANCE_DATASET.expenses[0]?.byCategory.payroll).toBe(before);
  });
});
