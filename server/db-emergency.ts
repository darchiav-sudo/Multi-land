import { neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from "@shared/schema";

// Use HTTP adapter instead of WebSocket to avoid connection pool issues
neonConfig.fetchConnectionCache = true;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set. Did you forget to provision a database?");
}

// Use HTTP adapter which doesn't have connection pool limits
export const db = drizzle(process.env.DATABASE_URL, { schema });

console.log('[DB-Emergency] Using HTTP adapter to bypass connection pool issues');