/**
 * Smart Sync Service for Odds API
 * Implements intelligent refresh scheduling to minimize API usage
 */

import { db } from "./db";
import { sql } from "drizzle-orm";
import * as oddsApi from "./oddsApi";

// Types for sync settings (inline to avoid schema changes)
interface SyncSetting {
  id: number;
  sportKey: string;
  sportTitle: string;
  sportGroup: string;
  enabled: boolean;
  priority: number;
  refreshIntervalMinutes: number;
  lastSyncedAt: Date | null;
  lastSyncCount: number;
}

interface SyncLog {
  id: number;
  startedAt: Date;
  completedAt: Date | null;
  sportsSynced: number;
  matchesCreated: number;
  matchesUpdated: number;
  apiRequestsUsed: number;
  status: string;
  errorMessage: string | null;
}

/**
 * Get all sync settings
 */
export async function getSyncSettings(): Promise<SyncSetting[]> {
  const result = await db.execute(sql`
    SELECT
      id,
      sport_key as "sportKey",
      sport_title as "sportTitle",
      sport_group as "sportGroup",
      enabled,
      priority,
      refresh_interval_minutes as "refreshIntervalMinutes",
      last_synced_at as "lastSyncedAt",
      last_sync_count as "lastSyncCount"
    FROM sync_settings
    ORDER BY priority DESC, sport_title ASC
  `);
  return result.rows as unknown as SyncSetting[];
}

/**
 * Get only enabled sync settings
 */
export async function getEnabledSyncSettings(): Promise<SyncSetting[]> {
  const result = await db.execute(sql`
    SELECT
      id,
      sport_key as "sportKey",
      sport_title as "sportTitle",
      sport_group as "sportGroup",
      enabled,
      priority,
      refresh_interval_minutes as "refreshIntervalMinutes",
      last_synced_at as "lastSyncedAt",
      last_sync_count as "lastSyncCount"
    FROM sync_settings
    WHERE enabled = true
    ORDER BY priority DESC
  `);
  return result.rows as unknown as SyncSetting[];
}

/**
 * Update sync setting
 */
export async function updateSyncSetting(
  sportKey: string,
  updates: { enabled?: boolean; priority?: number; refreshIntervalMinutes?: number }
): Promise<void> {
  const setClauses: string[] = ["updated_at = NOW()"];

  if (updates.enabled !== undefined) {
    setClauses.push(`enabled = ${updates.enabled}`);
  }
  if (updates.priority !== undefined) {
    setClauses.push(`priority = ${updates.priority}`);
  }
  if (updates.refreshIntervalMinutes !== undefined) {
    setClauses.push(`refresh_interval_minutes = ${updates.refreshIntervalMinutes}`);
  }

  await db.execute(sql.raw(`
    UPDATE sync_settings
    SET ${setClauses.join(", ")}
    WHERE sport_key = '${sportKey}'
  `));
}

/**
 * Bulk update sync settings (enable/disable multiple sports)
 */
export async function bulkUpdateSyncSettings(
  sportKeys: string[],
  enabled: boolean
): Promise<void> {
  if (sportKeys.length === 0) return;

  const keysList = sportKeys.map(k => `'${k}'`).join(",");
  await db.execute(sql.raw(`
    UPDATE sync_settings
    SET enabled = ${enabled}, updated_at = NOW()
    WHERE sport_key IN (${keysList})
  `));
}

/**
 * Get sports that need syncing based on their refresh interval
 */
export async function getSportsNeedingSync(): Promise<SyncSetting[]> {
  const result = await db.execute(sql`
    SELECT
      id,
      sport_key as "sportKey",
      sport_title as "sportTitle",
      sport_group as "sportGroup",
      enabled,
      priority,
      refresh_interval_minutes as "refreshIntervalMinutes",
      last_synced_at as "lastSyncedAt",
      last_sync_count as "lastSyncCount"
    FROM sync_settings
    WHERE enabled = true
      AND (
        last_synced_at IS NULL
        OR last_synced_at < NOW() - (refresh_interval_minutes || ' minutes')::INTERVAL
      )
    ORDER BY priority DESC
  `);
  return result.rows as unknown as SyncSetting[];
}

/**
 * Calculate smart refresh interval based on match proximity
 */
export function calculateSmartInterval(hoursUntilMatch: number): number {
  if (hoursUntilMatch <= 0) {
    // Live - refresh every 5 minutes
    return 5;
  } else if (hoursUntilMatch <= 2) {
    // Within 2 hours - every 15 minutes
    return 15;
  } else if (hoursUntilMatch <= 6) {
    // Within 6 hours - every 30 minutes
    return 30;
  } else if (hoursUntilMatch <= 24) {
    // Within 24 hours - every 2 hours
    return 120;
  } else if (hoursUntilMatch <= 72) {
    // Within 3 days - every 6 hours
    return 360;
  } else {
    // More than 3 days - once per day
    return 1440;
  }
}

/**
 * Create sync log entry
 */
async function createSyncLog(): Promise<number> {
  const result = await db.execute(sql`
    INSERT INTO sync_log (started_at, status)
    VALUES (NOW(), 'running')
    RETURNING id
  `);
  return (result.rows[0] as { id: number }).id;
}

/**
 * Update sync log entry
 */
async function updateSyncLog(
  logId: number,
  updates: {
    completedAt?: Date;
    sportsSynced?: number;
    matchesCreated?: number;
    matchesUpdated?: number;
    apiRequestsUsed?: number;
    status?: string;
    errorMessage?: string;
  }
): Promise<void> {
  const setClauses: string[] = [];

  if (updates.completedAt) setClauses.push(`completed_at = NOW()`);
  if (updates.sportsSynced !== undefined) setClauses.push(`sports_synced = ${updates.sportsSynced}`);
  if (updates.matchesCreated !== undefined) setClauses.push(`matches_created = ${updates.matchesCreated}`);
  if (updates.matchesUpdated !== undefined) setClauses.push(`matches_updated = ${updates.matchesUpdated}`);
  if (updates.apiRequestsUsed !== undefined) setClauses.push(`api_requests_used = ${updates.apiRequestsUsed}`);
  if (updates.status) setClauses.push(`status = '${updates.status}'`);
  if (updates.errorMessage) setClauses.push(`error_message = '${updates.errorMessage.replace(/'/g, "''")}'`);

  if (setClauses.length > 0) {
    await db.execute(sql.raw(`
      UPDATE sync_log
      SET ${setClauses.join(", ")}
      WHERE id = ${logId}
    `));
  }
}

/**
 * Get recent sync logs
 */
export async function getRecentSyncLogs(limit = 10): Promise<SyncLog[]> {
  const result = await db.execute(sql`
    SELECT
      id,
      started_at as "startedAt",
      completed_at as "completedAt",
      sports_synced as "sportsSynced",
      matches_created as "matchesCreated",
      matches_updated as "matchesUpdated",
      api_requests_used as "apiRequestsUsed",
      status,
      error_message as "errorMessage"
    FROM sync_log
    ORDER BY started_at DESC
    LIMIT ${limit}
  `);
  return result.rows as unknown as SyncLog[];
}

/**
 * Sync a single sport - uses free /events endpoint first
 */
async function syncSport(
  sportKey: string
): Promise<{ created: number; updated: number; apiCalls: number }> {
  let apiCalls = 0;
  let created = 0;
  let updated = 0;

  try {
    // First, check if there are any events (FREE endpoint)
    const events = await oddsApi.getEvents(sportKey);
    // Events endpoint is free, no apiCalls increment

    if (events.length === 0) {
      // No events, skip fetching odds
      return { created: 0, updated: 0, apiCalls: 0 };
    }

    // Only fetch odds if there are events (PAID endpoint - 1 credit)
    const oddsEvents = await oddsApi.getOdds(sportKey, {
      regions: "us",
      markets: "h2h",
    });
    apiCalls = 1;

    // Convert and upsert matches
    for (const event of oddsEvents) {
      const matchData = oddsApi.convertToMatch(event, sportKey);

      // Skip if no odds available
      if (!matchData.homeOdds || !matchData.awayOdds) continue;

      // Check if match exists by external ID
      const existingResult = await db.execute(sql`
        SELECT id, status FROM matches WHERE external_id = ${matchData.externalId}
      `);

      const existing = existingResult.rows[0] as { id: number; status: string } | undefined;

      if (existing) {
        // Only update if match is upcoming
        if (existing.status === "upcoming") {
          await db.execute(sql`
            UPDATE matches SET
              home_odds = ${matchData.homeOdds},
              away_odds = ${matchData.awayOdds},
              draw_odds = ${matchData.drawOdds},
              starts_at = ${matchData.startsAt.toISOString()},
              last_odds_update = NOW()
            WHERE external_id = ${matchData.externalId}
          `);
          updated++;
        }
      } else {
        // Insert new match
        await db.execute(sql`
          INSERT INTO matches (
            external_id, sport, league, home_team, away_team,
            home_odds, away_odds, draw_odds, starts_at, status, last_odds_update
          ) VALUES (
            ${matchData.externalId},
            ${matchData.sport},
            ${matchData.league},
            ${matchData.homeTeam},
            ${matchData.awayTeam},
            ${matchData.homeOdds},
            ${matchData.awayOdds},
            ${matchData.drawOdds},
            ${matchData.startsAt.toISOString()},
            'upcoming',
            NOW()
          )
        `);
        created++;
      }
    }

    // Update last synced timestamp for this sport
    await db.execute(sql`
      UPDATE sync_settings
      SET last_synced_at = NOW(), last_sync_count = ${created + updated}
      WHERE sport_key = ${sportKey}
    `);

  } catch (error) {
    console.error(`Error syncing ${sportKey}:`, error);
    throw error;
  }

  return { created, updated, apiCalls };
}

/**
 * Run full sync for all enabled sports that need refreshing
 */
export async function runSmartSync(options?: {
  forceFull?: boolean;
  maxSports?: number;
}): Promise<{
  sportsSynced: number;
  matchesCreated: number;
  matchesUpdated: number;
  apiRequestsUsed: number;
  quota: { remaining: number; used: number } | null;
}> {
  const logId = await createSyncLog();

  let sportsSynced = 0;
  let totalCreated = 0;
  let totalUpdated = 0;
  let totalApiCalls = 0;

  try {
    // Get sports that need syncing
    const sportsToSync = options?.forceFull
      ? await getEnabledSyncSettings()
      : await getSportsNeedingSync();

    // Limit number of sports if specified
    const limitedSports = options?.maxSports
      ? sportsToSync.slice(0, options.maxSports)
      : sportsToSync;

    for (const sport of limitedSports) {
      try {
        const result = await syncSport(sport.sportKey);
        totalCreated += result.created;
        totalUpdated += result.updated;
        totalApiCalls += result.apiCalls;
        sportsSynced++;
      } catch (error) {
        console.error(`Failed to sync ${sport.sportKey}:`, error);
        // Continue with other sports
      }
    }

    // Get final quota status
    const quota = oddsApi.getLastQuota();

    await updateSyncLog(logId, {
      completedAt: new Date(),
      sportsSynced,
      matchesCreated: totalCreated,
      matchesUpdated: totalUpdated,
      apiRequestsUsed: totalApiCalls,
      status: "completed",
    });

    return {
      sportsSynced,
      matchesCreated: totalCreated,
      matchesUpdated: totalUpdated,
      apiRequestsUsed: totalApiCalls,
      quota: quota ? { remaining: quota.remaining, used: quota.used } : null,
    };

  } catch (error) {
    await updateSyncLog(logId, {
      completedAt: new Date(),
      status: "failed",
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    });
    throw error;
  }
}

/**
 * Sync a specific sport immediately (bypasses schedule)
 */
export async function syncSportNow(sportKey: string): Promise<{
  created: number;
  updated: number;
  apiCalls: number;
}> {
  return syncSport(sportKey);
}

/**
 * Get sync status summary
 */
export async function getSyncStatus(): Promise<{
  enabledSports: number;
  totalSports: number;
  lastSync: SyncLog | null;
  sportsNeedingSync: number;
  quota: { remaining: number; used: number } | null;
}> {
  const allSettings = await getSyncSettings();
  const enabledCount = allSettings.filter(s => s.enabled).length;
  const needingSync = await getSportsNeedingSync();
  const recentLogs = await getRecentSyncLogs(1);
  const quota = oddsApi.getLastQuota();

  return {
    enabledSports: enabledCount,
    totalSports: allSettings.length,
    lastSync: recentLogs[0] || null,
    sportsNeedingSync: needingSync.length,
    quota,
  };
}

/**
 * Clean up old matches (past matches older than X days)
 */
export async function cleanupOldMatches(daysOld = 7): Promise<number> {
  const result = await db.execute(sql`
    DELETE FROM matches
    WHERE status = 'final'
      AND starts_at < NOW() - INTERVAL '${daysOld} days'
    RETURNING id
  `);
  return result.rows.length;
}

/**
 * Add a new sport to sync settings (from API discovery)
 */
export async function addSportToSettings(
  sportKey: string,
  sportTitle: string,
  sportGroup: string
): Promise<void> {
  await db.execute(sql`
    INSERT INTO sync_settings (sport_key, sport_title, sport_group, enabled, priority)
    VALUES (${sportKey}, ${sportTitle}, ${sportGroup}, false, 0)
    ON CONFLICT (sport_key) DO NOTHING
  `);
}

/**
 * Discover and add all available sports from API
 */
export async function discoverAllSports(): Promise<number> {
  const sports = await oddsApi.getSports(true); // Include inactive
  let added = 0;

  for (const sport of sports) {
    try {
      await addSportToSettings(sport.key, sport.title, sport.group);
      added++;
    } catch (error) {
      // Sport already exists, skip
    }
  }

  return added;
}
