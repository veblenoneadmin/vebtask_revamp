import { useState, useEffect } from 'react';
import { useSession } from '../lib/auth-client';
import { Card, CardContent, CardHeader } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import {
  Clock, Calendar, Play, Filter, Download, Search,
  Target, Building2, TrendingUp, BarChart3, Users
} from 'lucide-react';
import { cn } from '../lib/utils';

interface TimeLog {
  id: string;
  taskTitle: string;
  projectName: string;
  clientName: string;
  date: string;
  startTime: string;
  endTime: string;
  duration: number;
  description: string;
  isBillable: boolean;
  tags: string[];
  status: 'logged' | 'approved';
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

export function TimeLogs() {
  const { data: session } = useSession();
  const [timeLogs, setTimeLogs] = useState<TimeLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [orgId, setOrgId] = useState('default');
  const [isPrivileged, setIsPrivileged] = useState(false);
  const [userRole, setUserRole] = useState<string>('STAFF');
  const [selectedDateRange, setSelectedDateRange] = useState<'today' | 'week' | 'month' | 'custom'>('week');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterMember, setFilterMember] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const fetchUserOrgInfo = async () => {
      if (!session?.user?.id) return;
      try {
        const response = await fetch(`/api/organizations?userId=${session.user.id}`);
        if (response.ok) {
          const data = await response.json();
          if (data.organizations && data.organizations.length > 0) {
            setOrgId(data.organizations[0].id);
          }
        }
      } catch (error) {
        console.error('Failed to fetch user organization:', error);
      }
    };
    if (session?.user?.id) fetchUserOrgInfo();
  }, [session]);

  useEffect(() => {
    const fetchTimeLogs = async () => {
      if (!session?.user?.id || orgId === 'default') return;
      setLoading(true);
      try {
        const response = await fetch(`/api/timers/recent?userId=${session.user.id}&orgId=${orgId}&limit=100`);
        if (response.ok) {
          const data = await response.json();
          setIsPrivileged(data.isPrivileged ?? false);
          setUserRole(data.role ?? 'STAFF');
          const transformedLogs: TimeLog[] = (data.entries || []).map((entry: any) => ({
            id: entry.id,
            taskTitle: entry.taskTitle || 'Untitled Task',
            projectName: entry.projectName || 'General',
            clientName: entry.clientName || 'Internal',
            date: entry.startTime ? new Date(entry.startTime).toISOString().split('T')[0] : '',
            startTime: entry.startTime ? new Date(entry.startTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }) : '',
            endTime: entry.endTime ? new Date(entry.endTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }) : 'Active',
            duration: entry.duration ? Math.round(entry.duration / 60) : 0,
            description: entry.description || 'No description',
            isBillable: entry.isBillable ?? false,
            tags: [entry.category].filter(Boolean),
            status: 'logged',
            memberId: entry.memberId || session.user.id,
            memberName: entry.memberName || session.user.name || session.user.email || 'You',
            memberEmail: entry.memberEmail || session.user.email || '',
            memberImage: entry.memberImage || null,
            memberRole: entry.memberRole || 'STAFF',
          }));
          setTimeLogs(transformedLogs);
        } else {
          setTimeLogs([]);
        }
      } catch (error) {
        console.error('Error fetching time logs:', error);
        setTimeLogs([]);
      } finally {
        setLoading(false);
      }
    };
    fetchTimeLogs();
  }, [session, orgId]);

  const uniqueMembers = [...new Map(timeLogs.map(l => [l.memberId, { id: l.memberId, name: l.memberName }])).values()];

  const filteredLogs = timeLogs.filter(log => {
    const matchesSearch =
      log.taskTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.projectName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.memberName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || log.status === filterStatus;
    const matchesMember = filterMember === 'all' || log.memberId === filterMember;
    return matchesSearch && matchesStatus && matchesMember;
  });

  const formatDuration = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  const getRoleBadgeStyle = (role: string) => {
    switch (role) {
      case 'OWNER': return { background: 'rgba(220,220,170,0.15)', color: '#dcdcaa', border: '1px solid rgba(220,220,170,0.3)' };
      case 'ADMIN': return { background: 'rgba(197,134,192,0.15)', color: '#c586c0', border: '1px solid rgba(197,134,192,0.3)' };
      case 'STAFF': return { background: 'rgba(78,201,176,0.15)', color: '#4ec9b0',  border: '1px solid rgba(78,201,176,0.3)'  };
      default:      return { background: 'rgba(144,144,144,0.15)', color: '#909090',  border: '1px solid rgba(144,144,144,0.3)'  };
    }
  };

  const timeStats = {
    totalHours:    Math.round(filteredLogs.reduce((sum, l) => sum + l.duration, 0) / 60 * 10) / 10,
    billableHours: Math.round(filteredLogs.filter(l => l.isBillable).reduce((sum, l) => sum + l.duration, 0) / 60 * 10) / 10,
    totalEntries:  filteredLogs.length,
    activeMembers: new Set(filteredLogs.map(l => l.memberId)).size,
  };

  if (loading) {
    return (
      <div className="space-y-8">
        <div><h1 className="text-3xl font-bold gradient-text">Time Logs</h1><p className="text-muted-foreground mt-2">Loading time logs...</p></div>
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
            {isPrivileged
              ? `Viewing all team time entries · ${userRole.charAt(0) + userRole.slice(1).toLowerCase()} view`
              : 'Viewing your personal time entries'}
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" className="glass-surface"><Download className="h-4 w-4 mr-2" />Export</Button>
          <Button className="bg-gradient-primary hover:bg-gradient-primary/90 text-white shadow-glow"><Play className="h-4 w-4 mr-2" />Start Timer</Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="glass shadow-elevation"><CardContent className="p-6"><div className="flex items-center"><div className="h-12 w-12 rounded-xl bg-gradient-primary flex items-center justify-center shadow-glow mr-4"><Clock className="h-6 w-6 text-white" /></div><div><p className="text-2xl font-bold">{timeStats.totalHours}h</p><p className="text-sm text-muted-foreground">Total Hours</p></div></div></CardContent></Card>
        <Card className="glass shadow-elevation"><CardContent className="p-6"><div className="flex items-center"><div className="h-12 w-12 rounded-xl bg-gradient-success flex items-center justify-center shadow-glow mr-4"><TrendingUp className="h-6 w-6 text-white" /></div><div><p className="text-2xl font-bold">{timeStats.billableHours}h</p><p className="text-sm text-muted-foreground">Billable Hours</p></div></div></CardContent></Card>
        <Card className="glass shadow-elevation"><CardContent className="p-6"><div className="flex items-center"><div className="h-12 w-12 rounded-xl bg-gradient-info flex items-center justify-center shadow-glow mr-4"><BarChart3 className="h-6 w-6 text-white" /></div><div><p className="text-2xl font-bold">{timeStats.totalEntries}</p><p className="text-sm text-muted-foreground">Total Entries</p></div></div></CardContent></Card>
        <Card className="glass shadow-elevation"><CardContent className="p-6"><div className="flex items-center"><div className="h-12 w-12 rounded-xl bg-gradient-warning flex items-center justify-center shadow-glow mr-4">{isPrivileged ? <Users className="h-6 w-6 text-white" /> : <Target className="h-6 w-6 text-white" />}</div><div><p className="text-2xl font-bold">{isPrivileged ? timeStats.activeMembers : timeStats.totalEntries}</p><p className="text-sm text-muted-foreground">{isPrivileged ? 'Active Members' : 'My Entries'}</p></div></div></CardContent></Card>
      </div>

      {/* Filters */}
      <Card className="glass shadow-elevation">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row gap-4 items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <input type="text" placeholder={isPrivileged ? 'Search by task, project, or member...' : 'Search time logs...'} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 glass-surface border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary" />
            </div>
            <select value={selectedDateRange} onChange={(e) => setSelectedDateRange(e.target.value as any)} className="px-4 py-2 glass-surface border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary">
              <option value="today">Today</option><option value="week">This Week</option><option value="month">This Month</option><option value="custom">Custom Range</option>
            </select>
            {isPrivileged && (
              <select value={filterMember} onChange={(e) => setFilterMember(e.target.value)} className="px-4 py-2 glass-surface border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary">
                <option value="all">All Members</option>
                {uniqueMembers.map(m => (<option key={m.id} value={m.id}>{m.name}</option>))}
              </select>
            )}
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="px-4 py-2 glass-surface border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary">
              <option value="all">All Status</option><option value="logged">Logged</option><option value="approved">Approved</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="glass shadow-elevation">
        <CardHeader>
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">
              Time Entries ({filteredLogs.length})
              {isPrivileged && <span className="ml-2 text-sm font-normal text-muted-foreground">— Team view</span>}
            </h2>
            <Button size="sm" variant="outline" className="glass-surface"><Filter className="h-4 w-4 mr-2" />More Filters</Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  {isPrivileged && <th className="text-left p-4 font-medium text-muted-foreground">Member</th>}
                  <th className="text-left p-4 font-medium text-muted-foreground">Date</th>
                  <th className="text-left p-4 font-medium text-muted-foreground">Task</th>
                  <th className="text-left p-4 font-medium text-muted-foreground">Project</th>
                  <th className="text-left p-4 font-medium text-muted-foreground">Client</th>
                  <th className="text-left p-4 font-medium text-muted-foreground">Duration</th>
                  <th className="text-left p-4 font-medium text-muted-foreground">Billable</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((log) => (
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
                      <div className="flex items-center space-x-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium">{log.date ? new Date(log.date).toLocaleDateString() : '—'}</p>
                          <p className="text-xs text-muted-foreground">{log.startTime} – {log.endTime}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <div>
                        <p className="font-medium">{log.taskTitle}</p>
                        <p className="text-sm text-muted-foreground line-clamp-1">{log.description}</p>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center space-x-2"><Target className="h-4 w-4 text-muted-foreground" /><span className="text-sm">{log.projectName}</span></div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center space-x-2"><Building2 className="h-4 w-4 text-muted-foreground" /><span className="text-sm">{log.clientName}</span></div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center space-x-2"><Clock className="h-4 w-4 text-muted-foreground" /><span className="font-medium">{formatDuration(log.duration)}</span></div>
                    </td>
                    <td className="p-4">
                      <Badge className={cn('text-xs', log.isBillable ? 'text-teal-400 bg-teal-400/10 border-teal-400/20' : 'text-muted-foreground bg-muted/10 border-border')}>
                        {log.isBillable ? 'Billable' : 'Non-billable'}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredLogs.length === 0 && (
            <div className="text-center py-12">
              <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No time logs found</h3>
              <p className="text-muted-foreground mb-4">
                {searchTerm || filterStatus !== 'all' || filterMember !== 'all'
                  ? 'Try adjusting your filters or search term'
                  : 'Start tracking time to see logs here'}
              </p>
              <Button><Play className="h-4 w-4 mr-2" />Start Timer</Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
