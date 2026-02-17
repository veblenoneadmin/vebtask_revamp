import React, { createContext, useContext, useState, useEffect } from 'react';
import { useSession } from '../lib/auth-client';

interface Organization {
  id: string;
  name: string;
  slug: string;
  role: 'OWNER' | 'ADMIN' | 'STAFF' | 'CLIENT';
}

interface OrganizationContextType {
  currentOrg: Organization | null;
  allOrganizations: Organization[];
  isLoading: boolean;
  switchOrganization: (orgId: string) => void;
  refreshOrganizations: () => Promise<void>;
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined);

export function OrganizationProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const [currentOrg, setCurrentOrg] = useState<Organization | null>(null);
  const [allOrganizations, setAllOrganizations] = useState<Organization[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchOrganizations = async () => {
    if (!session?.user?.id) {
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch(`/api/organizations?userId=${session.user.id}`, {
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        const orgs = data.organizations || [];
        setAllOrganizations(orgs);
        
        // Set current org to first one if none selected
        if (orgs.length > 0 && !currentOrg) {
          const firstOrg = orgs[0];
          setCurrentOrg({
            id: firstOrg.id,
            name: firstOrg.name,
            slug: firstOrg.slug,
            role: firstOrg.role || 'ADMIN'
          });
        }
      } else {
        console.error('Failed to fetch organizations:', response.statusText);
      }
    } catch (error) {
      console.error('Error fetching organizations:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshOrganizations = async () => {
    setIsLoading(true);
    await fetchOrganizations();
  };

  const switchOrganization = (orgId: string) => {
    const org = allOrganizations.find(o => o.id === orgId);
    if (org) {
      setCurrentOrg({
        id: org.id,
        name: org.name,
        slug: org.slug,
        role: org.role || 'ADMIN'
      });
    }
  };

  useEffect(() => {
    fetchOrganizations();
  }, [session]);

  return (
    <OrganizationContext.Provider
      value={{
        currentOrg,
        allOrganizations,
        isLoading,
        switchOrganization,
        refreshOrganizations
      }}
    >
      {children}
    </OrganizationContext.Provider>
  );
}

export function useOrganization() {
  const context = useContext(OrganizationContext);
  if (context === undefined) {
    throw new Error('useOrganization must be used within an OrganizationProvider');
  }
  return context;
}