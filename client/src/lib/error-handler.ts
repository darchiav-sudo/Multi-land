/**
 * Enhanced error handling and recovery system for Multi Land
 */
import { queryClient } from './queryClient';
import { useToast } from '@/hooks/use-toast';
import { initOfflineSupport } from './offline-db';
import { getMobileInfo, storeData } from './capacitor';

// Define error types for better categorization
export enum ErrorType {
  NETWORK = 'network',
  AUTHENTICATION = 'authentication',
  PERMISSION = 'permission',
  VALIDATION = 'validation',
  SERVER = 'server',
  CLIENT = 'client',
  UNKNOWN = 'unknown'
}

// Error with additional context for better handling
export interface ExtendedError extends Error {
  type?: ErrorType;
  code?: string;
  context?: any;
  retryable?: boolean;
  endpoint?: string;
}

// Record of failed requests for retry management
const failedRequests = new Map<string, {
  endpoint: string,
  method: string,
  body?: any,
  retryCount: number,
  lastAttempt: number
}>();

// Maximum retry attempts for different error types
const MAX_RETRY_ATTEMPTS = {
  [ErrorType.NETWORK]: 5,
  [ErrorType.AUTHENTICATION]: 2,
  [ErrorType.SERVER]: 3,
  [ErrorType.UNKNOWN]: 2,
  [ErrorType.CLIENT]: 1,
  [ErrorType.VALIDATION]: 0,
  [ErrorType.PERMISSION]: 0
};

// Delay between retries (in ms) using exponential backoff
const getRetryDelay = (attempt: number): number => {
  // Base delay is 1 second, max delay is 30 seconds
  return Math.min(1000 * Math.pow(2, attempt), 30000);
};

// Create an error with the proper extended type
export const createError = (
  message: string,
  type: ErrorType = ErrorType.UNKNOWN,
  options: Partial<ExtendedError> = {}
): ExtendedError => {
  const error = new Error(message) as ExtendedError;
  error.type = type;
  
  // Add additional context
  Object.assign(error, options);
  
  // Determine if error is retryable based on type
  if (error.retryable === undefined) {
    error.retryable = [
      ErrorType.NETWORK,
      ErrorType.SERVER,
      ErrorType.UNKNOWN
    ].includes(type);
  }
  
  return error;
};

// Classify error based on message or status code
export const classifyError = (error: any, endpoint?: string): ExtendedError => {
  // Already classified
  if (error.type) return error as ExtendedError;
  
  const extendedError = error as ExtendedError;
  extendedError.endpoint = endpoint;
  
  // Check error message for common patterns
  const message = error.message?.toLowerCase() || '';
  
  if (message.includes('network') || message.includes('offline') || message.includes('internet')) {
    extendedError.type = ErrorType.NETWORK;
    extendedError.retryable = true;
    return extendedError;
  }
  
  if (message.includes('401') || message.includes('unauthorized') || message.includes('unauthenticated')) {
    extendedError.type = ErrorType.AUTHENTICATION;
    return extendedError;
  }
  
  if (message.includes('403') || message.includes('forbidden') || message.includes('permission')) {
    extendedError.type = ErrorType.PERMISSION;
    extendedError.retryable = false;
    return extendedError;
  }
  
  if (message.includes('validation') || message.includes('invalid')) {
    extendedError.type = ErrorType.VALIDATION;
    extendedError.retryable = false;
    return extendedError;
  }
  
  // Server errors (5xx)
  if (message.includes('500') || message.includes('502') || message.includes('503') || 
      message.includes('504') || message.includes('server error')) {
    extendedError.type = ErrorType.SERVER;
    extendedError.retryable = true;
    return extendedError;
  }
  
  // Client errors (4xx)
  if (message.includes('400') || message.includes('404') || message.includes('405') || 
      message.includes('client error')) {
    extendedError.type = ErrorType.CLIENT;
    extendedError.retryable = false;
    return extendedError;
  }
  
  // Default to unknown
  extendedError.type = ErrorType.UNKNOWN;
  extendedError.retryable = true;
  return extendedError;
};

// Get user-friendly error message
export const getUserFriendlyMessage = (error: ExtendedError): string => {
  switch (error.type) {
    case ErrorType.NETWORK:
      return 'Network connection issue. Please check your internet connection and try again.';
    case ErrorType.AUTHENTICATION:
      return 'Your session has expired. Please sign in again.';
    case ErrorType.PERMISSION:
      return 'You don\'t have permission to access this resource.';
    case ErrorType.VALIDATION:
      return 'There was an issue with the data provided. Please check your input and try again.';
    case ErrorType.SERVER:
      return 'The server encountered an error. We\'re working on it, please try again later.';
    case ErrorType.CLIENT:
      return 'The app encountered an error. Please try again or restart the app.';
    default:
      return error.message || 'An unexpected error occurred. Please try again.';
  }
};

// Queue a failed request for retry
export const queueForRetry = (
  endpoint: string,
  method: string,
  body?: any
): string => {
  const requestId = `${method}:${endpoint}:${Date.now()}`;
  
  failedRequests.set(requestId, {
    endpoint,
    method,
    body,
    retryCount: 0,
    lastAttempt: Date.now()
  });
  
  return requestId;
};

// Process all queued requests
export const retryFailedRequests = async (): Promise<void> => {
  if (failedRequests.size === 0) return;
  
  console.log(`Attempting to retry ${failedRequests.size} failed requests`);
  
  // Process each failed request
  for (const [requestId, request] of failedRequests.entries()) {
    // Skip if max retries exceeded or not enough time passed
    const maxRetries = MAX_RETRY_ATTEMPTS[ErrorType.NETWORK];
    if (request.retryCount >= maxRetries) {
      console.log(`Request ${requestId} exceeded max retry attempts (${maxRetries}), removing from queue`);
      failedRequests.delete(requestId);
      continue;
    }
    
    const timeElapsed = Date.now() - request.lastAttempt;
    const requiredDelay = getRetryDelay(request.retryCount);
    
    if (timeElapsed < requiredDelay) {
      console.log(`Not enough time elapsed for request ${requestId}, skipping for now`);
      continue;
    }
    
    // Attempt to retry
    try {
      console.log(`Retrying request ${requestId} (attempt ${request.retryCount + 1})`);
      
      const options: RequestInit = {
        method: request.method,
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      };
      
      if (request.body) {
        options.body = JSON.stringify(request.body);
      }
      
      const response = await fetch(request.endpoint, options);
      
      if (response.ok) {
        console.log(`Request ${requestId} succeeded on retry attempt ${request.retryCount + 1}`);
        
        // For successful GET requests, update the React Query cache
        if (request.method === 'GET') {
          try {
            const data = await response.json();
            queryClient.setQueryData([request.endpoint], data);
          } catch (e) {
            // If it's not JSON, that's ok
          }
        } else {
          // For successful mutations, invalidate relevant queries
          queryClient.invalidateQueries();
        }
        
        // Remove from retry queue
        failedRequests.delete(requestId);
      } else {
        // Update retry count and timestamp
        request.retryCount++;
        request.lastAttempt = Date.now();
        console.log(`Request ${requestId} failed on retry attempt ${request.retryCount}, will retry again later`);
      }
    } catch (error) {
      // Update retry count and timestamp
      request.retryCount++;
      request.lastAttempt = Date.now();
      console.error(`Error retrying request ${requestId}:`, error);
    }
  }
};

// Offline data saving for important operations
export const saveOperationForOfflineSync = async (
  operationType: string,
  data: any
): Promise<void> => {
  try {
    // Ensure offline support is initialized
    await initOfflineSupport();
    
    // Get existing operations
    const existingOps = JSON.parse(localStorage.getItem('offline_operations') || '[]');
    
    // Add new operation
    existingOps.push({
      id: `${operationType}:${Date.now()}`,
      type: operationType,
      data,
      timestamp: Date.now(),
      deviceInfo: getMobileInfo()
    });
    
    // Save back to storage
    localStorage.setItem('offline_operations', JSON.stringify(existingOps));
    
    console.log(`Saved ${operationType} operation for offline sync`);
  } catch (error) {
    console.error('Failed to save operation for offline sync:', error);
  }
};

// Global error handling - for use in components
export const useErrorHandler = () => {
  const { toast } = useToast();
  
  const handleError = (error: any, endpoint?: string) => {
    const classifiedError = classifyError(error, endpoint);
    const friendlyMessage = getUserFriendlyMessage(classifiedError);
    
    // Log error for debugging
    console.error('Application error:', classifiedError);
    
    // Show user friendly message
    toast({
      title: 'Error',
      description: friendlyMessage,
      variant: 'destructive',
      duration: 5000,
    });
    
    // Handle based on error type
    switch (classifiedError.type) {
      case ErrorType.AUTHENTICATION:
        // Clear user data and redirect to login
        queryClient.setQueryData(['/api/user'], null);
        if (window.location.pathname !== '/auth') {
          window.location.href = '/auth';
        }
        break;
        
      case ErrorType.NETWORK:
        // Store for retry when back online
        if (classifiedError.endpoint && classifiedError.retryable) {
          queueForRetry(
            classifiedError.endpoint,
            'GET', // Assume GET for now as we don't have method info
            undefined
          );
        }
        break;
    }
    
    return classifiedError;
  };
  
  return { handleError };
};

// Set up retry mechanism on reconnection
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    console.log('App is back online, retrying failed requests');
    retryFailedRequests();
  });
  
  // Set up periodic retry attempts
  setInterval(() => {
    if (navigator.onLine && failedRequests.size > 0) {
      retryFailedRequests();
    }
  }, 60000); // Check every minute
}