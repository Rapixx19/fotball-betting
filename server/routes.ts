import { Router, Request, Response, NextFunction } from "express";
import Anthropic from "@anthropic-ai/sdk";
import nodemailer from "nodemailer";
import passport from "./auth";
import * as storage from "./storage";
import * as mathEngine from "./mathEngine";
import { asyncHandler, BadRequestError, NotFoundError, ForbiddenError } from "./errors";

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

// Match routes
router.get("/matches", asyncHandler(async (req, res) => {
  const status = req.query.status as string | undefined;
  const matches = await storage.getMatches(status);
  res.json({ matches });
}));

router.get("/matches/:id", asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id);
  const match = await storage.getMatchById(id);
  if (!match) {
    throw new NotFoundError("Match not found");
  }
  res.json({ match });
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
