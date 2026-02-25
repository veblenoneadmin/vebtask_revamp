import { useState, useEffect, useCallback } from 'react';
import { useSession } from '../lib/auth-client';
import { Card, CardContent, CardHeader } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import {
  Clock, Calendar, Download, Search,
  TrendingUp, BarChart3, Users, LogIn, LogOut, Timer
} from 'lucide-react';
import { cn } from '../lib/utils';

interface AttendanceLog {
  id: string;
  date: string;
  timeIn: string;
  timeOut: string | null;
  duration: number; // seconds
  durationMins: number | null;
  notes: string | null;
  isActive: boolean;
  memberId: string;
  memberName: string;
  memberEmail: string;
  memberImage: string | null;
  memberRole: string;
}

function MemberAvatar({ name, image, size = 28 }: { name: string; image?: string | null; size?: number }) {
  const initials = name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '?';
  const colors = ['#569cd6', '#c586c0', '#4ec9b0', '#dcdcaa', '#ce9178', '#007acc'];
  const color = colors[(name?.charCodeAt(0) ?? 0) % colors.length];
  return image
    ? <img src={image} alt={name} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
    : <div style={{ width: size, height: size, borderRadius: '50%', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.36, fontWeight: 700, color: '#fff', flexShrink: 0 }}>{initials}</div>;
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function formatTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

const getRoleBadgeStyle = (role: string) => {
  switch (role) {
    case 'OWNER': return { background: 'rgba(220,220,170,0.15)', color: '#dcdcaa', border: '1px solid rgba(220,220,170,0.3)' };
    case 'ADMIN': return { background: 'rgba(197,134,192,0.15)', color: '#c586c0', border: '1px solid rgba(197,134,192,0.3)' };
    case 'STAFF': return { background: 'rgba(78,201,176,0.15)',  color: '#4ec9b0',  border: '1px solid rgba(78,201,176,0.3)'  };
    default:      return { background: 'rgba(144,144,144,0.15)', color: '#909090',  border: '1px solid rgba(144,144,144,0.3)'  };
  }
};

export function TimeLogs() {
  const { data: session } = useSession();
  const [logs, setLogs] = useState<AttendanceLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [orgId, setOrgId] = useState('');
  const [isPrivileged, setIsPrivileged] = useState(false);
  const [userRole, setUserRole] = useState('STAFF');

  // Clock-in state
  const [clockedIn, setClockedIn] = useState(false);
  const [activeLog, setActiveLog] = useState<AttendanceLog | null>(null);
  const [clockLoading, setClockLoading] = useState(false);
  const [elapsed, setElapsed] = useState(0); // seconds ticking

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMember, setFilterMember] = useState('all');

  // ── Fetch org ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!session?.user?.id) return;
    fetch(`/api/organizations?userId=${session.user.id}`)
      .then(r => r.json())
      .then(d => { if (d.organizations?.[0]) setOrgId(d.organizations[0].id); })
      .catch(console.error);
  }, [session]);

  // ── Fetch logs ─────────────────────────────────────────────────────────────
  const fetchLogs = useCallback(async () => {
    if (!session?.user?.id || !orgId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/attendance/logs?orgId=${orgId}`, {
        headers: { 'x-org-id': orgId },
      });
      if (res.ok) {
        const data = await res.json();
        setIsPrivileged(data.isPrivileged ?? false);
        setUserRole(data.role ?? 'STAFF');
        setLogs(data.logs || []);
      }
    } catch (err) {
      console.error('Failed to fetch attendance logs:', err);
    } finally {
      setLoading(false);
    }
  }, [session, orgId]);

  // ── Fetch clock-in status ──────────────────────────────────────────────────
  const fetchStatus = useCallback(async () => {
    if (!orgId) return;
    try {
      const res = await fetch(`/api/attendance/status`, {
        headers: { 'x-org-id': orgId },
      });
      if (res.ok) {
        const data = await res.json();
        setClockedIn(data.clockedIn);
        setActiveLog(data.activeLog);
      }
    } catch (err) {
      console.error('Failed to fetch clock status:', err);
    }
  }, [orgId]);

  useEffect(() => { if (orgId) { fetchLogs(); fetchStatus(); } }, [orgId, fetchLogs, fetchStatus]);

  // ── Elapsed timer tick ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!clockedIn || !activeLog?.timeIn) { setElapsed(0); return; }
    const tick = () => setElapsed(Math.floor((Date.now() - new Date(activeLog.timeIn).getTime()) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [clockedIn, activeLog]);

  // ── Clock In ───────────────────────────────────────────────────────────────
  const handleClockIn = async () => {
    setClockLoading(true);
    try {
      const res = await fetch('/api/attendance/clock-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-org-id': orgId },
        body: JSON.stringify({ orgId }),
      });
      if (res.ok) { await fetchStatus(); await fetchLogs(); }
      else { const d = await res.json(); alert(d.error || 'Failed to clock in'); }
    } catch (err) { console.error(err); } finally { setClockLoading(false); }
  };

  // ── Clock Out ──────────────────────────────────────────────────────────────
  const handleClockOut = async () => {
    setClockLoading(true);
    try {
      const res = await fetch('/api/attendance/clock-out', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-org-id': orgId },
        body: JSON.stringify({ orgId }),
      });
      if (res.ok) { await fetchStatus(); await fetchLogs(); }
      else { const d = await res.json(); alert(d.error || 'Failed to clock out'); }
    } catch (err) { console.error(err); } finally { setClockLoading(false); }
  };

  // ── Derived stats ──────────────────────────────────────────────────────────
  const uniqueMembers = [...new Map(logs.map(l => [l.memberId, { id: l.memberId, name: l.memberName }])).values()];

  const filteredLogs = logs.filter(log => {
    const matchSearch =
      log.memberName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.notes || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.date.includes(searchTerm);
    const matchMember = filterMember === 'all' || log.memberId === filterMember;
    return matchSearch && matchMember;
  });

  const completedLogs = filteredLogs.filter(l => !l.isActive);
  const totalSeconds  = completedLogs.reduce((sum, l) => sum + (l.duration || 0), 0);
  const totalHours    = Math.round(totalSeconds / 3600 * 10) / 10;
  const avgHours      = completedLogs.length > 0 ? Math.round(totalSeconds / completedLogs.length / 3600 * 10) / 10 : 0;

  if (loading) {
    return (
      <div className="space-y-8">
        <div><h1 className="text-3xl font-bold gradient-text">Time Logs</h1><p className="text-muted-foreground mt-2">Loading attendance records...</p></div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (<Card key={i} className="glass p-6"><div className="animate-pulse"><div className="h-4 bg-muted rounded w-3/4 mb-2"></div><div className="h-8 bg-muted rounded w-1/2"></div></div></Card>))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold gradient-text">Time Logs</h1>
          <p className="text-muted-foreground mt-1">
            {isPrivileged ? `Team attendance records · ${userRole.charAt(0) + userRole.slice(1).toLowerCase()} view` : 'Your attendance records'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="glass-surface">
            <Download className="h-4 w-4 mr-2" />Export
          </Button>
        </div>
      </div>

      {/* Clock In/Out Card */}
      <Card className={cn('glass shadow-elevation border', clockedIn ? 'border-green-500/30' : 'border-border')}>
        <CardContent className="p-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              {/* Pulsing status dot */}
              <div className="relative">
                <div className={cn('h-14 w-14 rounded-2xl flex items-center justify-center', clockedIn ? 'bg-green-500/20' : 'bg-muted/30')}>
                  <Timer className={cn('h-7 w-7', clockedIn ? 'text-green-400' : 'text-muted-foreground')} />
                </div>
                {clockedIn && (
                  <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-green-400">
                    <span className="absolute inset-0 rounded-full bg-green-400 animate-ping opacity-75"></span>
                  </span>
                )}
              </div>
              <div>
                <p className="font-semibold text-lg">{clockedIn ? 'Currently Clocked In' : 'Not Clocked In'}</p>
                {clockedIn && activeLog ? (
                  <p className="text-muted-foreground text-sm">
                    Since {formatTime(activeLog.timeIn)} · <span className="text-green-400 font-mono font-semibold">{formatDuration(elapsed)}</span>
                  </p>
                ) : (
                  <p className="text-muted-foreground text-sm">Click to start your work session</p>
                )}
              </div>
            </div>

            <Button
              onClick={clockedIn ? handleClockOut : handleClockIn}
              disabled={clockLoading}
              className={cn(
                'px-8 py-3 text-base font-semibold rounded-xl shadow-lg transition-all',
                clockedIn
                  ? 'bg-red-500/80 hover:bg-red-500 text-white border border-red-400/30'
                  : 'bg-green-500/80 hover:bg-green-500 text-white border border-green-400/30'
              )}
            >
              {clockLoading ? (
                <span className="flex items-center gap-2"><Clock className="h-4 w-4 animate-spin" /> Loading...</span>
              ) : clockedIn ? (
                <span className="flex items-center gap-2"><LogOut className="h-5 w-5" /> Clock Out</span>
              ) : (
                <span className="flex items-center gap-2"><LogIn className="h-5 w-5" /> Clock In</span>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="glass shadow-elevation"><CardContent className="p-6"><div className="flex items-center"><div className="h-12 w-12 rounded-xl bg-gradient-primary flex items-center justify-center shadow-glow mr-4"><Clock className="h-6 w-6 text-white" /></div><div><p className="text-2xl font-bold">{totalHours}h</p><p className="text-sm text-muted-foreground">Total Hours</p></div></div></CardContent></Card>
        <Card className="glass shadow-elevation"><CardContent className="p-6"><div className="flex items-center"><div className="h-12 w-12 rounded-xl bg-gradient-success flex items-center justify-center shadow-glow mr-4"><TrendingUp className="h-6 w-6 text-white" /></div><div><p className="text-2xl font-bold">{avgHours}h</p><p className="text-sm text-muted-foreground">Avg Per Session</p></div></div></CardContent></Card>
        <Card className="glass shadow-elevation"><CardContent className="p-6"><div className="flex items-center"><div className="h-12 w-12 rounded-xl bg-gradient-info flex items-center justify-center shadow-glow mr-4"><BarChart3 className="h-6 w-6 text-white" /></div><div><p className="text-2xl font-bold">{completedLogs.length}</p><p className="text-sm text-muted-foreground">Sessions</p></div></div></CardContent></Card>
        <Card className="glass shadow-elevation"><CardContent className="p-6"><div className="flex items-center"><div className="h-12 w-12 rounded-xl bg-gradient-warning flex items-center justify-center shadow-glow mr-4"><Users className="h-6 w-6 text-white" /></div><div><p className="text-2xl font-bold">{new Set(filteredLogs.map(l => l.memberId)).size}</p><p className="text-sm text-muted-foreground">{isPrivileged ? 'Members' : 'This Month'}</p></div></div></CardContent></Card>
      </div>

      {/* Filters */}
      <Card className="glass shadow-elevation">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row gap-4 items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <input type="text" placeholder="Search by name, notes, or date..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 glass-surface border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary" />
            </div>
            {isPrivileged && (
              <select value={filterMember} onChange={e => setFilterMember(e.target.value)}
                className="px-4 py-2 glass-surface border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary">
                <option value="all">All Members</option>
                {uniqueMembers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="glass shadow-elevation">
        <CardHeader>
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">
              Attendance Records ({filteredLogs.length})
              {isPrivileged && <span className="ml-2 text-sm font-normal text-muted-foreground">— Team view</span>}
            </h2>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  {isPrivileged && <th className="text-left p-4 font-medium text-muted-foreground">Member</th>}
                  <th className="text-left p-4 font-medium text-muted-foreground">Date</th>
                  <th className="text-left p-4 font-medium text-muted-foreground">Clock In</th>
                  <th className="text-left p-4 font-medium text-muted-foreground">Clock Out</th>
                  <th className="text-left p-4 font-medium text-muted-foreground">Duration</th>
                  <th className="text-left p-4 font-medium text-muted-foreground">Notes</th>
                  <th className="text-left p-4 font-medium text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map(log => (
                  <tr key={log.id} className="border-b border-border hover:bg-surface-elevated/50 transition-colors">

                    {isPrivileged && (
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <MemberAvatar name={log.memberName} image={log.memberImage} />
                          <div>
                            <p className="text-sm font-medium leading-tight">{log.memberName}</p>
                            <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold capitalize" style={getRoleBadgeStyle(log.memberRole)}>
                              {log.memberRole.toLowerCase()}
                            </span>
                          </div>
                        </div>
                      </td>
                    )}

                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">{formatDate(log.timeIn)}</span>
                      </div>
                    </td>

                    <td className="p-4">
                      <span className="text-sm font-mono text-green-400">{formatTime(log.timeIn)}</span>
                    </td>

                    <td className="p-4">
                      {log.timeOut
                        ? <span className="text-sm font-mono text-red-400">{formatTime(log.timeOut)}</span>
                        : <span className="text-sm text-muted-foreground italic">Active</span>}
                    </td>

                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span className="font-semibold">
                          {log.isActive ? (
                            <span className="text-green-400 font-mono">{formatDuration(log.memberId === session?.user?.id ? elapsed : null) || '...'}</span>
                          ) : (
                            formatDuration(log.duration)
                          )}
                        </span>
                      </div>
                    </td>

                    <td className="p-4">
                      <span className="text-sm text-muted-foreground">{log.notes || '—'}</span>
                    </td>

                    <td className="p-4">
                      <Badge className={cn('text-xs', log.isActive
                        ? 'text-green-400 bg-green-400/10 border-green-400/20'
                        : 'text-muted-foreground bg-muted/10 border-border')}>
                        {log.isActive ? '● Active' : 'Completed'}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredLogs.length === 0 && (
            <div className="text-center py-16">
              <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No attendance records found</h3>
              <p className="text-muted-foreground mb-6">
                {searchTerm || filterMember !== 'all'
                  ? 'Try adjusting your filters'
                  : 'Clock in to start recording your attendance'}
              </p>
              {!clockedIn && (
                <Button onClick={handleClockIn} disabled={clockLoading}
                  className="bg-green-500/80 hover:bg-green-500 text-white">
                  <LogIn className="h-4 w-4 mr-2" />Clock In Now
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
