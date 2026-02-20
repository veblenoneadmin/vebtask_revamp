import { useState, useEffect, useCallback } from 'react';
import { useSession } from '../lib/auth-client';
import { useOrganization } from '../contexts/OrganizationContext';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { ClientDashboard } from './ClientDashboard';
import { widgetService } from '../lib/widgets/WidgetService';
import { defaultDashboardLayouts, widgetDataFetchers } from '../lib/widgets/widgetRegistry';
import {
  Timer,
  Calendar,
  Brain,
  Zap,
  CheckSquare,
  LogIn,
  LogOut,
  Clock,
} from 'lucide-react';

function fmtDuration(s: number) {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function Dashboard() {
  const { data: session } = useSession();
  const { currentOrg, isLoading: orgLoading } = useOrganization();
  const [widgets, setWidgets] = useState<any[]>([]);
  const [widgetData, setWidgetData] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);

  // Attendance
  const [attendanceActive, setAttendanceActive] = useState<{ id: string; timeIn: string } | null>(null);
  const [attendanceElapsed, setAttendanceElapsed] = useState(0);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  
  // Load data for widgets
  const loadWidgetData = useCallback(async (widgetInstances: any[]) => {
    if (!session?.user?.id) return;

    const data: Record<string, any> = {};
    
    for (const instance of widgetInstances) {
      try {
        const fetcher = (widgetDataFetchers as any)[instance.widgetId];
        if (fetcher) {
          data[instance.instanceId] = await fetcher(currentOrg?.id, session.user.id);
        }
      } catch (error) {
        console.error(`Failed to load data for widget ${instance.widgetId}:`, error);
        data[instance.instanceId] = { error: 'Failed to load data' };
      }
    }
    
    setWidgetData(data);
  }, [session?.user?.id, currentOrg?.id]);

  // Initialize dashboard widgets
  useEffect(() => {
    const initializeDashboard = async () => {
      try {
        // Use layout based on user role
        const defaultLayout = currentOrg?.role === 'ADMIN' || currentOrg?.role === 'OWNER' 
          ? defaultDashboardLayouts.manager 
          : currentOrg?.role === 'STAFF'
          ? defaultDashboardLayouts.minimal
          : currentOrg?.role === 'CLIENT'
          ? defaultDashboardLayouts.client
          : defaultDashboardLayouts.standard;
        setWidgets(defaultLayout);
        
        // Load initial data for all widgets
        await loadWidgetData(defaultLayout);
      } catch (error) {
        console.error('Failed to initialize dashboard:', error);
      } finally {
        setLoading(false);
      }
    };

    if (session?.user && currentOrg?.id) {
      initializeDashboard();
    }
  }, [session, currentOrg, loadWidgetData]);

  // Attendance status fetch
  useEffect(() => {
    const fetchAttendance = async () => {
      if (!session?.user?.id || !currentOrg?.id) return;
      try {
        const q = new URLSearchParams({ userId: session.user.id, orgId: currentOrg.id }).toString();
        const res = await fetch(`/api/attendance/status?${q}`);
        if (res.ok) setAttendanceActive((await res.json()).active);
      } catch { /* ignore */ }
    };
    fetchAttendance();
  }, [session?.user?.id, currentOrg?.id]);

  // Live elapsed tick while clocked in
  useEffect(() => {
    if (!attendanceActive) { setAttendanceElapsed(0); return; }
    const tick = () => setAttendanceElapsed(Math.floor((Date.now() - new Date(attendanceActive.timeIn).getTime()) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [attendanceActive]);

  const handleTimeIn = async () => {
    if (!session?.user?.id || !currentOrg?.id) return;
    setAttendanceLoading(true);
    try {
      const res = await fetch('/api/attendance/time-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: session.user.id, orgId: currentOrg.id }),
      });
      if (res.ok) setAttendanceActive((await res.json()).log);
    } catch { /* ignore */ }
    finally { setAttendanceLoading(false); }
  };

  const handleTimeOut = async () => {
    if (!session?.user?.id || !currentOrg?.id) return;
    setAttendanceLoading(true);
    try {
      const res = await fetch('/api/attendance/time-out', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: session.user.id, orgId: currentOrg.id }),
      });
      if (res.ok) setAttendanceActive(null);
    } catch { /* ignore */ }
    finally { setAttendanceLoading(false); }
  };

  const handleWidgetRefresh = async (instanceId: string, widgetId: string) => {
    if (!session?.user?.id) return;
    const fetcher = (widgetDataFetchers as any)[widgetId];
    
    if (fetcher) {
      try {
        const newData = await fetcher(currentOrg?.id, session.user.id);
        setWidgetData(prev => ({
          ...prev,
          [instanceId]: newData
        }));
      } catch (error) {
        console.error(`Failed to refresh widget ${widgetId}:`, error);
      }
    }
  };

  const renderWidget = (instance: any) => {
    const widget = widgetService.getWidget(instance.widgetId);
    if (!widget) return null;

    const WidgetComponent = widget.component;
    const data = widgetData[instance.instanceId];
    const hasError = data?.error;
    
    return (
      <div
        key={instance.instanceId}
        className={`${getGridSizeClass(instance.position)} h-fit`}
        style={{
          gridColumn: `${instance.position.x + 1} / span ${instance.position.width}`,
          gridRow: `${instance.position.y + 1} / span ${instance.position.height}`
        }}
      >
        <WidgetComponent
          config={widget.defaultConfig}
          data={data}
          loading={!data && !hasError}
          error={hasError ? data.error : null}
          onRefresh={() => handleWidgetRefresh(instance.instanceId, instance.widgetId)}
          orgId={currentOrg?.id || ''}
          userId={session?.user?.id || ''}
        />
      </div>
    );
  };

  const getGridSizeClass = (position: any) => {
    return `col-span-${position.width} row-span-${position.height}`;
  };
  
  const quickActions = [
    { name: 'Start Timer', icon: Timer, href: '/timer', color: 'success' },
    { name: 'Brain Dump', icon: Brain, href: '/brain-dump', color: 'primary' },
    { name: 'Add Task', icon: CheckSquare, href: '/tasks', color: 'warning' },
    { name: 'Calendar', icon: Calendar, href: '/calendar', color: 'info' },
  ];

  // Early returns after all hooks
  // If user is a CLIENT, show the client-specific dashboard
  if (currentOrg?.role === 'CLIENT') {
    return <ClientDashboard />;
  }

  // Wait for both session and org to load
  if (!session || orgLoading || !currentOrg) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-surface to-surface-elevated">
        <div className="flex flex-col items-center space-y-6 animate-fade-in">
          <div className="relative">
            <img 
              src="/veblen-logo.png" 
              alt="Veblen" 
              className="w-32 h-32 object-contain animate-pulse-glow"
            />
          </div>
          <div className="flex flex-col items-center space-y-2">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
            <div className="text-lg font-medium text-muted-foreground">Loading Dashboard...</div>
          </div>
        </div>
      </div>
    );
  }

  const userName = session?.user?.email?.split('@')[0]?.replace(/[^a-zA-Z]/g, '') || 'User';
  const displayName = userName.charAt(0).toUpperCase() + userName.slice(1);

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold gradient-text">Good morning, {displayName}! 👋</h1>
            <p className="text-muted-foreground mt-2">Loading your dashboard...</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="glass p-6">
              <div className="animate-pulse">
                <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
                <div className="h-8 bg-muted rounded w-1/2"></div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Welcome Header */}
      <div>
        <h1 className="text-3xl font-bold gradient-text">Good morning, {displayName}! 👋</h1>
        <p className="text-muted-foreground mt-2">Here's your personalized dashboard with live data.</p>
      </div>

      {/* ── Time In / Time Out ── */}
      <div
        className="rounded-2xl p-5 flex items-center justify-between gap-4"
        style={{ background: '#0e0e0e', border: '1px solid #1c1c1c', boxShadow: '0 4px 24px rgba(0,0,0,0.5)' }}
      >
        <div className="flex items-center gap-4">
          <div
            className="h-12 w-12 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: attendanceActive ? 'rgba(74,222,128,0.12)' : 'rgba(255,255,255,0.04)' }}
          >
            <Clock className="h-6 w-6" style={{ color: attendanceActive ? '#4ade80' : '#444' }} />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider mb-0.5" style={{ color: '#555' }}>
              {attendanceActive ? 'Session Running' : 'Not Clocked In'}
            </p>
            <p className="text-2xl font-mono font-bold tabular-nums leading-none" style={{ color: attendanceActive ? '#4ade80' : '#2a2a2a' }}>
              {attendanceActive ? fmtDuration(attendanceElapsed) : '--:--:--'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {attendanceActive && (
            <div className="text-right hidden sm:block">
              <p className="text-[11px]" style={{ color: '#444' }}>Clocked in</p>
              <p className="text-sm font-medium tabular-nums" style={{ color: '#777' }}>
                {fmtTime(attendanceActive.timeIn)}
              </p>
            </div>
          )}
          <button
            onClick={attendanceActive ? handleTimeOut : handleTimeIn}
            disabled={attendanceLoading}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all shrink-0"
            style={attendanceActive
              ? { background: 'rgba(239,68,68,0.12)', color: '#f87171', border: '1px solid rgba(239,68,68,0.25)' }
              : { background: 'rgba(74,222,128,0.12)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.25)' }
            }
          >
            {attendanceActive
              ? <><LogOut className="h-4 w-4" />{attendanceLoading ? 'Clocking out...' : 'Clock Out'}</>
              : <><LogIn  className="h-4 w-4" />{attendanceLoading ? 'Clocking in...'  : 'Clock In'}</>
            }
          </button>
        </div>
      </div>

      {/* Quick Actions Bar */}
      <Card className="glass p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="h-10 w-10 rounded-lg bg-gradient-primary flex items-center justify-center">
              <Zap className="h-5 w-5 text-white" />
            </div>
            <div className="flex space-x-2">
              {quickActions.map((action) => {
                const Icon = action.icon;
                return (
                  <Button
                    key={action.name}
                    variant="ghost"
                    size="sm"
                    onClick={() => window.location.href = action.href}
                    className="flex items-center space-x-2"
                  >
                    <Icon className="h-4 w-4" />
                    <span className="hidden sm:inline">{action.name}</span>
                  </Button>
                );
              })}
            </div>
          </div>
          <Badge variant="secondary" className="text-xs">
            {widgets.length} widgets active
          </Badge>
        </div>
      </Card>

      {/* Dynamic Widget Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 auto-rows-min">
        {widgets.map(renderWidget)}
      </div>
    </div>
  );
}