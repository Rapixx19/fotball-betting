# Technical Constraints

This document outlines critical technical constraints that must be maintained throughout development. Violating these constraints will break the application.

## 1. Hash Routing (Critical)

**Constraint:** Always use hash routing (`/#/path`). Never switch to BrowserRouter.

**Reason:** The application runs inside an iframe sandbox that does not support browser history manipulation. Hash routing works around this limitation.

**Implementation:**
```tsx
// CORRECT - Use hash routing
import { Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";

function App() {
  return (
    <Router hook={useHashLocation}>
      {/* routes */}
    </Router>
  );
}

// WRONG - Never use this
import { BrowserRouter } from "react-router-dom";
```

**Links:**
```tsx
// CORRECT
<Link href="/#/dashboard">Dashboard</Link>

// WRONG
<Link href="/dashboard">Dashboard</Link>
```

---

## 2. No localStorage (Critical)

**Constraint:** Never use `localStorage` or `sessionStorage`.

**Reason:** The iframe sandbox blocks access to web storage APIs. Any `localStorage` calls will throw errors.

**Alternatives:**
- Use session cookies for authentication state
- Use TanStack Query cache for temporary data
- Use database for persistent data

```tsx
// WRONG - Will throw error
localStorage.setItem("token", value);

// CORRECT - Use cookies via API
fetch("/api/auth/login", { credentials: "include" });
```

---

## 3. Session Cookie Configuration

**Constraint:** Session cookies must have `secure: false` in development.

**Reason:** Local development uses HTTP, not HTTPS. Secure cookies require HTTPS.

```typescript
// server/index.ts
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false,  // Must be false for HTTP
    httpOnly: true,
    sameSite: "lax",
    maxAge: 24 * 60 * 60 * 1000  // 24 hours
  },
  store: new MemoryStore({
    checkPeriod: 86400000
  })
}));
```

---

## 4. SSL Configuration for Supabase

**Constraint:** Database connection must use `rejectUnauthorized: false`.

**Reason:** Supabase uses self-signed certificates that Node.js rejects by default.

```typescript
// server/db.ts
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false  // Required for Supabase
  }
});
```

---

## 5. API Response Shapes

**Constraint:** All API responses must return wrapped objects, never raw arrays.

**Reason:** Consistency, easier error handling, and room for metadata.

```typescript
// CORRECT
res.json({ matches: [...] });
res.json({ user: {...} });
res.json({ success: true, message: "Created" });

// WRONG
res.json([...]);  // Never return raw arrays
```

**Standard response shapes:**
```typescript
// Success with data
{ data: T }

// Success with specific key
{ matches: Match[] }
{ user: User }
{ slip: Slip }

// Success message
{ success: true, message: string }

// Error
{ error: string }
```

---

## 6. Password Hashing

**Constraint:** Use bcrypt with exactly 12 rounds.

**Reason:** Security standard - 12 rounds provides good security without excessive latency.

```typescript
import bcrypt from "bcrypt";

const SALT_ROUNDS = 12;

// Hashing
const hash = await bcrypt.hash(password, SALT_ROUNDS);

// Verification
const valid = await bcrypt.compare(password, hash);
```

---

## 7. CORS Configuration

**Constraint:** CORS must allow credentials and specify exact origin.

```typescript
app.use(cors({
  origin: process.env.CLIENT_URL || "http://localhost:5000",
  credentials: true  // Required for session cookies
}));
```

---

## 8. TanStack Query Configuration

**Constraint:** Include credentials in all fetch requests.

```typescript
// lib/queryClient.ts
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: async ({ queryKey }) => {
        const res = await fetch(queryKey[0] as string, {
          credentials: "include"  // Required for sessions
        });
        if (!res.ok) throw new Error(await res.text());
        return res.json();
      }
    }
  }
});
```

---

## 9. Drizzle Schema Location

**Constraint:** Schema must be in `shared/schema.ts`.

**Reason:** Shared between server (runtime) and drizzle-kit (migrations).

```
shared/
└── schema.ts    # Drizzle table definitions
```

---

## 10. Port Configuration

**Constraint:** Server must run on port 5000.

**Reason:** Vite proxy configured to forward `/api` requests to port 5000.

```typescript
// server/index.ts
const PORT = process.env.PORT || 5000;
app.listen(PORT);
```

```typescript
// vite.config.ts
export default defineConfig({
  server: {
    proxy: {
      "/api": "http://localhost:5000"
    }
  }
});
```

---

## Summary Checklist

Before committing any code, verify:

- [ ] Using hash routing (`/#/path`), not browser routing
- [ ] No localStorage or sessionStorage usage
- [ ] Session cookie `secure: false` in development
- [ ] Database SSL `rejectUnauthorized: false`
- [ ] API responses are wrapped objects
- [ ] bcrypt uses 12 salt rounds
- [ ] CORS allows credentials
- [ ] Fetch requests include credentials
- [ ] Schema in `shared/schema.ts`
- [ ] Server on port 5000
