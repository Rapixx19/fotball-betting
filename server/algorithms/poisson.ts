/**
 * Poisson Distribution Model for Soccer Score Prediction
 *
 * Uses Poisson distribution to model the probability of each team scoring
 * a specific number of goals based on their average scoring/conceding rates.
 */

import { TeamStats, PoissonResult, ScoreMatrix } from './types';

// Factorial function with memoization for efficiency
const factorialCache: Map<number, number> = new Map();
function factorial(n: number): number {
  if (n <= 1) return 1;
  if (factorialCache.has(n)) return factorialCache.get(n)!;
  const result = n * factorial(n - 1);
  factorialCache.set(n, result);
  return result;
}

// Poisson probability mass function: P(X = k) = (λ^k * e^(-λ)) / k!
export function poissonPMF(lambda: number, k: number): number {
  if (lambda <= 0) return k === 0 ? 1 : 0;
  return (Math.pow(lambda, k) * Math.exp(-lambda)) / factorial(k);
}

// Calculate expected goals for each team
export function calculateExpectedGoals(
  homeTeam: TeamStats,
  awayTeam: TeamStats,
  leagueAvgGoals: number = 1.35 // Typical league average home/away
): { homeXG: number; awayXG: number } {
  // Home team attack strength
  const homeAttackStrength = homeTeam.avgGoalsScored / leagueAvgGoals;
  // Away team defense strength
  const awayDefenseStrength = awayTeam.avgGoalsConceded / leagueAvgGoals;

  // Away team attack strength
  const awayAttackStrength = awayTeam.avgGoalsScored / leagueAvgGoals;
  // Home team defense strength
  const homeDefenseStrength = homeTeam.avgGoalsConceded / leagueAvgGoals;

  // Home advantage factor (typically home teams score ~0.25 more goals)
  const homeAdvantage = 1.15;

  // Expected goals
  const homeXG = homeAttackStrength * awayDefenseStrength * leagueAvgGoals * homeAdvantage;
  const awayXG = awayAttackStrength * homeDefenseStrength * leagueAvgGoals;

  return {
    homeXG: Math.max(0.1, homeXG), // Minimum 0.1 to avoid 0 lambda
    awayXG: Math.max(0.1, awayXG)
  };
}

// Generate score probability matrix (0-0 to maxGoals-maxGoals)
export function generateScoreMatrix(
  homeXG: number,
  awayXG: number,
  maxGoals: number = 6
): ScoreMatrix {
  const matrix: number[][] = [];

  for (let home = 0; home <= maxGoals; home++) {
    matrix[home] = [];
    for (let away = 0; away <= maxGoals; away++) {
      // Assuming independence: P(home=h, away=a) = P(home=h) * P(away=a)
      matrix[home][away] = poissonPMF(homeXG, home) * poissonPMF(awayXG, away);
    }
  }

  return matrix;
}

// Extract probabilities from score matrix
export function extractProbabilities(matrix: ScoreMatrix): {
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

      // Correct score (top 10 most likely)
      correctScores[`${home}-${away}`] = prob;
    }
  }

  // Normalize probabilities (should sum to ~1 but we cap at maxGoals)
  const total = homeWin + draw + awayWin;

  return {
    homeWin: homeWin / total,
    draw: draw / total,
    awayWin: awayWin / total,
    overUnder,
    btts: { yes: bttsYes / total, no: bttsNo / total },
    correctScores
  };
}

// Get most likely score
export function getMostLikelyScore(matrix: ScoreMatrix): { home: number; away: number; probability: number } {
  let maxProb = 0;
  let likelyScore = { home: 0, away: 0, probability: 0 };

  for (let home = 0; home < matrix.length; home++) {
    for (let away = 0; away < matrix[home].length; away++) {
      if (matrix[home][away] > maxProb) {
        maxProb = matrix[home][away];
        likelyScore = { home, away, probability: maxProb };
      }
    }
  }

  return likelyScore;
}

// Main Poisson analysis function
export function analyzePoissonModel(
  homeTeam: TeamStats,
  awayTeam: TeamStats,
  leagueAvgGoals?: number
): PoissonResult {
  const { homeXG, awayXG } = calculateExpectedGoals(homeTeam, awayTeam, leagueAvgGoals);
  const matrix = generateScoreMatrix(homeXG, awayXG);
  const probabilities = extractProbabilities(matrix);
  const likelyScore = getMostLikelyScore(matrix);

  return {
    homeXG,
    awayXG,
    homeWin: probabilities.homeWin,
    draw: probabilities.draw,
    awayWin: probabilities.awayWin,
    overUnder: probabilities.overUnder,
    btts: probabilities.btts,
    correctScores: probabilities.correctScores,
    predictedScore: `${likelyScore.home}-${likelyScore.away}`,
    scoreMatrix: matrix
  };
}

// Create default team stats when historical data is unavailable
export function createDefaultTeamStats(
  teamName: string,
  sport: string = 'soccer',
  eloRating: number = 1500
): TeamStats {
  // Default values based on typical league averages
  return {
    teamName,
    sport,
    eloRating,
    avgGoalsScored: 1.35,
    avgGoalsConceded: 1.35,
    formScore: 50,
    homeWinRate: 0.45,
    awayWinRate: 0.30,
    drawRate: 0.25,
    recentForm: 'DDDDD' // Default neutral form
  };
}
