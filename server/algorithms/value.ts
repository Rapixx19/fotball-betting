/**
 * Value Detection Module
 *
 * Identifies positive expected value (EV) betting opportunities
 * by comparing model probabilities to market implied probabilities.
 */

import { ValueResult, MarketOdds, MatchAnalysis } from './types';

// Minimum edge thresholds
const MIN_EDGE_THRESHOLD = 0.02; // 2% minimum edge to consider value
const HIGH_VALUE_THRESHOLD = 0.05; // 5%+ is high value
const EXCEPTIONAL_VALUE_THRESHOLD = 0.10; // 10%+ is exceptional

// Kelly fraction to use (fractional Kelly is safer)
const DEFAULT_KELLY_FRACTION = 0.25; // Quarter Kelly

/**
 * Convert decimal odds to implied probability
 */
export function oddsToImpliedProbability(odds: number): number {
  if (odds <= 1) return 1;
  return 1 / odds;
}

/**
 * Convert implied probability to decimal odds
 */
export function probabilityToOdds(probability: number): number {
  if (probability <= 0) return Infinity;
  if (probability >= 1) return 1;
  return 1 / probability;
}

/**
 * Remove bookmaker margin (vig) from odds
 */
export function removeVig(odds: MarketOdds): MarketOdds {
  const totalImplied = oddsToImpliedProbability(odds.home) +
    (odds.draw ? oddsToImpliedProbability(odds.draw) : 0) +
    oddsToImpliedProbability(odds.away);

  // Calculate fair odds
  return {
    home: odds.home * totalImplied,
    draw: odds.draw ? odds.draw * totalImplied : undefined,
    away: odds.away * totalImplied
  };
}

/**
 * Calculate edge (model probability - implied probability)
 */
export function calculateEdge(modelProbability: number, marketOdds: number): number {
  const impliedProb = oddsToImpliedProbability(marketOdds);
  return modelProbability - impliedProb;
}

/**
 * Calculate Kelly Criterion stake
 *
 * Kelly formula: f = (bp - q) / b
 * where:
 *   f = fraction of bankroll to bet
 *   b = decimal odds - 1 (profit per unit bet)
 *   p = probability of winning
 *   q = probability of losing (1 - p)
 */
export function calculateKellyStake(
  modelProbability: number,
  odds: number,
  kellyFraction: number = DEFAULT_KELLY_FRACTION
): number {
  const b = odds - 1;
  const p = modelProbability;
  const q = 1 - p;

  const fullKelly = (b * p - q) / b;

  // Apply Kelly fraction (e.g., quarter Kelly)
  const adjustedKelly = fullKelly * kellyFraction;

  // Clamp to reasonable bounds
  return Math.max(0, Math.min(0.25, adjustedKelly)); // Max 25% of bankroll
}

/**
 * Calculate expected value per unit staked
 */
export function calculateExpectedValue(
  modelProbability: number,
  odds: number,
  stake: number = 1
): number {
  const winAmount = stake * (odds - 1);
  const loseAmount = stake;

  return (modelProbability * winAmount) - ((1 - modelProbability) * loseAmount);
}

/**
 * Determine confidence level based on model agreement and edge size
 */
export function determineConfidence(
  edge: number,
  modelAgreement: number = 0.5
): 'low' | 'medium' | 'high' {
  const edgeStrength = edge >= HIGH_VALUE_THRESHOLD ? 2 :
    edge >= MIN_EDGE_THRESHOLD ? 1 : 0;

  const agreementStrength = modelAgreement >= 0.8 ? 2 :
    modelAgreement >= 0.6 ? 1 : 0;

  const totalScore = edgeStrength + agreementStrength;

  if (totalScore >= 3) return 'high';
  if (totalScore >= 2) return 'medium';
  return 'low';
}

/**
 * Generate recommendation based on value analysis
 */
export function generateRecommendation(value: ValueResult): string {
  if (value.edge <= 0) {
    return 'No value detected - avoid this bet';
  }

  if (value.edge >= EXCEPTIONAL_VALUE_THRESHOLD) {
    return `Strong value detected! ${(value.edge * 100).toFixed(1)}% edge - consider ${(value.kellyStake * 100).toFixed(1)}% stake`;
  }

  if (value.edge >= HIGH_VALUE_THRESHOLD) {
    return `Good value! ${(value.edge * 100).toFixed(1)}% edge - consider ${(value.kellyStake * 100).toFixed(1)}% stake`;
  }

  if (value.edge >= MIN_EDGE_THRESHOLD) {
    return `Slight value (${(value.edge * 100).toFixed(1)}% edge) - small stake recommended`;
  }

  return 'Marginal edge - proceed with caution';
}

/**
 * Analyze value for a single market
 */
export function analyzeMarketValue(
  market: string,
  modelProbability: number,
  marketOdds: number,
  modelAgreement: number = 0.5,
  kellyFraction: number = DEFAULT_KELLY_FRACTION
): ValueResult {
  const edge = calculateEdge(modelProbability, marketOdds);
  const kellyStake = calculateKellyStake(modelProbability, marketOdds, kellyFraction);
  const expectedValue = calculateExpectedValue(modelProbability, marketOdds);
  const confidence = determineConfidence(edge, modelAgreement);

  const result: ValueResult = {
    market,
    modelProbability,
    impliedProbability: oddsToImpliedProbability(marketOdds),
    edge,
    kellyStake,
    expectedValue,
    confidence,
    recommendation: ''
  };

  result.recommendation = generateRecommendation(result);

  return result;
}

/**
 * Find all value bets in a match
 */
export function findValueBets(
  analysis: MatchAnalysis,
  marketOdds: MarketOdds
): ValueResult[] {
  const valueBets: ValueResult[] = [];

  // Analyze 1X2 markets
  const homeValue = analyzeMarketValue(
    'home',
    analysis.consensus.homeWin,
    marketOdds.home,
    analysis.consensus.modelAgreement
  );

  if (homeValue.edge > 0) {
    valueBets.push(homeValue);
  }

  if (marketOdds.draw) {
    const drawValue = analyzeMarketValue(
      'draw',
      analysis.consensus.draw,
      marketOdds.draw,
      analysis.consensus.modelAgreement
    );

    if (drawValue.edge > 0) {
      valueBets.push(drawValue);
    }
  }

  const awayValue = analyzeMarketValue(
    'away',
    analysis.consensus.awayWin,
    marketOdds.away,
    analysis.consensus.modelAgreement
  );

  if (awayValue.edge > 0) {
    valueBets.push(awayValue);
  }

  // Analyze Over/Under if available
  if (marketOdds.overUnder && analysis.poisson?.overUnder) {
    for (const threshold of Object.keys(marketOdds.overUnder)) {
      const ouOdds = marketOdds.overUnder[threshold];
      const ouProbs = analysis.poisson.overUnder[threshold];

      if (ouOdds && ouProbs) {
        const overValue = analyzeMarketValue(
          `over_${threshold}`,
          ouProbs.over,
          ouOdds.over,
          analysis.consensus.modelAgreement
        );

        if (overValue.edge > MIN_EDGE_THRESHOLD) {
          valueBets.push(overValue);
        }

        const underValue = analyzeMarketValue(
          `under_${threshold}`,
          ouProbs.under,
          ouOdds.under,
          analysis.consensus.modelAgreement
        );

        if (underValue.edge > MIN_EDGE_THRESHOLD) {
          valueBets.push(underValue);
        }
      }
    }
  }

  // Analyze BTTS if available
  if (marketOdds.btts && analysis.poisson?.btts) {
    const bttsYesValue = analyzeMarketValue(
      'btts_yes',
      analysis.poisson.btts.yes,
      marketOdds.btts.yes,
      analysis.consensus.modelAgreement
    );

    if (bttsYesValue.edge > MIN_EDGE_THRESHOLD) {
      valueBets.push(bttsYesValue);
    }

    const bttsNoValue = analyzeMarketValue(
      'btts_no',
      analysis.poisson.btts.no,
      marketOdds.btts.no,
      analysis.consensus.modelAgreement
    );

    if (bttsNoValue.edge > MIN_EDGE_THRESHOLD) {
      valueBets.push(bttsNoValue);
    }
  }

  // Sort by edge (highest first)
  valueBets.sort((a, b) => b.edge - a.edge);

  return valueBets;
}

/**
 * Get the best value bet for a match
 */
export function getBestValueBet(
  analysis: MatchAnalysis,
  marketOdds: MarketOdds
): ValueResult | null {
  const valueBets = findValueBets(analysis, marketOdds);
  return valueBets.length > 0 ? valueBets[0] : null;
}

/**
 * Calculate optimal stake for a value bet
 */
export function calculateOptimalStake(
  bankroll: number,
  valueResult: ValueResult,
  maxStakePercent: number = 0.05 // 5% max
): number {
  const kellyStake = bankroll * valueResult.kellyStake;
  const maxStake = bankroll * maxStakePercent;

  return Math.min(kellyStake, maxStake);
}

/**
 * Analyze the overall value quality of a match
 */
export function analyzeMatchValueQuality(
  analysis: MatchAnalysis,
  marketOdds: MarketOdds
): {
  hasValue: boolean;
  bestMarket: string;
  bestEdge: number;
  overallRating: 'poor' | 'fair' | 'good' | 'excellent';
  summary: string;
} {
  const valueBets = findValueBets(analysis, marketOdds);

  if (valueBets.length === 0) {
    return {
      hasValue: false,
      bestMarket: 'none',
      bestEdge: 0,
      overallRating: 'poor',
      summary: 'No value opportunities detected in this match'
    };
  }

  const best = valueBets[0];

  let overallRating: 'poor' | 'fair' | 'good' | 'excellent' = 'fair';
  if (best.edge >= EXCEPTIONAL_VALUE_THRESHOLD && valueBets.length >= 2) {
    overallRating = 'excellent';
  } else if (best.edge >= HIGH_VALUE_THRESHOLD) {
    overallRating = 'good';
  }

  return {
    hasValue: true,
    bestMarket: best.market,
    bestEdge: best.edge,
    overallRating,
    summary: `${valueBets.length} value bet(s) found. Best: ${best.market} with ${(best.edge * 100).toFixed(1)}% edge`
  };
}
