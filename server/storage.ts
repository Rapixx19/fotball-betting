import { db } from "./db";
import { users, matches, slips, legs, chats, messages, teamStats, matchAnalysis, strategies, backtestResults } from "@shared/schema";
import type { InsertMatch, InsertSlip, InsertLeg, InsertChat, InsertMessage, InsertTeamStats, InsertMatchAnalysis, InsertStrategy, InsertBacktestResult } from "@shared/schema";
import { eq, desc, lt, and, sql, gte, lte } from "drizzle-orm";
import { hashPassword } from "./auth";
import crypto from "crypto";
import type { TeamStats as AlgoTeamStats, MatchAnalysis as AlgoMatchAnalysis } from "./algorithms/types";

// User operations
export async function createUser(data: { username: string; password: string }) {
  const hashedPassword = await hashPassword(data.password);
  const [user] = await db
    .insert(users)
    .values({ username: data.username, password: hashedPassword })
    .returning();
  return user;
}

export async function getUserByUsername(username: string) {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.username, username))
    .limit(1);
  return user;
}

export async function getUserById(id: number) {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, id))
    .limit(1);
  return user;
}

export async function getUserByEmail(email: string) {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  return user;
}

export async function getUserByResetToken(token: string) {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.passwordResetToken, token))
    .limit(1);
  return user;
}

export async function setPasswordResetToken(userId: number) {
  const token = crypto.randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + 3600000); // 1 hour from now

  await db
    .update(users)
    .set({ passwordResetToken: token, passwordResetExpires: expires })
    .where(eq(users.id, userId));

  return token;
}

export async function resetPassword(userId: number, newPassword: string) {
  const hashedPassword = await hashPassword(newPassword);
  await db
    .update(users)
    .set({
      password: hashedPassword,
      passwordResetToken: null,
      passwordResetExpires: null,
    })
    .where(eq(users.id, userId));
}

export async function updateUserEmail(userId: number, email: string) {
  await db
    .update(users)
    .set({ email })
    .where(eq(users.id, userId));
}

// Match operations
export async function getMatches(status?: string) {
  if (status) {
    return db.select().from(matches).where(eq(matches.status, status)).orderBy(matches.startsAt);
  }
  return db.select().from(matches).orderBy(matches.startsAt);
}

// Enhanced match queries with filtering
export async function getMatchesFiltered(options: {
  status?: string;
  sport?: string;
  league?: string;
  fromDate?: Date;
  toDate?: Date;
  limit?: number;
  offset?: number;
}) {
  const conditions = [];

  if (options.status) {
    conditions.push(eq(matches.status, options.status));
  }
  if (options.sport) {
    conditions.push(eq(matches.sport, options.sport));
  }
  if (options.league) {
    conditions.push(eq(matches.league, options.league));
  }

  let query = db.select().from(matches);

  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as typeof query;
  }

  query = query.orderBy(matches.startsAt) as typeof query;

  if (options.limit) {
    query = query.limit(options.limit) as typeof query;
  }
  if (options.offset) {
    query = query.offset(options.offset) as typeof query;
  }

  return query;
}

// Get matches grouped by sport/league
export async function getMatchesBySport() {
  const allMatches = await db
    .select()
    .from(matches)
    .where(eq(matches.status, "upcoming"))
    .orderBy(matches.startsAt);

  // Group by sport
  const grouped: Record<string, typeof allMatches> = {};
  for (const match of allMatches) {
    const key = match.sport;
    if (!grouped[key]) {
      grouped[key] = [];
    }
    grouped[key].push(match);
  }

  return grouped;
}

// Get upcoming matches for next N hours
export async function getUpcomingMatches(hoursAhead = 24) {
  const now = new Date();
  const future = new Date(now.getTime() + hoursAhead * 60 * 60 * 1000);

  // Use raw SQL for date comparison
  const result = await db.execute(
    sql`SELECT * FROM matches
        WHERE status = 'upcoming'
        AND starts_at >= ${now.toISOString()}
        AND starts_at <= ${future.toISOString()}
        ORDER BY starts_at ASC`
  );

  return result.rows;
}

// Get available sports from cached matches
export async function getAvailableSports() {
  const result = await db.execute(
    sql`SELECT DISTINCT sport, league, COUNT(*) as match_count
        FROM matches
        WHERE status = 'upcoming'
        GROUP BY sport, league
        ORDER BY match_count DESC`
  );
  return result.rows;
}

// Get match statistics
export async function getMatchStats() {
  const result = await db.execute(
    sql`SELECT
          status,
          COUNT(*) as count,
          MIN(starts_at) as earliest,
          MAX(starts_at) as latest
        FROM matches
        GROUP BY status`
  );
  return result.rows;
}

export async function getMatchById(id: number) {
  const [match] = await db
    .select()
    .from(matches)
    .where(eq(matches.id, id))
    .limit(1);
  return match;
}

export async function createMatch(data: InsertMatch) {
  const [match] = await db.insert(matches).values(data).returning();
  return match;
}

export async function updateMatch(id: number, data: Partial<InsertMatch>) {
  const [match] = await db
    .update(matches)
    .set(data)
    .where(eq(matches.id, id))
    .returning();
  return match;
}

// Slip operations
export async function getSlipsByUser(
  userId: number,
  options?: { limit?: number; cursor?: number }
) {
  const limit = options?.limit || 20;
  const cursor = options?.cursor;

  const query = cursor
    ? db
        .select()
        .from(slips)
        .where(and(eq(slips.userId, userId), lt(slips.id, cursor)))
        .orderBy(desc(slips.id))
        .limit(limit + 1)
    : db
        .select()
        .from(slips)
        .where(eq(slips.userId, userId))
        .orderBy(desc(slips.id))
        .limit(limit + 1);

  const results = await query;
  const hasMore = results.length > limit;
  const data = hasMore ? results.slice(0, -1) : results;
  const nextCursor = hasMore && data.length > 0 ? data[data.length - 1].id : null;

  return { data, nextCursor, hasMore };
}

export async function getSlipById(id: number) {
  const [slip] = await db
    .select()
    .from(slips)
    .where(eq(slips.id, id))
    .limit(1);
  return slip;
}

export async function getSlipWithLegs(id: number) {
  const slip = await getSlipById(id);
  if (!slip) return null;

  const slipLegs = await db
    .select()
    .from(legs)
    .where(eq(legs.slipId, id));

  return { ...slip, legs: slipLegs };
}

export async function createSlip(data: InsertSlip) {
  const [slip] = await db.insert(slips).values(data).returning();
  return slip;
}

// Optimized version that creates slip and legs in one operation and returns full slip
export async function createSlipWithLegs(
  slipData: InsertSlip,
  legsData: Omit<InsertLeg, "slipId">[]
) {
  const [slip] = await db.insert(slips).values(slipData).returning();

  const legsWithSlipId = legsData.map((leg) => ({
    ...leg,
    slipId: slip.id,
  }));

  const insertedLegs = await db.insert(legs).values(legsWithSlipId).returning();

  return { ...slip, legs: insertedLegs };
}

export async function deleteSlip(id: number) {
  await db.delete(slips).where(eq(slips.id, id));
}

// Leg operations
export async function createLeg(data: InsertLeg) {
  const [leg] = await db.insert(legs).values(data).returning();
  return leg;
}

export async function createLegs(data: InsertLeg[]) {
  return db.insert(legs).values(data).returning();
}

export async function getLegsBySlip(slipId: number) {
  return db.select().from(legs).where(eq(legs.slipId, slipId));
}

// Chat operations
export async function getChatsByUser(
  userId: number,
  options?: { limit?: number; cursor?: number }
) {
  const limit = options?.limit || 20;
  const cursor = options?.cursor;

  const query = cursor
    ? db
        .select()
        .from(chats)
        .where(and(eq(chats.userId, userId), lt(chats.id, cursor)))
        .orderBy(desc(chats.id))
        .limit(limit + 1)
    : db
        .select()
        .from(chats)
        .where(eq(chats.userId, userId))
        .orderBy(desc(chats.id))
        .limit(limit + 1);

  const results = await query;
  const hasMore = results.length > limit;
  const data = hasMore ? results.slice(0, -1) : results;
  const nextCursor = hasMore && data.length > 0 ? data[data.length - 1].id : null;

  return { data, nextCursor, hasMore };
}

export async function getChatById(id: number) {
  const [chat] = await db
    .select()
    .from(chats)
    .where(eq(chats.id, id))
    .limit(1);
  return chat;
}

export async function createChat(data: InsertChat) {
  const [chat] = await db.insert(chats).values(data).returning();
  return chat;
}

export async function deleteChat(id: number) {
  await db.delete(chats).where(eq(chats.id, id));
}

// Message operations
export async function getMessagesByChat(chatId: number) {
  return db
    .select()
    .from(messages)
    .where(eq(messages.chatId, chatId))
    .orderBy(messages.createdAt);
}

export async function createMessage(data: InsertMessage) {
  const [message] = await db.insert(messages).values(data).returning();
  return message;
}

// Slip settlement operations
export async function getPendingSlipsByMatch(matchId: number) {
  return db
    .select({
      slipId: legs.slipId,
      legId: legs.id,
      pick: legs.pick,
    })
    .from(legs)
    .where(and(eq(legs.matchId, matchId), eq(legs.status, "pending")));
}

export async function updateLegStatus(legId: number, status: "won" | "lost" | "push") {
  await db.update(legs).set({ status }).where(eq(legs.id, legId));
}

export async function updateSlipStatus(slipId: number, status: "won" | "lost" | "push") {
  await db.update(slips).set({ status }).where(eq(slips.id, slipId));
}

export async function getSlipLegsStatus(slipId: number) {
  const slipLegs = await db
    .select({ status: legs.status })
    .from(legs)
    .where(eq(legs.slipId, slipId));

  return slipLegs.map((l) => l.status);
}

// Settle a match and update all related slips
export async function settleMatch(
  matchId: number,
  homeScore: number,
  awayScore: number
) {
  // Update match with final scores and status
  await db
    .update(matches)
    .set({ homeScore, awayScore, status: "final" })
    .where(eq(matches.id, matchId));

  // Get all pending legs for this match
  const pendingLegs = await getPendingSlipsByMatch(matchId);

  // Determine outcome for each leg
  for (const leg of pendingLegs) {
    let legStatus: "won" | "lost" | "push";

    if (leg.pick === "home") {
      legStatus = homeScore > awayScore ? "won" : homeScore < awayScore ? "lost" : "push";
    } else if (leg.pick === "away") {
      legStatus = awayScore > homeScore ? "won" : awayScore < homeScore ? "lost" : "push";
    } else if (leg.pick === "draw") {
      legStatus = homeScore === awayScore ? "won" : "lost";
    } else {
      // Unknown pick type, mark as lost
      legStatus = "lost";
    }

    await updateLegStatus(leg.legId, legStatus);
  }

  // Now update slip statuses based on their legs
  const affectedSlipIds = [...new Set(pendingLegs.map((l) => l.slipId))];

  for (const slipId of affectedSlipIds) {
    const legStatuses = await getSlipLegsStatus(slipId);

    // All legs must be settled to determine slip outcome
    const allSettled = legStatuses.every((s) => s !== "pending");
    if (!allSettled) continue;

    // If any leg lost, slip lost
    if (legStatuses.includes("lost")) {
      await updateSlipStatus(slipId, "lost");
    }
    // If all legs won (accounting for pushes), slip won
    else if (legStatuses.every((s) => s === "won" || s === "push")) {
      // If all are push, slip is push; otherwise won
      if (legStatuses.every((s) => s === "push")) {
        await updateSlipStatus(slipId, "push");
      } else {
        await updateSlipStatus(slipId, "won");
      }
    }
  }

  return affectedSlipIds.length;
}

export async function deleteMatch(id: number) {
  await db.delete(matches).where(eq(matches.id, id));
}

// External match operations (for Odds API sync)
export async function getMatchByExternalId(externalId: string) {
  const [match] = await db
    .select()
    .from(matches)
    .where(eq(matches.externalId, externalId))
    .limit(1);
  return match;
}

export async function upsertMatchByExternalId(data: InsertMatch & { externalId: string }) {
  const existing = await getMatchByExternalId(data.externalId);

  if (existing) {
    // Only update if match is still upcoming (don't overwrite live/final matches)
    if (existing.status === "upcoming") {
      const [updated] = await db
        .update(matches)
        .set({
          homeOdds: data.homeOdds,
          awayOdds: data.awayOdds,
          drawOdds: data.drawOdds,
          startsAt: data.startsAt,
        })
        .where(eq(matches.externalId, data.externalId))
        .returning();
      return { match: updated, created: false };
    }
    return { match: existing, created: false };
  }

  const [created] = await db.insert(matches).values(data).returning();
  return { match: created, created: true };
}

export async function syncMatchesFromExternal(
  matchesData: (InsertMatch & { externalId: string })[]
) {
  const results = { created: 0, updated: 0, skipped: 0 };

  for (const matchData of matchesData) {
    const { created } = await upsertMatchByExternalId(matchData);
    if (created) {
      results.created++;
    } else {
      results.updated++;
    }
  }

  return results;
}

// ============================================
// TEAM STATS OPERATIONS
// ============================================

export async function getTeamStats(teamName: string, sport: string): Promise<AlgoTeamStats | null> {
  const [result] = await db
    .select()
    .from(teamStats)
    .where(and(eq(teamStats.teamName, teamName), eq(teamStats.sport, sport)))
    .limit(1);

  if (!result) return null;

  return {
    teamName: result.teamName,
    sport: result.sport,
    eloRating: parseFloat(result.eloRating || "1500"),
    avgGoalsScored: parseFloat(result.avgGoalsScored || "1.35"),
    avgGoalsConceded: parseFloat(result.avgGoalsConceded || "1.35"),
    formScore: parseFloat(result.formScore || "50"),
    recentForm: result.recentForm || "DDDDD",
    homeWinRate: result.homeWinRate ? parseFloat(result.homeWinRate) : undefined,
    awayWinRate: result.awayWinRate ? parseFloat(result.awayWinRate) : undefined,
    matchesPlayed: result.matchesPlayed || 0
  };
}

export async function upsertTeamStats(data: InsertTeamStats) {
  const existing = await db
    .select()
    .from(teamStats)
    .where(and(eq(teamStats.teamName, data.teamName), eq(teamStats.sport, data.sport)))
    .limit(1);

  if (existing.length > 0) {
    const [updated] = await db
      .update(teamStats)
      .set({ ...data, lastUpdated: new Date() })
      .where(and(eq(teamStats.teamName, data.teamName), eq(teamStats.sport, data.sport)))
      .returning();
    return updated;
  }

  const [created] = await db.insert(teamStats).values(data).returning();
  return created;
}

export async function getAllTeamStats(sport?: string) {
  if (sport) {
    return db.select().from(teamStats).where(eq(teamStats.sport, sport));
  }
  return db.select().from(teamStats);
}

// ============================================
// MATCH ANALYSIS OPERATIONS
// ============================================

export async function getMatchAnalysis(matchId: number) {
  const [result] = await db
    .select()
    .from(matchAnalysis)
    .where(eq(matchAnalysis.matchId, matchId))
    .limit(1);

  return result;
}

export async function saveMatchAnalysis(matchId: number, analysis: AlgoMatchAnalysis) {
  const data: InsertMatchAnalysis = {
    matchId,
    // Poisson model
    poissonHome: analysis.poisson?.homeWin?.toFixed(4),
    poissonDraw: analysis.poisson?.draw?.toFixed(4),
    poissonAway: analysis.poisson?.awayWin?.toFixed(4),
    predictedScore: analysis.poisson?.predictedScore,
    // Elo model
    eloHome: analysis.elo?.homeWinProb?.toFixed(4),
    eloDraw: analysis.elo?.drawProb?.toFixed(4),
    eloAway: analysis.elo?.awayWinProb?.toFixed(4),
    // Consensus
    consensusHome: analysis.consensus?.homeWin?.toFixed(4),
    consensusDraw: analysis.consensus?.draw?.toFixed(4),
    consensusAway: analysis.consensus?.awayWin?.toFixed(4),
    modelAgreement: analysis.consensus?.modelAgreement?.toFixed(2),
    confidence: analysis.consensus?.confidence,
    // Value
    valueHome: analysis.value?.home?.edge?.toFixed(2),
    valueDraw: analysis.value?.draw?.edge?.toFixed(2),
    valueAway: analysis.value?.away?.edge?.toFixed(2),
    bestValueMarket: analysis.value?.bestValue?.market,
    bestValueEdge: analysis.value?.bestValue?.edge?.toFixed(2),
    // Over/Under
    over25Prob: analysis.poisson?.overUnder?.["2.5"]?.over?.toFixed(4),
    under25Prob: analysis.poisson?.overUnder?.["2.5"]?.under?.toFixed(4),
    bttsYesProb: analysis.poisson?.btts?.yes?.toFixed(4),
    bttsNoProb: analysis.poisson?.btts?.no?.toFixed(4),
    // Insights
    insights: analysis.insights,
  };

  // Try to update existing or insert new
  const existing = await getMatchAnalysis(matchId);

  if (existing) {
    const [updated] = await db
      .update(matchAnalysis)
      .set({ ...data, computedAt: new Date() })
      .where(eq(matchAnalysis.matchId, matchId))
      .returning();
    return updated;
  }

  const [created] = await db.insert(matchAnalysis).values(data).returning();
  return created;
}

export async function deleteOldAnalysis(daysOld: number = 7) {
  const cutoff = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);
  const result = await db
    .delete(matchAnalysis)
    .where(lt(matchAnalysis.computedAt, cutoff));
  return result;
}

// ============================================
// STRATEGY OPERATIONS
// ============================================

export async function getStrategiesByUser(userId: number) {
  return db
    .select()
    .from(strategies)
    .where(eq(strategies.userId, userId))
    .orderBy(desc(strategies.createdAt));
}

export async function getStrategyById(id: number) {
  const [result] = await db
    .select()
    .from(strategies)
    .where(eq(strategies.id, id))
    .limit(1);
  return result;
}

export async function createStrategy(data: InsertStrategy) {
  const [strategy] = await db.insert(strategies).values(data).returning();
  return strategy;
}

export async function updateStrategy(id: number, data: Partial<InsertStrategy>) {
  const [updated] = await db
    .update(strategies)
    .set(data)
    .where(eq(strategies.id, id))
    .returning();
  return updated;
}

export async function deleteStrategy(id: number) {
  await db.delete(strategies).where(eq(strategies.id, id));
}

// ============================================
// BACKTEST RESULTS OPERATIONS
// ============================================

export async function getBacktestResultsByStrategy(strategyId: number) {
  return db
    .select()
    .from(backtestResults)
    .where(eq(backtestResults.strategyId, strategyId))
    .orderBy(desc(backtestResults.computedAt));
}

export async function saveBacktestResult(data: InsertBacktestResult) {
  const [result] = await db.insert(backtestResults).values(data).returning();
  return result;
}

export async function deleteBacktestResultsForStrategy(strategyId: number) {
  await db.delete(backtestResults).where(eq(backtestResults.strategyId, strategyId));
}

// ============================================
// HISTORICAL DATA FOR BACKTESTING
// ============================================

export async function getSettledMatchesInRange(startDate: Date, endDate: Date) {
  return db
    .select()
    .from(matches)
    .where(
      and(
        eq(matches.status, "final"),
        gte(matches.startsAt, startDate),
        lte(matches.startsAt, endDate)
      )
    )
    .orderBy(matches.startsAt);
}
