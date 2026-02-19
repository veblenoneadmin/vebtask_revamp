import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useSession } from '../../lib/auth-client';
import { hasAdminAccess } from '../../config/internal';
import {
  LayoutDashboard,
  CheckSquare,
  Clock,
  Brain,
  Settings,
  BarChart3,
  Building2,
  Users,
  Shield,
  CalendarClock
} from 'lucide-react';
import { cn } from '../../lib/utils';

const getAllNavigationItems = () => [
  { name: 'Dashboard',      href: '/dashboard',  icon: LayoutDashboard, roles: ['OWNER', 'ADMIN', 'STAFF', 'CLIENT'] },
  // { name: 'Brain Dump',     href: '/brain-dump', icon: Brain,           roles: ['OWNER', 'ADMIN', 'STAFF'] },
  { name: 'Tasks',          href: '/tasks',       icon: CheckSquare,     roles: ['OWNER', 'ADMIN', 'STAFF', 'CLIENT'] },
  { name: 'Timer',          href: '/timer',       icon: Clock,           roles: ['OWNER', 'ADMIN', 'STAFF', 'CLIENT'] },
  { name: 'Attendance',     href: '/attendance',  icon: CalendarClock,   roles: ['OWNER', 'ADMIN', 'STAFF', 'CLIENT'] },
  { name: 'Projects',       href: '/projects',    icon: Building2,       roles: ['OWNER', 'ADMIN', 'STAFF'] },
  { name: 'Time Logs',      href: '/timesheets',  icon: Clock,           roles: ['OWNER', 'ADMIN', 'STAFF', 'CLIENT'] },
  { name: 'Clients',        href: '/clients',     icon: Users,           roles: ['OWNER', 'ADMIN', 'STAFF'] },
  { name: 'Reports',        href: '/reports',     icon: BarChart3,       roles: ['OWNER', 'ADMIN', 'STAFF'] },
  { name: 'Administration', href: '/admin',       icon: Shield,          roles: ['OWNER', 'ADMIN'] },
  { name: 'Settings',       href: '/settings',    icon: Settings,        roles: ['OWNER', 'ADMIN', 'STAFF', 'CLIENT'] },
];

const Sidebar: React.FC = () => {
  const location = useLocation();
  const { data: session } = useSession();
  const [userRole, setUserRole] = useState<string>('CLIENT');

  useEffect(() => {
    const fetchUserRole = async () => {
      if (!session?.user?.id) return;
      try {
        const response = await fetch('/api/organizations');
        if (response.ok) {
          const data = await response.json();
          if (data.organizations?.length > 0) {
            setUserRole(data.organizations[0].role || 'CLIENT');
          }
        }
      } catch {
        // ignore
      }
    };
    if (session) fetchUserRole();
  }, [session]);

  const navItems = getAllNavigationItems().filter(item => {
    if (item.name === 'Administration') return hasAdminAccess(userRole);
    return item.roles.includes(userRole);
  });

  return (
    <div
      className="fixed inset-y-0 left-0 z-50 w-60 flex flex-col"
      style={{ background: '#070707', borderRight: '1px solid #1c1c1c' }}
    >
      {/* Logo */}
      <div
        className="flex h-14 items-center px-4 shrink-0"
        style={{ borderBottom: '1px solid #1c1c1c' }}
      >
        <div className="flex items-center gap-3">
          <img src="/veblen-logo.png" alt="VebTask" className="h-8 w-8 object-contain rounded-lg" />
          <div>
            <p className="text-sm font-bold gradient-text tracking-tight leading-tight">VebTask</p>
            <p className="text-[10px] leading-none" style={{ color: '#444' }}>Veblen Internal</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-2 py-4">
        <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-widest" style={{ color: '#333' }}>
          Menu
        </p>
        <div className="space-y-0.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.href;
            return (
              <NavLink
                key={item.name}
                to={item.href}
                className={cn(
                  'flex items-center gap-3 px-3 py-[7px] rounded-lg text-[13px] font-medium transition-colors duration-150'
                )}
                style={isActive ? {
                  background: 'linear-gradient(90deg, hsl(252 87% 62% / 0.15) 0%, transparent 100%)',
                  borderLeft: '2px solid hsl(252, 87%, 62%)',
                  color: '#c4b5fd',
                } : {
                  color: '#585858',
                  borderLeft: '2px solid transparent',
                }}
                onMouseEnter={e => {
                  if (!isActive) {
                    (e.currentTarget as HTMLElement).style.background = '#111';
                    (e.currentTarget as HTMLElement).style.color = '#bbb';
                  }
                }}
                onMouseLeave={e => {
                  if (!isActive) {
                    (e.currentTarget as HTMLElement).style.background = 'transparent';
                    (e.currentTarget as HTMLElement).style.color = '#585858';
                  }
                }}
              >
                <Icon className="h-4 w-4 shrink-0" style={isActive ? { color: '#a78bfa' } : {}} />
                {item.name}
              </NavLink>
            );
          })}
        </div>
      </nav>

      {/* Version tag */}
      <div
        className="px-4 py-2.5 text-[10px] shrink-0"
        style={{ color: '#252525', borderTop: '1px solid #141414' }}
      >
        VebTask v1.0
      </div>
    </div>
  );
};

export default Sidebar;