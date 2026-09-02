import { describe, expect, it } from "vitest";

import {
  calculateDaysOfCover,
  roundRecommendedOrderQuantity,
} from "../../modules/decisioning/decisioning-formulas.js";

describe("decisioning-formulas", () => {
  it("rounds replenishment quantities up to MOQ and case-pack boundaries", () => {
    expect(
      roundRecommendedOrderQuantity({
        rawQuantity: 5,
        minOrderQty: 12,
        casePackQty: 6,
      }),
    ).toBe(12);

    expect(
      roundRecommendedOrderQuantity({
        rawQuantity: 13,
        minOrderQty: 12,
        casePackQty: 6,
      }),
    ).toBe(18);
  });

  it("returns null days of cover when there is no forecast consumption", () => {
    expect(calculateDaysOfCover(10, 0, 7)).toBeNull();
    expect(calculateDaysOfCover(14, 14, 7)).toBe(7);
  });
});
