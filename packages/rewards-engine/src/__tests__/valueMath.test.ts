import { describe, expect, it } from "vitest";

import {
  centsToDollars,
  computeExpectedValueCents,
  computePointsEarned,
  computeValueCents,
} from "../valueMath.js";

describe("value math", () => {
  it("$100 at 4x with 1.6 cpp produces 640 cents", () => {
    expect(computeExpectedValueCents(10000, "4", "1.6")).toEqual({
      points: 400,
      valueCents: 640,
    });
  });

  it("$50 at 3x with 1.7 cpp produces 255 cents", () => {
    expect(computeExpectedValueCents(5000, "3", "1.7")).toEqual({
      points: 150,
      valueCents: 255,
    });
  });

  it("cashback math is points-like and consistent", () => {
    expect(centsToDollars(10000)).toBe(100);
    expect(computePointsEarned(10000, "6")).toBe(600);
    expect(computeValueCents(600, "1")).toBe(600);
    expect(computeExpectedValueCents(10000, "6", "1").valueCents).toBe(600);
  });
});
