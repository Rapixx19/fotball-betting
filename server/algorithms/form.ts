/**
 * Form Analysis Module
 *
 * Analyzes team recent form, trends, and performance patterns
 * to generate form-based predictions.
 */

import { TeamStats, FormResult } from './types';

// Points per result
const POINTS = {
  win: 3,
  draw: 1,
  loss: 0
};

// Weights for recent matches (most recent first)
const RECENCY_WEIGHTS = [1.0, 0.9, 0.8, 0.7, 0.6, 0.5, 0.45, 0.4, 0.35, 0.3];

/**
 * Parse form string (e.g., "WWDLW") into results
 */
export function parseFormString(form: string): Array<'W' | 'D' | 'L'> {
  return form
    .toUpperCase()
    .split('')
    .filter(c => ['W', 'D', 'L'].includes(c)) as Array<'W' | 'D' | 'L'>;
}

/**
 * Calculate weighted form score (0-100)
 */
export function calculateFormScore(form: string): number {
  const results = parseFormString(form);

  if (results.length === 0) return 50; // Default neutral form

  let weightedPoints = 0;
  let totalWeight = 0;

  results.forEach((result, index) => {
    const weight = RECENCY_WEIGHTS[index] || 0.3;
    totalWeight += weight;

    if (result === 'W') weightedPoints += 3 * weight;
    else if (result === 'D') weightedPoints += 1 * weight;
    // Loss = 0 points
  });

  // Convert to 0-100 scale (max possible = 3 points per game)
  const maxPoints = 3 * totalWeight;
  return (weightedPoints / maxPoints) * 100;
}

/**
 * Determine form trend
 */
export function determineFormTrend(form: string): 'improving' | 'stable' | 'declining' {
  const results = parseFormString(form);

  if (results.length < 4) return 'stable';

  // Split into recent and older
  const recent = results.slice(0, Math.floor(results.length / 2));
  const older = results.slice(Math.floor(results.length / 2));

  const recentScore = calculateFormScore(recent.join(''));
  const olderScore = calculateFormScore(older.join(''));

  const diff = recentScore - olderScore;

  if (diff > 15) return 'improving';
  if (diff < -15) return 'declining';
  return 'stable';
}

/**
 * Calculate points per game from form
 */
export function calculatePointsPerGame(form: string): number {
  const results = parseFormString(form);

  if (results.length === 0) return 1.0;

  let points = 0;
  results.forEach(r => {
    points += POINTS[r === 'W' ? 'win' : r === 'D' ? 'draw' : 'loss'];
  });

  return points / results.length;
}

/**
 * Calculate goals per game from recent matches
 */
export function estimateGoalsPerGame(team: TeamStats): number {
  return team.avgGoalsScored || 1.35;
}

/**
 * Calculate clean sheet rate from recent results
 */
export function calculateCleanSheetRate(concededPerGame: number): number {
  // Estimate clean sheet probability using Poisson
  return Math.exp(-concededPerGame);
}

/**
 * Calculate "failed to score" rate
 */
export function calculateFailedToScoreRate(scoredPerGame: number): number {
  // Probability of scoring 0 using Poisson
  return Math.exp(-scoredPerGame);
}

/**
 * Analyze team form
 */
export function analyzeTeamForm(team: TeamStats): FormResult {
  const form = team.recentForm || 'DDDDD';
  const formScore = calculateFormScore(form);
  const trend = determineFormTrend(form);
  const ppg = calculatePointsPerGame(form);
  const gpg = estimateGoalsPerGame(team);
  const csr = calculateCleanSheetRate(team.avgGoalsConceded || 1.35);
  const ftsr = calculateFailedToScoreRate(team.avgGoalsScored || 1.35);

  return {
    formScore,
    trend,
    lastFiveResults: form.slice(0, 5),
    pointsPerGame: ppg,
    goalsPerGame: gpg,
    cleanSheetRate: csr,
    failedToScoreRate: ftsr
  };
}

/**
 * Compare form between two teams
 */
export function compareForm(
  homeTeam: TeamStats,
  awayTeam: TeamStats
): {
  homeAdvantage: number;
  formDifference: number;
  recommendation: string;
} {
  const homeForm = analyzeTeamForm(homeTeam);
  const awayForm = analyzeTeamForm(awayTeam);

  const formDiff = homeForm.formScore - awayForm.formScore;

  // Calculate form-based home advantage
  // Base home advantage + form difference contribution
  let homeAdvantage = 0.1; // Base 10% home boost

  // Add form difference effect (max ±15%)
  homeAdvantage += (formDiff / 100) * 0.15;

  // Trend adjustments
  if (homeForm.trend === 'improving') homeAdvantage += 0.03;
  if (homeForm.trend === 'declining') homeAdvantage -= 0.03;
  if (awayForm.trend === 'improving') homeAdvantage -= 0.02;
  if (awayForm.trend === 'declining') homeAdvantage += 0.02;

  // Generate recommendation
  let recommendation = '';
  if (formDiff > 30) {
    recommendation = 'Home team in significantly better form';
  } else if (formDiff > 15) {
    recommendation = 'Home team in better form';
  } else if (formDiff < -30) {
    recommendation = 'Away team in significantly better form';
  } else if (formDiff < -15) {
    recommendation = 'Away team in better form';
  } else {
    recommendation = 'Teams in similar form';
  }

  if (homeForm.trend === 'improving' && awayForm.trend === 'declining') {
    recommendation += ' - momentum favors home';
  } else if (awayForm.trend === 'improving' && homeForm.trend === 'declining') {
    recommendation += ' - momentum favors away';
  }

  return {
    homeAdvantage,
    formDifference: formDiff,
    recommendation
  };
}

/**
 * Generate form-based insights
 */
export function generateFormInsights(
  homeTeam: TeamStats,
  awayTeam: TeamStats
): string[] {
  const insights: string[] = [];
  const homeForm = analyzeTeamForm(homeTeam);
  const awayForm = analyzeTeamForm(awayTeam);

  // Home team insights
  if (homeForm.formScore > 75) {
    insights.push(`${homeTeam.teamName} in excellent form (${homeForm.lastFiveResults})`);
  } else if (homeForm.formScore < 30) {
    insights.push(`${homeTeam.teamName} struggling (${homeForm.lastFiveResults})`);
  }

  // Away team insights
  if (awayForm.formScore > 75) {
    insights.push(`${awayTeam.teamName} in excellent form (${awayForm.lastFiveResults})`);
  } else if (awayForm.formScore < 30) {
    insights.push(`${awayTeam.teamName} struggling (${awayForm.lastFiveResults})`);
  }

  // Trend insights
  if (homeForm.trend === 'improving') {
    insights.push(`${homeTeam.teamName} showing improvement in recent matches`);
  }
  if (awayForm.trend === 'improving') {
    insights.push(`${awayTeam.teamName} showing improvement in recent matches`);
  }
  if (homeForm.trend === 'declining') {
    insights.push(`${homeTeam.teamName} form declining recently`);
  }
  if (awayForm.trend === 'declining') {
    insights.push(`${awayTeam.teamName} form declining recently`);
  }

  // Clean sheet rate
  if (homeForm.cleanSheetRate > 0.4) {
    insights.push(`${homeTeam.teamName} keeping clean sheets (${(homeForm.cleanSheetRate * 100).toFixed(0)}% rate)`);
  }
  if (awayForm.cleanSheetRate > 0.4) {
    insights.push(`${awayTeam.teamName} keeping clean sheets (${(awayForm.cleanSheetRate * 100).toFixed(0)}% rate)`);
  }

  // Failed to score
  if (homeForm.failedToScoreRate > 0.3) {
    insights.push(`${homeTeam.teamName} struggling to score (${(homeForm.failedToScoreRate * 100).toFixed(0)}% blank rate)`);
  }
  if (awayForm.failedToScoreRate > 0.3) {
    insights.push(`${awayTeam.teamName} struggling to score (${(awayForm.failedToScoreRate * 100).toFixed(0)}% blank rate)`);
  }

  return insights;
}

/**
 * Adjust probability based on form
 */
export function adjustProbabilityByForm(
  baseProbability: number,
  teamForm: FormResult,
  opponentForm: FormResult
): number {
  let adjustment = 0;

  // Form score difference effect
  const formDiff = teamForm.formScore - opponentForm.formScore;
  adjustment += formDiff * 0.001; // ±5% max

  // Trend effect
  if (teamForm.trend === 'improving') adjustment += 0.02;
  if (teamForm.trend === 'declining') adjustment -= 0.02;
  if (opponentForm.trend === 'improving') adjustment -= 0.015;
  if (opponentForm.trend === 'declining') adjustment += 0.015;

  // Apply adjustment with bounds
  const adjusted = baseProbability + adjustment;
  return Math.max(0.01, Math.min(0.99, adjusted));
}
