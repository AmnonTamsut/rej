import { describe, expect, it } from "vitest";
import type { ToolResult } from "../agents/specialist-agent.js";
import { auditNumbers } from "./number-audit.js";

/**
 * The Number Audit is a pure function over an answer and the Scoped Tool
 * results behind it, so it is tested as one: an answer is a string written
 * here, and the evidence is a tool result written here.
 *
 * Waiting for a Fixture that happens to hallucinate would leave the case the
 * audit exists for — a figure that came from nowhere — untested until a model
 * obliged. The tool results below are shaped like the real ones because the
 * tolerances are about real answers, not because anything reaches a Dataset.
 */

const cashPosition: ToolResult = {
  tool: "finance_cash_position",
  input: {},
  result: {
    asOf: "2025-09-30",
    balance: 1248000,
    monthlyBurn: 96000,
    runwayMonths: 13,
    currency: "USD",
  },
};

const q3Expenses: ToolResult = {
  tool: "finance_expenses",
  input: { period: "Q3" },
  result: {
    period: "Q3",
    currency: "USD",
    total: 1778000,
    byLine: { payroll: 1096000, hosting: 241000 },
  },
};

const q3Attrition: ToolResult = {
  tool: "hr_attrition",
  input: { period: "Q3" },
  result: { asOf: "2025-09-30", period: "Q3", joiners: 4, leavers: 2, attritionRatePercent: 4.3 },
};

describe("the Number Audit", () => {
  it("passes an answer whose every figure came from a Scoped Tool result", () => {
    const audit = auditNumbers(
      "You are holding 1,248,000 USD as of 2025-09-30, burning 96,000 USD a month, " +
        "which is 13 months of runway.",
      [cashPosition],
    );

    expect(audit.passed).toBe(true);
    expect(audit.unaccounted).toEqual([]);
  });

  it("fails an answer containing a figure no tool result accounts for, and names it", () => {
    // The case the audit exists for. Every other figure here is real, which is
    // what an invented one looks like in practice: one number in a paragraph of
    // grounded ones.
    const audit = auditNumbers(
      "You are holding 1,248,000 USD, burning 96,000 USD a month, which is 21 months of runway.",
      [cashPosition],
    );

    expect(audit.passed).toBe(false);
    expect(audit.unaccounted).toEqual(["21"]);
  });

  it("names every unaccounted figure, as the answer wrote it", () => {
    const audit = auditNumbers("Revenue was 2,100,000 USD against 1,900,000 USD of expenses.", [
      q3Expenses,
    ]);

    expect(audit.unaccounted).toEqual(["2,100,000", "1,900,000"]);
  });

  it("names a repeated unaccounted figure once", () => {
    const audit = auditNumbers("Runway is 21 months. At this burn, 21 months is comfortable.", [
      cashPosition,
    ]);

    expect(audit.unaccounted).toEqual(["21"]);
  });

  it("reads currency symbols and thousands separators as formatting, not as different figures", () => {
    // A tolerance decided rather than discovered: the Dataset holds 1248000 and
    // an answer will write it half a dozen ways. If those read as different
    // figures the audit fails every well-formatted answer, and an audit that
    // cries wolf is one nobody reads.
    for (const written of ["$1,248,000", "1248000", "USD 1,248,000.00", "1,248,000"]) {
      const audit = auditNumbers(`You are holding ${written}.`, [cashPosition]);

      expect(audit.passed, `${written} should read as the figure the tool returned`).toBe(true);
    }
  });

  it("passes a percentage a tool actually returned", () => {
    const audit = auditNumbers("Attrition ran at 4.3% in Q3, with 2 leavers against 4 joiners.", [
      q3Attrition,
    ]);

    expect(audit.passed).toBe(true);
  });

  it("fails a percentage the agent derived from two audited figures", () => {
    // The documented rule, asserted so that changing it is a deliberate edit
    // here rather than a quiet drift in the regular expression. Both figures
    // behind this percentage are grounded; the percentage itself is a number no
    // tool returned, and the audit checks provenance rather than arithmetic.
    const audit = auditNumbers("Payroll was 1,096,000 USD, or 62% of the 1,778,000 USD total.", [
      q3Expenses,
    ]);

    expect(audit.passed).toBe(false);
    expect(audit.unaccounted).toEqual(["62"]);
  });

  it("fails a figure the agent rounded or rescaled", () => {
    const audit = auditNumbers("You are holding roughly 1.2 million USD.", [cashPosition]);

    expect(audit.unaccounted).toEqual(["1.2"]);
  });

  it("accounts for a date the answer restated in prose", () => {
    // Dates are read in parts on both sides, so an answer that writes the
    // Dataset's `asOf` as words is not reported as having invented a year.
    const audit = auditNumbers("As of 30 September 2025 you hold 1,248,000 USD.", [cashPosition]);

    expect(audit.passed).toBe(true);
  });

  it("passes an answer with no figures in it at all", () => {
    // A refusal is the common case here: nothing to account for, nothing to
    // report, and no reason for the operator to distrust it.
    const audit = auditNumbers("That is not something I can answer.", [cashPosition]);

    expect(audit.passed).toBe(true);
  });

  it("checks against every tool result the turn retained", () => {
    const audit = auditNumbers("Expenses were 1,778,000 USD against 1,248,000 USD of cash.", [
      cashPosition,
      q3Expenses,
    ]);

    expect(audit.passed).toBe(true);
  });

  it("does not treat what the model asked a tool for as evidence", () => {
    // Otherwise a figure could be laundered: name it in a tool input, take the
    // error the tool returns, and state it as though a Dataset had supplied it.
    const askedForAMissingPeriod: ToolResult = {
      tool: "finance_revenue",
      input: { period: "1,900,000" },
      result: { error: "No figures for that period. Ask for one of: Q1, Q2, Q3, year to date." },
    };

    const audit = auditNumbers("Revenue was 1,900,000 USD.", [askedForAMissingPeriod]);

    expect(audit.passed).toBe(false);
    expect(audit.unaccounted).toEqual(["1,900,000"]);
  });

  it("leaves the tool results it was given untouched", () => {
    const before = JSON.stringify(cashPosition);

    auditNumbers("You are holding 1,248,000 USD.", [cashPosition]);

    expect(JSON.stringify(cashPosition)).toBe(before);
  });
});
