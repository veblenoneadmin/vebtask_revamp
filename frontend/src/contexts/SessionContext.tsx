import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useSession as useBetterAuthSession } from '../lib/auth-client';

interface SessionContextType {
  session: any;
  isLoading: boolean;
  error: any;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

interface SessionProviderProps {
  children: ReactNode;
}

export function SessionProvider({ children }: SessionProviderProps) {
  const { data: session, isPending: isLoading, error } = useBetterAuthSession();
  const [stableSession, setStableSession] = useState(session);
  const [saSession, setSaSession]         = useState<any>(null);
  const [checkingSa, setCheckingSa]       = useState(false);

  // Only update session when it actually changes to prevent unnecessary re-renders
  useEffect(() => {
    if (session !== stableSession) {
      setStableSession(session);
    }
    // Clear super admin session if a real session appears
    if (session) setSaSession(null);
  }, [session?.user?.id, session?.user?.email]); // Only depend on stable user properties

  // When Better Auth finds no session, check for a super admin cookie (no DB record)
  useEffect(() => {
    if (isLoading || session) return;
    let cancelled = false;
    setCheckingSa(true);
    fetch('/api/super-admin/me', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!cancelled && data?.isSuperAdmin) {
          setSaSession({ user: data.user });
        }
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setCheckingSa(false); });
    return () => { cancelled = true; };
  }, [isLoading, session?.user?.id]);

  const contextValue = {
    session:   stableSession || saSession,
    isLoading: isLoading || checkingSa,
    error,
  };

  return (
    <SessionContext.Provider value={contextValue}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSessionContext(): SessionContextType {
  const context = useContext(SessionContext);
  if (context === undefined) {
    throw new Error('useSessionContext must be used within a SessionProvider');
  }
  return context;
}

// Export a compatible hook that matches the better-auth API
export function useSession() {
  const { session, isLoading, error } = useSessionContext();
  return {
    data:      session,
    isPending: isLoading,
    error,
  };
}
