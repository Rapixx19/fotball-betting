/**
 * Correlation Analysis for Parlay Bets
 *
 * Detects and quantifies correlations between parlay legs
 * to adjust combined probabilities and provide warnings.
 */

import { ParlayLeg, CorrelationResult } from './types';

// Correlation factors by type
const CORRELATION_FACTORS = {
  // Same match correlations (strongest)
  sameMatchRelated: 0.7, // e.g., Over 2.5 + BTTS Yes
  sameMatchConflicting: 0.9, // e.g., Under 1.5 + BTTS Yes

  // Same team correlations
  sameTeamSameDay: 0.4, // Team plays twice same day (rare)
  sameTeamRelated: 0.2, // e.g., Team A -1.5 + Team A over team total

  // Same league correlations
  sameLeague: 0.1, // General league trends
  sameLeagueRivals: 0.15, // Direct rivals in same league

  // Cross-sport
  none: 0
};

/**
 * Market types and their relationships
 */
const MARKET_RELATIONSHIPS: Record<string, string[]> = {
  home: ['home_spread', 'home_ml', 'home_total'],
  away: ['away_spread', 'away_ml', 'away_total'],
  over: ['btts_yes', 'over_1.5', 'over_2.5', 'over_3.5', 'over_4.5'],
  under: ['btts_no', 'under_1.5', 'under_2.5', 'under_3.5', 'under_4.5'],
  btts_yes: ['over_2.5', 'over_1.5'],
  btts_no: ['under_2.5', 'under_1.5']
};

/**
 * Check if two picks are from the same match
 */
export function isSameMatch(leg1: ParlayLeg, leg2: ParlayLeg): boolean {
  return leg1.matchId === leg2.matchId;
}

/**
 * Check if two picks involve the same team
 */
export function isSameTeam(leg1: ParlayLeg, leg2: ParlayLeg): boolean {
  const teams1 = [leg1.homeTeam.toLowerCase(), leg1.awayTeam.toLowerCase()];
  const teams2 = [leg2.homeTeam.toLowerCase(), leg2.awayTeam.toLowerCase()];

  return teams1.some(t => teams2.includes(t));
}

/**
 * Check if two picks are from the same league
 */
export function isSameLeague(leg1: ParlayLeg, leg2: ParlayLeg): boolean {
  if (!leg1.league || !leg2.league) return false;
  return leg1.league.toLowerCase() === leg2.league.toLowerCase();
}

/**
 * Check if two markets are related/correlated
 */
export function areMarketsRelated(pick1: string, pick2: string): boolean {
  const p1 = pick1.toLowerCase().replace(/[^a-z0-9_]/g, '');
  const p2 = pick2.toLowerCase().replace(/[^a-z0-9_]/g, '');

  // Check direct relationship
  const related1 = MARKET_RELATIONSHIPS[p1] || [];
  const related2 = MARKET_RELATIONSHIPS[p2] || [];

  return related1.includes(p2) || related2.includes(p1);
}

/**
 * Check if two markets conflict
 */
export function areMarketsConflicting(pick1: string, pick2: string): boolean {
  const p1 = pick1.toLowerCase();
  const p2 = pick2.toLowerCase();

  // Direct conflicts
  const conflicts: Array<[string, string]> = [
    ['over', 'under'],
    ['home', 'away'],
    ['home', 'draw'],
    ['away', 'draw'],
    ['btts_yes', 'btts_no']
  ];

  for (const [a, b] of conflicts) {
    if ((p1.includes(a) && p2.includes(b)) || (p1.includes(b) && p2.includes(a))) {
      return true;
    }
  }

  // Check over/under threshold conflicts
  // e.g., over_2.5 conflicts with under_1.5
  const overMatch1 = p1.match(/over[_]?(\d+\.?\d*)/);
  const underMatch2 = p2.match(/under[_]?(\d+\.?\d*)/);
  if (overMatch1 && underMatch2) {
    const overThreshold = parseFloat(overMatch1[1]);
    const underThreshold = parseFloat(underMatch2[1]);
    if (overThreshold >= underThreshold) return true;
  }

  const underMatch1 = p1.match(/under[_]?(\d+\.?\d*)/);
  const overMatch2 = p2.match(/over[_]?(\d+\.?\d*)/);
  if (underMatch1 && overMatch2) {
    const underThreshold = parseFloat(underMatch1[1]);
    const overThreshold = parseFloat(overMatch2[1]);
    if (underThreshold <= overThreshold) return true;
  }

  return false;
}

/**
 * Analyze correlation between two legs
 */
export function analyzeCorrelation(leg1: ParlayLeg, leg2: ParlayLeg): CorrelationResult {
  // Default: no correlation
  const result: CorrelationResult = {
    isCorrelated: false,
    correlationType: 'none',
    correlationFactor: 0,
    adjustedProbability: 1
  };

  // Same match checks (highest correlation)
  if (isSameMatch(leg1, leg2)) {
    result.isCorrelated = true;
    result.correlationType = 'same_match';

    if (areMarketsConflicting(leg1.pick, leg2.pick)) {
      result.correlationFactor = CORRELATION_FACTORS.sameMatchConflicting;
      result.warning = 'Warning: Conflicting picks on same match';
      result.recommendation = 'These picks cannot both win - remove one';
    } else if (areMarketsRelated(leg1.pick, leg2.pick)) {
      result.correlationFactor = CORRELATION_FACTORS.sameMatchRelated;
      result.warning = 'Warning: Correlated picks on same match';
      result.recommendation = 'These picks are related - actual probability lower than implied';
    }
    return result;
  }

  // Same team checks
  if (isSameTeam(leg1, leg2)) {
    result.isCorrelated = true;
    result.correlationType = 'same_team';
    result.correlationFactor = CORRELATION_FACTORS.sameTeamRelated;
    result.warning = 'Note: Picks involve the same team';
    return result;
  }

  // Same league checks
  if (isSameLeague(leg1, leg2)) {
    result.isCorrelated = true;
    result.correlationType = 'same_league';
    result.correlationFactor = CORRELATION_FACTORS.sameLeague;
    // No warning for mild same-league correlation
    return result;
  }

  // Different sports are independent
  if (leg1.sport !== leg2.sport) {
    result.correlationType = 'none';
    result.correlationFactor = 0;
    return result;
  }

  return result;
}

/**
 * Analyze all legs in a parlay for correlations
 */
export function analyzeParlay(legs: ParlayLeg[]): {
  totalCorrelationFactor: number;
  adjustedProbability: number;
  correlations: Array<{
    leg1Index: number;
    leg2Index: number;
    correlation: CorrelationResult;
  }>;
  warnings: string[];
  recommendations: string[];
  hasConflict: boolean;
} {
  const correlations: Array<{
    leg1Index: number;
    leg2Index: number;
    correlation: CorrelationResult;
  }> = [];

  const warnings: string[] = [];
  const recommendations: string[] = [];
  let hasConflict = false;
  let totalCorrelationFactor = 0;

  // Check all pairs
  for (let i = 0; i < legs.length; i++) {
    for (let j = i + 1; j < legs.length; j++) {
      const correlation = analyzeCorrelation(legs[i], legs[j]);

      if (correlation.isCorrelated) {
        correlations.push({
          leg1Index: i,
          leg2Index: j,
          correlation
        });

        totalCorrelationFactor += correlation.correlationFactor;

        if (correlation.warning) {
          warnings.push(`Legs ${i + 1} & ${j + 1}: ${correlation.warning}`);
        }
        if (correlation.recommendation) {
          recommendations.push(`Legs ${i + 1} & ${j + 1}: ${correlation.recommendation}`);
        }

        // Check for conflicts (impossible parlays)
        if (correlation.correlationFactor >= CORRELATION_FACTORS.sameMatchConflicting) {
          hasConflict = true;
        }
      }
    }
  }

  // Calculate adjusted probability
  // The more correlation, the lower the actual combined probability
  // Use diminishing returns formula
  const adjustmentFactor = Math.exp(-totalCorrelationFactor * 0.5);
  const baseProb = legs.reduce((acc, leg) => acc * (1 / leg.odds), 1);
  const adjustedProbability = baseProb * adjustmentFactor;

  return {
    totalCorrelationFactor,
    adjustedProbability,
    correlations,
    warnings,
    recommendations,
    hasConflict
  };
}

/**
 * Get parlay adjustment factor based on correlations
 */
export function getParlayAdjustmentFactor(legs: ParlayLeg[]): number {
  const analysis = analyzeParlay(legs);

  if (analysis.hasConflict) {
    return 0; // Impossible parlay
  }

  // Return adjustment factor (0-1, lower = more correlated)
  return Math.exp(-analysis.totalCorrelationFactor * 0.5);
}

/**
 * Suggest better parlay combinations
 */
export function suggestBetterParlay(legs: ParlayLeg[]): {
  suggestion: string;
  removeLegIndex?: number;
  expectedEVImprovement: number;
} {
  const analysis = analyzeParlay(legs);

  if (analysis.hasConflict) {
    // Find the conflicting pair and suggest removal
    const conflict = analysis.correlations.find(
      c => c.correlation.correlationFactor >= CORRELATION_FACTORS.sameMatchConflicting
    );

    if (conflict) {
      return {
        suggestion: `Remove leg ${conflict.leg2Index + 1} to eliminate conflict`,
        removeLegIndex: conflict.leg2Index,
        expectedEVImprovement: 1 // Can't calculate EV for impossible parlay
      };
    }
  }

  if (analysis.correlations.length === 0) {
    return {
      suggestion: 'Good parlay - no significant correlations detected',
      expectedEVImprovement: 0
    };
  }

  // Find most correlated pair
  const maxCorrelation = analysis.correlations.reduce(
    (max, c) => c.correlation.correlationFactor > max.correlation.correlationFactor ? c : max,
    analysis.correlations[0]
  );

  const evImprovement = maxCorrelation.correlation.correlationFactor * 0.1;

  return {
    suggestion: `Consider removing leg ${maxCorrelation.leg2Index + 1} to reduce correlation (+${(evImprovement * 100).toFixed(1)}% EV)`,
    removeLegIndex: maxCorrelation.leg2Index,
    expectedEVImprovement: evImprovement
  };
}

/**
 * Calculate optimal parlay boost (promotional odds boost)
 */
export function calculateParlayBoost(legs: ParlayLeg[]): {
  baseOdds: number;
  boostedOdds: number;
  boostPercentage: number;
} {
  const baseOdds = legs.reduce((acc, leg) => acc * leg.odds, 1);

  // Typical sportsbook boosts:
  // 3 legs: 10%
  // 4 legs: 20%
  // 5 legs: 30%
  // 6+ legs: 40%
  let boostPercentage = 0;

  if (legs.length >= 6) boostPercentage = 0.4;
  else if (legs.length >= 5) boostPercentage = 0.3;
  else if (legs.length >= 4) boostPercentage = 0.2;
  else if (legs.length >= 3) boostPercentage = 0.1;

  const boostedOdds = baseOdds * (1 + boostPercentage);

  return {
    baseOdds,
    boostedOdds,
    boostPercentage
  };
}
