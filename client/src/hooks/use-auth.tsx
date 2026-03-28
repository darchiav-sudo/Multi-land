import { createContext, ReactNode, useContext, useEffect } from "react";
import {
  useQuery,
  useMutation,
  UseMutationResult,
} from "@tanstack/react-query";
import { User as SelectUser } from "@shared/schema";
import { getQueryFn, apiRequest, queryClient } from "../lib/queryClient";
import { useLocation } from "wouter";
import { isIOS } from "../lib/capacitor";

type AuthContextType = {
  user: SelectUser | null;
  isLoading: boolean;
  error: Error | null;
  loginMutation: UseMutationResult<SelectUser, Error, LoginData>;
  logoutMutation: UseMutationResult<void, Error, void>;
  registerMutation: UseMutationResult<SelectUser, Error, RegisterData>;
  adminLoginMutation: UseMutationResult<SelectUser, Error, LoginData>;
};

type LoginData = {
  email: string;
  password?: string;
  isAdmin?: boolean;
};

type RegisterData = {
  username: string;
  email: string;
  password?: string;
};

export const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [, navigate] = useLocation();
  
  const {
    data: user,
    error,
    isLoading,
  } = useQuery<SelectUser | null, Error>({
    queryKey: ["/api/user"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    staleTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: true,
    retry: (failureCount, error: any) => {
      // Don't retry on 401 unauthorized errors
      if (error?.message?.includes("401")) {
        return false;
      }
      return failureCount < 3;
    },
  });

  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginData) => {
      // iOS-specific checks and handling
      const deviceIsIOS = isIOS();
      
      if (deviceIsIOS) {
        console.log("iOS device detected, using enhanced login flow");
        // For iOS, add a slight delay and make sure the email is properly formatted
        // This helps with keyboard hiding and input field focus issues on iOS
        await new Promise(resolve => setTimeout(resolve, 300));
      }
      
      // Enhanced logging for troubleshooting
      console.log(`Login attempt for: ${credentials.email} (iOS: ${deviceIsIOS})`);
      
      try {
        const res = await apiRequest("POST", "/api/login", credentials);
        
        if (!res.ok) {
          // Handle specific HTTP error codes with meaningful messages
          if (res.status === 401) {
            // Try to get more specific error information from the response
            try {
              const errorData = await res.json();
              if (errorData.message) {
                if (errorData.message.includes("User not found")) {
                  throw new Error("Email address not found. Please check your email and try again.");
                } else if (errorData.message.includes("Password required")) {
                  throw new Error("Password is required for this account.");
                } else {
                  throw new Error(errorData.message);
                }
              }
            } catch (parseError) {
              // If we can't parse the error JSON, use a generic message
              throw new Error("Invalid email address. Please check and try again.");
            }
          }
          
          // For other status codes, throw a generic error
          throw new Error("Sign in failed. Please check your email and try again.");
        }
        
        const data = await res.json();
        console.log("Login response received successfully");
        return data;
      } catch (err) {
        console.error("Login request failed:", err);
        // On iOS, add a retry mechanism for network errors
        if (deviceIsIOS && err instanceof Error && 
            (err.message.includes('network') || err.message.includes('timeout'))) {
          console.log("Detected network error on iOS, retrying...");
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          try {
            const retryRes = await apiRequest("POST", "/api/login", credentials);
            if (!retryRes.ok) {
              throw new Error("Sign in failed after retry. Please check your email and try again.");
            }
            return await retryRes.json();
          } catch (retryErr) {
            throw new Error("Unable to sign in. Please check your connection and try again.");
          }
        }
        throw err;
      }
    },
    onSuccess: (user: SelectUser) => {
      // Update query cache first, before navigation
      queryClient.setQueryData(["/api/user"], user);
      console.log("User data cached, redirecting to My Learning page");
      
      // iOS-specific redirect handling
      if (isIOS()) {
        // Force a small delay on iOS to ensure the navigation works properly
        setTimeout(() => {
          navigate("/my-learning", { replace: true });
        }, 100);
      } else {
        // For other platforms, redirect immediately
        navigate("/my-learning", { replace: true });
      }
    },
    onError: (error: Error) => {
      console.error("Login failed:", error);
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (data: RegisterData) => {
      const res = await apiRequest("POST", "/api/register", data);
      return await res.json();
    },
    onSuccess: (user: SelectUser) => {
      queryClient.setQueryData(["/api/user"], user);
      // Redirect new users to My Learning page as well
      navigate("/my-learning", { replace: true });
    },
    onError: (error: Error) => {
      console.error("Registration failed:", error);
    },
  });

  const adminLoginMutation = useMutation({
    mutationFn: async (credentials: LoginData) => {
      // iOS-specific checks and handling
      const deviceIsIOS = isIOS();
      
      if (deviceIsIOS) {
        console.log("iOS device detected, using enhanced admin login flow");
        // For iOS, add a slight delay and make sure the email is properly formatted
        // This helps with keyboard hiding and input field focus issues on iOS
        await new Promise(resolve => setTimeout(resolve, 300));
      }
      
      // Enhanced logging for troubleshooting
      console.log(`Admin login attempt for: ${credentials.email} (iOS: ${deviceIsIOS})`);
      
      // Make sure password is provided and not empty for admin login
      if (!credentials.password || credentials.password.trim() === '') {
        const error = new Error("Password is required for admin login");
        console.error(error.message);
        throw error;
      }
      
      // Make sure to explicitly set isAdmin=true for admin login requests
      const adminCredentials = {
        ...credentials,
        isAdmin: true // Always set this flag for admin login
      };
      
      try {
        console.log("Sending admin login request with credentials:", { 
          email: adminCredentials.email, 
          hasPassword: !!adminCredentials.password,
          isAdmin: adminCredentials.isAdmin
        });
        
        const res = await apiRequest("POST", "/api/login", adminCredentials);
        
        if (!res.ok) {
          // Handle specific HTTP error codes
          if (res.status === 403) {
            throw new Error("Admin access denied. You don't have administrator privileges.");
          } else if (res.status === 401) {
            throw new Error("Invalid email or password");
          }
          
          const errorText = await res.text();
          throw new Error(`Login failed: ${errorText || res.statusText}`);
        }
        
        const data = await res.json();
        console.log("Admin login response received successfully");
        return data;
      } catch (err) {
        console.error("Admin login request failed:", err);
        
        // On iOS, add a retry mechanism for network errors
        if (deviceIsIOS && err instanceof Error && 
            (err.message.includes('network') || err.message.includes('timeout'))) {
          console.log("Detected network error on iOS, retrying admin login...");
          await new Promise(resolve => setTimeout(resolve, 1000));
          const retryRes = await apiRequest("POST", "/api/login", adminCredentials);
          
          if (!retryRes.ok) {
            throw new Error(`Login retry failed: ${retryRes.statusText}`);
          }
          
          return await retryRes.json();
        }
        throw err;
      }
    },
    onSuccess: (user: SelectUser) => {
      if (!user.isAdmin) {
        console.error("Access denied: Account doesn't have admin privileges");
        logoutMutation.mutate();
        return;
      }
      
      // Update query cache first, before navigation
      queryClient.setQueryData(["/api/user"], user);
      console.log("Admin user data cached, redirecting to admin page");
      
      // iOS-specific redirect handling
      if (isIOS()) {
        // Force a small delay on iOS to ensure the navigation works properly
        setTimeout(() => {
          navigate("/admin", { replace: true });
        }, 100);
      } else {
        // For other platforms, redirect immediately
        navigate("/admin", { replace: true });
      }
    },
    onError: (error: Error) => {
      console.error("Admin login failed:", error);
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/logout");
    },
    onSuccess: () => {
      queryClient.setQueryData(["/api/user"], null);
      navigate("/", { replace: true });
    },
    onError: (error: Error) => {
      console.error("Logout failed:", error);
    },
  });

  return (
    <AuthContext.Provider
      value={{
        user: user || null,
        isLoading,
        error,
        loginMutation,
        logoutMutation,
        registerMutation,
        adminLoginMutation,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
