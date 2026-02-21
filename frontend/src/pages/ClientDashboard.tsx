import { useState, useEffect } from 'react';
import { useSession } from '../lib/auth-client';
import { useApiClient } from '../lib/api-client';
import {
  CheckCircle2,
  Clock,
  Calendar,
  TrendingUp,
  FileText,
  BarChart3,
  AlertCircle,
  Loader2
} from 'lucide-react';

const VS = {
  bg0: '#1e1e1e', bg1: '#252526', bg2: '#2d2d2d', bg3: '#333333',
  border: '#3c3c3c', text0: '#f0f0f0', text1: '#c0c0c0', text2: '#909090',
  blue: '#569cd6', teal: '#4ec9b0', yellow: '#dcdcaa', orange: '#ce9178',
  purple: '#c586c0', red: '#f44747', green: '#6a9955', accent: '#007acc',
};

interface TaskSummary {
  id: string;
  title: string;
  description?: string;
  status: 'not_started' | 'in_progress' | 'completed' | 'cancelled';
  priority: 'Urgent' | 'High' | 'Medium' | 'Low';
  estimatedHours?: number;
  actualHours?: number;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
  userId: string;
  orgId: string;
}

interface TimeEntry {
  id: string;
  taskId: string;
  taskTitle: string;
  begin: string;
  end?: string;
  duration: number;
  description?: string;
  category: string;
  isBillable: boolean;
}

interface DashboardStats {
  totalTasks: number;
  completedTasks: number;
  activeTasks: number;
  totalHours: number;
  thisWeekHours: number;
  completionRate: number;
}

const getPriorityStyle = (priority: string): { color: string; bg: string } => {
  switch (priority) {
    case 'Urgent':
    case 'High': return { color: VS.red, bg: `${VS.red}18` };
    case 'Medium': return { color: VS.yellow, bg: `${VS.yellow}18` };
    case 'Low': return { color: VS.blue, bg: `${VS.blue}18` };
    default: return { color: VS.text2, bg: VS.bg3 };
  }
};

const getStatusStyle = (status: string): { color: string } => {
  switch (status) {
    case 'completed': return { color: VS.teal };
    case 'in_progress': return { color: VS.blue };
    default: return { color: VS.text2 };
  }
};

export function ClientDashboard() {
  const { data: session } = useSession();
  const apiClient = useApiClient();
  const [tasks, setTasks] = useState<TaskSummary[]>([]);
  const [recentTimeEntries, setRecentTimeEntries] = useState<TimeEntry[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    totalTasks: 0,
    completedTasks: 0,
    activeTasks: 0,
    totalHours: 0,
    thisWeekHours: 0,
    completionRate: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session?.user?.id) return;

    const loadDashboardData = async () => {
      try {
        setLoading(true);
        setError(null);

        const tasksResponse = await apiClient.fetch(`/api/tasks/recent?userId=${session.user.id}&limit=50`);
        if (tasksResponse.success) {
          setTasks(tasksResponse.tasks || []);
        }

        const timeResponse = await apiClient.fetch(`/api/timers/recent?userId=${session.user.id}&limit=10`);
        if (timeResponse.entries) {
          setRecentTimeEntries(timeResponse.entries.map((entry: any) => ({
            id: entry.id,
            taskId: entry.taskId,
            taskTitle: entry.taskTitle || 'Untitled Task',
            begin: entry.startTime,
            end: entry.endTime,
            duration: entry.duration || 0,
            description: entry.description || '',
            category: entry.category || 'work',
            isBillable: false
          })));
        }

        if (tasksResponse.success && tasksResponse.tasks) {
          const allTasks = tasksResponse.tasks;
          const completed = allTasks.filter((t: TaskSummary) => t.status === 'completed').length;
          const active = allTasks.filter((t: TaskSummary) =>
            t.status === 'in_progress' || t.status === 'not_started'
          ).length;
          const totalHours = allTasks.reduce((sum: number, t: TaskSummary) => sum + (t.actualHours || 0), 0);

          const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
          const thisWeekEntries = timeResponse.entries?.filter((entry: any) =>
            new Date(entry.startTime) >= oneWeekAgo
          ) || [];
          const thisWeekHours = thisWeekEntries.reduce((sum: number, entry: any) =>
            sum + (entry.duration || 0), 0) / 3600;

          setStats({
            totalTasks: allTasks.length,
            completedTasks: completed,
            activeTasks: active,
            totalHours,
            thisWeekHours: Math.round(thisWeekHours * 10) / 10,
            completionRate: allTasks.length > 0 ? Math.round((completed / allTasks.length) * 100) : 0
          });
        }

      } catch (err: any) {
        console.error('Error loading dashboard data:', err);
        setError(err.message || 'Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    };

    loadDashboardData();
  }, [session?.user?.id, apiClient]);

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 256, color: VS.text1 }}>
        <Loader2 size={28} style={{ animation: 'spin 1s linear infinite', marginRight: 10 }} />
        <span>Loading dashboard...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 24 }}>
        <div style={{ background: VS.bg1, border: `1px solid ${VS.red}40`, borderRadius: 6, padding: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: VS.red }}>
            <AlertCircle size={16} />
            <span style={{ fontSize: 13 }}>{error}</span>
          </div>
        </div>
      </div>
    );
  }

  const statCards = [
    {
      label: 'Total Tasks',
      value: stats.totalTasks,
      sub: `${stats.completedTasks} completed`,
      icon: <CheckCircle2 size={16} color={VS.text2} />,
      accent: VS.teal,
    },
    {
      label: 'Completion Rate',
      value: `${stats.completionRate}%`,
      sub: null,
      icon: <TrendingUp size={16} color={VS.text2} />,
      accent: VS.accent,
      progress: stats.completionRate,
    },
    {
      label: 'Total Hours',
      value: `${stats.totalHours.toFixed(1)}h`,
      sub: 'All time',
      icon: <Clock size={16} color={VS.text2} />,
      accent: VS.yellow,
    },
    {
      label: 'This Week',
      value: `${stats.thisWeekHours}h`,
      sub: 'Last 7 days',
      icon: <Calendar size={16} color={VS.text2} />,
      accent: VS.purple,
    },
  ];

  return (
    <div style={{ color: VS.text0, fontFamily: 'inherit' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: VS.text0, margin: 0 }}>Client Dashboard</h1>
        <span style={{ fontSize: 12, background: `${VS.accent}15`, color: VS.accent, border: `1px solid ${VS.accent}40`, borderRadius: 4, padding: '3px 10px' }}>
          {stats.activeTasks} Active Tasks
        </span>
      </div>

      {/* Stats Overview */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        {statCards.map((card, i) => (
          <div key={i} style={{ background: VS.bg1, border: `1px solid ${VS.border}`, borderRadius: 6, padding: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ fontSize: 12, color: VS.text2, fontWeight: 600 }}>{card.label}</span>
              {card.icon}
            </div>
            <div style={{ fontSize: 26, fontWeight: 700, color: card.accent }}>{card.value}</div>
            {card.sub && <p style={{ fontSize: 11, color: VS.text2, marginTop: 4 }}>{card.sub}</p>}
            {card.progress !== undefined && (
              <div style={{ marginTop: 10, height: 4, background: VS.bg3, borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${card.progress}%`, background: VS.accent, borderRadius: 2, transition: 'width 0.3s' }} />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Tasks and Time Entries */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Recent Tasks */}
        <div style={{ background: VS.bg1, border: `1px solid ${VS.border}`, borderRadius: 6, padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <FileText size={16} color={VS.text2} />
            <h2 style={{ fontSize: 15, fontWeight: 600, color: VS.text0, margin: 0 }}>Recent Tasks</h2>
          </div>

          {tasks.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: VS.text2 }}>
              <FileText size={40} style={{ opacity: 0.4, marginBottom: 12, display: 'block', margin: '0 auto 12px' }} />
              <p style={{ margin: 0 }}>No tasks found</p>
              <p style={{ fontSize: 12, marginTop: 4 }}>Tasks will appear here once created</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {tasks.slice(0, 5).map((task) => {
                const ps = getPriorityStyle(task.priority);
                const ss = getStatusStyle(task.status);
                return (
                  <div key={task.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h4 style={{ fontSize: 13, fontWeight: 600, color: VS.text0, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {task.title}
                      </h4>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                        <span style={{ fontSize: 11, background: ps.bg, color: ps.color, padding: '2px 7px', borderRadius: 4 }}>
                          {task.priority}
                        </span>
                        <span style={{ fontSize: 11, color: ss.color }}>
                          {task.status.replace('_', ' ')}
                        </span>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 12 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: VS.text0 }}>
                        {task.actualHours || 0}h / {task.estimatedHours || 0}h
                      </div>
                      <div style={{ fontSize: 11, color: VS.text2, marginTop: 2 }}>
                        {formatDate(task.updatedAt)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent Time Entries */}
        <div style={{ background: VS.bg1, border: `1px solid ${VS.border}`, borderRadius: 6, padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <BarChart3 size={16} color={VS.text2} />
            <h2 style={{ fontSize: 15, fontWeight: 600, color: VS.text0, margin: 0 }}>Recent Time Entries</h2>
          </div>

          {recentTimeEntries.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: VS.text2 }}>
              <Clock size={40} style={{ opacity: 0.4, marginBottom: 12, display: 'block', margin: '0 auto 12px' }} />
              <p style={{ margin: 0 }}>No time entries found</p>
              <p style={{ fontSize: 12, marginTop: 4 }}>Time tracking data will appear here</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {recentTimeEntries.map((entry) => (
                <div key={entry.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h4 style={{ fontSize: 13, fontWeight: 600, color: VS.text0, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {entry.taskTitle}
                    </h4>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                      <span style={{ fontSize: 11, background: VS.bg3, color: VS.text2, border: `1px solid ${VS.border}`, padding: '2px 7px', borderRadius: 4 }}>
                        {entry.category}
                      </span>
                      <span style={{ fontSize: 11, color: VS.text2 }}>
                        {formatDate(entry.begin)}
                      </span>
                    </div>
                    {entry.description && (
                      <p style={{ fontSize: 11, color: VS.text2, marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {entry.description}
                      </p>
                    )}
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 12 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: VS.text0 }}>
                      {formatDuration(entry.duration)}
                    </div>
                    <div style={{ fontSize: 11, color: entry.end ? VS.text2 : VS.teal, marginTop: 2 }}>
                      {entry.end ? 'Completed' : 'Running'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
