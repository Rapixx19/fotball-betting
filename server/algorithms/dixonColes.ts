/**
 * Dixon-Coles Model for Soccer Score Prediction
 *
 * An improvement over the basic Poisson model that accounts for the
 * correlation between low-scoring matches (0-0, 1-0, 0-1, 1-1 outcomes
 * are more common than independent Poisson would predict).
 *
 * Reference: Dixon & Coles (1997) "Modelling Association Football Scores and Inefficiencies in the Football Betting Market"
 */

import { TeamStats, DixonColesResult, ScoreMatrix } from './types';
import { poissonPMF, calculateExpectedGoals, generateScoreMatrix, getMostLikelyScore } from './poisson';

/**
 * The Dixon-Coles adjustment factor τ(x, y, λ, μ, ρ)
 *
 * This function adjusts the probability of low-scoring outcomes (0-0, 1-0, 0-1, 1-1)
 * based on the correlation parameter ρ (rho).
 *
 * ρ < 0: Negative correlation (low scores more likely than Poisson predicts)
 * ρ = 0: No correlation (standard Poisson)
 * ρ > 0: Positive correlation (low scores less likely)
 *
 * Typical empirical value for soccer: ρ ≈ -0.03 to -0.15
 */
export function dixonColesAdjustment(
  homeGoals: number,
  awayGoals: number,
  homeXG: number,
  awayXG: number,
  rho: number
): number {
  if (homeGoals === 0 && awayGoals === 0) {
    // 0-0
    return 1 - homeXG * awayXG * rho;
  } else if (homeGoals === 0 && awayGoals === 1) {
    // 0-1
    return 1 + homeXG * rho;
  } else if (homeGoals === 1 && awayGoals === 0) {
    // 1-0
    return 1 + awayXG * rho;
  } else if (homeGoals === 1 && awayGoals === 1) {
    // 1-1
    return 1 - rho;
  }
  // For all other scores, no adjustment
  return 1;
}

/**
 * Estimate the rho parameter from historical data
 * In practice, this would be fitted using maximum likelihood estimation
 * Here we use a simplified empirical approximation based on league characteristics
 */
export function estimateRho(
  homeTeam: TeamStats,
  awayTeam: TeamStats,
  leagueDefensiveness: number = 0.5 // 0 = attacking league, 1 = defensive league
): number {
  // Base rho (typically negative for soccer)
  let rho = -0.05;

  // Adjust based on team characteristics
  const avgConceded = (homeTeam.avgGoalsConceded + awayTeam.avgGoalsConceded) / 2;
  const avgScored = (homeTeam.avgGoalsScored + awayTeam.avgGoalsScored) / 2;

  // More defensive teams = more negative rho
  if (avgConceded < 1.0) rho -= 0.03;
  if (avgScored < 1.2) rho -= 0.02;

  // League effect
  rho -= leagueDefensiveness * 0.05;

  // Clamp to reasonable bounds
  return Math.max(-0.2, Math.min(0.1, rho));
}

/**
 * Generate Dixon-Coles adjusted score matrix
 */
export function generateDixonColesMatrix(
  homeXG: number,
  awayXG: number,
  rho: number,
  maxGoals: number = 6
): ScoreMatrix {
  const matrix: number[][] = [];

  for (let home = 0; home <= maxGoals; home++) {
    matrix[home] = [];
    for (let away = 0; away <= maxGoals; away++) {
      const poissonProb = poissonPMF(homeXG, home) * poissonPMF(awayXG, away);
      const adjustment = dixonColesAdjustment(home, away, homeXG, awayXG, rho);
      matrix[home][away] = poissonProb * adjustment;
    }
  }

  // Normalize to ensure probabilities sum to 1
  let total = 0;
  for (let home = 0; home <= maxGoals; home++) {
    for (let away = 0; away <= maxGoals; away++) {
      total += matrix[home][away];
    }
  }

  for (let home = 0; home <= maxGoals; home++) {
    for (let away = 0; away <= maxGoals; away++) {
      matrix[home][away] /= total;
    }
  }

  return matrix;
}

/**
 * Extract adjusted probabilities from Dixon-Coles matrix
 */
export function extractDixonColesProbabilities(matrix: ScoreMatrix): {
  homeWin: number;
  draw: number;
  awayWin: number;
  overUnder: { [key: string]: { over: number; under: number } };
  btts: { yes: number; no: number };
  correctScores: { [key: string]: number };
} {
  let homeWin = 0;
  let draw = 0;
  let awayWin = 0;

  const overUnderThresholds = [0.5, 1.5, 2.5, 3.5, 4.5];
  const overUnder: { [key: string]: { over: number; under: number } } = {};
  overUnderThresholds.forEach(threshold => {
    overUnder[threshold.toString()] = { over: 0, under: 0 };
  });

  let bttsYes = 0;
  let bttsNo = 0;

  const correctScores: { [key: string]: number } = {};

  const maxGoals = matrix.length - 1;

  for (let home = 0; home <= maxGoals; home++) {
    for (let away = 0; away <= maxGoals; away++) {
      const prob = matrix[home][away];
      const totalGoals = home + away;

      // Match result
      if (home > away) homeWin += prob;
      else if (home === away) draw += prob;
      else awayWin += prob;

      // Over/Under
      overUnderThresholds.forEach(threshold => {
        if (totalGoals > threshold) {
          overUnder[threshold.toString()].over += prob;
        } else {
          overUnder[threshold.toString()].under += prob;
        }
      });

      // Both Teams To Score
      if (home > 0 && away > 0) {
        bttsYes += prob;
      } else {
        bttsNo += prob;
      }

      // Store correct score
      correctScores[`${home}-${away}`] = prob;
    }
  }

  return {
    homeWin,
    draw,
    awayWin,
    overUnder,
    btts: { yes: bttsYes, no: bttsNo },
    correctScores
  };
}

/**
 * Main Dixon-Coles analysis function
 */
export function analyzeDixonColesModel(
  homeTeam: TeamStats,
  awayTeam: TeamStats,
  leagueAvgGoals?: number,
  customRho?: number
): DixonColesResult {
  const { homeXG, awayXG } = calculateExpectedGoals(homeTeam, awayTeam, leagueAvgGoals);

  // Estimate or use custom rho
  const rho = customRho ?? estimateRho(homeTeam, awayTeam);

  // Generate both standard Poisson and Dixon-Coles matrices for comparison
  const poissonMatrix = generateScoreMatrix(homeXG, awayXG);
  const dixonColesMatrix = generateDixonColesMatrix(homeXG, awayXG, rho);

  const poissonProbs = extractDixonColesProbabilities(poissonMatrix);
  const adjustedProbs = extractDixonColesProbabilities(dixonColesMatrix);
  const likelyScore = getMostLikelyScore(dixonColesMatrix);

  return {
    homeXG,
    awayXG,
    // Standard Poisson probabilities (unadjusted)
    homeWin: poissonProbs.homeWin,
    draw: poissonProbs.draw,
    awayWin: poissonProbs.awayWin,
    // Dixon-Coles adjusted probabilities
    rho,
    adjustedHomeWin: adjustedProbs.homeWin,
    adjustedDraw: adjustedProbs.draw,
    adjustedAwayWin: adjustedProbs.awayWin,
    // Additional markets
    overUnder: adjustedProbs.overUnder,
    btts: adjustedProbs.btts,
    correctScores: adjustedProbs.correctScores,
    predictedScore: `${likelyScore.home}-${likelyScore.away}`,
    scoreMatrix: dixonColesMatrix
  };
}

/**
 * Compare Poisson vs Dixon-Coles predictions
 */
export function comparePoissonDixonColes(
  homeTeam: TeamStats,
  awayTeam: TeamStats
): {
  poisson: { home: number; draw: number; away: number };
  dixonColes: { home: number; draw: number; away: number };
  difference: { home: number; draw: number; away: number };
} {
  const result = analyzeDixonColesModel(homeTeam, awayTeam);

  const difference = {
    home: result.adjustedHomeWin - result.homeWin,
    draw: result.adjustedDraw - result.draw,
    away: result.adjustedAwayWin - result.awayWin
  };

  return {
    poisson: {
      home: result.homeWin,
      draw: result.draw,
      away: result.awayWin
    },
    dixonColes: {
      home: result.adjustedHomeWin,
      draw: result.adjustedDraw,
      away: result.adjustedAwayWin
    },
    difference
  };
}
