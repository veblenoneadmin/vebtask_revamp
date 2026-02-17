import { createAuthClient } from "better-auth/react";

// Determine the base URL based on environment
function getBaseURL() {
  // In development, use the same server as the frontend
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return window.location.origin;
  }
  
  // In production, use the same origin (since we serve both from the same server)
  if (window.location.hostname === 'vebtask.com' || window.location.hostname === 'www.vebtask.com') {
    return window.location.origin;
  }
  
  // For Railway deployment
  if (window.location.hostname.includes('railway.app')) {
    return window.location.origin;
  }
  
  // Use environment variable or same origin as fallback
  return import.meta.env.VITE_APP_URL || window.location.origin;
}

const baseURL = getBaseURL();
console.log('Auth client baseURL:', baseURL + '/api/auth');

export const authClient = createAuthClient({
  baseURL: baseURL + "/api/auth",
  // Reduce session polling frequency to prevent blinking
  sessionConfig: {
    refreshOnWindowFocus: false, // Don't refresh on window focus
    refreshInterval: 5 * 60 * 1000, // Only refresh every 5 minutes instead of constantly
  },
});

// Export the hooks and methods we'll use
export const {
  signIn,
  signOut, 
  signUp,
  useSession,
} = authClient;