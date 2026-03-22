import { Router, Request, Response, NextFunction } from "express";
import Anthropic from "@anthropic-ai/sdk";
import nodemailer from "nodemailer";
import passport from "./auth";
import * as storage from "./storage";
import * as mathEngine from "./mathEngine";
import * as oddsApi from "./oddsApi";
import * as syncService from "./syncService";
import { asyncHandler, BadRequestError, NotFoundError, ForbiddenError } from "./errors";
import * as algorithms from "./algorithms";

const router = Router();

// Anthropic client (lazy initialization)
let anthropicClient: Anthropic | null = null;

function getAnthropicClient(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) {
    return null;
  }
  if (!anthropicClient) {
    anthropicClient = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }
  return anthropicClient;
}

// Email transporter (lazy initialization)
let emailTransporter: nodemailer.Transporter | null = null;

function getEmailTransporter(): nodemailer.Transporter | null {
  if (!process.env.SMTP_HOST) {
    return null;
  }
  if (!emailTransporter) {
    emailTransporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || "587"),
      secure: process.env.SMTP_SECURE === "true",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  return emailTransporter;
}

// Auth middleware
function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ error: "Unauthorized" });
}

// Admin middleware (checks for admin flag - extend as needed)
function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  // For now, check environment variable for admin usernames
  const adminUsernames = (process.env.ADMIN_USERNAMES || "").split(",").map((s) => s.trim());
  const user = req.user as any;
  if (!adminUsernames.includes(user.username)) {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
}

// Auth routes
router.post("/auth/register", asyncHandler(async (req, res) => {
  const { username, password, email } = req.body;

  if (!username || !password) {
    throw new BadRequestError("Username and password are required");
  }

  if (password.length < 6) {
    throw new BadRequestError("Password must be at least 6 characters");
  }

  const existing = await storage.getUserByUsername(username);
  if (existing) {
    throw new BadRequestError("Username already exists");
  }

  if (email) {
    const existingEmail = await storage.getUserByEmail(email);
    if (existingEmail) {
      throw new BadRequestError("Email already in use");
    }
  }

  const user = await storage.createUser({ username, password });

  if (email) {
    await storage.updateUserEmail(user.id, email);
  }

  req.login(user, (loginErr: Error | null) => {
    if (loginErr) {
      throw new Error("Failed to login after registration");
    }
    res.json({ user: { id: user.id, username: user.username } });
  });
}));

router.post("/auth/login", (req, res, next) => {
  passport.authenticate("local", (err: Error, user: any, info: any) => {
    if (err) {
      return res.status(500).json({ error: "Login failed" });
    }
    if (!user) {
      return res.status(401).json({ error: info?.message || "Invalid credentials" });
    }
    req.login(user, (err) => {
      if (err) {
        return res.status(500).json({ error: "Login failed" });
      }
      res.json({ user: { id: user.id, username: user.username } });
    });
  })(req, res, next);
});

router.post("/auth/logout", (req, res) => {
  req.logout((err) => {
    if (err) {
      return res.status(500).json({ error: "Logout failed" });
    }
    res.json({ success: true });
  });
});

router.get("/auth/user", (req, res) => {
  if (req.user) {
    const user = req.user as any;
    res.json({ user: { id: user.id, username: user.username } });
  } else {
    res.json({ user: null });
  }
});

// Password reset routes
router.post("/auth/forgot-password", asyncHandler(async (req, res) => {
  const { email } = req.body;

  if (!email) {
    throw new BadRequestError("Email is required");
  }

  const user = await storage.getUserByEmail(email);

  // Always return success to prevent email enumeration
  if (!user) {
    res.json({ success: true, message: "If an account exists, a reset email has been sent" });
    return;
  }

  const token = await storage.setPasswordResetToken(user.id);
  const transporter = getEmailTransporter();

  if (transporter) {
    const resetUrl = `${process.env.CLIENT_URL || "http://localhost:5173"}/#/reset-password?token=${token}`;

    await transporter.sendMail({
      from: process.env.SMTP_FROM || "noreply@parlayedge.com",
      to: email,
      subject: "Password Reset - ParlayEdge",
      html: `
        <h1>Password Reset</h1>
        <p>Click the link below to reset your password. This link expires in 1 hour.</p>
        <a href="${resetUrl}">${resetUrl}</a>
        <p>If you didn't request this, you can safely ignore this email.</p>
      `,
    });
  }

  res.json({ success: true, message: "If an account exists, a reset email has been sent" });
}));

router.post("/auth/reset-password", asyncHandler(async (req, res) => {
  const { token, password } = req.body;

  if (!token || !password) {
    throw new BadRequestError("Token and password are required");
  }

  if (password.length < 6) {
    throw new BadRequestError("Password must be at least 6 characters");
  }

  const user = await storage.getUserByResetToken(token);

  if (!user) {
    throw new BadRequestError("Invalid or expired reset token");
  }

  if (user.passwordResetExpires && new Date() > user.passwordResetExpires) {
    throw new BadRequestError("Reset token has expired");
  }

  await storage.resetPassword(user.id, password);

  res.json({ success: true, message: "Password has been reset" });
}));

// Match routes (cached from DB - no API calls)
router.get("/matches", asyncHandler(async (req, res) => {
  const { status, sport, league, hours } = req.query;

  // If hours specified, get upcoming matches within that window
  if (hours) {
    const matches = await storage.getUpcomingMatches(parseInt(hours as string));
    return res.json({ matches, cached: true });
  }

  // Otherwise use filtered query
  const matches = await storage.getMatchesFiltered({
    status: status as string,
    sport: sport as string,
    league: league as string,
  });

  res.json({ matches, cached: true });
}));

router.get("/matches/:id", asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id);
  const match = await storage.getMatchById(id);
  if (!match) {
    throw new NotFoundError("Match not found");
  }
  res.json({ match });
}));

// Get matches grouped by sport (cached)
router.get("/matches/by-sport", asyncHandler(async (_req, res) => {
  const grouped = await storage.getMatchesBySport();
  res.json({ sports: grouped, cached: true });
}));

// Get available sports from cached data
router.get("/sports", asyncHandler(async (_req, res) => {
  const sports = await storage.getAvailableSports();
  res.json({ sports, cached: true });
}));

// Get match statistics
router.get("/matches/stats", asyncHandler(async (_req, res) => {
  const stats = await storage.getMatchStats();
  res.json({ stats });
}));

// Admin match management routes
router.post("/admin/matches", requireAdmin, asyncHandler(async (req, res) => {
  const { sport, league, homeTeam, awayTeam, homeOdds, awayOdds, drawOdds, startsAt } = req.body;

  if (!sport || !homeTeam || !awayTeam || !startsAt) {
    throw new BadRequestError("Sport, home team, away team, and start time are required");
  }

  const match = await storage.createMatch({
    sport,
    league,
    homeTeam,
    awayTeam,
    homeOdds: homeOdds?.toString(),
    awayOdds: awayOdds?.toString(),
    drawOdds: drawOdds?.toString(),
    startsAt: new Date(startsAt),
  });

  res.json({ match });
}));

router.put("/admin/matches/:id", requireAdmin, asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id);
  const match = await storage.getMatchById(id);

  if (!match) {
    throw new NotFoundError("Match not found");
  }

  const updates: any = {};
  const allowedFields = ["sport", "league", "homeTeam", "awayTeam", "homeOdds", "awayOdds", "drawOdds", "startsAt", "status"];

  for (const field of allowedFields) {
    if (req.body[field] !== undefined) {
      if (field === "startsAt") {
        updates[field] = new Date(req.body[field]);
      } else if (["homeOdds", "awayOdds", "drawOdds"].includes(field)) {
        updates[field] = req.body[field]?.toString();
      } else {
        updates[field] = req.body[field];
      }
    }
  }

  const updated = await storage.updateMatch(id, updates);
  res.json({ match: updated });
}));

router.delete("/admin/matches/:id", requireAdmin, asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id);
  const match = await storage.getMatchById(id);

  if (!match) {
    throw new NotFoundError("Match not found");
  }

  await storage.deleteMatch(id);
  res.json({ success: true });
}));

// Live Odds API routes
router.get("/odds/sports", asyncHandler(async (_req, res) => {
  if (!process.env.ODDS_API_KEY) {
    throw new BadRequestError("Odds API not configured");
  }

  const sports = await oddsApi.getSports();
  const quota = oddsApi.getLastQuota();

  res.json({ sports, quota });
}));

router.get("/odds/events/:sport", asyncHandler(async (req, res) => {
  if (!process.env.ODDS_API_KEY) {
    throw new BadRequestError("Odds API not configured");
  }

  const { sport } = req.params;
  const events = await oddsApi.getEvents(sport);
  const quota = oddsApi.getLastQuota();

  res.json({ events, quota });
}));

router.get("/odds/live/:sport", asyncHandler(async (req, res) => {
  if (!process.env.ODDS_API_KEY) {
    throw new BadRequestError("Odds API not configured");
  }

  const { sport } = req.params;
  const regions = (req.query.regions as string) || "us";
  const markets = (req.query.markets as string) || "h2h";

  const events = await oddsApi.getOdds(sport, { regions, markets });
  const quota = oddsApi.getLastQuota();

  res.json({ events, quota });
}));

router.get("/odds/scores/:sport", asyncHandler(async (req, res) => {
  if (!process.env.ODDS_API_KEY) {
    throw new BadRequestError("Odds API not configured");
  }

  const { sport } = req.params;
  const daysFrom = req.query.daysFrom ? parseInt(req.query.daysFrom as string) : undefined;

  const scores = await oddsApi.getScores(sport, { daysFrom });
  const quota = oddsApi.getLastQuota();

  res.json({ scores, quota });
}));

// Sync matches from Odds API (admin only)
router.post("/admin/odds/sync", requireAdmin, asyncHandler(async (req, res) => {
  if (!process.env.ODDS_API_KEY) {
    throw new BadRequestError("Odds API not configured");
  }

  const { sports } = req.body;
  const sportKeys = sports || ["americanfootball_nfl", "basketball_nba", "baseball_mlb"];

  const allMatches: (Parameters<typeof storage.syncMatchesFromExternal>[0][number])[] = [];

  for (const sportKey of sportKeys) {
    try {
      const events = await oddsApi.getOdds(sportKey, { regions: "us", markets: "h2h" });

      for (const event of events) {
        const matchData = oddsApi.convertToMatch(event, sportKey);
        if (matchData.homeOdds && matchData.awayOdds) {
          allMatches.push(matchData);
        }
      }
    } catch (error) {
      console.error(`Error fetching odds for ${sportKey}:`, error);
    }
  }

  const results = await storage.syncMatchesFromExternal(allMatches);
  const quota = oddsApi.getLastQuota();

  res.json({
    success: true,
    synced: results,
    totalMatches: allMatches.length,
    quota,
  });
}));

// Public endpoint to get API quota status
router.get("/odds/quota", asyncHandler(async (_req, res) => {
  const quota = oddsApi.getLastQuota();
  res.json({ quota });
}));

// ============================================
// SYNC MANAGEMENT ROUTES (Admin only)
// ============================================

// Get all sync settings
router.get("/admin/sync/settings", requireAdmin, asyncHandler(async (_req, res) => {
  const settings = await syncService.getSyncSettings();
  res.json({ settings });
}));

// Update a single sport's sync settings
router.put("/admin/sync/settings/:sportKey", requireAdmin, asyncHandler(async (req, res) => {
  const { sportKey } = req.params;
  const { enabled, priority, refreshIntervalMinutes } = req.body;

  await syncService.updateSyncSetting(sportKey, {
    enabled,
    priority,
    refreshIntervalMinutes,
  });

  res.json({ success: true });
}));

// Bulk enable/disable sports
router.post("/admin/sync/settings/bulk", requireAdmin, asyncHandler(async (req, res) => {
  const { sportKeys, enabled } = req.body;

  if (!Array.isArray(sportKeys)) {
    throw new BadRequestError("sportKeys must be an array");
  }

  await syncService.bulkUpdateSyncSettings(sportKeys, enabled);
  res.json({ success: true, updated: sportKeys.length });
}));

// Get sync status (enabled sports, last sync, quota)
router.get("/admin/sync/status", requireAdmin, asyncHandler(async (_req, res) => {
  const status = await syncService.getSyncStatus();
  res.json(status);
}));

// Get recent sync logs
router.get("/admin/sync/logs", requireAdmin, asyncHandler(async (req, res) => {
  const limit = parseInt(req.query.limit as string) || 10;
  const logs = await syncService.getRecentSyncLogs(limit);
  res.json({ logs });
}));

// Run smart sync (only syncs sports that need refreshing)
router.post("/admin/sync/run", requireAdmin, asyncHandler(async (req, res) => {
  const { forceFull, maxSports } = req.body;

  const result = await syncService.runSmartSync({
    forceFull: forceFull === true,
    maxSports: maxSports ? parseInt(maxSports) : undefined,
  });

  res.json({
    success: true,
    ...result,
  });
}));

// Sync a specific sport immediately
router.post("/admin/sync/sport/:sportKey", requireAdmin, asyncHandler(async (req, res) => {
  const { sportKey } = req.params;

  const result = await syncService.syncSportNow(sportKey);
  const quota = oddsApi.getLastQuota();

  res.json({
    success: true,
    sport: sportKey,
    ...result,
    quota,
  });
}));

// Discover all available sports from API and add to settings
router.post("/admin/sync/discover", requireAdmin, asyncHandler(async (_req, res) => {
  const added = await syncService.discoverAllSports();
  res.json({
    success: true,
    sportsAdded: added,
    message: `Discovered and added ${added} new sports to settings`,
  });
}));

// Cleanup old finished matches
router.post("/admin/sync/cleanup", requireAdmin, asyncHandler(async (req, res) => {
  const daysOld = parseInt(req.body.daysOld) || 7;
  const deleted = await syncService.cleanupOldMatches(daysOld);
  res.json({
    success: true,
    matchesDeleted: deleted,
  });
}));

// Settle match endpoint
router.post("/admin/matches/:id/settle", requireAdmin, asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id);
  const { homeScore, awayScore } = req.body;

  if (homeScore === undefined || awayScore === undefined) {
    throw new BadRequestError("Home score and away score are required");
  }

  const match = await storage.getMatchById(id);
  if (!match) {
    throw new NotFoundError("Match not found");
  }

  if (match.status === "final") {
    throw new BadRequestError("Match has already been settled");
  }

  const affectedSlips = await storage.settleMatch(id, homeScore, awayScore);

  res.json({
    success: true,
    message: `Match settled. ${affectedSlips} slips affected.`,
  });
}));

// Slip routes with pagination
router.get("/slips", requireAuth, asyncHandler(async (req, res) => {
  const user = req.user as any;
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
  const cursor = req.query.cursor ? parseInt(req.query.cursor as string) : undefined;

  const result = await storage.getSlipsByUser(user.id, { limit, cursor });
  res.json(result);
}));

router.get("/slips/:id", requireAuth, asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id);
  const user = req.user as any;
  const slip = await storage.getSlipWithLegs(id);

  if (!slip) {
    throw new NotFoundError("Slip not found");
  }

  if (slip.userId !== user.id) {
    throw new ForbiddenError();
  }

  res.json({ slip });
}));

router.post("/slips", requireAuth, asyncHandler(async (req, res) => {
  const user = req.user as any;
  const { stake, legs } = req.body;

  if (!legs || !Array.isArray(legs) || legs.length === 0) {
    throw new BadRequestError("At least one leg is required");
  }

  if (legs.length > 25) {
    throw new BadRequestError("Maximum 25 legs allowed");
  }

  // Validate all matches exist
  for (const leg of legs) {
    const match = await storage.getMatchById(leg.matchId);
    if (!match) {
      throw new BadRequestError(`Match ${leg.matchId} not found`);
    }
    if (match.status !== "upcoming") {
      throw new BadRequestError(`Match ${leg.matchId} is not available for betting`);
    }
  }

  // Calculate combined odds and potential payout
  const combinedOdds = legs.reduce((acc: number, leg: any) => acc * parseFloat(leg.odds), 1);
  const potentialPayout = stake ? parseFloat(stake) * combinedOdds : null;

  const legsData = legs.map((leg: any) => ({
    matchId: leg.matchId,
    pick: leg.pick,
    odds: leg.odds.toString(),
  }));

  const fullSlip = await storage.createSlipWithLegs(
    {
      userId: user.id,
      stake: stake?.toString(),
      potentialPayout: potentialPayout?.toFixed(2),
    },
    legsData
  );

  res.json({ slip: fullSlip });
}));

router.delete("/slips/:id", requireAuth, asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id);
  const user = req.user as any;
  const slip = await storage.getSlipById(id);

  if (!slip) {
    throw new NotFoundError("Slip not found");
  }

  if (slip.userId !== user.id) {
    throw new ForbiddenError();
  }

  if (slip.status !== "pending") {
    throw new BadRequestError("Cannot delete a settled slip");
  }

  await storage.deleteSlip(id);
  res.json({ success: true });
}));

// Chat routes with pagination
router.get("/chats", requireAuth, asyncHandler(async (req, res) => {
  const user = req.user as any;
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
  const cursor = req.query.cursor ? parseInt(req.query.cursor as string) : undefined;

  const result = await storage.getChatsByUser(user.id, { limit, cursor });
  res.json(result);
}));

router.post("/chats", requireAuth, asyncHandler(async (req, res) => {
  const user = req.user as any;
  const { title } = req.body;

  const chat = await storage.createChat({
    userId: user.id,
    title: title || "New Chat",
  });

  res.json({ chat });
}));

router.get("/chats/:id/messages", requireAuth, asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id);
  const user = req.user as any;
  const chat = await storage.getChatById(id);

  if (!chat) {
    throw new NotFoundError("Chat not found");
  }

  if (chat.userId !== user.id) {
    throw new ForbiddenError();
  }

  const messages = await storage.getMessagesByChat(id);
  res.json({ messages });
}));

router.post("/chats/:id/messages", requireAuth, asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id);
  const user = req.user as any;
  const { content } = req.body;

  const chat = await storage.getChatById(id);

  if (!chat) {
    throw new NotFoundError("Chat not found");
  }

  if (chat.userId !== user.id) {
    throw new ForbiddenError();
  }

  // Save user message
  const userMessage = await storage.createMessage({
    chatId: id,
    role: "user",
    content,
  });

  // Generate AI response
  const aiResponse = await generateAIResponse(id, content);
  const assistantMessage = await storage.createMessage({
    chatId: id,
    role: "assistant",
    content: aiResponse,
  });

  res.json({ messages: [userMessage, assistantMessage] });
}));

router.delete("/chats/:id", requireAuth, asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id);
  const user = req.user as any;
  const chat = await storage.getChatById(id);

  if (!chat) {
    throw new NotFoundError("Chat not found");
  }

  if (chat.userId !== user.id) {
    throw new ForbiddenError();
  }

  await storage.deleteChat(id);
  res.json({ success: true });
}));

// Analysis route (now requires auth)
router.post("/analyze", requireAuth, asyncHandler(async (req, res) => {
  const { legs, stake } = req.body;

  if (!legs || !Array.isArray(legs) || legs.length === 0) {
    throw new BadRequestError("At least one leg is required");
  }

  const legInputs = legs.map((leg: any) => ({
    odds: parseFloat(leg.odds),
    pick: leg.pick,
  }));

  const analysis = mathEngine.analyzeParlay(legInputs, parseFloat(stake) || 10);
  res.json({ analysis });
}));

// ============================================
// MATCH ANALYSIS ROUTES (Algorithm Engine)
// ============================================

// Get full match analysis with all algorithm outputs
router.get("/matches/:id/analysis", asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id);
  const match = await storage.getMatchById(id);

  if (!match) {
    throw new NotFoundError("Match not found");
  }

  // Check for cached analysis
  const cachedAnalysis = await storage.getMatchAnalysis(id);

  // If cached analysis is recent (less than 1 hour old), return it
  if (cachedAnalysis && cachedAnalysis.computedAt) {
    const ageInHours = (Date.now() - new Date(cachedAnalysis.computedAt).getTime()) / (1000 * 60 * 60);
    if (ageInHours < 1) {
      return res.json({ analysis: cachedAnalysis, cached: true });
    }
  }

  // Get team stats or create defaults
  const homeTeamStats = await storage.getTeamStats(match.homeTeam, match.sport) ||
    algorithms.createDefaultTeamStats(match.homeTeam, match.sport);
  const awayTeamStats = await storage.getTeamStats(match.awayTeam, match.sport) ||
    algorithms.createDefaultTeamStats(match.awayTeam, match.sport);

  // Prepare market odds
  const marketOdds: algorithms.MarketOdds | undefined = match.homeOdds && match.awayOdds ? {
    home: parseFloat(match.homeOdds),
    draw: match.drawOdds ? parseFloat(match.drawOdds) : undefined,
    away: parseFloat(match.awayOdds)
  } : undefined;

  // Run full analysis
  const analysis = algorithms.analyzeMatch(
    homeTeamStats,
    awayTeamStats,
    marketOdds,
    { runMonteCarlo: true, monteCarloSimulations: 10000, matchId: id }
  );

  // Cache the analysis
  await storage.saveMatchAnalysis(id, analysis);

  res.json({ analysis, cached: false });
}));

// Get value bets across all upcoming matches
router.get("/value-bets", asyncHandler(async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
  const minEdge = parseFloat(req.query.minEdge as string) || 0.02; // Default 2% edge
  const sport = req.query.sport as string;

  // Get upcoming matches
  const matches = await storage.getMatchesFiltered({
    status: 'upcoming',
    sport: sport,
  });

  const valueBets: Array<{
    match: typeof matches[0];
    valueResult: algorithms.ValueResult;
    confidence: string;
  }> = [];

  for (const match of matches) {
    if (!match.homeOdds || !match.awayOdds) continue;

    // Check for cached analysis
    let analysis = await storage.getMatchAnalysis(match.id);

    // If no cached analysis, compute quick analysis
    if (!analysis) {
      const homeTeamStats = await storage.getTeamStats(match.homeTeam, match.sport) ||
        algorithms.createDefaultTeamStats(match.homeTeam, match.sport);
      const awayTeamStats = await storage.getTeamStats(match.awayTeam, match.sport) ||
        algorithms.createDefaultTeamStats(match.awayTeam, match.sport);

      const quickResult = algorithms.quickAnalyzeMatch(homeTeamStats, awayTeamStats);

      analysis = {
        id: 0,
        matchId: match.id,
        consensusHome: quickResult.homeWin.toString(),
        consensusDraw: quickResult.draw.toString(),
        consensusAway: quickResult.awayWin.toString(),
        modelAgreement: '0.7',
        confidence: quickResult.confidence,
      } as any;
    }

    const marketOdds: algorithms.MarketOdds = {
      home: parseFloat(match.homeOdds),
      draw: match.drawOdds ? parseFloat(match.drawOdds) : undefined,
      away: parseFloat(match.awayOdds)
    };

    // Find value bets for this match
    const fullAnalysis = {
      consensus: {
        homeWin: parseFloat(analysis.consensusHome || '0.33'),
        draw: parseFloat(analysis.consensusDraw || '0.33'),
        awayWin: parseFloat(analysis.consensusAway || '0.33'),
        modelAgreement: parseFloat(analysis.modelAgreement || '0.5'),
        confidence: analysis.confidence || 'medium'
      },
      poisson: {
        overUnder: {},
        btts: { yes: 0.5, no: 0.5 }
      }
    } as algorithms.MatchAnalysis;

    const valueBetsForMatch = algorithms.findValueBets(fullAnalysis, marketOdds);

    for (const valueResult of valueBetsForMatch) {
      if (valueResult.edge >= minEdge) {
        valueBets.push({
          match,
          valueResult,
          confidence: analysis.confidence || 'medium'
        });
      }
    }
  }

  // Sort by edge (highest first) and limit
  valueBets.sort((a, b) => b.valueResult.edge - a.valueResult.edge);
  const limitedBets = valueBets.slice(0, limit);

  res.json({
    valueBets: limitedBets,
    total: valueBets.length,
    minEdgeUsed: minEdge
  });
}));

// Advanced parlay analysis with correlation detection
router.post("/parlay/analyze-advanced", requireAuth, asyncHandler(async (req, res) => {
  const { legs, stake } = req.body;

  if (!legs || !Array.isArray(legs) || legs.length === 0) {
    throw new BadRequestError("At least one leg is required");
  }

  if (legs.length > 25) {
    throw new BadRequestError("Maximum 25 legs allowed");
  }

  // Convert to ParlayLeg format and get match info
  const parlayLegs: algorithms.ParlayLeg[] = [];

  for (const leg of legs) {
    const match = await storage.getMatchById(leg.matchId);
    if (!match) {
      throw new BadRequestError(`Match ${leg.matchId} not found`);
    }

    parlayLegs.push({
      matchId: leg.matchId,
      homeTeam: match.homeTeam,
      awayTeam: match.awayTeam,
      league: match.league || undefined,
      sport: match.sport,
      pick: leg.pick,
      odds: parseFloat(leg.odds),
    });
  }

  // Get team stats for analysis
  const teamStatsMap = new Map<string, algorithms.TeamStats>();

  for (const leg of parlayLegs) {
    if (!teamStatsMap.has(leg.homeTeam)) {
      const stats = await storage.getTeamStats(leg.homeTeam, leg.sport) ||
        algorithms.createDefaultTeamStats(leg.homeTeam, leg.sport);
      teamStatsMap.set(leg.homeTeam, stats);
    }
    if (!teamStatsMap.has(leg.awayTeam)) {
      const stats = await storage.getTeamStats(leg.awayTeam, leg.sport) ||
        algorithms.createDefaultTeamStats(leg.awayTeam, leg.sport);
      teamStatsMap.set(leg.awayTeam, stats);
    }
  }

  // Run advanced analysis
  const advancedAnalysis = algorithms.analyzeAdvancedParlay(parlayLegs, teamStatsMap);

  // Also get basic mathEngine analysis
  const legInputs = legs.map((leg: any) => ({
    odds: parseFloat(leg.odds),
    pick: leg.pick,
  }));
  const basicAnalysis = mathEngine.analyzeParlay(legInputs, parseFloat(stake) || 10);

  res.json({
    basic: basicAnalysis,
    advanced: {
      correlationAnalysis: advancedAnalysis.correlationAnalysis,
      parlayBoost: advancedAnalysis.parlayBoost,
      suggestion: advancedAnalysis.betterParlaysuggestion,
      combinedProbability: advancedAnalysis.combinedProbability,
      expectedValue: advancedAnalysis.expectedValue,
      recommendation: advancedAnalysis.recommendation,
      legAnalyses: advancedAnalysis.legAnalyses.map(a => ({
        matchId: a.matchId,
        homeTeam: a.homeTeam,
        awayTeam: a.awayTeam,
        consensus: a.consensus,
        insights: a.insights?.slice(0, 3) || []
      }))
    }
  });
}));

// ============================================
// STRATEGY ROUTES (Backtesting)
// ============================================

// List user strategies
router.get("/strategies", requireAuth, asyncHandler(async (req, res) => {
  const user = req.user as any;
  const strategies = await storage.getStrategiesByUser(user.id);
  res.json({ strategies });
}));

// Create new strategy
router.post("/strategies", requireAuth, asyncHandler(async (req, res) => {
  const user = req.user as any;
  const { name, description, criteria, stakeType, stakeAmount, kellyFraction } = req.body;

  if (!name || !criteria) {
    throw new BadRequestError("Name and criteria are required");
  }

  const strategy = await storage.createStrategy({
    userId: user.id,
    name,
    description,
    criteria,
    stakeType: stakeType || 'fixed',
    stakeAmount: stakeAmount?.toString(),
    kellyFraction: kellyFraction?.toString(),
  });

  res.json({ strategy });
}));

// Get single strategy
router.get("/strategies/:id", requireAuth, asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id);
  const user = req.user as any;
  const strategy = await storage.getStrategyById(id);

  if (!strategy) {
    throw new NotFoundError("Strategy not found");
  }

  if (strategy.userId !== user.id) {
    throw new ForbiddenError();
  }

  res.json({ strategy });
}));

// Update strategy
router.put("/strategies/:id", requireAuth, asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id);
  const user = req.user as any;
  const strategy = await storage.getStrategyById(id);

  if (!strategy) {
    throw new NotFoundError("Strategy not found");
  }

  if (strategy.userId !== user.id) {
    throw new ForbiddenError();
  }

  const { name, description, criteria, stakeType, stakeAmount, kellyFraction, isActive } = req.body;

  const updated = await storage.updateStrategy(id, {
    name,
    description,
    criteria,
    stakeType,
    stakeAmount: stakeAmount?.toString(),
    kellyFraction: kellyFraction?.toString(),
    isActive,
  });

  res.json({ strategy: updated });
}));

// Delete strategy
router.delete("/strategies/:id", requireAuth, asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id);
  const user = req.user as any;
  const strategy = await storage.getStrategyById(id);

  if (!strategy) {
    throw new NotFoundError("Strategy not found");
  }

  if (strategy.userId !== user.id) {
    throw new ForbiddenError();
  }

  await storage.deleteStrategy(id);
  res.json({ success: true });
}));

// Run backtest on strategy
router.post("/strategies/:id/backtest", requireAuth, asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id);
  const user = req.user as any;
  const { startDate, endDate, initialBankroll } = req.body;

  const strategy = await storage.getStrategyById(id);

  if (!strategy) {
    throw new NotFoundError("Strategy not found");
  }

  if (strategy.userId !== user.id) {
    throw new ForbiddenError();
  }

  // Get historical matches for backtesting
  const start = startDate ? new Date(startDate) : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000); // Default 90 days
  const end = endDate ? new Date(endDate) : new Date();
  const bankroll = initialBankroll || 1000;

  const settledMatches = await storage.getSettledMatchesInRange(start, end);

  // Run backtest simulation
  const criteria = strategy.criteria as any;
  const bets: Array<{
    matchId: number;
    date: string;
    market: string;
    odds: number;
    stake: number;
    result: 'won' | 'lost' | 'push';
    profit: number;
  }> = [];

  let currentBankroll = bankroll;
  let maxBankroll = bankroll;
  let maxDrawdown = 0;

  for (const match of settledMatches) {
    if (!match.homeOdds || !match.awayOdds || match.homeScore === null || match.awayScore === null) {
      continue;
    }

    // Filter by sport
    if (criteria.sports && criteria.sports.length > 0 && !criteria.sports.includes(match.sport)) {
      continue;
    }

    // Get cached analysis or compute quick analysis
    let analysis = await storage.getMatchAnalysis(match.id);

    if (!analysis) {
      const homeTeamStats = await storage.getTeamStats(match.homeTeam, match.sport) ||
        algorithms.createDefaultTeamStats(match.homeTeam, match.sport);
      const awayTeamStats = await storage.getTeamStats(match.awayTeam, match.sport) ||
        algorithms.createDefaultTeamStats(match.awayTeam, match.sport);

      const quickResult = algorithms.quickAnalyzeMatch(homeTeamStats, awayTeamStats);
      analysis = {
        consensusHome: quickResult.homeWin.toString(),
        consensusDraw: quickResult.draw.toString(),
        consensusAway: quickResult.awayWin.toString(),
        modelAgreement: '0.7',
      } as any;
    }

    // Check each market for value
    const markets = criteria.markets || ['home', 'draw', 'away'];

    for (const market of markets) {
      let modelProb: number;
      let marketOdds: number;

      if (market === 'home') {
        modelProb = parseFloat(analysis.consensusHome || '0.33');
        marketOdds = parseFloat(match.homeOdds);
      } else if (market === 'away') {
        modelProb = parseFloat(analysis.consensusAway || '0.33');
        marketOdds = parseFloat(match.awayOdds);
      } else if (market === 'draw' && match.drawOdds) {
        modelProb = parseFloat(analysis.consensusDraw || '0.33');
        marketOdds = parseFloat(match.drawOdds);
      } else {
        continue;
      }

      // Apply filters
      if (criteria.minModelProbability && modelProb < criteria.minModelProbability) continue;
      if (criteria.maxModelProbability && modelProb > criteria.maxModelProbability) continue;
      if (criteria.maxOdds && marketOdds > criteria.maxOdds) continue;
      if (criteria.minOdds && marketOdds < criteria.minOdds) continue;

      const impliedProb = 1 / marketOdds;
      const edge = modelProb - impliedProb;

      if (criteria.minEdge && edge < criteria.minEdge) continue;

      // Calculate stake
      let stake: number;
      if (strategy.stakeType === 'kelly' && strategy.kellyFraction) {
        const kelly = algorithms.calculateKellyStake(modelProb, marketOdds, parseFloat(strategy.kellyFraction));
        stake = currentBankroll * kelly;
      } else if (strategy.stakeType === 'percentage' && strategy.stakeAmount) {
        stake = currentBankroll * (parseFloat(strategy.stakeAmount) / 100);
      } else {
        stake = parseFloat(strategy.stakeAmount || '10');
      }

      stake = Math.min(stake, currentBankroll * 0.1); // Max 10% per bet
      stake = Math.max(stake, 1); // Min $1

      // Determine result
      let result: 'won' | 'lost' | 'push';
      const homeWin = match.homeScore > match.awayScore;
      const awayWin = match.awayScore > match.homeScore;
      const draw = match.homeScore === match.awayScore;

      if (market === 'home' && homeWin) result = 'won';
      else if (market === 'away' && awayWin) result = 'won';
      else if (market === 'draw' && draw) result = 'won';
      else result = 'lost';

      const profit = result === 'won' ? stake * (marketOdds - 1) : -stake;

      bets.push({
        matchId: match.id,
        date: match.startsAt.toISOString(),
        market,
        odds: marketOdds,
        stake,
        result,
        profit
      });

      currentBankroll += profit;
      maxBankroll = Math.max(maxBankroll, currentBankroll);
      const drawdown = (maxBankroll - currentBankroll) / maxBankroll;
      maxDrawdown = Math.max(maxDrawdown, drawdown);
    }
  }

  // Calculate results
  const wonBets = bets.filter(b => b.result === 'won').length;
  const lostBets = bets.filter(b => b.result === 'lost').length;
  const pushBets = bets.filter(b => b.result === 'push').length;
  const totalStaked = bets.reduce((sum, b) => sum + b.stake, 0);
  const totalReturns = bets.filter(b => b.result === 'won').reduce((sum, b) => sum + b.stake * b.odds, 0);
  const profit = currentBankroll - bankroll;
  const roi = totalStaked > 0 ? (profit / totalStaked) * 100 : 0;
  const winRate = bets.length > 0 ? wonBets / bets.length : 0;

  // Calculate Sharpe ratio (simplified)
  const returns = bets.map(b => b.profit / b.stake);
  const avgReturn = returns.length > 0 ? returns.reduce((a, b) => a + b, 0) / returns.length : 0;
  const stdReturn = returns.length > 1 ? Math.sqrt(returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / (returns.length - 1)) : 1;
  const sharpeRatio = stdReturn > 0 ? avgReturn / stdReturn : 0;

  // Save backtest result
  const result = await storage.saveBacktestResult({
    strategyId: id,
    startDate: start,
    endDate: end,
    totalBets: bets.length,
    wonBets,
    lostBets,
    pushBets,
    winRate: winRate.toString(),
    totalStaked: totalStaked.toString(),
    totalReturns: totalReturns.toString(),
    profit: profit.toString(),
    roiPercent: roi.toString(),
    maxDrawdown: (maxDrawdown * 100).toString(),
    sharpeRatio: sharpeRatio.toString(),
    bets,
  });

  res.json({
    result: {
      ...result,
      summary: {
        totalBets: bets.length,
        wonBets,
        lostBets,
        pushBets,
        winRate: (winRate * 100).toFixed(1) + '%',
        profit: profit.toFixed(2),
        roi: roi.toFixed(2) + '%',
        maxDrawdown: (maxDrawdown * 100).toFixed(2) + '%',
        sharpeRatio: sharpeRatio.toFixed(2),
        finalBankroll: currentBankroll.toFixed(2)
      }
    }
  });
}));

// Get backtest results for strategy
router.get("/strategies/:id/backtest", requireAuth, asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id);
  const user = req.user as any;
  const strategy = await storage.getStrategyById(id);

  if (!strategy) {
    throw new NotFoundError("Strategy not found");
  }

  if (strategy.userId !== user.id) {
    throw new ForbiddenError();
  }

  const results = await storage.getBacktestResultsByStrategy(id);
  res.json({ results });
}));

// AI response generator
async function generateAIResponse(chatId: number, userMessage: string): Promise<string> {
  const client = getAnthropicClient();

  if (!client) {
    return generateFallbackResponse(userMessage);
  }

  try {
    // Get conversation history for context
    const messages = await storage.getMessagesByChat(chatId);
    const conversationHistory = messages.slice(-10).map((msg) => ({
      role: msg.role as "user" | "assistant",
      content: msg.content,
    }));

    // Add current message
    conversationHistory.push({ role: "user", content: userMessage });

    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      system: `You are a sports betting analysis assistant for ParlayEdge. You help users understand:
- Parlay construction and odds calculation
- Expected value and probability concepts
- The Kelly Criterion for bankroll management
- Risk assessment for multi-leg parlays
- General betting strategy

Be helpful, educational, and encourage responsible betting. Never guarantee wins or encourage reckless gambling. If asked about specific bets, provide analysis based on mathematical principles.`,
      messages: conversationHistory,
    });

    const textBlock = response.content.find((block) => block.type === "text");
    return textBlock ? textBlock.text : "I apologize, but I couldn't generate a response. Please try again.";
  } catch (error) {
    console.error("Anthropic API error:", error);
    return generateFallbackResponse(userMessage);
  }
}

// Fallback response when AI is unavailable
function generateFallbackResponse(userMessage: string): string {
  const lowerMessage = userMessage.toLowerCase();

  if (lowerMessage.includes("parlay") || lowerMessage.includes("bet")) {
    return "When building a parlay, consider the correlation between your picks. Independent events have multiplicative probabilities, so a 4-leg parlay with 50% picks each has only about 6.25% chance of hitting. Would you like me to analyze a specific parlay for you?";
  }

  if (lowerMessage.includes("odds") || lowerMessage.includes("value")) {
    return "Finding value in odds is key to long-term profitability. Compare the implied probability from the odds to your estimated true probability. If your estimated probability is higher, you may have found value. What odds are you looking at?";
  }

  if (lowerMessage.includes("bankroll") || lowerMessage.includes("kelly")) {
    return "The Kelly Criterion suggests betting a fraction of your bankroll equal to (bp - q) / b, where b is odds minus 1, p is win probability, and q is 1 - p. This maximizes long-term growth while managing risk. Would you like me to calculate Kelly for a specific bet?";
  }

  return "I can help you analyze parlays, understand odds and probability, manage your bankroll, and develop betting strategies. What would you like to know more about?";
}

export default router;
