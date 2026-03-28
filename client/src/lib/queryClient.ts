import { QueryClient, QueryFunction } from "@tanstack/react-query";

// Create a response cache for GET requests
const API_CACHE = new Map<string, { data: any, timestamp: number }>();
const CACHE_TTL = 1000 * 60 * 5; // 5 minutes cache TTL
const VIDEO_CHUNK_SIZE = 1024 * 1024; // 1MB chunk size for videos

import { createError, ErrorType, saveOperationForOfflineSync, queueForRetry, classifyError } from './error-handler';

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    try {
      const text = (await res.text()) || res.statusText;
      const statusCode = res.status;
      
      // Classify error based on status code
      let errorType: ErrorType;
      let retryable = false;
      
      if (statusCode >= 500) {
        errorType = ErrorType.SERVER;
        retryable = true;
      } else if (statusCode === 401) {
        errorType = ErrorType.AUTHENTICATION;
        retryable = false;
      } else if (statusCode === 403) {
        errorType = ErrorType.PERMISSION;
        retryable = false;
      } else if (statusCode === 400 || statusCode === 422) {
        errorType = ErrorType.VALIDATION;
        retryable = false;
      } else if (statusCode === 404 || statusCode === 405) {
        errorType = ErrorType.CLIENT;
        retryable = false;
      } else {
        errorType = ErrorType.UNKNOWN;
        retryable = true;
      }
      
      throw createError(
        `${res.status}: ${text}`,
        errorType,
        {
          code: `HTTP_${res.status}`,
          context: { 
            url: res.url,
            statusCode: res.status,
            statusText: res.statusText
          },
          retryable
        }
      );
    } catch (e) {
      if (e.type) {
        throw e; // This is already a properly formatted error
      }
      throw createError(
        `${res.status}: ${res.statusText}`,
        ErrorType.UNKNOWN,
        {
          code: `HTTP_${res.status}`,
          context: { 
            url: res.url,
            statusCode: res.status,
            statusText: res.statusText
          },
          retryable: true
        }
      );
    }
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  // Check cache for GET requests except for user and video data
  if (
    method === 'GET' && 
    !url.includes('/api/user') && 
    !url.includes('/api/video/') && 
    !url.includes('?nocache=true')
  ) {
    const cacheKey = url;
    const cachedResponse = API_CACHE.get(cacheKey);
    
    if (cachedResponse && (Date.now() - cachedResponse.timestamp < CACHE_TTL)) {
      // Return a new response built from cached data
      return new Response(JSON.stringify(cachedResponse.data), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  try {
    // Add performance headers for better network prioritization
    const headers: Record<string, string> = {};
    
    if (data) {
      headers['Content-Type'] = 'application/json';
    }
    
    // Prioritize loading critical resources
    if (url.includes('/api/user') || url.includes('/api/categories')) {
      headers['Priority'] = 'high';
    } else if (url.includes('/api/video/')) {
      headers['Priority'] = 'low';
    }

    const options: RequestInit = {
      method,
      headers,
      body: data ? JSON.stringify(data) : undefined,
      credentials: "include",
    };
    
    // Add special handling for large video requests
    if (url.includes('/api/video/') && !headers.range && method === 'GET') {
      // Request initial chunk to start playback faster
      headers.range = `bytes=0-${VIDEO_CHUNK_SIZE}`;
    }

    // Use a catch block for network errors
    let res: Response;
    try {
      res = await fetch(url, options);
    } catch (networkError) {
      // Handle network errors with retry capability
      const error = createError(
        'Network error. Please check your connection and try again.',
        ErrorType.NETWORK,
        {
          code: 'NETWORK_ERROR',
          context: { url, method },
          retryable: true
        }
      );
      
      // Queue for retry when back online if applicable
      if (method === 'GET') {
        // Use queueForRetry to schedule a retry when back online
        const requestId = queueForRetry(url, method);
        console.log(`Queued GET request for retry: ${requestId}`);
      } else if (method === 'POST' || method === 'PUT' || method === 'PATCH') {
        // For mutations, try to save for offline sync
        try {
          await saveOperationForOfflineSync('api_request', {
            url,
            method,
            data,
            timestamp: Date.now()
          });
          console.log(`Saved ${method} operation for offline sync to ${url}`);
        } catch (saveError) {
          console.error('Failed to save operation for offline sync:', saveError);
        }
      }
      
      throw error;
    }

    if (!res.ok) {
      // Process failed responses
      await throwIfResNotOk(res);
      // The line above should throw, but TypeScript doesn't know that
      throw new Error('Response not OK');
    }

    // Cache successful GET responses if they are JSON
    if (
      method === 'GET' && 
      !url.includes('/api/user') && 
      !url.includes('/api/video/') &&
      res.headers.get('Content-Type')?.includes('application/json')
    ) {
      try {
        // Clone before consuming
        const clone = res.clone();
        const data = await clone.json();

        // Update cache
        API_CACHE.set(url, {
          data,
          timestamp: Date.now()
        });
      } catch (err) {
        // If not JSON, don't cache
        console.debug('Response not cacheable', url);
      }
    }

    return res;
  } catch (error) {
    // Already properly formatted errors
    if (error.type) {
      throw error;
    }
    
    // Other errors without typing
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw createError(
        'Network issue. Please check your connection and try again.',
        ErrorType.NETWORK,
        {
          code: 'FETCH_ERROR',
          context: { url, method },
          retryable: true
        }
      );
    }
    
    // For any errors that weren't properly classified
    const classifiedError = classifyError(error, url);
    classifiedError.context = { 
      ...classifiedError.context,
      url, 
      method
    };
    
    throw classifiedError;
  }
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    try {
      const res = await fetch(queryKey[0] as string, {
        credentials: "include",
        // Add cache headers to make browser caching more efficient
        headers: {
          'Cache-Control': 'max-age=60' // 1 minute browser cache
        }
      });

      if (unauthorizedBehavior === "returnNull" && res.status === 401) {
        return null;
      }

      await throwIfResNotOk(res);
      return await res.json();
    } catch (error) {
      // Add better error handling for failed fetches
      console.error(`Query failed for ${queryKey[0]}:`, error);
      throw error;
    }
  };

// Initialize with optimized settings and enhanced error recovery
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: 1000 * 60 * 2, // 2 minutes
      gcTime: 1000 * 60 * 10, // Keep unused queries for 10 minutes
      retry: (failureCount, error: any) => {
        // Check for properly typed errors
        if (error.type) {
          // Don't retry non-retryable errors
          if (error.retryable === false) {
            console.log('Not retrying query - error marked as non-retryable:', error.type);
            return false;
          }
          
          // Get max retry attempts based on error type
          const maxRetries = {
            [ErrorType.NETWORK]: 3,
            [ErrorType.SERVER]: 2,
            [ErrorType.UNKNOWN]: 1,
            [ErrorType.CLIENT]: 0,
            [ErrorType.AUTHENTICATION]: 0,
            [ErrorType.PERMISSION]: 0,
            [ErrorType.VALIDATION]: 0
          }[error.type] || 0;
          
          // Only retry if we haven't exceeded max retries
          const shouldRetry = failureCount < maxRetries;
          if (shouldRetry) {
            console.log(`Retrying query (attempt ${failureCount + 1}/${maxRetries}) for error type:`, error.type);
          } else {
            console.log(`Max retries (${maxRetries}) exceeded for error type:`, error.type);
          }
          return shouldRetry;
        }
        
        // Legacy error handling
        if (error instanceof Error) {
          // Don't retry client errors
          if (error.message.includes('404') || 
              error.message.includes('401') ||
              error.message.includes('403') ||
              error.message.includes('400')) {
            return false;
          }
          
          // Retry network and server errors
          if (error.message.includes('network') || 
              error.message.includes('offline') ||
              error.message.includes('500') ||
              error.message.includes('502') ||
              error.message.includes('503')) {
            return failureCount < 3; // Up to 3 retries for connection issues
          }
          
          return failureCount < 1; // Default: retry once
        }
        
        return failureCount < 1; // Fallback: retry once for unknown error types
      },
      // Add a retry delay with exponential backoff
      retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
    },
    mutations: {
      // Add limited retry for mutations
      retry: (failureCount, error: any) => {
        // Only retry network errors for mutations
        if (error.type === ErrorType.NETWORK) {
          return failureCount < 2; // Up to 2 retries
        }
        
        // Don't retry other errors for mutations
        return false;
      },
      retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 10000),
    },
  },
});

// Function to clear cache - useful after logout or when forcing refreshes
export function clearApiCache() {
  API_CACHE.clear();
  console.log('API cache cleared');
}

// WebSocket connection management with mobile device optimizations
let wsConnection: WebSocket | null = null;
let reconnectTimeout: NodeJS.Timeout | null = null;
let wsConnecting = false;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 3; // Limit reconnections to avoid draining mobile battery

interface WebSocketMessage {
  type: string;
  data: any;
  timestamp: number;
}

type WebSocketMessageHandler = (message: WebSocketMessage) => void;
const messageHandlers: Record<string, WebSocketMessageHandler[]> = {};

// Temporarily disable WebSocket connections to fix database connection pool exhaustion
export function initWebSocket() {
  console.log('WebSocket connections temporarily disabled to preserve database resources');
  return;
  
  // Prevent multiple simultaneous connection attempts
  if (wsConnection || wsConnecting) return;
  
  // Check if we've exceeded reconnection attempts - for mobile battery optimization
  if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    console.log(`Maximum reconnect attempts (${MAX_RECONNECT_ATTEMPTS}) reached. Stopping WebSocket reconnections to preserve battery.`);
    return;
  }
  
  wsConnecting = true;
  
  // Get the proper WebSocket URL based on the current protocol and hostname
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}/ws`;
  
  try {
    console.log(`Connecting to WebSocket server at: ${wsUrl} (attempt ${reconnectAttempts + 1}/${MAX_RECONNECT_ATTEMPTS})`);
    wsConnection = new WebSocket(wsUrl);
    
    // Set a connection timeout to prevent hanging connections
    const connectionTimeout = setTimeout(() => {
      if (wsConnection && wsConnection.readyState !== WebSocket.OPEN) {
        console.log('WebSocket connection timeout');
        wsConnection.close();
        wsConnection = null;
        wsConnecting = false;
        
        // Count this as a reconnect attempt
        reconnectAttempts++;
      }
    }, 10000); // 10-second connection timeout
    
    wsConnection.onopen = () => {
      console.log('WebSocket connection established');
      wsConnecting = false;
      reconnectAttempts = 0; // Reset reconnect attempts on successful connection
      
      // Clear the connection timeout
      clearTimeout(connectionTimeout);
      
      // Reset reconnect timeout if it exists
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
        reconnectTimeout = null;
      }
      
      // Send a ping message to keep the connection alive
      keepAlive();
    };
    
    wsConnection.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data) as WebSocketMessage;
        
        // Log more selectively to reduce console spam
        if (message.type !== 'pong') {
          console.log('WebSocket message received:', message);
        }
        
        // Handle the message based on its type
        if (messageHandlers[message.type]) {
          messageHandlers[message.type].forEach(handler => {
            try {
              handler(message);
            } catch (error) {
              console.error('Error in WebSocket message handler:', error);
            }
          });
        }
        
        // Handle specific message types that should trigger React Query cache updates
        handleReactQueryUpdates(message);
        
      } catch (error) {
        console.error('Error processing WebSocket message:', error);
      }
    };
    
    wsConnection.onclose = (event) => {
      // Clear the connection timeout
      clearTimeout(connectionTimeout);
      
      console.log('WebSocket connection closed:', event.code, event.reason);
      wsConnection = null;
      wsConnecting = false;
      
      // Increment reconnect attempts
      reconnectAttempts++;
      
      // Only attempt to reconnect if we haven't exceeded the maximum attempts
      if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS && !reconnectTimeout) {
        // Use exponential backoff to reduce battery impact on mobile
        const backoffDelay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000); // Max 30 seconds
        console.log(`Scheduling WebSocket reconnect in ${backoffDelay}ms`);
        
        reconnectTimeout = setTimeout(() => {
          console.log('Attempting to reconnect WebSocket...');
          reconnectTimeout = null;
          initWebSocket();
        }, backoffDelay);
      } else if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
        console.log(`Maximum reconnect attempts (${MAX_RECONNECT_ATTEMPTS}) reached. WebSocket reconnection stopped.`);
      }
    };
    
    wsConnection.onerror = (error) => {
      console.error('WebSocket error:', error);
      // Let onclose handle reconnection
    };
    
  } catch (error) {
    console.error('Error initializing WebSocket:', error);
    wsConnecting = false;
    reconnectAttempts++; // Count this as a failed attempt
  }
}

// Periodically send a ping to keep the connection alive
function keepAlive() {
  if (!wsConnection || wsConnection.readyState !== WebSocket.OPEN) return;
  
  wsConnection.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
  
  // Schedule the next ping
  setTimeout(keepAlive, 30000); // Send a ping every 30 seconds
}

// Add a message handler for a specific message type
export function addWebSocketMessageHandler(type: string, handler: WebSocketMessageHandler) {
  if (!messageHandlers[type]) {
    messageHandlers[type] = [];
  }
  messageHandlers[type].push(handler);
  
  // Return a function to remove this handler
  return () => {
    if (messageHandlers[type]) {
      const index = messageHandlers[type].indexOf(handler);
      if (index !== -1) {
        messageHandlers[type].splice(index, 1);
      }
    }
  };
}

// Handle React Query cache updates based on WebSocket messages
function handleReactQueryUpdates(message: WebSocketMessage) {
  switch (message.type) {
    case 'course_created':
    case 'course_updated':
      // Invalidate course queries
      queryClient.invalidateQueries({ queryKey: ['/api/courses'] });
      break;
      
    case 'comment_created':
      // Invalidate comments for the specific content
      if (message.data?.contentId) {
        queryClient.invalidateQueries({ 
          queryKey: [`/api/contents/${message.data.contentId}/comments`]
        });
      }
      break;
      
    case 'comment_deleted':
      // Invalidate comments for the specific content
      if (message.data?.contentId) {
        queryClient.invalidateQueries({ 
          queryKey: [`/api/contents/${message.data.contentId}/comments`] 
        });
      }
      break;
      
    // Add more cases as needed for other real-time updates
  }
}

// Initialize the WebSocket connection when this module is loaded
// The connection will be established when the app starts
if (typeof window !== 'undefined') {
  // Only run in browser environment
  window.addEventListener('load', () => {
    initWebSocket();
  });
}
