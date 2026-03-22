import { pgTable, serial, varchar, text, timestamp, decimal, integer, index } from "drizzle-orm/pg-core";
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

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  slips: many(slips),
  chats: many(chats),
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
