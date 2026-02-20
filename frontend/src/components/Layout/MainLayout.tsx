import React, { useState, useEffect, useRef } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useSession, signOut } from '../../lib/auth-client';
import Sidebar from './Sidebar';
import { LogOut, ChevronDown, Menu } from 'lucide-react';

// ── VS Code Dark+ tokens ──────────────────────────────────────────────────────
const VS = {
  bg0:    '#1e1e1e',
  bg1:    '#252526',
  bg2:    '#2d2d2d',
  bg3:    '#333333',
  border: '#3c3c3c',
  text0:  '#f0f0f0',
  text1:  '#c0c0c0',
  text2:  '#909090',
  accent: '#007acc',
  teal:   '#4ec9b0',
  red:    '#f44747',
};

function fmtElapsed(s: number) {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
}

function nowClock() {
  return new Date().toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Australia/Sydney' });
}

const pageTitles: Record<string, string> = {
  '/dashboard':   'Dashboard',
  '/brain-dump':  'Brain Dump',
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
  const [orgId, setOrgId] = useState<string>('');

  // Wall clock
  const [currentTime, setCurrentTime] = useState(nowClock());

  // Attendance timer
  const [attendanceActive, setAttendanceActive] = useState<{ timeIn: string } | null>(null);
  const [navElapsed, setNavElapsed] = useState(0);
  const navTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const fetchRole = async () => {
      if (!session?.user?.id) return;
      try {
        const res = await fetch('/api/organizations');
        if (res.ok) {
          const data = await res.json();
          if (data.organizations?.length > 0) {
            setUserRole(data.organizations[0].role || '');
            setOrgId(data.organizations[0].id || '');
          }
        }
      } catch { /* ignore */ }
    };
    if (session) fetchRole();
  }, [session]);

  // Wall clock tick
  useEffect(() => {
    const id = setInterval(() => setCurrentTime(nowClock()), 1000);
    return () => clearInterval(id);
  }, []);

  // Fetch attendance status once orgId is known, then poll every 30s
  useEffect(() => {
    if (!session?.user?.id || !orgId) return;
    const fetchStatus = async () => {
      try {
        const q = new URLSearchParams({ userId: session!.user!.id, orgId }).toString();
        const res = await fetch(`/api/attendance/status?${q}`);
        if (res.ok) setAttendanceActive((await res.json()).active);
      } catch { /* ignore */ }
    };
    fetchStatus();
    const poll = setInterval(fetchStatus, 30_000);
    return () => clearInterval(poll);
  }, [session?.user?.id, orgId]);

  // Live elapsed tick
  useEffect(() => {
    if (navTimerRef.current) clearInterval(navTimerRef.current);
    if (!attendanceActive) { setNavElapsed(0); return; }
    const tick = () => setNavElapsed(Math.floor((Date.now() - new Date(attendanceActive.timeIn).getTime()) / 1000));
    tick();
    navTimerRef.current = setInterval(tick, 1000);
    return () => { if (navTimerRef.current) clearInterval(navTimerRef.current); };
  }, [attendanceActive]);

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
    <div className="min-h-screen" style={{ background: VS.bg0 }}>
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Top Navbar */}
      <header
        className="fixed top-0 right-0 z-40 flex h-14 items-center justify-between px-4 md:px-6 md:left-60 left-0"
        style={{ background: VS.bg1, borderBottom: `1px solid ${VS.border}` }}
      >
        {/* Left — hamburger + page title */}
        <div className="flex items-center gap-3">
          <button
            className="md:hidden flex items-center justify-center h-8 w-8 rounded-lg transition-colors"
            style={{ color: VS.text2 }}
            onClick={() => setSidebarOpen(v => !v)}
            aria-label="Toggle menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <h1 className="text-sm font-semibold" style={{ color: VS.text2 }}>{pageTitle}</h1>
        </div>

        {/* Center — wall clock + attendance elapsed (absolutely centered) */}
        <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-3">
          <span className="text-[13px] font-mono font-semibold tabular-nums" style={{ color: VS.text1 }}>
            {currentTime}
          </span>

          {attendanceActive && (
            <>
              <span style={{ color: VS.border }}>|</span>
              <div className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: VS.teal }} />
                <span className="text-[13px] font-mono font-semibold tabular-nums" style={{ color: VS.teal }}>
                  {fmtElapsed(navElapsed)}
                </span>
              </div>
            </>
          )}
        </div>

        {/* Right — user dropdown */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <button
              onClick={() => setShowDropdown(v => !v)}
              className="flex items-center gap-2.5 rounded-lg px-3 py-1.5 transition-colors duration-150"
              style={{ background: showDropdown ? VS.bg3 : 'transparent' }}
              onMouseEnter={e => { if (!showDropdown) (e.currentTarget as HTMLElement).style.background = VS.bg2; }}
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
                <p className="text-[12px] font-medium capitalize" style={{ color: VS.text0 }}>{displayName}</p>
                {userRole && (
                  <p className="text-[10px] capitalize" style={{ color: VS.text2 }}>{userRole.toLowerCase()}</p>
                )}
              </div>
              <ChevronDown className="h-3.5 w-3.5 shrink-0" style={{ color: VS.text2 }} />
            </button>

            {/* Dropdown */}
            {showDropdown && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowDropdown(false)} />
                <div
                  className="absolute right-0 top-full mt-2 w-56 rounded-xl z-20 overflow-hidden"
                  style={{ background: VS.bg1, border: `1px solid ${VS.border}`, boxShadow: '0 16px 48px rgba(0,0,0,0.7)' }}
                >
                  <div className="px-4 py-3" style={{ borderBottom: `1px solid ${VS.border}` }}>
                    <p className="text-[12px] font-medium capitalize" style={{ color: VS.text0 }}>{displayName}</p>
                    <p className="text-[11px] truncate mt-0.5" style={{ color: VS.text2 }}>{email}</p>
                  </div>
                  <button
                    onClick={handleSignOut}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-[13px] transition-colors duration-150"
                    style={{ color: VS.text1 }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLElement).style.background = `${VS.red}14`;
                      (e.currentTarget as HTMLElement).style.color = VS.red;
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLElement).style.background = 'transparent';
                      (e.currentTarget as HTMLElement).style.color = VS.text1;
                    }}
                  >
                    <LogOut className="h-4 w-4" />
                    Sign out
                  </button>
                </div>
              </>
            )}
          </div>
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
