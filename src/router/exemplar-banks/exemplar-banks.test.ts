import { describe, expect, it } from "vitest";
import { localPassAgainst } from "../local-pass.js";
import { EXEMPLAR_BANKS, type ExemplarBank } from "./index.js";

const withExemplar = (route: string, phrasing: string): ExemplarBank[] =>
  EXEMPLAR_BANKS.map((bank) =>
    bank.route === route ? { ...bank, exemplars: [...bank.exemplars, phrasing] } : bank,
  );

describe("Exemplar Banks", () => {
  it("defines one bank per Local Pass Route, each a non-empty list of phrasings", () => {
    expect(EXEMPLAR_BANKS.map((bank) => bank.route)).toEqual(["finance", "hr", "both"]);
    for (const bank of EXEMPLAR_BANKS) {
      expect(bank.exemplars.length).toBeGreaterThan(0);
      expect(bank.exemplars.every((e) => typeof e === "string" && e.length > 0)).toBe(true);
    }
  });

  it("changes routing when a phrasing is added, with no change to Router logic", async () => {
    const question = "What time does the office open?";

    const before = await localPassAgainst(question, EXEMPLAR_BANKS);
    expect(before.outcome, "this Question should start out unplaceable").toBe("abstained");

    const after = await localPassAgainst(question, withExemplar("hr", "What are the office opening hours?"));

    expect(after.outcome).toBe("placed");
    expect(after.outcome === "placed" && after.route).toBe("hr");
  });
});
