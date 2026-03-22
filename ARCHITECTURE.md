# Architecture Overview

## System Architecture

ParlayEdge follows a modern full-stack architecture with clear separation between frontend and backend concerns.

```
┌─────────────────────────────────────────────────────────────┐
│                        Client                                │
│  ┌─────────────────────────────────────────────────────────┐│
│  │  React 18 + Vite + Tailwind CSS                         ││
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐ ││
│  │  │   Pages     │  │ Components  │  │  Query Client   │ ││
│  │  │  (Wouter)   │  │ (shadcn/ui) │  │ (TanStack)      │ ││
│  │  └─────────────┘  └─────────────┘  └─────────────────┘ ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
                              │
                              │ HTTP/REST
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                        Server                                │
│  ┌─────────────────────────────────────────────────────────┐│
│  │  Express 5 + Passport.js                                ││
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐ ││
│  │  │   Routes    │  │    Auth     │  │   Math Engine   │ ││
│  │  │  /api/*     │  │  Sessions   │  │   (Analysis)    │ ││
│  │  └─────────────┘  └─────────────┘  └─────────────────┘ ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
                              │
                              │ Drizzle ORM
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   Supabase PostgreSQL                        │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│  │  users   │ │ matches  │ │   legs   │ │  slips   │       │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘       │
│  ┌──────────┐ ┌──────────┐                                  │
│  │  chats   │ │ messages │                                  │
│  └──────────┘ └──────────┘                                  │
└─────────────────────────────────────────────────────────────┘
```

## Frontend Structure

### Technology Stack
- **React 18:** UI framework with hooks
- **Vite:** Fast build tool and dev server
- **Tailwind CSS:** Utility-first CSS framework
- **Wouter:** Lightweight router with hash routing support
- **TanStack Query:** Server state management
- **shadcn/ui:** Radix UI-based component library

### Directory Structure
```
client/src/
├── components/
│   ├── auth/           # Login, Register forms
│   ├── layout/         # Header, Sidebar, Navigation
│   ├── chat/           # AI chat interface
│   └── ui/             # shadcn/ui components
├── pages/
│   ├── Dashboard.tsx   # Main dashboard
│   ├── Matches.tsx     # Match listings
│   ├── Slips.tsx       # Betting slips
│   └── Analysis.tsx    # Parlay analysis
└── lib/
    └── queryClient.ts  # TanStack Query configuration
```

### Routing
Uses Wouter with hash routing (`/#/path`) for iframe compatibility:
- `/#/` - Dashboard
- `/#/matches` - Match listings
- `/#/slips` - Saved slips
- `/#/analysis` - Analysis tools

## Backend Structure

### Technology Stack
- **Express 5:** Web framework
- **Passport.js:** Authentication middleware
- **express-session + memorystore:** Session management
- **bcrypt:** Password hashing (12 rounds)
- **Drizzle ORM:** Type-safe database queries

### Directory Structure
```
server/
├── index.ts            # Express app entry point
├── routes.ts           # API route definitions
├── auth.ts             # Passport configuration
├── db.ts               # Database connection
├── storage.ts          # Data access layer
└── mathEngine.ts       # Probability calculations
```

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | User registration |
| POST | `/api/auth/login` | User login |
| POST | `/api/auth/logout` | User logout |
| GET | `/api/auth/user` | Get current user |
| GET | `/api/matches` | List matches |
| GET | `/api/matches/:id` | Get match details |
| GET | `/api/slips` | List user's slips |
| POST | `/api/slips` | Create slip |
| DELETE | `/api/slips/:id` | Delete slip |
| GET | `/api/chats` | List user's chats |
| POST | `/api/chats` | Create chat |
| POST | `/api/chats/:id/messages` | Send message |
| POST | `/api/analyze` | Analyze parlay |

## Database Schema

### Tables (6 total)

```sql
-- users: User accounts
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- matches: Sports matches with odds
CREATE TABLE matches (
  id SERIAL PRIMARY KEY,
  sport VARCHAR(50) NOT NULL,
  home_team VARCHAR(255) NOT NULL,
  away_team VARCHAR(255) NOT NULL,
  home_odds DECIMAL(6,3),
  away_odds DECIMAL(6,3),
  draw_odds DECIMAL(6,3),
  starts_at TIMESTAMP NOT NULL,
  status VARCHAR(20) DEFAULT 'upcoming'
);

-- legs: Individual bets within a slip
CREATE TABLE legs (
  id SERIAL PRIMARY KEY,
  slip_id INTEGER REFERENCES slips(id),
  match_id INTEGER REFERENCES matches(id),
  pick VARCHAR(50) NOT NULL,
  odds DECIMAL(6,3) NOT NULL
);

-- slips: User betting slips (parlays)
CREATE TABLE slips (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  stake DECIMAL(10,2),
  potential_payout DECIMAL(10,2),
  status VARCHAR(20) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT NOW()
);

-- chats: AI chat sessions
CREATE TABLE chats (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  title VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW()
);

-- messages: Chat messages
CREATE TABLE messages (
  id SERIAL PRIMARY KEY,
  chat_id INTEGER REFERENCES chats(id),
  role VARCHAR(20) NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
```

## Math Engine Models

The math engine provides probability calculations for parlay analysis:

### Core Functions

1. **Implied Probability:** Convert odds to probability
   ```
   impliedProbability(odds) = 1 / odds
   ```

2. **Parlay Odds:** Calculate combined odds
   ```
   parlayOdds(legs) = Π(leg.odds)
   ```

3. **Expected Value:** Calculate EV
   ```
   EV = (winProb × payout) - (loseProb × stake)
   ```

4. **Kelly Criterion:** Optimal bet sizing
   ```
   kellyFraction = (bp - q) / b
   where b = odds - 1, p = winProb, q = 1 - p
   ```

5. **Correlation Adjustment:** Adjust for correlated outcomes
   ```
   adjustedProb = baseProb × correlationFactor
   ```

## Deployment

### Vercel Configuration
- Frontend: Static files served from `/dist`
- Backend: Serverless functions from `/server`
- Rewrites: `/api/*` routed to Express handler

### Environment
- Node.js 18 runtime
- PostgreSQL via Supabase (external)
- Session storage: In-memory (MemoryStore)
