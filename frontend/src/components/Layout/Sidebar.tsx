import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useSession, signOut } from '../../lib/auth-client';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Avatar, AvatarFallback } from '../ui/avatar';
import {
  LayoutDashboard,
  CheckSquare,
  Clock,
  Brain,
  Settings,
  LogOut,
  BarChart3,
  Building2,
  Users,
  Shield,
  Star
} from 'lucide-react';
import { cn } from '../../lib/utils';

// Navigation items with role-based access control
const getAllNavigationItems = () => [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, roles: ['OWNER', 'ADMIN', 'STAFF', 'CLIENT'] },
  { name: 'Brain Dump', href: '/brain-dump', icon: Brain, roles: ['OWNER', 'ADMIN', 'STAFF'] },
  { name: 'Tasks', href: '/tasks', icon: CheckSquare, roles: ['OWNER', 'ADMIN', 'STAFF', 'CLIENT'] },
  { name: 'Timer', href: '/timer', icon: Clock, roles: ['OWNER', 'ADMIN', 'STAFF', 'CLIENT'] },
  { name: 'Skills', href: '/skills', icon: Star, roles: ['OWNER', 'ADMIN', 'STAFF'] },
  { name: 'Projects', href: '/projects', icon: Building2, roles: ['OWNER', 'ADMIN', 'STAFF'] },
  { name: 'Time Logs', href: '/timesheets', icon: Clock, roles: ['OWNER', 'ADMIN', 'STAFF', 'CLIENT'] },
  { name: 'Clients', href: '/clients', icon: Users, roles: ['OWNER', 'ADMIN', 'STAFF'] },
  { name: 'Reports', href: '/reports', icon: BarChart3, roles: ['OWNER', 'ADMIN', 'STAFF'] },
  { name: 'Administration', href: '/admin', icon: Shield, roles: ['OWNER', 'ADMIN'] },
  { name: 'Settings', href: '/settings', icon: Settings, roles: ['OWNER', 'ADMIN', 'STAFF', 'CLIENT'] },
];

const Sidebar: React.FC = () => {
  const location = useLocation();
  const { data: session } = useSession();
  const [userRole, setUserRole] = useState<string>('CLIENT');
  
  // Fetch user role when session is available
  useEffect(() => {
    const fetchUserRole = async () => {
      if (session?.user?.id) {
        try {
          console.log('🔍 Fetching organizations for user:', session.user.email);
          const response = await fetch('/api/organizations');
          console.log('📡 Organizations API response status:', response.status);
          
          if (response.ok) {
            const data = await response.json();
            console.log('📋 Organizations data:', data);
            
            if (data.organizations && data.organizations.length > 0) {
              const role = data.organizations[0].role || 'CLIENT';
              console.log('👤 Setting user role to:', role);
              setUserRole(role);
            } else {
              console.log('⚠️ No organizations found, defaulting to CLIENT');
              setUserRole('CLIENT');
            }
          } else {
            console.error('❌ Failed to fetch organizations:', response.status, response.statusText);
          }
        } catch (error) {
          console.error('❌ Failed to fetch user role:', error);
        }
      }
    };
    
    if (session) {
      fetchUserRole();
    }
  }, [session]);

  const handleSignOut = async () => {
    try {
      await signOut();
      window.location.href = '/login';
    } catch (error) {
      console.error('Logout failed:', error);
      // Still redirect even if logout fails
      window.location.href = '/login';
    }
  };

  // Get user initials
  const getInitials = (email: string) => {
    return email
      .split('@')[0]
      .split('.')
      .map(name => name.charAt(0).toUpperCase())
      .join('')
      .slice(0, 2);
  };

  return (
    <div className="fixed inset-y-0 left-0 z-50 w-72 glass-surface border-r border-border">
      <div className="flex h-full flex-col">
        {/* Logo */}
        <div className="flex h-16 items-center px-6 border-b border-border">
          <div className="flex items-center space-x-3">
            <img src="/veblen-logo.png" alt="VebTask Logo" className="h-10 w-10 object-contain rounded-lg" />
            <div>
              <h1 className="text-lg font-bold gradient-text">VebTask</h1>
              <p className="text-xs text-muted-foreground">Veblen Internal</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-6 space-y-2">
          {getAllNavigationItems()
            .filter(item => {
              // Show admin navigation only to admins/owners
              if (item.name === 'Administration') {
                return userRole === 'OWNER' || userRole === 'ADMIN';
              }
              // Filter based on user role
              return item.roles.includes(userRole);
            })
            .map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.href;
            
            return (
              <NavLink
                key={item.name}
                to={item.href}
                className={cn(
                  "flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 group",
                  "hover:bg-surface-elevated hover:text-foreground",
                  isActive 
                    ? "bg-gradient-primary text-white shadow-lg glow-primary" 
                    : "text-muted-foreground hover:bg-surface-elevated/80"
                )}
              >
                <Icon className={cn(
                  "mr-3 h-5 w-5 transition-transform duration-200", 
                  isActive && "text-white",
                  !isActive && "group-hover:scale-110"
                )} />
                {item.name}
              </NavLink>
            );
          })}
        </nav>

        {/* User Profile */}
        <div className="p-4 border-t border-border">
          <div className="flex items-center space-x-3 p-3 rounded-lg bg-surface-elevated">
            <Avatar className="h-10 w-10">
              <AvatarFallback className="bg-gradient-primary text-white font-medium">
                {session?.user?.email ? getInitials(session.user.email) : 'U'}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-2">
                <p className="text-sm font-medium text-foreground truncate">
                  {session?.user?.email?.split('@')[0] || 'User'}
                </p>
                <Badge variant="outline" className="text-xs capitalize">
                  {userRole.toLowerCase()}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground truncate">{session?.user?.email}</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSignOut}
              className="h-8 w-8 p-0 hover:bg-error/10 hover:text-error"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;