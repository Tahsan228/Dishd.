import { describe, expect, it } from "vitest";
import { cashCommissionCents, parseTipCents } from "./money";

describe("integer-cent tips", () => {
  it.each([["0",0],["2",200],["2.50",250],["0.29",29],["99.99",9999],["100.00",10000]])("parses %s exactly", (input, expected) => expect(parseTipCents(input)).toBe(expected));
  it.each(["", "-1", "100.01", "1.001", "1e2", "Infinity", "NaN", " 2", "+2", "1,00", "0x10"])("rejects %s", input => expect(parseTipCents(input)).toBeNull());
  it("rejects non-string form values", () => expect(parseTipCents(200)).toBeNull());
});
describe("5% cash commission", () => {
  it.each([[0,0],[9,0],[10,1],[29,1],[30,2],[1500,75],[1999,100],[2000,100]])("rounds %i food cents to %i fee cents", (food, fee) => expect(cashCommissionCents(food)).toBe(fee));
  it("rejects fractional or negative cents", () => { expect(() => cashCommissionCents(0.5)).toThrow(); expect(() => cashCommissionCents(-1)).toThrow(); });
});
