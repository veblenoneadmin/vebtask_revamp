import { useState, useEffect } from 'react';
import { useSession } from '../lib/auth-client';
import {
  Clock,
  Calendar,
  Play,
  Filter,
  Download,
  Search,
  Target,
  Building2,
  TrendingUp,
  BarChart3,
} from 'lucide-react';

// ── VS Code Dark+ tokens ───────────────────────────────────────────────────────
const VS = {
  bg0:    '#1e1e1e',
  bg1:    '#252526',
  bg2:    '#2d2d2d',
  bg3:    '#333333',
  border: '#3c3c3c',
  text0:  '#f0f0f0',
  text1:  '#c0c0c0',
  text2:  '#909090',
  blue:   '#569cd6',
  teal:   '#4ec9b0',
  yellow: '#dcdcaa',
  orange: '#ce9178',
  purple: '#c586c0',
  red:    '#f44747',
  green:  '#6a9955',
  accent: '#007acc',
};

interface TimeLog {
  id: string;
  taskTitle: string;
  projectName: string;
  clientName: string;
  date: string;
  startTime: string;
  endTime: string;
  duration: number; // in minutes
  description: string;
  isBillable: boolean;
  tags: string[];
  status: 'logged' | 'approved';
}

// ── Stat card sub-component ────────────────────────────────────────────────────
function StatCard({
  label,
  value,
  color,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  color: string;
  icon: React.ElementType;
}) {
  return (
    <div
      className="rounded-xl p-5 flex items-center gap-4"
      style={{ background: VS.bg1, border: `1px solid ${VS.border}` }}
    >
      <div
        className="h-11 w-11 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: `${color}18`, border: `1px solid ${color}33` }}
      >
        <Icon className="h-5 w-5" style={{ color }} />
      </div>
      <div>
        <p className="text-2xl font-bold tabular-nums leading-none" style={{ color: VS.text0 }}>
          {value}
        </p>
        <p
          className="text-[11px] font-semibold uppercase tracking-widest mt-1"
          style={{ color: VS.text2 }}
        >
          {label}
        </p>
      </div>
    </div>
  );
}

// ── Status badge helper ────────────────────────────────────────────────────────
function statusStyles(status: string): React.CSSProperties {
  switch (status) {
    case 'approved':
      return {
        background: `${VS.teal}18`,
        color: VS.teal,
        border: `1px solid ${VS.teal}33`,
        borderRadius: 6,
        padding: '2px 8px',
        fontSize: 11,
        fontWeight: 600,
        textTransform: 'capitalize',
        display: 'inline-block',
      };
    case 'logged':
      return {
        background: `${VS.yellow}18`,
        color: VS.yellow,
        border: `1px solid ${VS.yellow}33`,
        borderRadius: 6,
        padding: '2px 8px',
        fontSize: 11,
        fontWeight: 600,
        textTransform: 'capitalize',
        display: 'inline-block',
      };
    default:
      return {
        background: `${VS.text2}18`,
        color: VS.text2,
        border: `1px solid ${VS.text2}33`,
        borderRadius: 6,
        padding: '2px 8px',
        fontSize: 11,
        fontWeight: 600,
        textTransform: 'capitalize',
        display: 'inline-block',
      };
  }
}

// ── Shared input/select style ──────────────────────────────────────────────────
const inputStyle: React.CSSProperties = {
  background: VS.bg2,
  border: `1px solid ${VS.border}`,
  borderRadius: 8,
  padding: '8px 12px',
  color: VS.text0,
  outline: 'none',
  fontSize: 13,
};

export function TimeLogs() {
  const { data: session } = useSession();
  const [timeLogs, setTimeLogs] = useState<TimeLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [orgId, setOrgId] = useState('default');
  const [selectedDateRange, setSelectedDateRange] = useState<'today' | 'week' | 'month' | 'custom'>('week');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterClient, setFilterClient] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch user's organization
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

    if (session?.user?.id) {
      fetchUserOrgInfo();
    }
  }, [session]);

  // Fetch time logs
  useEffect(() => {
    const fetchTimeLogs = async () => {
      if (!session?.user?.id || orgId === 'default') return;

      setLoading(true);
      try {
        const response = await fetch(`/api/timers/recent?userId=${session.user.id}&orgId=${orgId}&limit=50`);
        if (response.ok) {
          const data = await response.json();

          // Transform API data to match our TimeLog interface
          const transformedLogs: TimeLog[] = (data.entries || []).map((entry: any) => ({
            id: entry.id,
            taskTitle: entry.taskTitle || 'Untitled Task',
            projectName: entry.projectName || 'General',
            clientName: entry.clientName || 'Internal',
            date: entry.startTime ? new Date(entry.startTime).toISOString().split('T')[0] : '',
            startTime: entry.startTime
              ? new Date(entry.startTime).toLocaleTimeString('en-US', {
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: false,
                })
              : '',
            endTime: entry.endTime
              ? new Date(entry.endTime).toLocaleTimeString('en-US', {
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: false,
                })
              : '',
            duration: entry.duration ? Math.round(entry.duration / 60) : 0, // Convert seconds to minutes
            description: entry.description || 'No description',
            isBillable: true, // TODO: Add billable field to API
            tags: [entry.category].filter(Boolean),
            status: entry.status === 'running' ? 'logged' : 'logged', // TODO: Add proper status field
          }));

          setTimeLogs(transformedLogs);
        } else {
          console.error('Failed to fetch time logs');
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

  const filteredLogs = timeLogs.filter((log) => {
    const matchesSearch =
      log.taskTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.projectName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || log.status === filterStatus;
    const matchesClient = filterClient === 'all' || log.clientName === filterClient;

    return matchesSearch && matchesStatus && matchesClient;
  });

  const formatDuration = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  const timeStats = {
    totalHours:
      Math.round(
        (filteredLogs.reduce((sum, log) => sum + log.duration, 0) / 60) * 10
      ) / 10,
    billableHours:
      Math.round(
        (filteredLogs
          .filter((log) => log.isBillable)
          .reduce((sum, log) => sum + log.duration, 0) /
          60) *
          10
      ) / 10,
    totalEntries: filteredLogs.length,
    completedTasks: filteredLogs.filter((log) => log.status === 'approved').length,
  };

  const uniqueClients = [...new Set(timeLogs.map((log) => log.clientName))];

  // ── Loading skeleton ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-6">
        {/* Header skeleton */}
        <div className="flex items-center justify-between">
          <div className="animate-pulse space-y-2">
            <div className="h-7 rounded-lg w-48" style={{ background: VS.bg2 }} />
            <div className="h-4 rounded w-56" style={{ background: VS.bg2 }} />
          </div>
        </div>

        {/* Stat cards skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="rounded-xl p-5 animate-pulse"
              style={{ background: VS.bg1, border: `1px solid ${VS.border}` }}
            >
              <div className="flex items-center gap-4">
                <div className="h-11 w-11 rounded-xl" style={{ background: VS.bg2 }} />
                <div className="space-y-2">
                  <div className="h-6 rounded w-16" style={{ background: VS.bg2 }} />
                  <div className="h-3 rounded w-24" style={{ background: VS.bg2 }} />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Table skeleton */}
        <div
          className="rounded-xl p-5 animate-pulse space-y-4"
          style={{ background: VS.bg1, border: `1px solid ${VS.border}` }}
        >
          {[...Array(5)].map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="h-4 rounded w-full" style={{ background: VS.bg2 }} />
              <div className="h-3 rounded w-2/3" style={{ background: VS.bg2 }} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Main render ──────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* ── Page header ── */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: VS.text0 }}>
            Time Logs
          </h1>
          <p className="text-[13px] mt-1" style={{ color: VS.text2 }}>
            Track and manage your time entries
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: VS.bg2,
              border: `1px solid ${VS.border}`,
              borderRadius: 8,
              padding: '8px 14px',
              color: VS.text1,
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            <Download className="h-4 w-4" />
            Export
          </button>
          <button
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: `${VS.accent}cc`,
              border: `1px solid ${VS.accent}`,
              borderRadius: 8,
              padding: '8px 14px',
              color: VS.text0,
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <Play className="h-4 w-4" />
            Start Timer
          </button>
        </div>
      </div>

      {/* ── Stats Cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard
          label="Total Hours"
          value={`${timeStats.totalHours}h`}
          color={VS.accent}
          icon={Clock}
        />
        <StatCard
          label="Billable Hours"
          value={`${timeStats.billableHours}h`}
          color={VS.teal}
          icon={TrendingUp}
        />
        <StatCard
          label="Total Entries"
          value={timeStats.totalEntries}
          color={VS.blue}
          icon={BarChart3}
        />
        <StatCard
          label="Completed Tasks"
          value={timeStats.completedTasks}
          color={VS.yellow}
          icon={Target}
        />
      </div>

      {/* ── Filters ── */}
      <div
        className="rounded-xl p-5"
        style={{ background: VS.bg1, border: `1px solid ${VS.border}` }}
      >
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center">

          {/* Search */}
          <div className="relative flex-1">
            <Search
              className="absolute h-4 w-4 pointer-events-none"
              style={{ left: 10, top: '50%', transform: 'translateY(-50%)', color: VS.text2 }}
            />
            <input
              type="text"
              placeholder="Search time logs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                ...inputStyle,
                width: '100%',
                paddingLeft: 32,
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Date Range */}
          <select
            value={selectedDateRange}
            onChange={(e) => setSelectedDateRange(e.target.value as any)}
            style={inputStyle}
          >
            <option value="today">Today</option>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
            <option value="custom">Custom Range</option>
          </select>

          {/* Status Filter */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            style={inputStyle}
          >
            <option value="all">All Status</option>
            <option value="logged">Logged</option>
            <option value="approved">Approved</option>
          </select>

          {/* Client Filter */}
          <select
            value={filterClient}
            onChange={(e) => setFilterClient(e.target.value)}
            style={inputStyle}
          >
            <option value="all">All Clients</option>
            {uniqueClients.map((client) => (
              <option key={client} value={client}>
                {client}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Time Entries Table ── */}
      <div
        className="rounded-xl overflow-hidden"
        style={{ background: VS.bg1, border: `1px solid ${VS.border}` }}
      >
        {/* Table header row */}
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: `1px solid ${VS.border}` }}
        >
          <h2 className="text-[13px] font-bold" style={{ color: VS.text0 }}>
            Time Entries{' '}
            <span style={{ color: VS.text2, fontWeight: 400 }}>({filteredLogs.length})</span>
          </h2>
          <button
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: VS.bg2,
              border: `1px solid ${VS.border}`,
              borderRadius: 6,
              padding: '5px 10px',
              color: VS.text1,
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            <Filter className="h-3.5 w-3.5" />
            More Filters
          </button>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${VS.border}` }}>
                {['Date', 'Task', 'Project', 'Client', 'Duration', 'Status'].map((heading) => (
                  <th
                    key={heading}
                    style={{
                      textAlign: 'left',
                      padding: '10px 16px',
                      fontSize: 11,
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.08em',
                      color: VS.text2,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredLogs.map((log, idx) => (
                <tr
                  key={log.id}
                  style={{
                    borderBottom:
                      idx < filteredLogs.length - 1 ? `1px solid ${VS.border}` : 'none',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={(e) =>
                    ((e.currentTarget as HTMLTableRowElement).style.background = VS.bg2)
                  }
                  onMouseLeave={(e) =>
                    ((e.currentTarget as HTMLTableRowElement).style.background = 'transparent')
                  }
                >
                  {/* Date */}
                  <td style={{ padding: '12px 16px', verticalAlign: 'middle' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Calendar className="h-4 w-4 shrink-0" style={{ color: VS.text2 }} />
                      <div>
                        <p style={{ fontSize: 13, fontWeight: 500, color: VS.text0, margin: 0 }}>
                          {new Date(log.date).toLocaleDateString()}
                        </p>
                        <p style={{ fontSize: 11, color: VS.text2, margin: 0 }}>
                          {log.startTime} – {log.endTime}
                        </p>
                      </div>
                    </div>
                  </td>

                  {/* Task */}
                  <td style={{ padding: '12px 16px', verticalAlign: 'middle', maxWidth: 240 }}>
                    <p
                      style={{
                        fontSize: 13,
                        fontWeight: 500,
                        color: VS.text0,
                        margin: 0,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {log.taskTitle}
                    </p>
                    <p
                      style={{
                        fontSize: 11,
                        color: VS.text2,
                        margin: 0,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {log.description}
                    </p>
                  </td>

                  {/* Project */}
                  <td style={{ padding: '12px 16px', verticalAlign: 'middle' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Target className="h-4 w-4 shrink-0" style={{ color: VS.text2 }} />
                      <span style={{ fontSize: 13, color: VS.text1 }}>{log.projectName}</span>
                    </div>
                  </td>

                  {/* Client */}
                  <td style={{ padding: '12px 16px', verticalAlign: 'middle' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Building2 className="h-4 w-4 shrink-0" style={{ color: VS.text2 }} />
                      <span style={{ fontSize: 13, color: VS.text1 }}>{log.clientName}</span>
                    </div>
                  </td>

                  {/* Duration */}
                  <td style={{ padding: '12px 16px', verticalAlign: 'middle' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Clock className="h-4 w-4 shrink-0" style={{ color: VS.text2 }} />
                      <span style={{ fontSize: 13, fontWeight: 600, color: VS.text0 }}>
                        {formatDuration(log.duration)}
                      </span>
                    </div>
                  </td>

                  {/* Status */}
                  <td style={{ padding: '12px 16px', verticalAlign: 'middle' }}>
                    <span style={statusStyles(log.status)}>{log.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Empty state */}
        {filteredLogs.length === 0 && (
          <div
            style={{
              textAlign: 'center',
              padding: '56px 24px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <Clock className="h-12 w-12" style={{ color: VS.text2 }} />
            <h3 style={{ fontSize: 16, fontWeight: 600, color: VS.text0, margin: 0 }}>
              No time logs found
            </h3>
            <p style={{ fontSize: 13, color: VS.text2, margin: 0 }}>
              {searchTerm || filterStatus !== 'all' || filterClient !== 'all'
                ? 'Try adjusting your filters or search term'
                : 'Start tracking your time to see logs here'}
            </p>
            <button
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                background: `${VS.accent}cc`,
                border: `1px solid ${VS.accent}`,
                borderRadius: 8,
                padding: '8px 16px',
                color: VS.text0,
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                marginTop: 4,
              }}
            >
              <Play className="h-4 w-4" />
              Start Timer
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
