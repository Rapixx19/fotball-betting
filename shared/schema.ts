import { pgTable, serial, varchar, text, timestamp, decimal, integer, index, jsonb, boolean } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// Users table
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: varchar("username", { length: 255 }).unique().notNull(),
  email: varchar("email", { length: 255 }).unique(),
  password: varchar("password", { length: 255 }).notNull(),
  passwordResetToken: varchar("password_reset_token", { length: 255 }),
  passwordResetExpires: timestamp("password_reset_expires"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Matches table
export const matches = pgTable("matches", {
  id: serial("id").primaryKey(),
  externalId: varchar("external_id", { length: 255 }).unique(),
  sport: varchar("sport", { length: 50 }).notNull(),
  league: varchar("league", { length: 100 }),
  homeTeam: varchar("home_team", { length: 255 }).notNull(),
  awayTeam: varchar("away_team", { length: 255 }).notNull(),
  homeOdds: decimal("home_odds", { precision: 6, scale: 3 }),
  awayOdds: decimal("away_odds", { precision: 6, scale: 3 }),
  drawOdds: decimal("draw_odds", { precision: 6, scale: 3 }),
  startsAt: timestamp("starts_at").notNull(),
  status: varchar("status", { length: 20 }).default("upcoming").notNull(),
  homeScore: integer("home_score"),
  awayScore: integer("away_score"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  statusIdx: index("matches_status_idx").on(table.status),
  startsAtIdx: index("matches_starts_at_idx").on(table.startsAt),
  externalIdIdx: index("matches_external_id_idx").on(table.externalId),
}));

// Slips table (parlays)
export const slips = pgTable("slips", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  stake: decimal("stake", { precision: 10, scale: 2 }),
  potentialPayout: decimal("potential_payout", { precision: 10, scale: 2 }),
  status: varchar("status", { length: 20 }).default("pending").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index("slips_user_id_idx").on(table.userId),
  statusIdx: index("slips_status_idx").on(table.status),
  createdAtIdx: index("slips_created_at_idx").on(table.createdAt),
}));

// Legs table (individual bets within a slip)
export const legs = pgTable("legs", {
  id: serial("id").primaryKey(),
  slipId: integer("slip_id").references(() => slips.id, { onDelete: "cascade" }).notNull(),
  matchId: integer("match_id").references(() => matches.id).notNull(),
  pick: varchar("pick", { length: 50 }).notNull(),
  odds: decimal("odds", { precision: 6, scale: 3 }).notNull(),
  status: varchar("status", { length: 20 }).default("pending").notNull(),
}, (table) => ({
  slipIdIdx: index("legs_slip_id_idx").on(table.slipId),
  matchIdIdx: index("legs_match_id_idx").on(table.matchId),
  statusIdx: index("legs_status_idx").on(table.status),
}));

// Chats table
export const chats = pgTable("chats", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  title: varchar("title", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index("chats_user_id_idx").on(table.userId),
  createdAtIdx: index("chats_created_at_idx").on(table.createdAt),
}));

// Messages table
export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  chatId: integer("chat_id").references(() => chats.id, { onDelete: "cascade" }).notNull(),
  role: varchar("role", { length: 20 }).notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  chatIdIdx: index("messages_chat_id_idx").on(table.chatId),
}));

// Team Statistics table (for algorithm inputs)
export const teamStats = pgTable("team_stats", {
  id: serial("id").primaryKey(),
  teamName: varchar("team_name", { length: 255 }).notNull(),
  sport: varchar("sport", { length: 50 }).notNull(),
  eloRating: decimal("elo_rating", { precision: 8, scale: 2 }).default("1500"),
  avgGoalsScored: decimal("avg_goals_scored", { precision: 5, scale: 3 }),
  avgGoalsConceded: decimal("avg_goals_conceded", { precision: 5, scale: 3 }),
  formScore: decimal("form_score", { precision: 5, scale: 2 }),
  recentForm: varchar("recent_form", { length: 20 }), // e.g., "WWDLW"
  homeWinRate: decimal("home_win_rate", { precision: 4, scale: 3 }),
  awayWinRate: decimal("away_win_rate", { precision: 4, scale: 3 }),
  matchesPlayed: integer("matches_played").default(0),
  lastUpdated: timestamp("last_updated").defaultNow().notNull(),
}, (table) => ({
  teamSportIdx: index("team_stats_team_sport_idx").on(table.teamName, table.sport),
}));

// Match Analysis table (pre-computed algorithm results)
export const matchAnalysis = pgTable("match_analysis", {
  id: serial("id").primaryKey(),
  matchId: integer("match_id").references(() => matches.id, { onDelete: "cascade" }).unique().notNull(),
  // Poisson model results
  poissonHome: decimal("poisson_home", { precision: 5, scale: 4 }),
  poissonDraw: decimal("poisson_draw", { precision: 5, scale: 4 }),
  poissonAway: decimal("poisson_away", { precision: 5, scale: 4 }),
  predictedScore: varchar("predicted_score", { length: 10 }),
  // Elo model results
  eloHome: decimal("elo_home", { precision: 5, scale: 4 }),
  eloDraw: decimal("elo_draw", { precision: 5, scale: 4 }),
  eloAway: decimal("elo_away", { precision: 5, scale: 4 }),
  // Consensus probabilities
  consensusHome: decimal("consensus_home", { precision: 5, scale: 4 }),
  consensusDraw: decimal("consensus_draw", { precision: 5, scale: 4 }),
  consensusAway: decimal("consensus_away", { precision: 5, scale: 4 }),
  modelAgreement: decimal("model_agreement", { precision: 3, scale: 2 }),
  confidence: varchar("confidence", { length: 10 }), // low, medium, high
  // Value analysis
  valueHome: decimal("value_home", { precision: 5, scale: 2 }),
  valueDraw: decimal("value_draw", { precision: 5, scale: 2 }),
  valueAway: decimal("value_away", { precision: 5, scale: 2 }),
  bestValueMarket: varchar("best_value_market", { length: 20 }),
  bestValueEdge: decimal("best_value_edge", { precision: 5, scale: 2 }),
  // Over/Under analysis
  over25Prob: decimal("over_25_prob", { precision: 5, scale: 4 }),
  under25Prob: decimal("under_25_prob", { precision: 5, scale: 4 }),
  bttsYesProb: decimal("btts_yes_prob", { precision: 5, scale: 4 }),
  bttsNoProb: decimal("btts_no_prob", { precision: 5, scale: 4 }),
  // AI-generated insights
  insights: jsonb("insights").$type<string[]>(),
  computedAt: timestamp("computed_at").defaultNow().notNull(),
}, (table) => ({
  matchIdIdx: index("match_analysis_match_id_idx").on(table.matchId),
  computedAtIdx: index("match_analysis_computed_at_idx").on(table.computedAt),
}));

// Betting Strategies table (for backtesting)
export const strategies = pgTable("strategies", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  // Strategy criteria (JSON)
  criteria: jsonb("criteria").$type<{
    sports?: string[];
    leagues?: string[];
    minModelProbability?: number;
    maxModelProbability?: number;
    minEdge?: number;
    maxOdds?: number;
    minOdds?: number;
    minModelAgreement?: number;
    markets?: string[];
  }>().notNull(),
  // Staking configuration
  stakeType: varchar("stake_type", { length: 20 }).default("fixed").notNull(), // fixed, kelly, percentage
  stakeAmount: decimal("stake_amount", { precision: 10, scale: 2 }),
  kellyFraction: decimal("kelly_fraction", { precision: 4, scale: 2 }),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index("strategies_user_id_idx").on(table.userId),
}));

// Backtest Results table
export const backtestResults = pgTable("backtest_results", {
  id: serial("id").primaryKey(),
  strategyId: integer("strategy_id").references(() => strategies.id, { onDelete: "cascade" }).notNull(),
  // Date range
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  // Summary statistics
  totalBets: integer("total_bets").notNull(),
  wonBets: integer("won_bets").notNull(),
  lostBets: integer("lost_bets").notNull(),
  pushBets: integer("push_bets").default(0),
  winRate: decimal("win_rate", { precision: 5, scale: 4 }),
  // Financial results
  totalStaked: decimal("total_staked", { precision: 12, scale: 2 }),
  totalReturns: decimal("total_returns", { precision: 12, scale: 2 }),
  profit: decimal("profit", { precision: 12, scale: 2 }),
  roiPercent: decimal("roi_percent", { precision: 6, scale: 3 }),
  // Risk metrics
  maxDrawdown: decimal("max_drawdown", { precision: 6, scale: 3 }),
  sharpeRatio: decimal("sharpe_ratio", { precision: 6, scale: 3 }),
  // Detailed results (JSON)
  bets: jsonb("bets").$type<Array<{
    matchId: number;
    date: string;
    market: string;
    odds: number;
    stake: number;
    result: 'won' | 'lost' | 'push';
    profit: number;
  }>>(),
  monthlyBreakdown: jsonb("monthly_breakdown").$type<Record<string, {
    bets: number;
    profit: number;
    roi: number;
  }>>(),
  computedAt: timestamp("computed_at").defaultNow().notNull(),
}, (table) => ({
  strategyIdIdx: index("backtest_results_strategy_id_idx").on(table.strategyId),
  computedAtIdx: index("backtest_results_computed_at_idx").on(table.computedAt),
}));

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  slips: many(slips),
  chats: many(chats),
  strategies: many(strategies),
}));

export const slipsRelations = relations(slips, ({ one, many }) => ({
  user: one(users, {
    fields: [slips.userId],
    references: [users.id],
  }),
  legs: many(legs),
}));

export const legsRelations = relations(legs, ({ one }) => ({
  slip: one(slips, {
    fields: [legs.slipId],
    references: [slips.id],
  }),
  match: one(matches, {
    fields: [legs.matchId],
    references: [matches.id],
  }),
}));

export const chatsRelations = relations(chats, ({ one, many }) => ({
  user: one(users, {
    fields: [chats.userId],
    references: [users.id],
  }),
  messages: many(messages),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  chat: one(chats, {
    fields: [messages.chatId],
    references: [chats.id],
  }),
}));

export const matchAnalysisRelations = relations(matchAnalysis, ({ one }) => ({
  match: one(matches, {
    fields: [matchAnalysis.matchId],
    references: [matches.id],
  }),
}));

export const matchesRelations = relations(matches, ({ one }) => ({
  analysis: one(matchAnalysis),
}));

export const strategiesRelations = relations(strategies, ({ one, many }) => ({
  user: one(users, {
    fields: [strategies.userId],
    references: [users.id],
  }),
  backtestResults: many(backtestResults),
}));

export const backtestResultsRelations = relations(backtestResults, ({ one }) => ({
  strategy: one(strategies, {
    fields: [backtestResults.strategyId],
    references: [strategies.id],
  }),
}));

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Match = typeof matches.$inferSelect;
export type InsertMatch = typeof matches.$inferInsert;
export type Slip = typeof slips.$inferSelect;
export type InsertSlip = typeof slips.$inferInsert;
export type Leg = typeof legs.$inferSelect;
export type InsertLeg = typeof legs.$inferInsert;
export type Chat = typeof chats.$inferSelect;
export type InsertChat = typeof chats.$inferInsert;
export type Message = typeof messages.$inferSelect;
export type InsertMessage = typeof messages.$inferInsert;
export type TeamStats = typeof teamStats.$inferSelect;
export type InsertTeamStats = typeof teamStats.$inferInsert;
export type MatchAnalysis = typeof matchAnalysis.$inferSelect;
export type InsertMatchAnalysis = typeof matchAnalysis.$inferInsert;
export type Strategy = typeof strategies.$inferSelect;
export type InsertStrategy = typeof strategies.$inferInsert;
export type BacktestResult = typeof backtestResults.$inferSelect;
export type InsertBacktestResult = typeof backtestResults.$inferInsert;
