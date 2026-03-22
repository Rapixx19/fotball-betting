# ParlayEdge

Full-stack sports betting parlay analysis application that helps users analyze and track their sports betting parlays with AI-powered insights.

## Tech Stack

- **Frontend:** React 18 + Vite + Tailwind CSS + Wouter (hash routing)
- **Backend:** Express 5 + Passport.js authentication
- **Database:** Supabase PostgreSQL + Drizzle ORM
- **UI Components:** shadcn/ui (Radix UI primitives)

## Quick Start

### Prerequisites

- Node.js 18+
- npm 9+
- Supabase account with PostgreSQL database

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd sporsbetting

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your Supabase credentials

# Push database schema
npm run db:push

# Start development server
npm run dev
```

The app will be available at `http://localhost:5000`.

## Environment Variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | Supabase PostgreSQL connection string |
| `SESSION_SECRET` | Secret key for session encryption |

## Key Features

- **User Authentication:** Secure login/registration with bcrypt password hashing
- **Parlay Builder:** Create and analyze multi-leg parlays
- **Match Analysis:** View upcoming matches with odds and predictions
- **Slip Tracking:** Save and track your betting slips
- **AI Chat:** Get AI-powered betting insights and analysis
- **Math Engine:** Advanced probability calculations for parlay outcomes

## Project Structure

```
sporsbetting/
├── client/           # React frontend
│   └── src/
│       ├── components/   # Reusable UI components
│       ├── pages/        # Route pages
│       └── lib/          # Utilities and query client
├── server/           # Express backend
├── shared/           # Shared types and Drizzle schema
└── docs/             # Additional documentation
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |
| `npm run db:push` | Push schema to database |

## Documentation

- [Architecture Overview](./ARCHITECTURE.md)
- [Technical Constraints](./TECHNICAL_CONSTRAINTS.md)

## License

MIT
