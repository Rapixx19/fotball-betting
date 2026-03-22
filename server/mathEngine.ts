import { ValidationError } from "./errors";

export interface LegInput {
  odds: number;
  pick: string;
}

export interface ParlayAnalysis {
  combinedOdds: number;
  impliedProbability: number;
  expectedValue: number;
  kellyFraction: number;
  riskRating: "low" | "medium" | "high";
  recommendations: string[];
}

// Validation helpers
function validateOdds(odds: number, context = "Odds"): void {
  if (typeof odds !== "number" || isNaN(odds)) {
    throw new ValidationError(`${context} must be a valid number`);
  }
  if (odds <= 1) {
    throw new ValidationError(`${context} must be greater than 1 (got ${odds})`);
  }
  if (odds > 10000) {
    throw new ValidationError(`${context} exceeds maximum allowed value`);
  }
}

function validateProbability(prob: number, context = "Probability"): void {
  if (typeof prob !== "number" || isNaN(prob)) {
    throw new ValidationError(`${context} must be a valid number`);
  }
  if (prob < 0 || prob > 1) {
    throw new ValidationError(`${context} must be between 0 and 1 (got ${prob})`);
  }
}

function validateStake(stake: number): void {
  if (typeof stake !== "number" || isNaN(stake)) {
    throw new ValidationError("Stake must be a valid number");
  }
  if (stake <= 0) {
    throw new ValidationError("Stake must be greater than 0");
  }
  if (stake > 1000000) {
    throw new ValidationError("Stake exceeds maximum allowed value");
  }
}

function validateLegs(legs: LegInput[]): void {
  if (!Array.isArray(legs) || legs.length === 0) {
    throw new ValidationError("At least one leg is required");
  }
  if (legs.length > 25) {
    throw new ValidationError("Maximum 25 legs allowed in a parlay");
  }
  legs.forEach((leg, index) => {
    if (!leg.pick || typeof leg.pick !== "string") {
      throw new ValidationError(`Leg ${index + 1}: pick is required`);
    }
    validateOdds(leg.odds, `Leg ${index + 1} odds`);
  });
}

// Convert decimal odds to implied probability
export function impliedProbability(odds: number): number {
  validateOdds(odds);
  return 1 / odds;
}

// Convert implied probability to decimal odds
export function probabilityToOdds(probability: number): number {
  validateProbability(probability);
  if (probability === 0) {
    throw new ValidationError("Cannot convert 0 probability to odds");
  }
  return 1 / probability;
}

// Calculate combined odds for a parlay
export function calculateParlayOdds(legs: LegInput[]): number {
  validateLegs(legs);
  return legs.reduce((acc, leg) => acc * leg.odds, 1);
}

// Calculate combined probability (assuming independence)
export function calculateParlayProbability(legs: LegInput[]): number {
  validateLegs(legs);
  return legs.reduce((acc, leg) => acc * impliedProbability(leg.odds), 1);
}

// Calculate expected value
export function calculateExpectedValue(
  stake: number,
  winProbability: number,
  payout: number
): number {
  validateStake(stake);
  validateProbability(winProbability);

  if (payout < 0) {
    throw new ValidationError("Payout cannot be negative");
  }

  const loseProbability = 1 - winProbability;
  return winProbability * payout - loseProbability * stake;
}

// Calculate Kelly Criterion fraction
export function calculateKellyFraction(
  odds: number,
  winProbability: number
): number {
  validateOdds(odds);
  validateProbability(winProbability);

  const b = odds - 1;
  const p = winProbability;
  const q = 1 - p;

  // Guard against division issues (b is always > 0 since odds > 1)
  const kelly = (b * p - q) / b;

  // Clamp to valid range
  return Math.max(0, Math.min(1, kelly));
}

// Assess risk rating based on number of legs and probability
export function assessRiskRating(
  legs: number,
  probability: number
): "low" | "medium" | "high" {
  if (legs < 0) {
    throw new ValidationError("Number of legs cannot be negative");
  }
  validateProbability(probability);

  if (legs <= 2 && probability > 0.3) return "low";
  if (legs <= 4 && probability > 0.15) return "medium";
  return "high";
}

// Generate recommendations based on analysis
export function generateRecommendations(
  analysis: Omit<ParlayAnalysis, "recommendations">,
  legCount: number
): string[] {
  const recommendations: string[] = [];

  if (analysis.expectedValue < 0) {
    recommendations.push("Negative expected value - consider reducing stake");
  } else if (analysis.expectedValue > 0) {
    recommendations.push("Positive expected value - favorable bet");
  }

  if (analysis.kellyFraction < 0.01) {
    recommendations.push("Kelly suggests minimal or no bet");
  } else if (analysis.kellyFraction > 0.1) {
    recommendations.push(`Kelly suggests ${(analysis.kellyFraction * 100).toFixed(1)}% of bankroll`);
  }

  if (legCount > 4) {
    recommendations.push("Large parlays have low hit rates - consider fewer legs");
  }

  if (analysis.impliedProbability < 0.05) {
    recommendations.push("Very low probability - high risk, high reward");
  }

  if (analysis.riskRating === "high") {
    recommendations.push("High risk parlay - only bet what you can afford to lose");
  }

  return recommendations;
}

// Main analysis function
export function analyzeParlay(
  legs: LegInput[],
  stake: number,
  estimatedWinProbability?: number
): ParlayAnalysis {
  validateLegs(legs);
  validateStake(stake);

  if (estimatedWinProbability !== undefined) {
    validateProbability(estimatedWinProbability, "Estimated win probability");
  }

  const combinedOdds = calculateParlayOdds(legs);
  const impliedProb = calculateParlayProbability(legs);

  // Use estimated probability if provided, otherwise use implied
  const winProb = estimatedWinProbability ?? impliedProb;

  const potentialPayout = stake * combinedOdds;
  const expectedValue = calculateExpectedValue(stake, winProb, potentialPayout);
  const kellyFraction = calculateKellyFraction(combinedOdds, winProb);
  const riskRating = assessRiskRating(legs.length, winProb);

  const partialAnalysis = {
    combinedOdds,
    impliedProbability: impliedProb,
    expectedValue,
    kellyFraction,
    riskRating,
  };

  return {
    ...partialAnalysis,
    recommendations: generateRecommendations(partialAnalysis, legs.length),
  };
}

// Calculate potential payout
export function calculatePayout(stake: number, odds: number): number {
  validateStake(stake);
  validateOdds(odds);
  return stake * odds;
}

// Format odds for display (American style)
export function toAmericanOdds(decimalOdds: number): string {
  validateOdds(decimalOdds);
  if (decimalOdds >= 2) {
    return `+${Math.round((decimalOdds - 1) * 100)}`;
  } else {
    return `${Math.round(-100 / (decimalOdds - 1))}`;
  }
}

// Convert American odds to decimal
export function fromAmericanOdds(americanOdds: number): number {
  if (typeof americanOdds !== "number" || isNaN(americanOdds)) {
    throw new ValidationError("American odds must be a valid number");
  }
  if (americanOdds === 0) {
    throw new ValidationError("American odds cannot be 0");
  }
  if (americanOdds > -100 && americanOdds < 100) {
    throw new ValidationError("American odds must be >= 100 or <= -100");
  }

  if (americanOdds > 0) {
    return americanOdds / 100 + 1;
  } else {
    return 100 / Math.abs(americanOdds) + 1;
  }
}
