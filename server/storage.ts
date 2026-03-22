import { db } from "./db";
import { users, matches, slips, legs, chats, messages } from "@shared/schema";
import type { InsertMatch, InsertSlip, InsertLeg, InsertChat, InsertMessage } from "@shared/schema";
import { eq, desc, lt, and } from "drizzle-orm";
import { hashPassword } from "./auth";
import crypto from "crypto";

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
