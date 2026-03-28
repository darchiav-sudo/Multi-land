import React, { Component, ErrorInfo, ReactNode } from "react";
import { ErrorType } from "@/lib/error-handler";
import { refreshAccessToken } from "@/lib/auth-utils";
import { Button } from "@/components/ui/button";
import { RefreshCcw, Home, AlertTriangle } from "lucide-react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorType: ErrorType;
  errorInfo: ErrorInfo | null;
  reloadAttempts: number;
}

/**
 * Error boundary component that catches JavaScript errors in children,
 * logs them, and displays a fallback UI.
 */
class ErrorBoundaryClass extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorType: ErrorType.UNKNOWN,
    errorInfo: null,
    reloadAttempts: 0,
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    // Determine error type if available
    const errorType = (error as any).type || ErrorType.UNKNOWN;
    return { hasError: true, error, errorType };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log the error to console
    console.error("Error caught by boundary:", error, errorInfo);
    
    // Update state with error info
    this.setState({ errorInfo });
    
    // Attempt recovery for authentication errors
    if ((error as any).type === ErrorType.AUTHENTICATION) {
      this.handleAuthError();
    }
  }

  private handleAuthError = async () => {
    try {
      // For authentication errors, try to refresh the token
      await refreshAccessToken();
      // If successful, reset the error state
      this.setState({ 
        hasError: false, 
        error: null, 
        errorInfo: null 
      });
    } catch (refreshError) {
      console.error("Failed to refresh authentication:", refreshError);
      // Token refresh failed, keep showing the error
    }
  };

  private handleReload = () => {
    this.setState(prevState => ({ 
      hasError: false, 
      error: null, 
      errorInfo: null,
      reloadAttempts: prevState.reloadAttempts + 1
    }));
    
    // Call custom reset handler if provided
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  private handleGoHome = () => {
    // Reset the error state
    this.setState({ 
      hasError: false, 
      error: null, 
      errorInfo: null 
    });
    
    // Redirect to home page and clear state
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <div className="flex flex-col items-center justify-center h-screen p-4 bg-background text-foreground">
          <div className="w-full max-w-md bg-card p-6 rounded-lg shadow-md">
            <div className="flex items-center justify-center w-16 h-16 rounded-full bg-destructive/10 mx-auto mb-4">
              <AlertTriangle size={28} className="text-destructive" />
            </div>
            
            <h2 className="text-xl font-semibold text-center mb-2">
              {this.state.errorType === ErrorType.AUTHENTICATION 
                ? "Authentication Error" 
                : this.state.errorType === ErrorType.NETWORK
                ? "Network Error"
                : "Something went wrong"}
            </h2>
            
            <p className="text-sm text-muted-foreground mb-4 text-center">
              {this.state.errorType === ErrorType.AUTHENTICATION 
                ? "Your session may have expired. Please sign in again."
                : this.state.errorType === ErrorType.NETWORK
                ? "Unable to connect to the server. Please check your internet connection."
                : "We encountered an unexpected error. Please try reloading the page."}
            </p>

            <div className="flex flex-col space-y-2">
              <Button 
                variant="outline"
                className="w-full flex items-center justify-center" 
                onClick={this.handleReload}
              >
                <RefreshCcw size={16} className="mr-2" />
                Try Again
              </Button>
              
              <Button 
                variant="default"
                className="w-full flex items-center justify-center" 
                onClick={this.handleGoHome}
              >
                <Home size={16} className="mr-2" />
                Go to Home Page
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export const ErrorBoundary: React.FC<Props> = (props) => {
  return <ErrorBoundaryClass {...props} />;
};

export const APIErrorBoundary: React.FC<Props> = ({ children, fallback }) => {
  return (
    <ErrorBoundary fallback={
      <div className="mt-4 p-4 bg-destructive/10 rounded-md">
        <h4 className="font-medium text-destructive mb-2">Unable to load data</h4>
        <p className="text-sm text-muted-foreground">
          We're having trouble retrieving data from our servers. Please try again later.
        </p>
        <Button 
          variant="outline" 
          className="mt-3" 
          onClick={() => window.location.reload()}
        >
          <RefreshCcw size={16} className="mr-2" />
          Reload
        </Button>
      </div>
    }>
      {children}
    </ErrorBoundary>
  );
};