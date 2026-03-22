/**
 * Elo Rating System for Sports Prediction
 *
 * Uses the Elo rating system (originally developed for chess) to estimate
 * team strength and predict match outcomes.
 *
 * Key concepts:
 * - Each team has a rating (default 1500)
 * - Higher rating = stronger team
 * - Rating difference determines win probability
 * - Ratings update after each match based on result vs expectation
 */

import { TeamStats, EloResult } from './types';

// Default Elo parameters
const DEFAULT_RATING = 1500;
const K_FACTOR = 32; // How much ratings change per match
const HOME_ADVANTAGE = 65; // Elo points advantage for home team
const SCALE_FACTOR = 400; // Standard Elo scale factor

/**
 * Calculate expected score (win probability) from rating difference
 * Uses the standard Elo formula: E = 1 / (1 + 10^((Ra - Rb) / 400))
 */
export function calculateExpectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / SCALE_FACTOR));
}

/**
 * Calculate win probabilities including draw
 * We use a modified approach that accounts for draw probability
 * based on rating closeness
 */
export function calculateWinProbabilities(
  homeRating: number,
  awayRating: number,
  homeAdvantage: number = HOME_ADVANTAGE
): { homeWin: number; draw: number; awayWin: number } {
  // Apply home advantage
  const adjustedHomeRating = homeRating + homeAdvantage;
  const ratingDiff = adjustedHomeRating - awayRating;

  // Base win probability from Elo formula
  const homeExpected = calculateExpectedScore(adjustedHomeRating, awayRating);

  // Draw probability increases when teams are closer in rating
  // Maximum draw probability around 30% when ratings are equal
  // Decreases as rating difference increases
  const drawBase = 0.26; // Base draw probability
  const drawDecay = 0.0008; // How fast draw probability decreases with rating diff
  const drawProb = Math.max(0.05, drawBase * Math.exp(-drawDecay * Math.abs(ratingDiff)));

  // Distribute remaining probability based on expected score
  const remainingProb = 1 - drawProb;
  const homeWin = remainingProb * homeExpected;
  const awayWin = remainingProb * (1 - homeExpected);

  // Normalize to ensure sum = 1
  const total = homeWin + drawProb + awayWin;
  return {
    homeWin: homeWin / total,
    draw: drawProb / total,
    awayWin: awayWin / total
  };
}

/**
 * Update Elo ratings after a match
 *
 * @param homeRating Current home team rating
 * @param awayRating Current away team rating
 * @param result 1 = home win, 0.5 = draw, 0 = away win
 * @param kFactor Optional custom K factor
 * @returns New ratings for both teams
 */
export function updateEloRatings(
  homeRating: number,
  awayRating: number,
  result: number,
  kFactor: number = K_FACTOR
): { newHomeRating: number; newAwayRating: number } {
  const expectedHome = calculateExpectedScore(homeRating + HOME_ADVANTAGE, awayRating);
  const expectedAway = 1 - expectedHome;

  const homeResult = result;
  const awayResult = 1 - result;

  const newHomeRating = homeRating + kFactor * (homeResult - expectedHome);
  const newAwayRating = awayRating + kFactor * (awayResult - expectedAway);

  return { newHomeRating, newAwayRating };
}

/**
 * Estimate expected score based on Elo rating difference
 * Higher rating difference = more goals difference expected
 */
export function estimateScoreFromElo(
  homeRating: number,
  awayRating: number,
  homeAdvantage: number = HOME_ADVANTAGE
): { homeGoals: number; awayGoals: number } {
  const adjustedHomeRating = homeRating + homeAdvantage;
  const ratingDiff = adjustedHomeRating - awayRating;

  // Base expected goals (league average)
  const baseGoals = 1.35;

  // Adjust based on rating difference
  // Every 100 Elo points difference = ~0.2 goal advantage
  const goalAdvantage = ratingDiff / 500;

  const homeGoals = Math.max(0.1, baseGoals + goalAdvantage);
  const awayGoals = Math.max(0.1, baseGoals - goalAdvantage);

  return {
    homeGoals: Math.round(homeGoals * 10) / 10,
    awayGoals: Math.round(awayGoals * 10) / 10
  };
}

/**
 * Get K factor based on match importance
 */
export function getKFactor(
  matchImportance: 'friendly' | 'league' | 'cup' | 'final' = 'league',
  homeRating?: number,
  awayRating?: number
): number {
  const baseK: Record<string, number> = {
    friendly: 20,
    league: 32,
    cup: 40,
    final: 60
  };

  let k = baseK[matchImportance] || 32;

  // Reduce K for very high-rated teams (more stable ratings)
  if (homeRating && homeRating > 1800) k *= 0.9;
  if (awayRating && awayRating > 1800) k *= 0.9;

  // Increase K for low-rated teams (more volatile)
  if (homeRating && homeRating < 1300) k *= 1.1;
  if (awayRating && awayRating < 1300) k *= 1.1;

  return k;
}

/**
 * Calculate rating confidence based on number of matches
 */
export function getRatingConfidence(matchesPlayed: number): 'low' | 'medium' | 'high' {
  if (matchesPlayed < 10) return 'low';
  if (matchesPlayed < 30) return 'medium';
  return 'high';
}

/**
 * Main Elo analysis function
 */
export function analyzeEloModel(
  homeTeam: TeamStats,
  awayTeam: TeamStats,
  homeAdvantage: number = HOME_ADVANTAGE
): EloResult {
  const homeRating = homeTeam.eloRating || DEFAULT_RATING;
  const awayRating = awayTeam.eloRating || DEFAULT_RATING;

  const probs = calculateWinProbabilities(homeRating, awayRating, homeAdvantage);
  const expectedScore = estimateScoreFromElo(homeRating, awayRating, homeAdvantage);

  return {
    homeRating,
    awayRating,
    ratingDiff: homeRating - awayRating,
    homeWinProb: probs.homeWin,
    drawProb: probs.draw,
    awayWinProb: probs.awayWin,
    expectedHomeScore: expectedScore.homeGoals,
    expectedAwayScore: expectedScore.awayGoals
  };
}

/**
 * Simulate season to update all team ratings
 */
export function simulateSeason(
  matches: Array<{
    homeTeam: string;
    awayTeam: string;
    homeScore: number;
    awayScore: number;
  }>,
  initialRatings: Map<string, number> = new Map()
): Map<string, number> {
  const ratings = new Map(initialRatings);

  for (const match of matches) {
    const homeRating = ratings.get(match.homeTeam) || DEFAULT_RATING;
    const awayRating = ratings.get(match.awayTeam) || DEFAULT_RATING;

    // Determine result
    let result: number;
    if (match.homeScore > match.awayScore) result = 1;
    else if (match.homeScore === match.awayScore) result = 0.5;
    else result = 0;

    const { newHomeRating, newAwayRating } = updateEloRatings(homeRating, awayRating, result);

    ratings.set(match.homeTeam, newHomeRating);
    ratings.set(match.awayTeam, newAwayRating);
  }

  return ratings;
}

/**
 * Get tier classification based on Elo rating
 */
export function getEloTier(rating: number): string {
  if (rating >= 1900) return 'Elite';
  if (rating >= 1700) return 'Strong';
  if (rating >= 1500) return 'Average';
  if (rating >= 1300) return 'Weak';
  return 'Poor';
}

/**
 * Calculate probability of upset (lower-rated team winning)
 */
export function getUpsetProbability(
  homeRating: number,
  awayRating: number,
  homeAdvantage: number = HOME_ADVANTAGE
): number {
  const adjustedHomeRating = homeRating + homeAdvantage;
  const probs = calculateWinProbabilities(homeRating, awayRating, homeAdvantage);

  if (adjustedHomeRating > awayRating) {
    // Home is favorite, away win is upset
    return probs.awayWin;
  } else {
    // Away is favorite, home win is upset
    return probs.homeWin;
  }
}
