/**
 * xG (Expected Goals) Monte Carlo Simulation
 *
 * Uses Monte Carlo simulation with xG data to estimate match outcomes.
 * Runs thousands of simulations to generate probability distributions.
 */

import { TeamStats, MonteCarloResult, ScoreMatrix } from './types';

// Default simulation parameters
const DEFAULT_SIMULATIONS = 10000;
const MAX_GOALS_PER_TEAM = 8;

/**
 * Generate a random number from Poisson distribution
 * Using the inverse transform method
 */
function poissonRandom(lambda: number): number {
  if (lambda <= 0) return 0;

  const L = Math.exp(-lambda);
  let k = 0;
  let p = 1;

  do {
    k++;
    p *= Math.random();
  } while (p > L);

  return k - 1;
}

/**
 * Calculate xG for a team based on their stats
 */
export function calculateXG(
  team: TeamStats,
  isHome: boolean,
  opponent: TeamStats
): number {
  // Use xG if available, otherwise estimate from goals scored
  let xg = team.xGFor ?? team.avgGoalsScored;

  // Adjust for opponent defensive quality
  const opponentDefense = opponent.xGAgainst ?? opponent.avgGoalsConceded;
  const avgConceded = 1.35; // League average
  const defenseMultiplier = opponentDefense / avgConceded;

  xg *= defenseMultiplier;

  // Home advantage adjustment
  if (isHome) {
    xg *= 1.12; // ~12% boost for home team
  } else {
    xg *= 0.92; // ~8% reduction for away team
  }

  // Form adjustment
  if (team.formScore !== undefined) {
    const formMultiplier = 0.85 + (team.formScore / 100) * 0.3;
    xg *= formMultiplier;
  }

  return Math.max(0.1, xg);
}

/**
 * Run a single match simulation
 */
function simulateMatch(
  homeXG: number,
  awayXG: number,
  variance: number = 0.2
): { homeGoals: number; awayGoals: number } {
  // Add some variance to xG for this simulation
  const homeXGVaried = Math.max(0.1, homeXG * (1 + (Math.random() - 0.5) * variance));
  const awayXGVaried = Math.max(0.1, awayXG * (1 + (Math.random() - 0.5) * variance));

  return {
    homeGoals: poissonRandom(homeXGVaried),
    awayGoals: poissonRandom(awayXGVaried)
  };
}

/**
 * Run Monte Carlo simulation
 */
export function runMonteCarloSimulation(
  homeTeam: TeamStats,
  awayTeam: TeamStats,
  simulations: number = DEFAULT_SIMULATIONS
): MonteCarloResult {
  const homeXG = calculateXG(homeTeam, true, awayTeam);
  const awayXG = calculateXG(awayTeam, false, homeTeam);

  // Track results
  let homeWins = 0;
  let draws = 0;
  let awayWins = 0;
  let totalHomeGoals = 0;
  let totalAwayGoals = 0;

  // Goal distributions
  const homeGoalDist: number[] = new Array(MAX_GOALS_PER_TEAM + 1).fill(0);
  const awayGoalDist: number[] = new Array(MAX_GOALS_PER_TEAM + 1).fill(0);

  // Over/Under tracking
  const overUnderThresholds = [0.5, 1.5, 2.5, 3.5, 4.5];
  const overCounts: { [key: string]: number } = {};
  overUnderThresholds.forEach(t => { overCounts[t.toString()] = 0; });

  // BTTS tracking
  let bttsYes = 0;

  // Run simulations
  for (let i = 0; i < simulations; i++) {
    const { homeGoals, awayGoals } = simulateMatch(homeXG, awayXG);

    // Track results
    if (homeGoals > awayGoals) homeWins++;
    else if (homeGoals === awayGoals) draws++;
    else awayWins++;

    totalHomeGoals += homeGoals;
    totalAwayGoals += awayGoals;

    // Goal distribution
    const cappedHomeGoals = Math.min(homeGoals, MAX_GOALS_PER_TEAM);
    const cappedAwayGoals = Math.min(awayGoals, MAX_GOALS_PER_TEAM);
    homeGoalDist[cappedHomeGoals]++;
    awayGoalDist[cappedAwayGoals]++;

    // Over/Under
    const totalGoals = homeGoals + awayGoals;
    overUnderThresholds.forEach(t => {
      if (totalGoals > t) overCounts[t.toString()]++;
    });

    // BTTS
    if (homeGoals > 0 && awayGoals > 0) bttsYes++;
  }

  // Calculate probabilities
  const homeWinProb = homeWins / simulations;
  const drawProb = draws / simulations;
  const awayWinProb = awayWins / simulations;

  // Calculate over/under probabilities
  const overUnder: { [key: string]: { over: number; under: number } } = {};
  overUnderThresholds.forEach(t => {
    const overProb = overCounts[t.toString()] / simulations;
    overUnder[t.toString()] = {
      over: overProb,
      under: 1 - overProb
    };
  });

  // Calculate confidence intervals using normal approximation
  const ci = calculateConfidenceInterval(simulations, homeWins, draws, awayWins);

  return {
    simulations,
    homeWin: homeWinProb,
    draw: drawProb,
    awayWin: awayWinProb,
    avgHomeGoals: totalHomeGoals / simulations,
    avgAwayGoals: totalAwayGoals / simulations,
    overUnder,
    btts: {
      yes: bttsYes / simulations,
      no: (simulations - bttsYes) / simulations
    },
    goalDistribution: {
      home: homeGoalDist.map(c => c / simulations),
      away: awayGoalDist.map(c => c / simulations)
    },
    confidenceInterval: ci
  };
}

/**
 * Calculate 95% confidence intervals for probabilities
 */
function calculateConfidenceInterval(
  n: number,
  homeWins: number,
  draws: number,
  awayWins: number
): {
  homeWin: { low: number; high: number };
  draw: { low: number; high: number };
  awayWin: { low: number; high: number };
} {
  const z = 1.96; // 95% confidence

  const calcCI = (successes: number): { low: number; high: number } => {
    const p = successes / n;
    const se = Math.sqrt(p * (1 - p) / n);
    return {
      low: Math.max(0, p - z * se),
      high: Math.min(1, p + z * se)
    };
  };

  return {
    homeWin: calcCI(homeWins),
    draw: calcCI(draws),
    awayWin: calcCI(awayWins)
  };
}

/**
 * Generate score probability matrix from Monte Carlo results
 */
export function generateScoreMatrixFromMC(
  homeTeam: TeamStats,
  awayTeam: TeamStats,
  simulations: number = DEFAULT_SIMULATIONS
): ScoreMatrix {
  const homeXG = calculateXG(homeTeam, true, awayTeam);
  const awayXG = calculateXG(awayTeam, false, homeTeam);

  const maxGoals = 6;
  const matrix: number[][] = [];

  // Initialize matrix
  for (let h = 0; h <= maxGoals; h++) {
    matrix[h] = new Array(maxGoals + 1).fill(0);
  }

  // Run simulations
  for (let i = 0; i < simulations; i++) {
    const { homeGoals, awayGoals } = simulateMatch(homeXG, awayXG);
    const cappedHome = Math.min(homeGoals, maxGoals);
    const cappedAway = Math.min(awayGoals, maxGoals);
    matrix[cappedHome][cappedAway]++;
  }

  // Convert to probabilities
  for (let h = 0; h <= maxGoals; h++) {
    for (let a = 0; a <= maxGoals; a++) {
      matrix[h][a] /= simulations;
    }
  }

  return matrix;
}

/**
 * Calculate implied xG from market odds
 */
export function calculateImpliedXGFromOdds(
  homeOdds: number,
  drawOdds: number,
  awayOdds: number
): { homeXG: number; awayXG: number } {
  // Convert odds to probabilities (removing vig)
  const totalProb = 1 / homeOdds + 1 / drawOdds + 1 / awayOdds;
  const homeProb = (1 / homeOdds) / totalProb;
  // drawProb = (1 / drawOdds) / totalProb - included in totalProb for normalization
  const awayProb = (1 / awayOdds) / totalProb;

  // Estimate xG based on win probabilities
  // This is a simplified inverse calculation
  // Higher win probability = higher xG
  const baseXG = 1.35;

  // Approximate xG from win probability
  // Using empirical relationship
  const homeXG = baseXG * (1 + Math.log(homeProb / 0.45) * 0.5);
  const awayXG = baseXG * (1 + Math.log(awayProb / 0.30) * 0.5);

  return {
    homeXG: Math.max(0.5, Math.min(4, homeXG)),
    awayXG: Math.max(0.5, Math.min(4, awayXG))
  };
}

/**
 * Quick simulation for live match predictions
 */
export function quickSimulation(
  homeXG: number,
  awayXG: number,
  currentHomeGoals: number = 0,
  currentAwayGoals: number = 0,
  minutesPlayed: number = 0,
  totalMinutes: number = 90
): MonteCarloResult {
  const remainingMinutes = totalMinutes - minutesPlayed;
  const fraction = remainingMinutes / totalMinutes;

  // Adjust xG for remaining time
  const remainingHomeXG = homeXG * fraction;
  const remainingAwayXG = awayXG * fraction;

  // Create temporary team stats
  const homeTeam: TeamStats = {
    teamName: 'Home',
    sport: 'soccer',
    eloRating: 1500,
    avgGoalsScored: remainingHomeXG,
    avgGoalsConceded: 1,
    formScore: 50,
    xGFor: remainingHomeXG
  };

  const awayTeam: TeamStats = {
    teamName: 'Away',
    sport: 'soccer',
    eloRating: 1500,
    avgGoalsScored: remainingAwayXG,
    avgGoalsConceded: 1,
    formScore: 50,
    xGFor: remainingAwayXG
  };

  const result = runMonteCarloSimulation(homeTeam, awayTeam, 5000);

  // Adjust for current score
  result.avgHomeGoals += currentHomeGoals;
  result.avgAwayGoals += currentAwayGoals;

  return result;
}
