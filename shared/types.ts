// Re-export Drizzle types
export type {
  User,
  InsertUser,
  Match,
  InsertMatch,
  Slip,
  InsertSlip,
  Leg,
  InsertLeg,
  Chat,
  InsertChat,
  Message,
  InsertMessage,
} from "./schema";

// API Response types
export interface ApiUser {
  id: number;
  username: string;
}

export interface ApiMatch {
  id: number;
  sport: string;
  league: string | null;
  homeTeam: string;
  awayTeam: string;
  homeOdds: string | null;
  awayOdds: string | null;
  drawOdds: string | null;
  startsAt: string;
  status: string;
  homeScore: number | null;
  awayScore: number | null;
}

export interface ApiLeg {
  id: number;
  slipId: number;
  matchId: number;
  pick: string;
  odds: string;
  status: string;
}

export interface ApiSlip {
  id: number;
  userId: number;
  stake: string | null;
  potentialPayout: string | null;
  status: string;
  createdAt: string;
  legs?: ApiLeg[];
}

export interface ApiChat {
  id: number;
  userId: number;
  title: string | null;
  createdAt: string;
}

export interface ApiMessage {
  id: number;
  chatId: number;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

// Analysis types
export interface LegInput {
  odds: number;
  pick: string;
}

export interface ParlayAnalysis {
  combinedOdds: number;
  impliedProbability: number;
  expectedValue: number;
  kellyFraction: number;
  riskRating: "low" | "medium" | "high";
  recommendations: string[];
}

// Pagination types
export interface PaginationParams {
  limit?: number;
  cursor?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  nextCursor: number | null;
  hasMore: boolean;
}

// Parlay builder types (for React context)
export interface ParlayLeg {
  matchId: number;
  pick: string;
  odds: number;
  matchInfo?: {
    homeTeam: string;
    awayTeam: string;
    sport: string;
  };
}
