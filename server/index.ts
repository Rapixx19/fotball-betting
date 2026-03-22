import "dotenv/config";
import express from "express";
import cors from "cors";
import session from "express-session";
import MemoryStore from "memorystore";
import { Redis } from "ioredis";
import { RedisStore } from "connect-redis";
import rateLimit from "express-rate-limit";
import passport from "./auth";
import routes from "./routes";

const app = express();
const PORT = process.env.PORT || 5000;

// Session store configuration
function createSessionStore() {
  const redisUrl = process.env.REDIS_URL;

  if (redisUrl) {
    try {
      const redisClient = new Redis(redisUrl);

      redisClient.on("error", (err) => {
        console.error("Redis connection error:", err);
      });

      redisClient.on("connect", () => {
        console.log("Connected to Redis");
      });

      return new RedisStore({ client: redisClient });
    } catch (err) {
      console.warn("Failed to connect to Redis, falling back to MemoryStore:", err);
    }
  }

  // Fallback to MemoryStore for development
  console.log("Using MemoryStore for sessions (not recommended for production)");
  const MemoryStoreSession = MemoryStore(session);
  return new MemoryStoreSession({
    checkPeriod: 86400000, // 24 hours
  });
}

// Middleware
app.use(cors({
  origin: process.env.CLIENT_URL || "http://localhost:5173",
  credentials: true,
}));

app.use(express.json());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later" },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 auth attempts per window per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many login attempts, please try again later" },
});

app.use("/api", limiter);
app.use("/api/auth/login", authLimiter);
app.use("/api/auth/register", authLimiter);

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || "dev-secret-change-in-production",
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false,
    httpOnly: true,
    sameSite: "lax",
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
  },
  store: createSessionStore(),
}));

// Passport initialization
app.use(passport.initialize());
app.use(passport.session());

// API routes
app.use("/api", routes);

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export default app;
