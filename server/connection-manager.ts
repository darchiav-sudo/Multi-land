import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

class ConnectionManager {
  private static instance: ConnectionManager;
  private pool: Pool;
  private db: any;
  private activeConnections = 0;
  private maxConnections = 5; // Reduced from 10 to be more conservative
  private connectionQueue: Array<{ resolve: Function; reject: Function }> = [];

  private constructor() {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL must be set. Did you forget to provision a database?");
    }

    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: this.maxConnections,
      idleTimeoutMillis: 10000, // 10 seconds
      connectionTimeoutMillis: 3000, // 3 seconds
      allowExitOnIdle: true
    });

    this.db = drizzle({ client: this.pool, schema });

    // Monitor connection events
    this.pool.on('connect', () => {
      this.activeConnections++;
      console.log(`Database connection opened. Active: ${this.activeConnections}/${this.maxConnections}`);
    });

    this.pool.on('remove', () => {
      this.activeConnections--;
      console.log(`Database connection closed. Active: ${this.activeConnections}/${this.maxConnections}`);
      this.processQueue();
    });

    this.pool.on('error', (err) => {
      console.error('Database pool error:', err);
    });
  }

  static getInstance(): ConnectionManager {
    if (!ConnectionManager.instance) {
      ConnectionManager.instance = new ConnectionManager();
    }
    return ConnectionManager.instance;
  }

  getDatabase() {
    return this.db;
  }

  async acquireConnection(): Promise<any> {
    if (this.activeConnections >= this.maxConnections) {
      return new Promise((resolve, reject) => {
        this.connectionQueue.push({ resolve, reject });
        
        // Set a timeout for queued requests
        setTimeout(() => {
          const index = this.connectionQueue.findIndex(item => item.resolve === resolve);
          if (index !== -1) {
            this.connectionQueue.splice(index, 1);
            reject(new Error('Connection request timeout'));
          }
        }, 10000); // 10 second timeout
      });
    }

    return this.pool.connect();
  }

  private processQueue() {
    if (this.connectionQueue.length > 0 && this.activeConnections < this.maxConnections) {
      const { resolve } = this.connectionQueue.shift()!;
      this.pool.connect()
        .then(resolve)
        .catch(err => {
          console.error('Failed to acquire queued connection:', err);
          this.processQueue(); // Try next in queue
        });
    }
  }

  async closeAllConnections() {
    try {
      await this.pool.end();
      console.log('All database connections closed');
    } catch (error) {
      console.error('Error closing database connections:', error);
    }
  }

  getStats() {
    return {
      activeConnections: this.activeConnections,
      maxConnections: this.maxConnections,
      queueLength: this.connectionQueue.length
    };
  }
}

// Export singleton instance
export const connectionManager = ConnectionManager.getInstance();
export const db = connectionManager.getDatabase();
export const pool = connectionManager['pool'];