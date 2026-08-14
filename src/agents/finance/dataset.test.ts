import { describe, expect, it } from "vitest";
import { FINANCE_DATASET, PERIODS, rowFor, type Period } from "./dataset.js";

const revenue = (period: Period) => rowFor(FINANCE_DATASET.revenue, period);
const expenses = (period: Period) => rowFor(FINANCE_DATASET.expenses, period);
const payroll = (period: Period) => rowFor(FINANCE_DATASET.payroll, period);

const QUARTERS = PERIODS.filter((period) => period !== "year to date");

const sum = (values: readonly number[]): number => values.reduce((total, v) => total + v, 0);

/**
 * The Dataset is invented, but it is not arbitrary: a reviewer who adds up the
 * figures in an answer should find they agree. These are the sums that have to
 * hold for the demo to survive being read carefully.
 */
describe("the Finance Dataset", () => {
  it("has a row for every period every Scoped Tool accepts", () => {
    for (const period of PERIODS) {
      expect(revenue(period), `revenue for ${period}`).toBeDefined();
      expect(expenses(period), `expenses for ${period}`).toBeDefined();
      expect(payroll(period), `payroll for ${period}`).toBeDefined();
    }
  });

  it("splits revenue into parts that add up to the total", () => {
    for (const period of PERIODS) {
      const row = revenue(period);
      expect((row?.recurring ?? 0) + (row?.services ?? 0), `revenue split for ${period}`).toBe(
        row?.total,
      );
    }
  });

  it("breaks expenses into lines that add up to the total", () => {
    for (const period of PERIODS) {
      const row = expenses(period);
      expect(sum(Object.values(row?.byLine ?? {})), `expenses for ${period}`).toBe(row?.total);
    }
  });

  it("adds the quarters up to the year to date", () => {
    expect(sum(QUARTERS.map((q) => revenue(q)?.total ?? 0))).toBe(revenue("year to date")?.total);
    expect(sum(QUARTERS.map((q) => expenses(q)?.total ?? 0))).toBe(expenses("year to date")?.total);
    expect(sum(QUARTERS.map((q) => payroll(q)?.totalCost ?? 0))).toBe(
      payroll("year to date")?.totalCost,
    );
  });

  it("reports the same payroll figure whichever tool reaches it", () => {
    // The payroll tool and the expenses breakdown are two views of one cost.
    // Two views that disagree is the kind of detail that sinks a demo.
    for (const period of PERIODS) {
      expect(payroll(period)?.totalCost, `payroll for ${period}`).toBe(
        expenses(period)?.byLine.payroll,
      );
    }
  });

  it("burns what the latest quarter actually lost, and has the runway that follows", () => {
    const { balance, monthlyBurn, runwayMonths } = FINANCE_DATASET.cash;
    const quarterlyLoss = (expenses("Q3")?.total ?? 0) - (revenue("Q3")?.total ?? 0);

    expect(monthlyBurn).toBe(quarterlyLoss / 3);
    expect(runwayMonths).toBe(balance / monthlyBurn);
  });

  it("is frozen, so nothing downstream can edit the books", () => {
    expect(Object.isFrozen(FINANCE_DATASET)).toBe(true);
    expect(Object.isFrozen(FINANCE_DATASET.revenue[0])).toBe(true);
    expect(Object.isFrozen(FINANCE_DATASET.expenses[0]?.byLine)).toBe(true);
  });
});
