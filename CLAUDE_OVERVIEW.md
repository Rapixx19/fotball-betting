# ParlayEdge — Claude Overview for AI Agent Layer

This document is the **single source of truth** for adding an AI agent analysis layer. It describes everything the system already has: architecture, algorithms, data models, and specs.

---

## 1. Project Summary

**ParlayEdge** (codebase: `sporsbetting`) is a sports parlay analysis app:
- **Frontend:** React 18 + Vite + Tailwind + shadcn/ui
- **Backend:** Express 5 + Passport.js
- **Database:** PostgreSQL (Supabase) via Drizzle ORM
- **Data source:** The Odds API (the-odds-api.com) v4
- **AI today:** Anthropic Claude for chat; math-based parlay analysis (no ML)

---

## 2. Algorithms (Implemented)

### 2.1 Math Engine (`server/mathEngine.ts`)

All probability and risk logic lives here.

| Function | Formula / Logic |
|----------|-----------------|
| **impliedProbability(odds)** | `1 / odds` |
| **probabilityToOdds(prob)** | `1 / prob` (prob must be > 0) |
| **calculateParlayOdds(legs)** | `Π leg.odds` |
| **calculateParlayProbability(legs)** | `Π impliedProbability(leg.odds)` (assumes independence) |
| **calculatePayout(stake, odds)** | `stake * odds` |
| **calculateExpectedValue(stake, winProb, payout)** | `winProb * payout - (1 - winProb) * stake` |
| **calculateKellyFraction(odds, winProb)** | `(b*p - q) / b` where `b = odds - 1`, `p = winProb`, `q = 1 - p`; clamped to `[0, 1]` |
| **assessRiskRating(legs, probability)** | Low: ≤2 legs & prob > 0.3; Medium: ≤4 legs & prob > 0.15; High: else |
| **toAmericanOdds(decimal)** | `≥2: +((dec-1)*100)`; `<2: -100/(dec-1)` |
| **fromAmericanOdds(american)** | `>0: american/100+1`; `<0: 100/|american|+1` |

**Validation rules:**
- Odds: 1 < odds ≤ 10000
- Probability: 0 ≤ prob ≤ 1
- Stake: 0 < stake ≤ 1,000,000
- Legs: 1–25 per parlay

**Recommendation logic** (`generateRecommendations`):
- EV < 0 → "Negative expected value - consider reducing stake"
- EV > 0 → "Positive expected value - favorable bet"
- Kelly < 0.01 → "Kelly suggests minimal or no bet"
- Kelly > 0.1 → "Kelly suggests X% of bankroll"
- legCount > 4 → "Large parlays have low hit rates - consider fewer legs"
- impliedProb < 0.05 → "Very low probability - high risk, high reward"
- riskRating === "high" → "High risk parlay - only bet what you can afford to lose"

**Main analysis** (`analyzeParlay`):
- Input: `legs: { odds, pick }[]`, `stake`, optional `estimatedWinProbability`
- Uses `estimatedWinProbability` if provided, else implied probability
- Returns: `combinedOdds`, `impliedProbability`, `expectedValue`, `kellyFraction`, `riskRating`, `recommendations[]`

---

### 2.2 Sync Service (`server/syncService.ts`)

**Smart refresh interval** (`calculateSmartInterval(hoursUntilMatch)`):

| Hours until match | Refresh interval |
|-------------------|-------------------|
| ≤ 0 (live) | 5 min |
| ≤ 2 | 15 min |
| ≤ 6 | 30 min |
| ≤ 24 | 2 h |
| ≤ 72 | 6 h |
| > 72 | 24 h |

---

### 2.3 Parlay Builder (`client/src/contexts/ParlayContext.tsx`)

- **Combined odds:** `legs.reduce((acc, leg) => acc * leg.odds, 1)`
- **One leg per match:** Toggling a pick replaces any existing leg for that match
- **Pick format:** `pick` is string (e.g. home/away/draw or team name)

---

## 3. External APIs

### 3.1 The Odds API (Implemented)

- **Base:** `https://api.the-odds-api.com/v4`
- **Auth:** `ODDS_API_KEY`
- **Endpoints used:** `/sports`, `/sports/{key}/events`, `/sports/{key}/odds`, `/sports/{key}/scores`
- **Quota headers:** `x-requests-remaining`, `x-requests-used`

**Supported sports keys:**
`americanfootball_nfl`, `americanfootball_ncaaf`, `basketball_nba`, `basketball_ncaab`, `baseball_mlb`, `icehockey_nhl`, `soccer_usa_mls`, `soccer_epl`, `soccer_germany_bundesliga`, `soccer_spain_la_liga`, `soccer_italy_serie_a`, `soccer_france_ligue_one`, `soccer_uefa_champs_league`, `mma_mixed_martial_arts`, `boxing_boxing`

### 3.2 Anthropic Claude (Implemented)

- **Model:** `claude-sonnet-4-20250514`
- **Env:** `ANTHROPIC_API_KEY`
- **Use:** Chat assistant (general parlay/odds/bankroll advice)
- **System prompt:** Sports betting analysis assistant for ParlayEdge; covers parlays, odds, EV, Kelly, risk; educational, no guarantees

---

## 4. Data Models

### 4.1 Drizzle Schema (`shared/schema.ts`)

| Table | Key Columns |
|-------|-------------|
| **users** | id, username, email, password, passwordResetToken, passwordResetExpires |
| **matches** | id, externalId, sport, league, homeTeam, awayTeam, homeOdds, awayOdds, drawOdds, startsAt, status, homeScore, awayScore |
| **slips** | id, userId, stake, potentialPayout, status, createdAt |
| **legs** | id, slipId, matchId, pick, odds, status |
| **chats** | id, userId, title, createdAt |
| **messages** | id, chatId, role, content, createdAt |

**Enums (string values):**
- `leg_status`: pending, won, lost, push
- `match_status`: upcoming, live, final
- `slip_status`: pending, won, lost, push

### 4.2 Sync Tables (raw SQL, not in Drizzle)

- **sync_settings:** sport_key, enabled, priority, refresh_interval_minutes, last_synced_at, last_sync_count
- **sync_log:** started_at, completed_at, sports_synced, matches_created, matches_updated, api_requests_used, status

---

## 5. API Endpoints

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| POST | `/api/auth/register` | No | Register |
| POST | `/api/auth/login` | No | Login |
| POST | `/api/auth/logout` | Yes | Logout |
| GET | `/api/auth/user` | No | Current user |
| POST | `/api/auth/forgot-password` | No | Request password reset |
| POST | `/api/auth/reset-password` | No | Reset with token |
| GET | `/api/matches` | No | Matches (filtered) |
| GET | `/api/matches/:id` | No | Match details |
| GET | `/api/matches/by-sport` | No | Matches grouped by sport |
| GET | `/api/matches/stats` | No | Match stats |
| GET | `/api/sports` | No | Sports from DB |
| GET | `/api/odds/sports` | No | Odds API sports |
| GET | `/api/odds/events/:sport` | No | Odds API events |
| GET | `/api/odds/live/:sport` | No | Odds API live odds |
| GET | `/api/odds/scores/:sport` | No | Odds API scores |
| GET | `/api/odds/quota` | No | Odds API quota |
| GET | `/api/slips` | Yes | User slips (paginated: `{ data, nextCursor, hasMore }`) |
| GET | `/api/slips/:id` | Yes | Slip + legs |
| POST | `/api/slips` | Yes | Create slip |
| DELETE | `/api/slips/:id` | Yes | Delete slip |
| GET | `/api/chats` | Yes | User chats |
| POST | `/api/chats` | Yes | Create chat |
| GET | `/api/chats/:id/messages` | Yes | Chat messages |
| POST | `/api/chats/:id/messages` | Yes | Send message |
| DELETE | `/api/chats/:id` | Yes | Delete chat |
| **POST** | **`/api/analyze`** | Yes | **Analyze parlay** — body: `{ legs: [{ odds, pick }], stake }` → `{ analysis: ParlayAnalysis }` |
| POST | `/api/admin/matches` | Admin | Create match |
| PUT | `/api/admin/matches/:id` | Admin | Update match |
| DELETE | `/api/admin/matches/:id` | Admin | Delete match |
| POST | `/api/admin/matches/:id/settle` | Admin | Settle match |
| POST | `/api/admin/odds/sync` | Admin | Sync from Odds API |
| GET/PUT/POST | `/api/admin/sync/*` | Admin | Sync settings, status, logs, run, discover, cleanup |

---

## 6. Data Flow

1. **Matches:** Odds API → sync service → `matches` → `/api/matches`
2. **Parlay build:** Matches page → picks → `ParlayContext` → Analysis page
3. **Analysis:** `POST /api/analyze` → `mathEngine.analyzeParlay()` → EV, Kelly, risk, recommendations
4. **Slips:** `POST /api/slips` creates slip + legs
5. **Settlement:** Admin settles match → leg/slip status updates
6. **AI chat:** User message → Anthropic Claude → stored in `messages`

---

## 7. Types for Agent Use

```ts
// Analysis input
interface LegInput {
  odds: number;
  pick: string;
}

// Analysis output
interface ParlayAnalysis {
  combinedOdds: number;
  impliedProbability: number;
  expectedValue: number;
  kellyFraction: number;
  riskRating: "low" | "medium" | "high";
  recommendations: string[];
}

// Parlay leg in context (with optional match info)
interface ParlayLeg {
  matchId: number;
  pick: string;
  odds: number;
  matchInfo?: { homeTeam: string; awayTeam: string; sport: string };
}
```

---

## 8. Planned / Not Implemented (from CURSOR_PROMPTS.md)

These are in the prompt library but **not in the codebase**:

| Feature | Description |
|---------|-------------|
| **API-Football** | Alternative data source (fixtures, stats, odds from RapidAPI) |
| **Team ratings** | Elo, π-rating, xG, form stored in DB and updated from results |
| **Dixon-Coles** | Football Poisson model with correction |
| **Bivariate Poisson** | Alternative football model with covariance |
| **Logistic ensemble** | Logistic regression replacing hardcoded weighted average |
| **Gradient boosting** | XGBoost/LightGBM leaf values as lookup table |
| **Basketball model** | Offensive/defensive ratings, expected points |
| **Tennis model** | Surface-specific Elo, serve/return |
| **team_ratings table** | Elo, π-rating, xg_attack, xg_defence, form_last5 |
| **match_results table** | Historical results for rating updates |

---

## 9. Constraints (from TECHNICAL_CONSTRAINTS.md)

- **Hash routing:** `/#/path` — never BrowserRouter
- **No localStorage:** Use cookies/API/DB
- **Session cookie:** `secure: false` (iframe/proxy)
- **Supabase SSL:** `rejectUnauthorized: false`
- **API responses:** Wrapped objects, not raw arrays
- **bcrypt:** 12 rounds
- **Port:** 5000

---

## 10. Where an AI Agent Layer Fits

### Current State

- **Analysis:** Pure math (`mathEngine.analyzeParlay`) — EV, Kelly, risk, recommendations
- **Chat:** General assistant with domain knowledge (parlays, EV, Kelly); no access to live parlay or match data

### Hooks for AI Agents

1. **`POST /api/analyze`** — Input: `{ legs, stake }`. Output: `ParlayAnalysis`. An agent could:
   - Receive the same input
   - Use `ParlayAnalysis` as baseline
   - Add natural-language commentary, alternative scenarios, or sport-specific insights

2. **Match data** — `GET /api/matches`, `/api/matches/:id`, `/api/matches/by-sport` provide teams, odds, status. Agents can reason about picks and context.

3. **Parlay context** — `ParlayLeg[]` with `matchInfo` (homeTeam, awayTeam, sport) is the semantic input for “this parlay”.

4. **Math engine** — All formulas are in `mathEngine.ts`. Agents can cite or extend them.

### Suggested Agent Architecture

- **Agent 1 – Parlay Analyzer:** Takes `legs` + `stake`, calls `analyzeParlay`, enriches with narrative and edge cases.
- **Agent 2 – Match Analyst:** Uses match list + odds to suggest value picks or correlations.
- **Agent 3 – Chat Enhancer:** Uses structured analysis (EV, Kelly, risk) when responding to parlay-related questions.

All agents should respect: existing math (EV, Kelly, implied prob), validation (1–25 legs, odds range), and API response shapes (wrapped objects).

---

## 11. Env Vars

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection |
| `SESSION_SECRET` | Session signing |
| `CLIENT_URL` | CORS origin (e.g. `http://localhost:5173`) |
| `ODDS_API_KEY` | The Odds API |
| `ANTHROPIC_API_KEY` | Claude chat |
| `REDIS_URL` | Optional session store (else MemoryStore) |
| `ADMIN_USERNAMES` | Comma-separated admin usernames |
| `SMTP_*` | Password reset email |

---

## 12. File Map

| Path | Role |
|------|------|
| `server/mathEngine.ts` | All probability/EV/Kelly/risk logic |
| `server/routes.ts` | API, auth, analyze, AI chat |
| `server/oddsApi.ts` | The Odds API client |
| `server/syncService.ts` | Match sync, smart interval |
| `server/storage.ts` | DB operations |
| `server/auth.ts` | Passport local strategy |
| `shared/schema.ts` | Drizzle tables |
| `shared/types.ts` | API and domain types |
| `client/src/contexts/ParlayContext.tsx` | Parlay builder state |
