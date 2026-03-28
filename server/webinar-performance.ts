import { WebSocket } from "ws";

// Performance optimizations for webinar system
export class WebinarPerformanceManager {
  private static instance: WebinarPerformanceManager;
  private activeConnections = new Map<string, WebSocket>();
  private messageQueue = new Map<string, any[]>();
  private connectionHealth = new Map<string, { lastPing: number; isAlive: boolean }>();

  static getInstance(): WebinarPerformanceManager {
    if (!WebinarPerformanceManager.instance) {
      WebinarPerformanceManager.instance = new WebinarPerformanceManager();
    }
    return WebinarPerformanceManager.instance;
  }

  // Add connection with health monitoring
  addConnection(id: string, ws: WebSocket): void {
    this.activeConnections.set(id, ws);
    this.connectionHealth.set(id, { lastPing: Date.now(), isAlive: true });
    
    // Set up health monitoring
    this.setupHealthMonitoring(id, ws);
  }

  // Remove connection and cleanup
  removeConnection(id: string): void {
    this.activeConnections.delete(id);
    this.connectionHealth.delete(id);
    this.messageQueue.delete(id);
  }

  // Setup health monitoring for connection
  private setupHealthMonitoring(id: string, ws: WebSocket): void {
    const interval = setInterval(() => {
      const health = this.connectionHealth.get(id);
      if (!health || !this.activeConnections.has(id)) {
        clearInterval(interval);
        return;
      }

      if (ws.readyState === WebSocket.OPEN) {
        ws.ping();
        health.lastPing = Date.now();
      } else {
        this.removeConnection(id);
        clearInterval(interval);
      }
    }, 30000);

    ws.on('pong', () => {
      const health = this.connectionHealth.get(id);
      if (health) {
        health.isAlive = true;
        health.lastPing = Date.now();
      }
    });

    ws.on('close', () => {
      this.removeConnection(id);
      clearInterval(interval);
    });
  }

  // Broadcast message to specific webinar room with batching
  broadcastToWebinar(webinarId: string, message: any): void {
    const serializedMessage = JSON.stringify(message);
    
    this.activeConnections.forEach((ws, connectionId) => {
      if (connectionId.includes(`webinar-${webinarId}`) && ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(serializedMessage);
        } catch (error) {
          console.error(`Failed to send message to ${connectionId}:`, error);
          this.removeConnection(connectionId);
        }
      }
    });
  }

  // Get active connection count for a webinar
  getActiveCount(webinarId: string): number {
    let count = 0;
    this.activeConnections.forEach((ws, connectionId) => {
      if (connectionId.includes(`webinar-${webinarId}`) && ws.readyState === WebSocket.OPEN) {
        count++;
      }
    });
    return count;
  }

  // Queue message for delivery when connection is stable
  queueMessage(connectionId: string, message: any): void {
    if (!this.messageQueue.has(connectionId)) {
      this.messageQueue.set(connectionId, []);
    }
    this.messageQueue.get(connectionId)!.push(message);
  }

  // Process queued messages
  processQueuedMessages(connectionId: string): void {
    const queue = this.messageQueue.get(connectionId);
    const ws = this.activeConnections.get(connectionId);
    
    if (queue && ws && ws.readyState === WebSocket.OPEN) {
      queue.forEach(message => {
        try {
          ws.send(JSON.stringify(message));
        } catch (error) {
          console.error(`Failed to send queued message:`, error);
        }
      });
      this.messageQueue.set(connectionId, []);
    }
  }

  // Clean up stale connections
  cleanupStaleConnections(): void {
    const now = Date.now();
    const timeout = 60000; // 1 minute timeout

    this.connectionHealth.forEach((health, connectionId) => {
      if (now - health.lastPing > timeout) {
        const ws = this.activeConnections.get(connectionId);
        if (ws) {
          ws.terminate();
        }
        this.removeConnection(connectionId);
      }
    });
  }
}

// Database query optimization utilities
export class DatabaseQueryOptimizer {
  private static queryCache = new Map<string, { data: any; timestamp: number }>();
  private static cacheTimeout = 30000; // 30 seconds

  // Cache database results for frequently accessed data
  static async cachedQuery<T>(
    key: string, 
    queryFn: () => Promise<T>, 
    customTimeout?: number
  ): Promise<T> {
    const cached = this.queryCache.get(key);
    const timeout = customTimeout || this.cacheTimeout;
    
    if (cached && Date.now() - cached.timestamp < timeout) {
      return cached.data;
    }

    const result = await queryFn();
    this.queryCache.set(key, { data: result, timestamp: Date.now() });
    
    return result;
  }

  // Clear cache for specific key or all
  static clearCache(key?: string): void {
    if (key) {
      this.queryCache.delete(key);
    } else {
      this.queryCache.clear();
    }
  }

  // Cleanup expired cache entries
  static cleanupCache(): void {
    const now = Date.now();
    this.queryCache.forEach((value, key) => {
      if (now - value.timestamp > this.cacheTimeout) {
        this.queryCache.delete(key);
      }
    });
  }
}

// Performance monitoring
export class PerformanceMonitor {
  private static metrics = {
    wsConnections: 0,
    wsMessages: 0,
    dbQueries: 0,
    errors: 0
  };

  static incrementMetric(metric: keyof typeof PerformanceMonitor.metrics): void {
    this.metrics[metric]++;
  }

  static getMetrics() {
    return { ...this.metrics };
  }

  static resetMetrics(): void {
    this.metrics = {
      wsConnections: 0,
      wsMessages: 0,
      dbQueries: 0,
      errors: 0
    };
  }
}