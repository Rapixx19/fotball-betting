import "dotenv/config";
import express from "express";
import cors from "cors";
import session from "express-session";
import MemoryStore from "memorystore";
import passport from "../server/auth";
import routes from "../server/routes";

const app = express();

// Session store for serverless (use MemoryStore - stateless per invocation)
const MemoryStoreSession = MemoryStore(session);

// Middleware
app.use(cors({
  origin: process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : process.env.CLIENT_URL || "http://localhost:5173",
  credentials: true,
}));

app.use(express.json());

// Session configuration (simplified for serverless)
app.use(session({
  secret: process.env.SESSION_SECRET || "dev-secret-change-in-production",
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 24 * 60 * 60 * 1000,
  },
  store: new MemoryStoreSession({
    checkPeriod: 86400000,
  }),
}));

// Passport initialization
app.use(passport.initialize());
app.use(passport.session());

// API routes
app.use("/api", routes);

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", env: "vercel" });
});

export default app;
