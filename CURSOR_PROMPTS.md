# ParlayEdge — Cursor Prompt Library
# Paste any of these directly into Cursor chat with Claude

---

## PROMPT 1 — Real Live Data: API-Football Integration

```
I'm building ParlayEdge, a sports betting parlay analysis app.
The backend is Express + TypeScript, the database is Supabase PostgreSQL via Drizzle ORM.

Currently ALL match data and odds are generated with Math.random() in server/routes.ts.
I need to replace this with real live data from API-Football (https://www.api-football.com).

Here is the current mock data flow:
- generateFootballMatches() in server/routes.ts generates fake fixtures
- generateBasketballMatches(), generateTennisMatches(), generateBaseballMatches(), generateF1Matches() do the same
- All of this feeds into getMatches() which has a 30-second cache
- The /api/matches endpoint returns this cache

What I need you to build:

1. Create server/providers/apiFootball.ts
   - Use API-Football v3 (RapidAPI key stored in env var API_FOOTBALL_KEY)
   - Fetch today's fixtures: GET /fixtures?date=YYYY-MM-DD
   - Fetch live odds: GET /odds?fixture={id}&bookmaker=8 (bet365 = bookmaker 8)
   - Fetch fixture statistics: GET /fixtures/statistics?fixture={id}
   - Map the API response to our internal match shape (same shape as buildFootballMatch() returns)
   - Cache responses in memory for 5 minutes to stay within API rate limits (100 req/day free tier)
   - Fall back to mock data if API key is missing or request fails

2. Create server/providers/oddsApi.ts  
   - Use The Odds API (https://the-odds-api.com), key in env var ODDS_API_KEY
   - Fetch: GET /v4/sports/soccer_epl/odds?regions=eu&markets=h2h,totals&oddsFormat=decimal
   - This gives us real bookmaker odds to compute edge against
   - Map to our internal odds shape: { home: { odds, fairProb, modelProb, edge }, draw: {...}, away: {...} }

3. Modify server/routes.ts getMatches() function:
   - Try apiFootball.getTodayFixtures() first
   - Merge real odds from oddsApi.getOdds() into each fixture
   - Keep the mock generator as fallback if both APIs fail
   - Keep the 30-second cache

4. Add to .env.example:
   API_FOOTBALL_KEY=your_key_here
   ODDS_API_KEY=your_key_here

The internal match shape that everything must conform to is defined in buildFootballMatch() in server/routes.ts. Do not change the shape — only the data source. The math engine (Dixon-Coles, xG, Elo) still runs on top of real fixture data — we compute our own modelProb and compare against real book odds.
```

---

## PROMPT 2 — Historical Result Storage & Live Elo/π-Rating Updates

```
I'm building ParlayEdge. The backend is Express + TypeScript + Drizzle ORM + Supabase PostgreSQL.

Currently Elo and π-ratings are hardcoded static values in a TEAM_RATINGS object in server/routes.ts.
They never update. I need them to update after every real match result.

Here is the current rating system (already implemented in server/routes.ts):
- eloToProb(eloDiff): standard logistic Elo, 400-point scale
- piRatingToProb(piDiff): Gaussian CDF approximation
- featureEnsemble(): blends Elo(0.30) + π(0.25) + xG(0.20) + form(0.15) + home(0.10)

What I need you to build:

1. Add two new Drizzle tables to shared/schema.ts:

   team_ratings:
     id serial PK
     team_name text unique not null
     sport text not null  -- football | basketball | tennis | f1
     elo_rating real not null default 1500
     pi_rating real not null default 1.50
     xg_attack real not null default 1.40
     xg_defence real not null default 1.40
     form_last5 text[] not null default [] -- ["W","D","L","W","W"]
     matches_played integer not null default 0
     updated_at timestamp default now()

   match_results:
     id serial PK
     fixture_id text unique not null  -- from API-Football fixture ID
     home_team text not null
     away_team text not null
     home_score integer not null
     away_score integer not null
     sport text not null
     league text not null
     played_at timestamp not null
     home_elo_before real
     away_elo_before real
     home_elo_after real
     away_elo_after real
     created_at timestamp default now()

2. Create server/ratings.ts with these functions:

   updateEloRatings(homeTeam, awayTeam, homeScore, awayScore):
     - K-factor = 32
     - Expected: E = 1 / (1 + 10^(-Δ/400))
     - Result S: 1 if home wins, 0.5 if draw, 0 if away wins
     - New rating: R' = R + K * (S - E)
     - Save to team_ratings table

   updatePiRatings(homeTeam, awayTeam, homeScore, awayScore):
     - α = 0.04 (learning rate)
     - Expected goal diff = piHome - piAway + 0.3 (home advantage)
     - Actual goal diff = homeScore - awayScore
     - Δπ_home = α * (actualDiff - expectedDiff)
     - Δπ_away = -Δπ_home
     - Save to team_ratings table

   updateForm(team, result): -- result is "W" | "D" | "L"
     - Append to form_last5, keep only last 5 entries

   processMatchResult(fixtureId, homeTeam, awayTeam, homeScore, awayScore, sport, league, playedAt):
     - Check match_results to avoid duplicate processing
     - Call updateEloRatings, updatePiRatings, updateForm
     - Insert into match_results

3. Create server/jobs/resultSync.ts:
   - Runs every 60 minutes via setInterval
   - Calls API-Football GET /fixtures?date=yesterday&status=FT to get completed matches
   - For each result not already in match_results, calls processMatchResult()
   - Log how many results were processed

4. In server/routes.ts getTeamRating(name):
   - First look up team_ratings table in DB
   - Fall back to the hardcoded TEAM_RATINGS object if not found

Run drizzle-kit push after adding the tables.
```

---

## PROMPT 3 — Bivariate Poisson Model

```
I'm building ParlayEdge. The backend is Express + TypeScript.

Currently the football prediction engine uses Independent Poisson with Dixon-Coles correction (in server/routes.ts).
I need to add a proper Bivariate Poisson model alongside it and blend the two.

The bivariate Poisson distribution for (X,Y) goal scores is:
P(X=x, Y=y) = e^(-(λ1+λ2+λ3)) * (λ1^x / x!) * (λ2^y / y!) * Σ_{k=0}^{min(x,y)} C(x,k)*C(y,k)*k! * (λ3/(λ1*λ2))^k

Where:
- λ1 = home team scoring rate (independent component)
- λ2 = away team scoring rate (independent component)  
- λ3 = covariance parameter (correlation between home and away goals)
- We estimate λ3 ≈ 0.10 as a prior (Karlis & Ntzoufras 2003)

What I need you to add to server/routes.ts:

1. Function bivariatePoisson(x, y, lambda1, lambda2, lambda3):
   - Compute P(X=x, Y=y) using the formula above
   - Use log-space arithmetic to avoid underflow
   - Return the probability as a number

2. Function bivariateOutcomes(lambdaH, lambdaA, lambda3=0.10, maxGoals=8):
   - Compute the full score matrix up to maxGoals × maxGoals
   - Return { homeWin, draw, awayWin, over25, btts } same shape as dixonColesOutcomes()

3. Modify computeFootballModelProbs():
   - Compute both dixonColesOutcomes() and bivariateOutcomes() 
   - Blend them: 50% Dixon-Coles + 50% Bivariate Poisson
   - The blended result feeds into the existing featureEnsemble step (no change there)
   - Add bivariateHomeWin, bivariateDraw, bivariateAwayWin to modelBreakdown output

4. Expose the bivariate probabilities in the /api/matches response modelBreakdown field so the frontend can display them.

Keep all existing functions. Do not remove Dixon-Coles. Just add Bivariate alongside it and blend.
```

---

## PROMPT 4 — Gradient Boosting Ensemble (proper ML replacement)

```
I'm building ParlayEdge. The backend is Express + TypeScript.

Currently the "feature ensemble" in server/routes.ts is just a hardcoded weighted average:
  blend = 0.30*eloProb + 0.25*piProb + 0.20*xgProb + 0.15*formProb + 0.10*homeProb

This is NOT a real gradient boosting model. I need to replace it with a proper trained model approach.

Since we can't run Python scikit-learn in Node.js at runtime, the approach is:
1. Pre-compute the model coefficients offline (I'll run the training separately)
2. Hard-code the trained logistic regression / gradient boosting leaf values as a lookup table in TypeScript
3. Apply them at runtime

For now, implement a proper logistic regression with interaction terms (much better than simple weighted average):

1. Replace featureEnsemble() in server/routes.ts with a new function logisticEnsemble():

   Features (same inputs as before):
   - x1 = eloToProb(eloDiff)          -- Elo-derived win prob
   - x2 = piRatingToProb(piDiff)       -- π-rating win prob
   - x3 = xgStrengthProb               -- xG strength (normalised 0-1)
   - x4 = formProb                     -- form-based prob (0-1)
   - x5 = homeAdvantage                -- 0.06 constant for home team

   Interaction terms (these capture non-linear effects):
   - x6 = x1 * x2                     -- Elo × π agreement
   - x7 = x3 * x4                     -- xG × form agreement  
   - x8 = (x1 - x2)^2                 -- Elo/π disagreement penalty
   - x9 = x5 * x1                     -- home advantage amplified by Elo strength

   Coefficients (use these calibrated values — to be updated with real training):
   β = [β0=-0.15, β1=1.8, β2=1.4, β3=1.2, β4=0.8, β5=0.6, β6=0.9, β7=0.5, β8=-0.3, β9=0.4]

   Logit = β0 + β1*x1 + β2*x2 + β3*x3 + β4*x4 + β5*x5 + β6*x6 + β7*x7 + β8*x8 + β9*x9
   Output = sigmoid(Logit) = 1 / (1 + e^(-Logit))
   Clamp output to [0.06, 0.94]

2. Add a function gbmLeafScore(features) as a stub:
   - This is where a real XGBoost/LightGBM model would run
   - For now implement it as 3 shallow decision tree stumps averaged:
     Tree 1: if eloDiff > 100 → 0.62, elif eloDiff < -100 → 0.38, else → 0.50
     Tree 2: if piDiff > 0.5 → 0.60, elif piDiff < -0.5 → 0.40, else → 0.50
     Tree 3: if xgStrengthDiff > 0.2 → 0.58, elif xgStrengthDiff < -0.2 → 0.42, else → 0.50
   - Average the 3 tree outputs
   - Add a comment: "// TODO: replace with exported XGBoost model weights when training data is available"

3. Modify computeFootballModelProbs() to blend:
   - 60% logisticEnsemble() output
   - 40% gbmLeafScore() output
   - Replace the current BLEND_ENS step with this blended value

4. Add gbmScore to modelBreakdown output so the dashboard can display it.
```

---

## PROMPT 5 — Session Persistence on Vercel (connect-pg-simple)

```
I'm deploying ParlayEdge to Vercel. The backend is Express + TypeScript + Supabase PostgreSQL.

The current session store uses memorystore (in-memory). This breaks on Vercel because:
- Each serverless function invocation is stateless
- Memory resets on every cold start
- Users get logged out randomly

I need to replace memorystore with connect-pg-simple so sessions are stored in Supabase PostgreSQL.

Current session setup in server/index.ts:
  import MemoryStore from "memorystore";
  const MStore = MemoryStore(session);
  app.use(session({
    secret: process.env.SESSION_SECRET || "parlayedge-dev-secret-change-in-prod",
    resave: false,
    saveUninitialized: false,
    store: new MStore({ checkPeriod: 86400000 }),
    cookie: {
      secure: false,   // CRITICAL: must stay false — site is proxied via HTTP iframe
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000,
      sameSite: "lax",
    },
  }));

What to change:

1. Install: npm install connect-pg-simple @types/connect-pg-simple

2. Replace the MemoryStore import and setup with connect-pg-simple:
   import connectPgSimple from "connect-pg-simple";
   const PgStore = connectPgSimple(session);
   
   Store config:
   new PgStore({
     conString: process.env.DATABASE_URL,
     tableName: "sessions",
     createTableIfMissing: true,
     ssl: { rejectUnauthorized: false },
     ttl: 7 * 24 * 60 * 60, // 7 days in seconds
   })

3. Keep all other session options EXACTLY the same, especially:
   - secure: false  (DO NOT change this — it will break login in the iframe proxy)
   - sameSite: "lax"
   - httpOnly: true

4. The DATABASE_URL env var is already set. Make sure it's used here.

5. The connect-pg-simple library will auto-create a "sessions" table in Supabase on first run. No migration needed.

Do not change anything else in server/index.ts. Only swap the session store.
```

---

## PROMPT 6 — Basketball: Proper Points-Based Model

```
I'm building ParlayEdge. Backend is Express + TypeScript.

Currently generateBasketballMatches() in server/routes.ts uses only Elo ratings to compute win probability. There's no basketball-specific math.

Basketball is fundamentally different from football. I need a proper model.

What to implement in server/routes.ts:

1. Function computeBasketballModelProbs(homeTeam, awayTeam):
   
   Team ratings already exist in TEAM_RATINGS with:
   - elo: number (standard Elo)
   - xgAttack: number -- for basketball this represents offensive rating (points per 100 possessions, ~108-120)
   - xgDefence: number -- defensive rating (opponent points per 100 possessions, ~108-115)
   
   Steps:
   a) Compute expected point differential:
      homeOrtg = hR.xgAttack   (offensive rating)
      homeDrtg = hR.xgDefence  (defensive rating, lower = better)
      awayOrtg = aR.xgAttack
      awayDrtg = aR.xgDefence
      
      -- Expected points scored by each team (pace-adjusted):
      homeExpectedPts = (homeOrtg + awayDrtg) / 2 + 3.2  (3.2 = home court bonus in NBA)
      awayExpectedPts = (awayOrtg + homeDrtg) / 2
      
      expectedDiff = homeExpectedPts - awayExpectedPts
   
   b) Convert point differential to win probability using historical NBA calibration:
      -- In NBA, each point of expected margin ≈ 3% win probability shift
      homeWinProb = sigmoid(expectedDiff / 10) where sigmoid(x) = 1/(1+e^(-x))
      clamp to [0.10, 0.90]
   
   c) Blend with Elo: 60% points model + 40% Elo
      eloProb = eloToProb(hR.elo - aR.elo + 30)  -- +30 for home court in Elo terms
      finalHomeProb = 0.60 * homeWinProb + 0.40 * eloProb
   
   d) Total points line:
      totalLine = homeExpectedPts + awayExpectedPts
      -- Model over probability: compare our expected total vs the book's total line
      -- If our expected total > book line by >3pts → over has edge

2. Update generateBasketballMatches() to use computeBasketballModelProbs() instead of just eloToProb()

3. Update TEAM_RATINGS for NBA teams so xgAttack and xgDefence represent real offensive/defensive ratings (not goals):
   Use these approximate 2025-26 season values (offensive rating / defensive rating):
   LA Lakers: ortg=116.2, drtg=113.5
   Boston Celtics: ortg=122.1, drtg=109.4
   Golden State Warriors: ortg=118.8, drtg=112.0
   Miami Heat: ortg=112.3, drtg=111.8
   Milwaukee Bucks: ortg=119.5, drtg=113.2
   Phoenix Suns: ortg=115.4, drtg=114.8
   Denver Nuggets: ortg=118.9, drtg=112.1
   Dallas Mavericks: ortg=117.2, drtg=114.5
   Philadelphia 76ers: ortg=114.8, drtg=113.0
   Chicago Bulls: ortg=111.2, drtg=115.8
   Brooklyn Nets: ortg=109.5, drtg=117.4
   Toronto Raptors: ortg=113.0, drtg=114.2

4. Add to modelBreakdown for basketball: homeOrtg, homeDrtg, awayOrtg, awayDrtg, expectedDiff, totalLine
```

---

## PROMPT 7 — Tennis: Surface + Serve/Return Model

```
I'm building ParlayEdge. Backend is Express + TypeScript.

Currently tennis predictions in generateTennisMatches() use only Elo. I need a surface-aware model.

What to implement in server/routes.ts:

1. Add surface-specific Elo ratings to TEAM_RATINGS for tennis players:
   Replace the single elo value with:
   - eloHard: number    (hard court Elo)
   - eloClay: number    (clay court Elo)
   - eloGrass: number   (grass court Elo)
   - serveRating: number   (0-1, how dominant their serve is, e.g. Isner=0.92, Djokovic=0.75)
   - returnRating: number  (0-1, return of serve quality, e.g. Djokovic=0.90, Kyrgios=0.55)
   
   Use these values:
   Jannik Sinner:     eloHard=2050, eloClay=1980, eloGrass=1960, serve=0.78, return=0.85
   Carlos Alcaraz:    eloHard=1990, eloClay=2040, eloGrass=1970, serve=0.80, return=0.82
   Novak Djokovic:    eloHard=2060, eloClay=2080, eloGrass=2090, serve=0.76, return=0.92
   Alexander Zverev:  eloHard=1920, eloClay=1940, eloGrass=1860, serve=0.82, return=0.72
   Aryna Sabalenka:   eloHard=1890, eloClay=1840, eloGrass=1810, serve=0.84, return=0.75
   Iga Swiatek:       eloHard=1930, eloClay=2020, eloGrass=1850, serve=0.74, return=0.88
   Coco Gauff:        eloHard=1840, eloClay=1830, eloGrass=1790, serve=0.75, return=0.80
   Elena Rybakina:    eloHard=1860, eloClay=1820, eloGrass=1880, serve=0.88, return=0.72
   Rafael Nadal:      eloHard=1920, eloClay=2080, eloGrass=1930, serve=0.77, return=0.84
   Holger Rune:       eloHard=1810, eloClay=1840, eloGrass=1790, serve=0.76, return=0.75
   Daniil Medvedev:   eloHard=1960, eloClay=1820, eloGrass=1880, serve=0.79, return=0.83
   Stefanos Tsitsipas:eloHard=1870, eloClay=1920, eloGrass=1830, serve=0.78, return=0.76

2. Function computeTennisModelProbs(p1, p2, surface: "Hard"|"Clay"|"Grass"):

   a) Surface-specific Elo:
      p1SurfElo = surface === "Hard" ? p1.eloHard : surface === "Clay" ? p1.eloClay : p1.eloGrass
      (same for p2)
      eloProb = eloToProb(p1SurfElo - p2SurfElo)
   
   b) Serve-return model:
      -- On fast surfaces (Hard/Grass), serve dominates more
      surfaceServeWeight = surface === "Clay" ? 0.35 : 0.55
      
      -- p1 holds serve at rate: serveHoldRate = 0.5 + (p1.serveRating - p2.returnRating) * 0.4
      -- p2 holds serve at rate: p2HoldRate = 0.5 + (p2.serveRating - p1.returnRating) * 0.4
      -- clamp both to [0.45, 0.95]
      
      -- Convert hold rates to match win probability (Bradley-Terry):
      serveReturnProb = p1HoldRate / (p1HoldRate + p2HoldRate - p1HoldRate * p2HoldRate)
      -- Note: this is a rough approximation of the geometric series for a tennis set
   
   c) Blend: (1 - surfaceServeWeight)*eloProb + surfaceServeWeight*serveReturnProb

3. Update generateTennisMatches() to use computeTennisModelProbs(p1, p2, surface)

4. Add to modelBreakdown: p1SurfElo, p2SurfElo, surface, serveReturnProb, eloProb, blend weights
```

---

## PROMPT 8 — Vercel Full-Stack Deployment Fix

```
I'm deploying ParlayEdge to Vercel. It's a full-stack app: React frontend + Express backend.

The current setup does NOT work on Vercel because:
1. Vercel can't run a long-lived Express server — it needs serverless functions
2. The build outputs dist/index.cjs (Express server) and dist/public/ (static frontend)
3. The vercel.json routes /api/* to the Express server and /* to static files
4. BUT Vercel's @vercel/node adapter has a 50MB limit and our bundle is 1.1MB — that's fine
5. The real issue: the Express app calls httpServer.listen() which doesn't work in serverless

Here is what needs to change:

1. Create api/index.ts (Vercel serverless entry point):
   - Import the Express app from server/index.ts BUT do not call .listen()
   - Export the app as default: export default app
   - Vercel will wrap it automatically
   
   The trick: server/index.ts currently does everything inside an async IIFE that calls listen().
   Refactor it so the app setup is exported separately from the listen() call:
   
   In server/index.ts:
   - Export: export { app, httpServer }
   - Only call httpServer.listen() if process.env.VERCEL !== "1"
   
   In api/index.ts:
   - import { app } from "../server/index"
   - export default app

2. Update vercel.json:
   {
     "version": 2,
     "builds": [
       { "src": "api/index.ts", "use": "@vercel/node" },
       { "src": "client/package.json", "use": "@vercel/static-build", "config": { "distDir": "dist/public" } }
     ],
     "routes": [
       { "src": "/api/(.*)", "dest": "/api/index.ts" },
       { "src": "/(.*)", "dest": "/dist/public/$1" }
     ]
   }

   Actually simpler — just use the pre-built output:
   {
     "version": 2,
     "buildCommand": "npm run build",
     "outputDirectory": "dist/public",
     "functions": {
       "api/index.ts": { "maxDuration": 30 }
     },
     "routes": [
       { "src": "/api/(.*)", "dest": "/api/index.ts" },
       { "handle": "filesystem" },
       { "src": "/(.*)", "dest": "/index.html" }
     ]
   }

3. The DATABASE_URL, SESSION_SECRET, NODE_ENV env vars must be set in Vercel dashboard.

4. CRITICAL session cookie constraint: secure: false MUST stay. The app is embedded in an iframe 
   proxy that uses HTTP. Setting secure: true will silently break all login/logout.

5. After deploying, test these routes work:
   POST /api/auth/register
   POST /api/auth/login  
   GET /api/auth/me
   GET /api/model/scoreboard
   GET /api/parlay/slips

Do not change the frontend routing — it uses hash-based routing (/#/route) via wouter's useHashLocation. This is intentional and must not be changed to path-based routing.
```

---

## PROMPT 9 — Complete Database Schema (Reference)

```
The ParlayEdge Supabase database (PostgreSQL) has these tables.
Connection: postgresql://postgres:LucieFerdi2!@db.qgwtimdvqipzhvnqsmwm.supabase.co:5432/postgres
SSL: { rejectUnauthorized: false }

EXISTING TABLES (already in Supabase):

users:
  id serial PK
  email text unique not null
  username text unique not null
  password_hash text not null
  created_at timestamp default now()

parlay_slips:
  id serial PK
  user_id integer references users(id) on delete cascade
  selections jsonb not null  -- ParlaySelection[]
  total_odds real not null
  target_multiplier real not null
  stake real not null default 10
  potential_return real not null
  model_parlay_prob real
  fair_parlay_odds real
  parlay_edge real
  kelly_fraction real
  confidence_score integer
  status text not null default 'pending'
  created_at text not null

communities:
  id serial PK
  name text unique not null
  description text not null default ''
  sport text not null default 'all'
  is_private boolean not null default false
  owner_id integer references users(id) on delete cascade not null
  member_count integer not null default 1
  created_at timestamp default now()

community_members:
  id serial PK
  community_id integer references communities(id) on delete cascade not null
  user_id integer references users(id) on delete cascade not null
  role text not null default 'member'
  joined_at timestamp default now()

community_slips:
  id serial PK
  community_id integer references communities(id) on delete cascade not null
  slip_id integer references parlay_slips(id) on delete cascade not null
  shared_by_user_id integer references users(id) on delete cascade not null
  comment text not null default ''
  likes integer not null default 0
  shared_at timestamp default now()

follows:
  id serial PK
  follower_id integer references users(id) on delete cascade not null
  following_id integer references users(id) on delete cascade not null
  created_at timestamp default now()

TABLES TO ADD (via drizzle-kit push after updating shared/schema.ts):

team_ratings: (see Prompt 2)
match_results: (see Prompt 2)
sessions: (auto-created by connect-pg-simple — see Prompt 5)

ParlaySelection type (stored as JSONB in parlay_slips.selections):
{
  matchId: string
  matchLabel: string
  market: string
  selection: string
  odds: number
  probability: number
  edge: number
}
```

---

## PROMPT 10 — Critical Constraints (Always Include This)

```
CRITICAL CONSTRAINTS for ParlayEdge — never violate these:

1. ROUTING: App uses hash-based routing via wouter's useHashLocation hook.
   <Router hook={useHashLocation}> in App.tsx.
   ALL routes are /#/path. NEVER switch to BrowserRouter or path routing.
   Reason: app is served as static files in a sandboxed iframe.

2. NO LOCALSTORAGE: The app runs inside a sandboxed iframe where localStorage is blocked.
   Never use localStorage, sessionStorage, or IndexedDB.
   All persistent state must use React state + backend API.

3. SESSION COOKIE secure: false — ALWAYS.
   The site is proxied through an HTTP iframe context.
   secure: true will silently break all authentication.
   This is in server/index.ts and must never change.

4. SUPABASE SSL: Always pass ssl: { rejectUnauthorized: false } to pg Pool.
   The Supabase cert chain would otherwise cause connection rejection.

5. API RESPONSE SHAPES — these are wrapped objects, not bare arrays:
   GET /api/parlay/slips → { slips: ParlaySlip[] }
   GET /api/model/scoreboard → { scoreboard: ScoredMatch[] }
   GET /api/matches → { matches: Match[] }
   Frontend must unwrap before .map():
   const slips = Array.isArray(data) ? data : data?.slips ?? []

6. AUTH: Passport.js local strategy, bcrypt 12 rounds, express-session.
   useAuth() hook returns { user, authState, login, register, logout }
   user is null when not logged in.

7. DRIZZLE-KIT: Always prefix with NODE_TLS_REJECT_UNAUTHORIZED=0:
   NODE_TLS_REJECT_UNAUTHORIZED=0 npx drizzle-kit push

8. DEMO USER in Supabase (id=1):
   email: demo@parlayedge.com
   password: Demo1234!
   username: DemoUser
```
