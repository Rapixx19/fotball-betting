/**
 * Type definitions for the Algorithm Engine
 */

// Team statistics for model inputs
export interface TeamStats {
  teamName: string;
  sport: string;
  eloRating: number;
  avgGoalsScored: number;
  avgGoalsConceded: number;
  formScore: number; // 0-100
  homeWinRate?: number;
  awayWinRate?: number;
  drawRate?: number;
  recentForm?: string; // e.g., "WWDLW"
  xGFor?: number; // Expected goals for
  xGAgainst?: number; // Expected goals against
  matchesPlayed?: number;
}

// Score probability matrix (2D array)
export type ScoreMatrix = number[][];

// Poisson model results
export interface PoissonResult {
  homeXG: number;
  awayXG: number;
  homeWin: number;
  draw: number;
  awayWin: number;
  overUnder: { [key: string]: { over: number; under: number } };
  btts: { yes: number; no: number };
  correctScores: { [key: string]: number };
  predictedScore: string;
  scoreMatrix: ScoreMatrix;
}

// Dixon-Coles model results (extends Poisson with correlation adjustment)
export interface DixonColesResult extends PoissonResult {
  rho: number; // Correlation parameter
  adjustedHomeWin: number;
  adjustedDraw: number;
  adjustedAwayWin: number;
}

// Elo rating model results
export interface EloResult {
  homeRating: number;
  awayRating: number;
  ratingDiff: number;
  homeWinProb: number;
  drawProb: number;
  awayWinProb: number;
  expectedHomeScore: number;
  expectedAwayScore: number;
}

// Monte Carlo simulation results
export interface MonteCarloResult {
  simulations: number;
  homeWin: number;
  draw: number;
  awayWin: number;
  avgHomeGoals: number;
  avgAwayGoals: number;
  overUnder: { [key: string]: { over: number; under: number } };
  btts: { yes: number; no: number };
  goalDistribution: { home: number[]; away: number[] };
  confidenceInterval: {
    homeWin: { low: number; high: number };
    draw: { low: number; high: number };
    awayWin: { low: number; high: number };
  };
}

// Form analysis results
export interface FormResult {
  formScore: number; // 0-100
  trend: 'improving' | 'stable' | 'declining';
  lastFiveResults: string; // "WWDLW"
  pointsPerGame: number;
  goalsPerGame: number;
  cleanSheetRate: number;
  failedToScoreRate: number;
  homeForm?: number;
  awayForm?: number;
}

// Value detection results
export interface ValueResult {
  market: string; // "home", "draw", "away"
  modelProbability: number;
  impliedProbability: number;
  edge: number; // Positive = value bet
  kellyStake: number;
  expectedValue: number;
  confidence: 'low' | 'medium' | 'high';
  recommendation: string;
}

// Correlation analysis for parlays
export interface CorrelationResult {
  isCorrelated: boolean;
  correlationType: 'same_match' | 'same_team' | 'same_league' | 'none';
  correlationFactor: number; // 0-1, higher = more correlated
  adjustedProbability: number;
  warning?: string;
  recommendation?: string;
}

// Parlay leg for correlation analysis
export interface ParlayLeg {
  matchId: number;
  homeTeam: string;
  awayTeam: string;
  league?: string;
  sport: string;
  pick: string; // "home", "away", "draw", "over_2.5", etc.
  odds: number;
  modelProbability?: number;
}

// Full match analysis combining all models
export interface MatchAnalysis {
  matchId: number;
  homeTeam: string;
  awayTeam: string;

  // Model outputs
  poisson: PoissonResult;
  dixonColes?: DixonColesResult;
  elo: EloResult;
  monteCarlo?: MonteCarloResult;
  homeForm?: FormResult;
  awayForm?: FormResult;

  // Consensus
  consensus: {
    homeWin: number;
    draw: number;
    awayWin: number;
    modelAgreement: number; // 0-1, how much models agree
    confidence: 'low' | 'medium' | 'high';
  };

  // Value analysis
  value: {
    home: ValueResult;
    draw: ValueResult;
    away: ValueResult;
    bestValue?: ValueResult;
  };

  // AI-generated insights
  insights: string[];

  // Computed timestamp
  computedAt: Date;
}

// Strategy criteria for backtesting
export interface StrategyCriteria {
  sports?: string[];
  leagues?: string[];
  minModelProbability?: number;
  maxModelProbability?: number;
  minEdge?: number;
  maxOdds?: number;
  minOdds?: number;
  minModelAgreement?: number;
  markets?: string[]; // "home", "away", "draw", "over_2.5", etc.
  formFilter?: {
    minFormScore?: number;
    trend?: 'improving' | 'stable' | 'declining';
  };
  eloFilter?: {
    minRatingDiff?: number;
    maxRatingDiff?: number;
  };
}

// Stake calculation methods
export type StakeType = 'fixed' | 'kelly' | 'percentage';

// Strategy definition
export interface Strategy {
  id?: number;
  userId: number;
  name: string;
  criteria: StrategyCriteria;
  stakeType: StakeType;
  stakeAmount?: number; // For fixed stake
  kellyFraction?: number; // For Kelly (0.25 = quarter Kelly)
  percentageFraction?: number; // For percentage staking
  createdAt?: Date;
}

// Backtest result for a single bet
export interface BacktestBet {
  matchId: number;
  date: Date;
  market: string;
  odds: number;
  modelProbability: number;
  edge: number;
  stake: number;
  result: 'won' | 'lost' | 'push';
  profit: number;
  runningTotal: number;
}

// Full backtest results
export interface BacktestResult {
  strategyId: number;
  startDate: Date;
  endDate: Date;
  totalBets: number;
  wonBets: number;
  lostBets: number;
  pushBets: number;
  winRate: number;
  totalStaked: number;
  totalReturns: number;
  profit: number;
  roi: number;
  maxDrawdown: number;
  sharpeRatio: number;
  confidenceInterval: { low: number; high: number };
  bets: BacktestBet[];
  monthlyBreakdown?: { [month: string]: { bets: number; profit: number; roi: number } };
}

// Market odds
export interface MarketOdds {
  home: number;
  draw?: number;
  away: number;
  overUnder?: { [key: string]: { over: number; under: number } };
  btts?: { yes: number; no: number };
}
