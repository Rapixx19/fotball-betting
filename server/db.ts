import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  console.error("\n❌ DATABASE_URL is not set!");
  console.error("Get your connection string from Supabase:");
  console.error("1. Go to https://supabase.com/dashboard");
  console.error("2. Select your project (pwqxdyqhxodlurpnfnka)");
  console.error("3. Settings > Database > Connection string > URI");
  console.error("4. Add it to your .env file\n");
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

pool.on("error", (err) => {
  console.error("Database pool error:", err);
});

export const db = drizzle(pool, { schema });
