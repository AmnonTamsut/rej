import { describe, expect, it } from "vitest";
import {
  attritionFor,
  headcountFor,
  HR_DATASET,
  PERIODS,
  TEAMS,
  type Period,
} from "./dataset.js";

const QUARTERS = PERIODS.filter((period) => period !== "year to date");

const sum = (values: readonly number[]): number => values.reduce((total, v) => total + v, 0);

const rosterFor = (team: string) => HR_DATASET.employees.filter((e) => e.team === team);

/** Which quarter a date in the fiscal year falls in. The Dataset covers Q1–Q3 of 2025. */
const quarterOf = (date: string): Period => {
  const month = Number(date.slice(5, 7));
  return month <= 3 ? "Q1" : month <= 6 ? "Q2" : "Q3";
};

const daysBetween = (from: string, to: string): number =>
  Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);

/**
 * The Dataset is invented, but it is not arbitrary: a reviewer who counts the
 * roster should find it agrees with the headcount, and one who follows the
 * joiners and leavers should arrive at the same 48 people. These are the sums
 * that have to hold for the demo to survive being read carefully.
 */
describe("the HR Dataset", () => {
  it("has a headcount row for every team, and a team for every employee", () => {
    expect(HR_DATASET.headcount.byTeam.map((row) => row.team).sort()).toEqual([...TEAMS].sort());
    for (const employee of HR_DATASET.employees) {
      expect(TEAMS, `${employee.name} is on an unknown team`).toContain(employee.team);
    }
  });

  it("adds the teams up to the total headcount", () => {
    expect(sum(HR_DATASET.headcount.byTeam.map((row) => row.headcount))).toBe(
      HR_DATASET.headcount.total,
    );
  });

  it("carries one employee record per person counted", () => {
    // The roster and the headcount are two views of the same 48 people. Two
    // views that disagree is the kind of detail that sinks a demo.
    expect(HR_DATASET.employees).toHaveLength(HR_DATASET.headcount.total);
    for (const team of TEAMS) {
      expect(rosterFor(team), `roster for ${team}`).toHaveLength(headcountFor(team)?.headcount ?? 0);
    }
  });

  it("splits every team into permanent staff and contractors that add back up", () => {
    for (const row of HR_DATASET.headcount.byTeam) {
      expect(row.permanent + row.contractors, `${row.team} split`).toBe(row.headcount);
      expect(
        rosterFor(row.team).filter((e) => e.employmentType === "contractor"),
        `contractors on ${row.team}`,
      ).toHaveLength(row.contractors);
    }
  });

  it("names a real team on every vacancy, and dates it consistently with the days it has been open", () => {
    for (const vacancy of HR_DATASET.vacancies) {
      expect(TEAMS, `${vacancy.role} is open on an unknown team`).toContain(vacancy.team);
      expect(daysBetween(vacancy.openedOn, HR_DATASET.asOf), `${vacancy.role} days open`).toBe(
        vacancy.daysOpen,
      );
    }
  });

  it("has an attrition row for every period the Scoped Tool accepts", () => {
    for (const period of PERIODS) {
      expect(attritionFor(period), `attrition for ${period}`).toBeDefined();
    }
  });

  it("moves headcount by exactly the joiners and leavers it reports", () => {
    for (const period of PERIODS) {
      const row = attritionFor(period);
      expect(
        (row?.startingHeadcount ?? 0) + (row?.joiners ?? 0) - (row?.leavers ?? 0),
        `headcount flow for ${period}`,
      ).toBe(row?.endingHeadcount);
    }
  });

  it("adds the quarters up to the year to date, and ends the year at today's headcount", () => {
    const ytd = attritionFor("year to date");

    expect(sum(QUARTERS.map((q) => attritionFor(q)?.joiners ?? 0))).toBe(ytd?.joiners);
    expect(sum(QUARTERS.map((q) => attritionFor(q)?.leavers ?? 0))).toBe(ytd?.leavers);
    expect(ytd?.startingHeadcount).toBe(attritionFor("Q1")?.startingHeadcount);
    expect(ytd?.endingHeadcount).toBe(HR_DATASET.headcount.total);
  });

  it("rates attrition against the average headcount it reports", () => {
    for (const period of PERIODS) {
      const row = attritionFor(period);
      const average = ((row?.startingHeadcount ?? 0) + (row?.endingHeadcount ?? 0)) / 2;

      expect(row?.averageHeadcount, `average headcount for ${period}`).toBe(average);
      expect(row?.attritionRatePercent, `attrition rate for ${period}`).toBeCloseTo(
        ((row?.leavers ?? 0) / average) * 100,
        1,
      );
    }
  });

  it("gives a reason for every leaver it counts", () => {
    for (const period of PERIODS) {
      const row = attritionFor(period);
      expect(sum(row?.leaverReasons.map((r) => r.count) ?? []), `reasons for ${period}`).toBe(
        row?.leavers,
      );
    }
  });

  it("carries a start date for every joiner it counted this year", () => {
    // Attrition says how many people joined each quarter; the roster says who.
    // The four leavers all pre-date this year's joiners, so every joiner the
    // attrition figures count is still on the roster to be found.
    const joinedThisYear = HR_DATASET.employees.filter((e) => e.startedOn.startsWith("2025"));

    for (const quarter of QUARTERS) {
      expect(
        joinedThisYear.filter((e) => quarterOf(e.startedOn) === quarter),
        `people whose start date falls in ${quarter}`,
      ).toHaveLength(attritionFor(quarter)?.joiners ?? 0);
    }
  });

  it("is frozen, so nothing downstream can edit the people records", () => {
    expect(Object.isFrozen(HR_DATASET)).toBe(true);
    expect(Object.isFrozen(HR_DATASET.employees[0])).toBe(true);
    expect(Object.isFrozen(HR_DATASET.headcount.byTeam[0])).toBe(true);
  });
});
