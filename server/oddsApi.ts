/**
 * The Odds API Integration
 * https://the-odds-api.com/liveapi/guides/v4/
 */

const API_BASE = "https://api.the-odds-api.com/v4";

// Supported sports keys
export const SUPPORTED_SPORTS = [
  "americanfootball_nfl",
  "americanfootball_ncaaf",
  "basketball_nba",
  "basketball_ncaab",
  "baseball_mlb",
  "icehockey_nhl",
  "soccer_usa_mls",
  "soccer_epl",
  "soccer_germany_bundesliga",
  "soccer_spain_la_liga",
  "soccer_italy_serie_a",
  "soccer_france_ligue_one",
  "soccer_uefa_champs_league",
  "mma_mixed_martial_arts",
  "boxing_boxing",
] as const;

export type SportKey = (typeof SUPPORTED_SPORTS)[number];

// API Response Types
export interface OddsSport {
  key: string;
  group: string;
  title: string;
  description: string;
  active: boolean;
  has_outrights: boolean;
}

export interface OddsEvent {
  id: string;
  sport_key: string;
  sport_title: string;
  commence_time: string;
  home_team: string;
  away_team: string;
}

export interface OddsOutcome {
  name: string;
  price: number;
  point?: number;
}

export interface OddsMarket {
  key: string;
  last_update: string;
  outcomes: OddsOutcome[];
}

export interface OddsBookmaker {
  key: string;
  title: string;
  last_update: string;
  markets: OddsMarket[];
}

export interface OddsEventWithOdds extends OddsEvent {
  bookmakers: OddsBookmaker[];
}

export interface OddsScore {
  id: string;
  sport_key: string;
  sport_title: string;
  commence_time: string;
  completed: boolean;
  home_team: string;
  away_team: string;
  scores: { name: string; score: string }[] | null;
  last_update: string | null;
}

export interface ApiQuota {
  remaining: number;
  used: number;
  lastRequestCost: number;
}

// Track API quota from response headers
let lastQuota: ApiQuota | null = null;

export function getLastQuota(): ApiQuota | null {
  return lastQuota;
}

function getApiKey(): string {
  const key = process.env.ODDS_API_KEY;
  if (!key) {
    throw new Error("ODDS_API_KEY environment variable is not set");
  }
  return key;
}

async function fetchApi<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${API_BASE}${endpoint}`);
  url.searchParams.set("apiKey", getApiKey());

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url.toString());

  // Update quota tracking from headers
  lastQuota = {
    remaining: parseInt(response.headers.get("x-requests-remaining") || "0"),
    used: parseInt(response.headers.get("x-requests-used") || "0"),
    lastRequestCost: parseInt(response.headers.get("x-requests-last") || "0"),
  };

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Odds API error (${response.status}): ${errorText}`);
  }

  return response.json();
}

/**
 * Get list of available sports (free endpoint - no quota cost)
 */
export async function getSports(includeInactive = false): Promise<OddsSport[]> {
  const params: Record<string, string> = {};
  if (includeInactive) {
    params.all = "true";
  }
  return fetchApi<OddsSport[]>("/sports", params);
}

/**
 * Get events for a sport (free endpoint - no quota cost)
 */
export async function getEvents(sportKey: string): Promise<OddsEvent[]> {
  return fetchApi<OddsEvent[]>(`/sports/${sportKey}/events`);
}

/**
 * Get odds for a sport
 * Quota cost: regions × markets (e.g., 1 region × 1 market = 1 credit)
 */
export async function getOdds(
  sportKey: string,
  options: {
    regions?: string;
    markets?: string;
    oddsFormat?: "decimal" | "american";
    bookmakers?: string;
  } = {}
): Promise<OddsEventWithOdds[]> {
  const params: Record<string, string> = {
    regions: options.regions || "us",
    markets: options.markets || "h2h",
    oddsFormat: options.oddsFormat || "decimal",
  };

  if (options.bookmakers) {
    params.bookmakers = options.bookmakers;
  }

  return fetchApi<OddsEventWithOdds[]>(`/sports/${sportKey}/odds`, params);
}

/**
 * Get live scores for a sport
 * Quota cost: 1 (live only) or 2 (with completed)
 */
export async function getScores(
  sportKey: string,
  options: { daysFrom?: number } = {}
): Promise<OddsScore[]> {
  const params: Record<string, string> = {};
  if (options.daysFrom) {
    params.daysFrom = options.daysFrom.toString();
  }
  return fetchApi<OddsScore[]>(`/sports/${sportKey}/scores`, params);
}

/**
 * Get all upcoming events with odds for multiple sports
 * More efficient than calling getOdds for each sport individually
 */
export async function getAllUpcomingWithOdds(
  sportKeys: string[] = SUPPORTED_SPORTS as unknown as string[],
  options: {
    regions?: string;
    markets?: string;
  } = {}
): Promise<{ sport: string; events: OddsEventWithOdds[] }[]> {
  const results: { sport: string; events: OddsEventWithOdds[] }[] = [];

  // First get active sports to avoid wasting quota on inactive ones
  const activeSports = await getSports();
  const activeSportKeys = new Set(activeSports.filter(s => s.active).map(s => s.key));

  for (const sportKey of sportKeys) {
    if (!activeSportKeys.has(sportKey)) {
      continue;
    }

    try {
      const events = await getOdds(sportKey, options);
      if (events.length > 0) {
        results.push({ sport: sportKey, events });
      }
    } catch (error) {
      console.error(`Error fetching odds for ${sportKey}:`, error);
    }
  }

  return results;
}

/**
 * Convert Odds API event to our match format
 */
export function convertToMatch(event: OddsEventWithOdds, sportKey: string): {
  sport: string;
  league: string;
  homeTeam: string;
  awayTeam: string;
  homeOdds: string | null;
  awayOdds: string | null;
  drawOdds: string | null;
  startsAt: Date;
  externalId: string;
} {
  // Extract sport from sport_key
  const [sportGroup] = sportKey.split("_");
  const sportName = sportGroup.replace("americanfootball", "football")
    .replace("icehockey", "hockey");

  // Get best available odds (first bookmaker with h2h market)
  let homeOdds: number | null = null;
  let awayOdds: number | null = null;
  let drawOdds: number | null = null;

  for (const bookmaker of event.bookmakers) {
    const h2hMarket = bookmaker.markets.find(m => m.key === "h2h");
    if (h2hMarket) {
      for (const outcome of h2hMarket.outcomes) {
        if (outcome.name === event.home_team) {
          homeOdds = outcome.price;
        } else if (outcome.name === event.away_team) {
          awayOdds = outcome.price;
        } else if (outcome.name === "Draw") {
          drawOdds = outcome.price;
        }
      }
      break; // Use first bookmaker's odds
    }
  }

  return {
    sport: sportName,
    league: event.sport_title,
    homeTeam: event.home_team,
    awayTeam: event.away_team,
    homeOdds: homeOdds?.toFixed(3) || null,
    awayOdds: awayOdds?.toFixed(3) || null,
    drawOdds: drawOdds?.toFixed(3) || null,
    startsAt: new Date(event.commence_time),
    externalId: event.id,
  };
}
