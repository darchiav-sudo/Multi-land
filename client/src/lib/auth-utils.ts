import { apiRequest } from "./queryClient";

/**
 * Attempts to refresh the user's authentication token
 * Returns true if successful, false otherwise
 */
export async function refreshAccessToken(): Promise<boolean> {
  try {
    // Call the token refresh endpoint
    const response = await apiRequest("POST", "/api/refresh-token");
    
    if (response.ok) {
      console.log("Access token refreshed successfully");
      return true;
    } else {
      console.error("Failed to refresh token:", await response.text());
      return false;
    }
  } catch (error) {
    console.error("Error refreshing access token:", error);
    return false;
  }
}

/**
 * Simple function to check if an email is valid
 * Accepts various email formats and handles edge cases
 */
export function isValidEmail(email: string): boolean {
  if (!email) return false;
  
  // Trim the email to remove any leading/trailing whitespace
  const trimmedEmail = email.trim();
  
  // Basic email format validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(trimmedEmail);
}

/**
 * Normalizes an email address for consistent comparison
 * (trims whitespace and converts to lowercase)
 */
export function normalizeEmail(email: string): string {
  if (!email) return '';
  return email.trim().toLowerCase();
}

/**
 * Checks if a password meets minimum security requirements
 */
export function isStrongPassword(password: string): boolean {
  if (!password) return false;
  
  // Password must be at least 8 characters
  return password.length >= 8;
}

/**
 * Safely parse JWT token to get user information without exposing sensitive data
 */
export function parseJwtToken(token: string): Record<string, any> | null {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );

    return JSON.parse(jsonPayload);
  } catch (error) {
    console.error('Error parsing JWT token:', error);
    return null;
  }
}