/**
 * Algorithm Engine Orchestrator
 *
 * Combines all prediction models to generate comprehensive match analysis,
 * consensus probabilities, and AI-generated insights.
 */

import { TeamStats, MatchAnalysis, MarketOdds, ValueResult, ParlayLeg } from './types';
import { analyzePoissonModel, createDefaultTeamStats } from './poisson';
import { analyzeDixonColesModel } from './dixonColes';
import { analyzeEloModel } from './elo';
import { runMonteCarloSimulation } from './xg';
import { analyzeTeamForm, generateFormInsights, compareForm } from './form';
import { analyzeParlay, suggestBetterParlay, calculateParlayBoost } from './correlation';
import { findValueBets, getBestValueBet, analyzeMatchValueQuality } from './value';

// Re-export all types and key functions
export * from './types';
export { analyzePoissonModel, createDefaultTeamStats } from './poisson';
export { analyzeDixonColesModel } from './dixonColes';
export { analyzeEloModel, updateEloRatings, getEloTier } from './elo';
export { runMonteCarloSimulation } from './xg';
export { analyzeTeamForm, generateFormInsights, compareForm } from './form';
export { analyzeParlay, suggestBetterParlay, calculateParlayBoost, getParlayAdjustmentFactor } from './correlation';
export { findValueBets, getBestValueBet, analyzeMatchValueQuality, calculateKellyStake, calculateExpectedValue } from './value';

/**
 * Calculate consensus probability from multiple models
 * Uses weighted average based on model reliability
 */
export function calculateConsensus(
  poisson: { home: number; draw: number; away: number },
  dixonColes: { home: number; draw: number; away: number } | null,
  elo: { home: number; draw: number; away: number },
  monteCarlo: { home: number; draw: number; away: number } | null
): {
  homeWin: number;
  draw: number;
  awayWin: number;
  modelAgreement: number;
} {
  // Weights for each model (sum = 1)
  const weights = {
    poisson: 0.25,
    dixonColes: 0.30,
    elo: 0.20,
    monteCarlo: 0.25
  };

  // Collect available model predictions
  const predictions: Array<{
    model: string;
    weight: number;
    home: number;
    draw: number;
    away: number;
  }> = [];

  predictions.push({
    model: 'poisson',
    weight: weights.poisson,
    ...poisson
  });

  if (dixonColes) {
    predictions.push({
      model: 'dixonColes',
      weight: weights.dixonColes,
      ...dixonColes
    });
  }

  predictions.push({
    model: 'elo',
    weight: weights.elo,
    ...elo
  });

  if (monteCarlo) {
    predictions.push({
      model: 'monteCarlo',
      weight: weights.monteCarlo,
      ...monteCarlo
    });
  }

  // Normalize weights
  const totalWeight = predictions.reduce((sum, p) => sum + p.weight, 0);

  // Calculate weighted average
  let homeWin = 0;
  let draw = 0;
  let awayWin = 0;

  predictions.forEach(p => {
    const normalizedWeight = p.weight / totalWeight;
    homeWin += p.home * normalizedWeight;
    draw += p.draw * normalizedWeight;
    awayWin += p.away * normalizedWeight;
  });

  // Calculate model agreement (how much models agree)
  // Using coefficient of variation - lower CV = higher agreement
  const homeValues = predictions.map(p => p.home);
  const drawValues = predictions.map(p => p.draw);
  const awayValues = predictions.map(p => p.away);

  const cv = (values: number[]) => {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);
    return mean > 0 ? stdDev / mean : 0;
  };

  const avgCV = (cv(homeValues) + cv(drawValues) + cv(awayValues)) / 3;
  // Convert CV to agreement score (0-1, higher = more agreement)
  const modelAgreement = Math.max(0, Math.min(1, 1 - avgCV));

  // Normalize probabilities to sum to 1
  const total = homeWin + draw + awayWin;
  return {
    homeWin: homeWin / total,
    draw: draw / total,
    awayWin: awayWin / total,
    modelAgreement
  };
}

/**
 * Generate AI insights based on analysis
 */
export function generateInsights(
  homeTeam: TeamStats,
  awayTeam: TeamStats,
  consensus: { homeWin: number; draw: number; awayWin: number; modelAgreement: number },
  marketOdds?: MarketOdds
): string[] {
  const insights: string[] = [];

  // Elo-based insights
  const eloDiff = homeTeam.eloRating - awayTeam.eloRating;
  if (Math.abs(eloDiff) > 200) {
    const stronger = eloDiff > 0 ? homeTeam.teamName : awayTeam.teamName;
    insights.push(`${stronger} is significantly higher rated (${Math.abs(eloDiff).toFixed(0)} Elo points difference)`);
  }

  // Form insights
  const formInsights = generateFormInsights(homeTeam, awayTeam);
  insights.push(...formInsights.slice(0, 3)); // Limit to 3 form insights

  // Form comparison
  const formComparison = compareForm(homeTeam, awayTeam);
  if (Math.abs(formComparison.formDifference) > 20) {
    insights.push(formComparison.recommendation);
  }

  // Model agreement insights
  if (consensus.modelAgreement > 0.85) {
    insights.push('High model agreement - prediction confidence is strong');
  } else if (consensus.modelAgreement < 0.6) {
    insights.push('Low model agreement - prediction uncertainty is high');
  }

  // Probability insights
  if (consensus.homeWin > 0.55) {
    insights.push(`Home team favored (${(consensus.homeWin * 100).toFixed(0)}% win probability)`);
  } else if (consensus.awayWin > 0.45) {
    insights.push(`Away team is dangerous (${(consensus.awayWin * 100).toFixed(0)}% win probability)`);
  } else if (consensus.draw > 0.30) {
    insights.push(`Draw is a strong possibility (${(consensus.draw * 100).toFixed(0)}% probability)`);
  }

  // Value insights (if market odds provided)
  if (marketOdds) {
    const valueAnalysis = analyzeMatchValueQuality(
      { consensus } as MatchAnalysis,
      marketOdds
    );

    if (valueAnalysis.hasValue && valueAnalysis.bestEdge > 0.03) {
      insights.push(`Value detected on ${valueAnalysis.bestMarket} (+${(valueAnalysis.bestEdge * 100).toFixed(1)}% edge)`);
    }
  }

  // Goal expectation insights
  const avgGoals = (homeTeam.avgGoalsScored + awayTeam.avgGoalsScored) / 2;
  if (avgGoals > 1.8) {
    insights.push('Both teams are high-scoring - consider over goals');
  } else if (avgGoals < 1.0) {
    insights.push('Defensive match expected - consider under goals');
  }

  return insights;
}

/**
 * Main function to analyze a match
 */
export function analyzeMatch(
  homeTeam: TeamStats,
  awayTeam: TeamStats,
  marketOdds?: MarketOdds,
  options: {
    runMonteCarlo?: boolean;
    monteCarloSimulations?: number;
    matchId?: number;
  } = {}
): MatchAnalysis {
  const { runMonteCarlo = true, monteCarloSimulations = 10000, matchId = 0 } = options;

  // Run Poisson model
  const poisson = analyzePoissonModel(homeTeam, awayTeam);

  // Run Dixon-Coles model
  const dixonColes = analyzeDixonColesModel(homeTeam, awayTeam);

  // Run Elo model
  const elo = analyzeEloModel(homeTeam, awayTeam);

  // Run Monte Carlo simulation (optional, computationally expensive)
  const monteCarlo = runMonteCarlo
    ? runMonteCarloSimulation(homeTeam, awayTeam, monteCarloSimulations)
    : undefined;

  // Analyze team forms
  const homeForm = analyzeTeamForm(homeTeam);
  const awayForm = analyzeTeamForm(awayTeam);

  // Calculate consensus
  const consensus = calculateConsensus(
    { home: poisson.homeWin, draw: poisson.draw, away: poisson.awayWin },
    { home: dixonColes.adjustedHomeWin, draw: dixonColes.adjustedDraw, away: dixonColes.adjustedAwayWin },
    { home: elo.homeWinProb, draw: elo.drawProb, away: elo.awayWinProb },
    monteCarlo ? { home: monteCarlo.homeWin, draw: monteCarlo.draw, away: monteCarlo.awayWin } : null
  );

  // Determine confidence
  const confidence: 'low' | 'medium' | 'high' =
    consensus.modelAgreement > 0.8 ? 'high' :
      consensus.modelAgreement > 0.6 ? 'medium' : 'low';

  // Analyze value (if market odds provided)
  let value: MatchAnalysis['value'] | undefined;

  if (marketOdds) {
    const partialAnalysis = {
      consensus: { ...consensus, confidence },
      poisson
    } as MatchAnalysis;

    const homeValue = findValueBets(partialAnalysis, marketOdds)
      .find(v => v.market === 'home') || createDefaultValueResult('home', consensus.homeWin, marketOdds.home);

    const drawValue = marketOdds.draw
      ? (findValueBets(partialAnalysis, marketOdds).find(v => v.market === 'draw') ||
        createDefaultValueResult('draw', consensus.draw, marketOdds.draw))
      : createDefaultValueResult('draw', consensus.draw, marketOdds.draw || 3.5);

    const awayValue = findValueBets(partialAnalysis, marketOdds)
      .find(v => v.market === 'away') || createDefaultValueResult('away', consensus.awayWin, marketOdds.away);

    const bestValue = getBestValueBet(partialAnalysis, marketOdds);

    value = {
      home: homeValue,
      draw: drawValue,
      away: awayValue,
      bestValue: bestValue || undefined
    };
  }

  // Generate insights
  const insights = generateInsights(homeTeam, awayTeam, consensus, marketOdds);

  return {
    matchId,
    homeTeam: homeTeam.teamName,
    awayTeam: awayTeam.teamName,
    poisson,
    dixonColes,
    elo,
    monteCarlo,
    homeForm,
    awayForm,
    consensus: {
      ...consensus,
      confidence
    },
    value: value!,
    insights,
    computedAt: new Date()
  };
}

/**
 * Create a default value result when no value is found
 */
function createDefaultValueResult(market: string, modelProbability: number, marketOdds: number): ValueResult {
  const impliedProbability = 1 / marketOdds;
  const edge = modelProbability - impliedProbability;

  return {
    market,
    modelProbability,
    impliedProbability,
    edge,
    kellyStake: 0,
    expectedValue: edge * 100, // Per $100 bet
    confidence: 'low',
    recommendation: edge > 0 ? 'Slight edge detected' : 'No value'
  };
}

/**
 * Analyze parlay with all models
 */
export function analyzeAdvancedParlay(
  legs: ParlayLeg[],
  teamStatsMap?: Map<string, TeamStats>
): {
  legAnalyses: MatchAnalysis[];
  correlationAnalysis: ReturnType<typeof analyzeParlay>;
  parlayBoost: ReturnType<typeof calculateParlayBoost>;
  betterParlaysuggestion: ReturnType<typeof suggestBetterParlay>;
  combinedProbability: {
    independent: number;
    adjusted: number;
  };
  expectedValue: number;
  recommendation: string;
} {
  // Analyze each leg
  const legAnalyses: MatchAnalysis[] = [];

  for (const leg of legs) {
    const homeTeam = teamStatsMap?.get(leg.homeTeam) ||
      createDefaultTeamStats(leg.homeTeam, leg.sport);
    const awayTeam = teamStatsMap?.get(leg.awayTeam) ||
      createDefaultTeamStats(leg.awayTeam, leg.sport);

    const analysis = analyzeMatch(homeTeam, awayTeam, undefined, {
      runMonteCarlo: false, // Skip MC for speed
      matchId: leg.matchId
    });

    legAnalyses.push(analysis);

    // Update leg with model probability
    if (leg.pick.toLowerCase() === 'home') {
      leg.modelProbability = analysis.consensus.homeWin;
    } else if (leg.pick.toLowerCase() === 'away') {
      leg.modelProbability = analysis.consensus.awayWin;
    } else if (leg.pick.toLowerCase() === 'draw') {
      leg.modelProbability = analysis.consensus.draw;
    }
  }

  // Analyze correlations
  const correlationAnalysis = analyzeParlay(legs);

  // Calculate parlay boost
  const parlayBoost = calculateParlayBoost(legs);

  // Get better parlay suggestion
  const betterParlaysuggestion = suggestBetterParlay(legs);

  // Calculate combined probabilities
  const independentProb = legs.reduce((acc, leg) => {
    return acc * (leg.modelProbability || (1 / leg.odds));
  }, 1);

  const adjustedProb = correlationAnalysis.adjustedProbability;

  // Calculate expected value
  const combinedOdds = legs.reduce((acc, leg) => acc * leg.odds, 1);
  const potentialReturn = combinedOdds - 1;
  const expectedValue = (adjustedProb * potentialReturn) - ((1 - adjustedProb) * 1);

  // Generate recommendation
  let recommendation = '';
  if (correlationAnalysis.hasConflict) {
    recommendation = '⚠️ AVOID: Parlay contains conflicting bets that cannot both win';
  } else if (expectedValue > 0.1) {
    recommendation = '✅ Positive EV parlay - good value detected';
  } else if (expectedValue > 0) {
    recommendation = '⚡ Slight positive EV - consider smaller stake';
  } else if (correlationAnalysis.warnings.length > 0) {
    recommendation = '⚠️ Correlated legs reduce value - consider independent selections';
  } else {
    recommendation = '❌ Negative EV - not recommended';
  }

  return {
    legAnalyses,
    correlationAnalysis,
    parlayBoost,
    betterParlaysuggestion,
    combinedProbability: {
      independent: independentProb,
      adjusted: adjustedProb
    },
    expectedValue,
    recommendation
  };
}

/**
 * Quick analysis for a single match (faster, less detailed)
 */
export function quickAnalyzeMatch(
  homeTeam: TeamStats,
  awayTeam: TeamStats
): {
  homeWin: number;
  draw: number;
  awayWin: number;
  predictedScore: string;
  confidence: 'low' | 'medium' | 'high';
} {
  const poisson = analyzePoissonModel(homeTeam, awayTeam);
  const elo = analyzeEloModel(homeTeam, awayTeam);

  // Simple average of two fast models
  const homeWin = (poisson.homeWin + elo.homeWinProb) / 2;
  const draw = (poisson.draw + elo.drawProb) / 2;
  const awayWin = (poisson.awayWin + elo.awayWinProb) / 2;

  // Normalize
  const total = homeWin + draw + awayWin;

  // Confidence based on model agreement
  const homeDiff = Math.abs(poisson.homeWin - elo.homeWinProb);
  const confidence: 'low' | 'medium' | 'high' =
    homeDiff < 0.1 ? 'high' :
      homeDiff < 0.2 ? 'medium' : 'low';

  return {
    homeWin: homeWin / total,
    draw: draw / total,
    awayWin: awayWin / total,
    predictedScore: poisson.predictedScore,
    confidence
  };
}
