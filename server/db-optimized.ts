import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Ultra-conservative connection pool to prevent exhaustion
export const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  max: 1, // Single connection only
  idleTimeoutMillis: 1000, // 1 second
  connectionTimeoutMillis: 1000, // 1 second
  allowExitOnIdle: true
});

export const db = drizzle({ client: pool, schema });

// Connection monitoring
let activeConnections = 0;

pool.on('connect', () => {
  activeConnections++;
  console.log(`[DB] Connection opened. Active: ${activeConnections}`);
});

pool.on('remove', () => {
  activeConnections--;
  console.log(`[DB] Connection closed. Active: ${activeConnections}`);
});

pool.on('error', (err) => {
  console.error('[DB] Pool error:', err.message);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('[DB] Shutting down connection pool...');
  await pool.end();
});