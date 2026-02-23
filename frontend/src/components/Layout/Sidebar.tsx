import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useSession } from '../../lib/auth-client';
import {
  LayoutDashboard,
  CheckSquare,
  Clock,
  Settings,
  BarChart3,
  Building2,
  Users,
  TrendingUp,
} from 'lucide-react';
import { cn } from '../../lib/utils';

// ── VS Code Dark+ tokens ──────────────────────────────────────────────────────
const VS = {
  bg1:    '#252526',
  bg2:    '#2d2d2d',
  border: '#3c3c3c',
  text1:  '#c0c0c0',
  text2:  '#909090',
  accent: '#569cd6',
};

const getAllNavigationItems = () => [
  { name: 'Dashboard',      href: '/dashboard',  icon: LayoutDashboard, roles: ['OWNER', 'ADMIN', 'STAFF', 'CLIENT'] },
  { name: 'Tasks',          href: '/tasks',       icon: CheckSquare,     roles: ['OWNER', 'ADMIN', 'STAFF', 'CLIENT'] },
  { name: 'Projects',       href: '/projects',    icon: Building2,       roles: ['OWNER', 'ADMIN', 'STAFF'] },
  { name: 'Time Logs',      href: '/timesheets',  icon: Clock,           roles: ['OWNER', 'ADMIN', 'STAFF', 'CLIENT'] },
  { name: 'Clients',        href: '/clients',     icon: Users,           roles: ['OWNER', 'ADMIN', 'STAFF'] },
  { name: 'Reports',        href: '/reports',     icon: BarChart3,       roles: ['OWNER', 'ADMIN', 'STAFF'] },
  { name: 'Members',        href: '/members',     icon: Users,           roles: ['OWNER', 'ADMIN'] },
  { name: 'KPI Reports',    href: '/kpi-reports', icon: TrendingUp,      roles: ['OWNER', 'ADMIN', 'STAFF'] },
  { name: 'User Management', href: '/admin',       icon: Users,           roles: ['OWNER', 'ADMIN'] },
  { name: 'Settings',       href: '/settings',    icon: Settings,        roles: ['OWNER', 'ADMIN', 'STAFF', 'CLIENT'] },
];

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
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
      } catch { /* ignore */ }
    };
    if (session) fetchUserRole();
  }, [session]);

  // Close sidebar on route change (mobile)
  useEffect(() => {
    onClose();
  }, [location.pathname]);

  const navItems = getAllNavigationItems().filter(item => {
    if (item.name === 'User Management') return userRole === 'OWNER' || userRole === 'ADMIN';
    return item.roles.includes(userRole);
  });

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div className="fixed inset-0 z-40 bg-black/60 md:hidden" onClick={onClose} />
      )}

      {/* Sidebar panel */}
      <div
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-60 flex flex-col transition-transform duration-300 ease-in-out',
          'md:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
        style={{ background: VS.bg1, borderRight: `1px solid ${VS.border}` }}
      >
        {/* Logo */}
        <div
          className="flex h-14 items-center px-4 shrink-0"
          style={{ borderBottom: `1px solid ${VS.border}` }}
        >
          <div className="flex items-center gap-3">
            <img src="/veblen-logo.png" alt="VebTask" className="h-8 w-8 object-contain rounded-lg" />
            <div>
              <p className="text-sm font-bold gradient-text tracking-tight leading-tight">VebTask</p>
              <p className="text-[10px] leading-none" style={{ color: VS.text2 }}>Veblen Internal</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-2 py-4">
          <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-widest" style={{ color: VS.border }}>
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
                    background: `${VS.accent}22`,
                    borderLeft: `2px solid ${VS.accent}`,
                    color: VS.accent,
                  } : {
                    color: VS.text2,
                    borderLeft: '2px solid transparent',
                  }}
                  onMouseEnter={e => {
                    if (!isActive) {
                      (e.currentTarget as HTMLElement).style.background = VS.bg2;
                      (e.currentTarget as HTMLElement).style.color = VS.text1;
                    }
                  }}
                  onMouseLeave={e => {
                    if (!isActive) {
                      (e.currentTarget as HTMLElement).style.background = 'transparent';
                      (e.currentTarget as HTMLElement).style.color = VS.text2;
                    }
                  }}
                >
                  <Icon className="h-4 w-4 shrink-0" style={isActive ? { color: VS.accent } : {}} />
                  {item.name}
                </NavLink>
              );
            })}
          </div>
        </nav>

        {/* Version tag */}
        <div
          className="px-4 py-2.5 text-[10px] shrink-0"
          style={{ color: VS.border, borderTop: `1px solid ${VS.border}` }}
        >
          VebTask v1.0
        </div>
      </div>
    </>
  );
};

export default Sidebar;
