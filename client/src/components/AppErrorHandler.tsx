import React, { useEffect } from 'react';
import { ErrorBoundary } from './ErrorBoundary';
import { useToast } from '@/hooks/use-toast';
import { useLocation } from 'wouter';
import { retryFailedRequests } from '@/lib/error-handler';

/**
 * Global error handler component that wraps the entire application
 * and provides top-level error handling capabilities.
 */
const AppErrorHandler: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  // Handle global unhandled promise rejections
  useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      // Log the error for debugging
      console.error('Unhandled Promise Rejection:', event.reason);

      // Show a user-friendly toast
      toast({
        title: 'Unexpected Error',
        description: 'An unexpected error occurred. Please try again or refresh the page.',
        variant: 'destructive',
        duration: 5000,
      });

      // Prevent the default browser behavior for unhandled rejections
      event.preventDefault();
    };

    // Register the event handler
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    // Clean up on unmount
    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, [toast]);

  // Handle online/offline status changes
  useEffect(() => {
    const handleOnline = async () => {
      // Attempt to retry failed requests when back online
      try {
        await retryFailedRequests();
        
        toast({
          title: 'Back Online',
          description: 'Your connection has been restored.',
          variant: 'default',
          duration: 3000,
        });
      } catch (error) {
        console.error('Error retrying failed requests:', error);
      }
    };

    const handleOffline = () => {
      toast({
        title: 'Connection Lost',
        description: 'You are currently offline. Some features may be unavailable.',
        variant: 'destructive',
        duration: 5000,
      });
    };

    // Register event handlers
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Check initial status
    if (!navigator.onLine) {
      toast({
        title: 'Offline Mode',
        description: 'You are currently offline. Some features may be unavailable.',
        variant: 'destructive',
        duration: 5000,
      });
    }

    // Clean up on unmount
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [toast]);

  // Monitor app visibility changes
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // App is active again, check for any errors to recover from
        if (navigator.onLine) {
          retryFailedRequests();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const handleResetError = () => {
    // Return to home page on catastrophic errors
    setLocation('/');
  };

  return (
    <ErrorBoundary>
      {children}
    </ErrorBoundary>
  );
};

export default AppErrorHandler;