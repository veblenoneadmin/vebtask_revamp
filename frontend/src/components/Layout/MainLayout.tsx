import React, { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useSession, signOut } from '../../lib/auth-client';
import Sidebar from './Sidebar';
import { LogOut, ChevronDown, Menu } from 'lucide-react';

const pageTitles: Record<string, string> = {
  '/dashboard':   'Dashboard',
  '/tasks':       'Tasks',
  '/timer':       'Timer',
  '/attendance':  'Attendance',
  '/projects':    'Projects',
  '/timesheets':  'Time Logs',
  '/clients':     'Clients',
  '/reports':     'Reports',
  '/admin':       'Administration',
  '/settings':    'Settings',
};

const MainLayout: React.FC = () => {
  const { data: session } = useSession();
  const location = useLocation();
  const [showDropdown, setShowDropdown] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userRole, setUserRole] = useState<string>('');

  useEffect(() => {
    const fetchRole = async () => {
      if (!session?.user?.id) return;
      try {
        const res = await fetch('/api/organizations');
        if (res.ok) {
          const data = await res.json();
          if (data.organizations?.length > 0) {
            setUserRole(data.organizations[0].role || '');
          }
        }
      } catch {
        // ignore
      }
    };
    if (session) fetchRole();
  }, [session]);

  const handleSignOut = async () => {
    try { await signOut(); } catch { /* ignore */ }
    window.location.href = '/login';
  };

  const getInitials = (email: string) =>
    email.split('@')[0].split('.').map(n => n[0]?.toUpperCase()).join('').slice(0, 2);

  const pageTitle = pageTitles[location.pathname] ?? 'VebTask';
  const email = session?.user?.email ?? '';
  const displayName = email.split('@')[0] || 'User';

  return (
    <div className="min-h-screen" style={{ background: '#050505' }}>
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Top Navbar */}
      <header
        className="fixed top-0 right-0 z-40 flex h-14 items-center justify-between px-4 md:px-6 md:left-60 left-0"
        style={{
          background: '#070707',
          borderBottom: '1px solid #1c1c1c',
        }}
      >
        <div className="flex items-center gap-3">
          {/* Hamburger — mobile only */}
          <button
            className="md:hidden flex items-center justify-center h-8 w-8 rounded-lg transition-colors"
            style={{ color: '#666' }}
            onClick={() => setSidebarOpen(v => !v)}
            aria-label="Toggle menu"
          >
            <Menu className="h-5 w-5" />
          </button>

          {/* Page title */}
          <h1 className="text-sm font-semibold" style={{ color: '#666' }}>
            {pageTitle}
          </h1>
        </div>

        {/* Account dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowDropdown(v => !v)}
            className="flex items-center gap-2.5 rounded-lg px-3 py-1.5 transition-colors duration-150"
            style={{ background: showDropdown ? '#111' : 'transparent' }}
            onMouseEnter={e => { if (!showDropdown) (e.currentTarget as HTMLElement).style.background = '#0f0f0f'; }}
            onMouseLeave={e => { if (!showDropdown) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
          >
            {/* Avatar */}
            <div
              className="h-7 w-7 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0"
              style={{ background: 'linear-gradient(135deg, hsl(252 87% 62%), hsl(260 80% 70%))' }}
            >
              {email ? getInitials(email) : 'U'}
            </div>
            <div className="text-left leading-tight hidden sm:block">
              <p className="text-[12px] font-medium capitalize" style={{ color: '#ccc' }}>{displayName}</p>
              {userRole && (
                <p className="text-[10px] capitalize" style={{ color: '#555' }}>{userRole.toLowerCase()}</p>
              )}
            </div>
            <ChevronDown className="h-3.5 w-3.5 shrink-0" style={{ color: '#555' }} />
          </button>

          {/* Dropdown */}
          {showDropdown && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowDropdown(false)} />
              <div
                className="absolute right-0 top-full mt-2 w-56 rounded-xl z-20 overflow-hidden"
                style={{
                  background: '#0d0d0d',
                  border: '1px solid #222',
                  boxShadow: '0 16px 48px rgba(0,0,0,0.7)',
                }}
              >
                <div className="px-4 py-3" style={{ borderBottom: '1px solid #1a1a1a' }}>
                  <p className="text-[12px] font-medium capitalize" style={{ color: '#ccc' }}>{displayName}</p>
                  <p className="text-[11px] truncate mt-0.5" style={{ color: '#555' }}>{email}</p>
                </div>
                <button
                  onClick={handleSignOut}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-[13px] transition-colors duration-150"
                  style={{ color: '#777' }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLElement).style.background = 'rgba(220,38,38,0.08)';
                    (e.currentTarget as HTMLElement).style.color = '#f87171';
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.background = 'transparent';
                    (e.currentTarget as HTMLElement).style.color = '#777';
                  }}
                >
                  <LogOut className="h-4 w-4" />
                  Sign out
                </button>
              </div>
            </>
          )}
        </div>
      </header>

      {/* Page content */}
      <main className="md:pl-60 pt-14">
        <div className="p-4 md:p-7">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default MainLayout;
