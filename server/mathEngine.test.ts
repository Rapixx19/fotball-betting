import { describe, it, expect } from "vitest";
import {
  impliedProbability,
  probabilityToOdds,
  calculateParlayOdds,
  calculateParlayProbability,
  calculateExpectedValue,
  calculateKellyFraction,
  assessRiskRating,
  generateRecommendations,
  analyzeParlay,
  calculatePayout,
  toAmericanOdds,
  fromAmericanOdds,
} from "./mathEngine";
import { AppError } from "./errors";

describe("mathEngine", () => {
  describe("impliedProbability", () => {
    it("calculates implied probability from decimal odds", () => {
      expect(impliedProbability(2.0)).toBe(0.5);
      expect(impliedProbability(4.0)).toBe(0.25);
      expect(impliedProbability(1.5)).toBeCloseTo(0.6667, 4);
    });

    it("throws on invalid odds", () => {
      expect(() => impliedProbability(1)).toThrow(AppError);
      expect(() => impliedProbability(0)).toThrow(AppError);
      expect(() => impliedProbability(-1)).toThrow(AppError);
      expect(() => impliedProbability(NaN)).toThrow(AppError);
    });

    it("throws on odds exceeding maximum", () => {
      expect(() => impliedProbability(10001)).toThrow(AppError);
    });
  });

  describe("probabilityToOdds", () => {
    it("converts probability to decimal odds", () => {
      expect(probabilityToOdds(0.5)).toBe(2.0);
      expect(probabilityToOdds(0.25)).toBe(4.0);
      expect(probabilityToOdds(0.1)).toBe(10.0);
    });

    it("throws on invalid probability", () => {
      expect(() => probabilityToOdds(-0.1)).toThrow(AppError);
      expect(() => probabilityToOdds(1.1)).toThrow(AppError);
      expect(() => probabilityToOdds(0)).toThrow(AppError);
    });
  });

  describe("calculateParlayOdds", () => {
    it("calculates combined odds for a parlay", () => {
      const legs = [
        { odds: 2.0, pick: "Team A" },
        { odds: 2.0, pick: "Team B" },
      ];
      expect(calculateParlayOdds(legs)).toBe(4.0);
    });

    it("handles single leg", () => {
      const legs = [{ odds: 1.5, pick: "Team A" }];
      expect(calculateParlayOdds(legs)).toBe(1.5);
    });

    it("handles multiple legs", () => {
      const legs = [
        { odds: 2.0, pick: "Team A" },
        { odds: 3.0, pick: "Team B" },
        { odds: 1.5, pick: "Team C" },
      ];
      expect(calculateParlayOdds(legs)).toBe(9.0);
    });

    it("throws on empty legs", () => {
      expect(() => calculateParlayOdds([])).toThrow(AppError);
    });

    it("throws on too many legs", () => {
      const legs = Array(26).fill({ odds: 2.0, pick: "Team" });
      expect(() => calculateParlayOdds(legs)).toThrow(AppError);
    });
  });

  describe("calculateParlayProbability", () => {
    it("calculates combined probability", () => {
      const legs = [
        { odds: 2.0, pick: "Team A" }, // 50%
        { odds: 2.0, pick: "Team B" }, // 50%
      ];
      expect(calculateParlayProbability(legs)).toBe(0.25);
    });
  });

  describe("calculateExpectedValue", () => {
    it("calculates positive expected value", () => {
      // Fair coin flip with 2x payout
      const ev = calculateExpectedValue(10, 0.6, 20);
      expect(ev).toBeCloseTo(8, 1); // 0.6 * 20 - 0.4 * 10 = 12 - 4 = 8
    });

    it("calculates negative expected value", () => {
      const ev = calculateExpectedValue(10, 0.4, 20);
      expect(ev).toBeCloseTo(2, 1); // 0.4 * 20 - 0.6 * 10 = 8 - 6 = 2
    });

    it("throws on invalid inputs", () => {
      expect(() => calculateExpectedValue(-1, 0.5, 10)).toThrow(AppError);
      expect(() => calculateExpectedValue(10, 1.5, 10)).toThrow(AppError);
      expect(() => calculateExpectedValue(10, 0.5, -10)).toThrow(AppError);
    });
  });

  describe("calculateKellyFraction", () => {
    it("calculates kelly fraction for favorable bet", () => {
      // Odds of 2.0 (even money), 60% win probability
      const kelly = calculateKellyFraction(2.0, 0.6);
      // Kelly = (1 * 0.6 - 0.4) / 1 = 0.2
      expect(kelly).toBeCloseTo(0.2, 2);
    });

    it("returns 0 for unfavorable bet", () => {
      // Odds of 2.0, 40% win probability
      const kelly = calculateKellyFraction(2.0, 0.4);
      expect(kelly).toBe(0);
    });

    it("clamps to maximum of 1", () => {
      // Very favorable bet
      const kelly = calculateKellyFraction(10.0, 0.9);
      expect(kelly).toBeLessThanOrEqual(1);
    });
  });

  describe("assessRiskRating", () => {
    it("returns low for 2-leg parlay with high probability", () => {
      expect(assessRiskRating(2, 0.35)).toBe("low");
    });

    it("returns medium for 4-leg parlay with moderate probability", () => {
      expect(assessRiskRating(4, 0.16)).toBe("medium");
    });

    it("returns high for large parlays", () => {
      expect(assessRiskRating(5, 0.1)).toBe("high");
    });

    it("returns high for low probability", () => {
      expect(assessRiskRating(2, 0.1)).toBe("high");
    });
  });

  describe("generateRecommendations", () => {
    it("recommends reducing stake for negative EV", () => {
      const analysis = {
        combinedOdds: 4.0,
        impliedProbability: 0.1,
        expectedValue: -5,
        kellyFraction: 0,
        riskRating: "high" as const,
      };
      const recs = generateRecommendations(analysis, 4);
      expect(recs).toContain("Negative expected value - consider reducing stake");
    });

    it("recommends favorable bet for positive EV", () => {
      const analysis = {
        combinedOdds: 2.0,
        impliedProbability: 0.5,
        expectedValue: 10,
        kellyFraction: 0.1,
        riskRating: "low" as const,
      };
      const recs = generateRecommendations(analysis, 2);
      expect(recs).toContain("Positive expected value - favorable bet");
    });

    it("warns about large parlays", () => {
      const analysis = {
        combinedOdds: 32.0,
        impliedProbability: 0.03,
        expectedValue: -5,
        kellyFraction: 0,
        riskRating: "high" as const,
      };
      const recs = generateRecommendations(analysis, 5);
      expect(recs).toContain("Large parlays have low hit rates - consider fewer legs");
    });
  });

  describe("analyzeParlay", () => {
    it("returns complete analysis", () => {
      const legs = [
        { odds: 2.0, pick: "Team A" },
        { odds: 2.0, pick: "Team B" },
      ];
      const analysis = analyzeParlay(legs, 10);

      expect(analysis.combinedOdds).toBe(4.0);
      expect(analysis.impliedProbability).toBe(0.25);
      expect(analysis.riskRating).toBeDefined();
      expect(analysis.recommendations).toBeInstanceOf(Array);
    });

    it("accepts custom win probability", () => {
      const legs = [{ odds: 2.0, pick: "Team A" }];
      const analysis = analyzeParlay(legs, 10, 0.7);

      // EV should be based on 0.7 probability, not 0.5 implied
      expect(analysis.expectedValue).toBeGreaterThan(0);
    });
  });

  describe("calculatePayout", () => {
    it("calculates correct payout", () => {
      expect(calculatePayout(10, 2.0)).toBe(20);
      expect(calculatePayout(25, 4.0)).toBe(100);
    });

    it("throws on invalid stake", () => {
      expect(() => calculatePayout(0, 2.0)).toThrow(AppError);
      expect(() => calculatePayout(-10, 2.0)).toThrow(AppError);
    });
  });

  describe("toAmericanOdds", () => {
    it("converts decimal to American odds", () => {
      expect(toAmericanOdds(2.0)).toBe("+100");
      expect(toAmericanOdds(3.0)).toBe("+200");
      expect(toAmericanOdds(1.5)).toBe("-200");
      expect(toAmericanOdds(1.25)).toBe("-400");
    });
  });

  describe("fromAmericanOdds", () => {
    it("converts American to decimal odds", () => {
      expect(fromAmericanOdds(100)).toBe(2.0);
      expect(fromAmericanOdds(200)).toBe(3.0);
      expect(fromAmericanOdds(-200)).toBe(1.5);
      expect(fromAmericanOdds(-400)).toBe(1.25);
    });

    it("throws on invalid American odds", () => {
      expect(() => fromAmericanOdds(0)).toThrow(AppError);
      expect(() => fromAmericanOdds(50)).toThrow(AppError);
      expect(() => fromAmericanOdds(-50)).toThrow(AppError);
    });
  });
});
