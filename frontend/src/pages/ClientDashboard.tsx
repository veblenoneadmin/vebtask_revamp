import { useState, useEffect } from 'react';
import { useSession } from '../lib/auth-client';
import { useApiClient } from '../lib/api-client';
import {
  CheckCircle2, Clock, Folder, AlertCircle, ChevronDown, ChevronRight,
  Loader2, ListTodo, Calendar,
} from 'lucide-react';

const VS = {
  bg0: '#1e1e1e', bg1: '#252526', bg2: '#2d2d2d', bg3: '#333333',
  border: '#3c3c3c', text0: '#f0f0f0', text1: '#c0c0c0', text2: '#909090',
  blue: '#569cd6', teal: '#4ec9b0', yellow: '#dcdcaa', orange: '#ce9178',
  purple: '#c586c0', red: '#f44747', green: '#6a9955', accent: '#007acc',
};

interface Task {
  id: string;
  title: string;
  status: string;
  priority: string;
  estimatedHours: number;
  actualHours: number;
  dueDate?: string;
  createdAt: string;
  updatedAt: string;
}

interface Project {
  id: string;
  name: string;
  color: string;
  status: string;
  tasks: Task[];
}

interface ClientInfo {
  id: string;
  name: string;
  email?: string;
  company?: string;
}

const statusColor: Record<string, string> = {
  completed:   VS.teal,
  in_progress: VS.blue,
  not_started: VS.text2,
  cancelled:   VS.red,
};

const priorityColor: Record<string, string> = {
  Urgent: VS.red, High: VS.orange, Medium: VS.yellow, Low: VS.blue,
};

function fmt(s: string) { return s.replace(/_/g, ' '); }

function dueDateColor(dueDate?: string) {
  if (!dueDate) return VS.text2;
  const d = new Date(dueDate);
  const now = new Date();
  if (d < now) return VS.red;
  const diff = (d.getTime() - now.getTime()) / 86400000;
  if (diff <= 3) return VS.orange;
  return VS.text2;
}

export function ClientDashboard() {
  const { data: session } = useSession();
  const apiClient = useApiClient();
  const [client, setClient]   = useState<ClientInfo | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!session?.user?.id) return;
    (async () => {
      try {
        setLoading(true);
        const data = await apiClient.fetch('/api/clients/my');
        if (data.success) {
          setClient(data.client);
          setProjects(data.projects ?? []);
          // Expand all projects by default
          const exp: Record<string, boolean> = {};
          (data.projects ?? []).forEach((p: Project) => { exp[p.id] = true; });
          setExpanded(exp);
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load data');
      } finally {
        setLoading(false);
      }
    })();
  }, [session?.user?.id]);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 240, color: VS.text1 }}>
        <Loader2 size={24} style={{ marginRight: 10, animation: 'spin 1s linear infinite' }} />
        Loading your projects…
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 24, background: VS.bg1, border: `1px solid ${VS.red}40`, borderRadius: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: VS.red }}>
          <AlertCircle size={16} /> {error}
        </div>
      </div>
    );
  }

  if (!client) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 0', color: VS.text2 }}>
        <Folder size={48} style={{ margin: '0 auto 16px', opacity: 0.4 }} />
        <p style={{ fontSize: 16, fontWeight: 600, color: VS.text1 }}>No client profile found</p>
        <p style={{ fontSize: 13, marginTop: 6 }}>Contact your account manager to get access.</p>
      </div>
    );
  }

  // Aggregate stats
  const allTasks    = projects.flatMap(p => p.tasks);
  const total       = allTasks.length;
  const completed   = allTasks.filter(t => t.status === 'completed').length;
  const inProgress  = allTasks.filter(t => t.status === 'in_progress').length;
  const totalHours  = allTasks.reduce((s, t) => s + (Number(t.actualHours) || 0), 0);
  const completion  = total > 0 ? Math.round((completed / total) * 100) : 0;

  const stats = [
    { label: 'Total Tasks',      value: total,             icon: ListTodo,     color: VS.blue   },
    { label: 'Completed',        value: completed,         icon: CheckCircle2, color: VS.teal   },
    { label: 'In Progress',      value: inProgress,        icon: Clock,        color: VS.yellow },
    { label: 'Completion Rate',  value: `${completion}%`,  icon: Calendar,     color: VS.accent },
  ];

  return (
    <div style={{ color: VS.text0 }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>
          Welcome, {client.name}
        </h1>
        {client.company && (
          <p style={{ fontSize: 13, color: VS.text2, marginTop: 4 }}>{client.company}</p>
        )}
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 28 }}>
        {stats.map(({ label, value, icon: Icon, color }) => (
          <div key={label} style={{ background: VS.bg1, border: `1px solid ${VS.border}`, borderRadius: 8, padding: 18,
            display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 38, height: 38, borderRadius: 8, background: `${color}18`,
              border: `1px solid ${color}33`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon size={18} color={color} />
            </div>
            <div>
              <div style={{ fontSize: 22, fontWeight: 700, color }}>{value}</div>
              <div style={{ fontSize: 11, color: VS.text2, marginTop: 2 }}>{label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Projects + Tasks */}
      {projects.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 0', background: VS.bg1,
          border: `1px solid ${VS.border}`, borderRadius: 10, color: VS.text2 }}>
          <Folder size={40} style={{ margin: '0 auto 14px', opacity: 0.4 }} />
          <p style={{ fontSize: 14, fontWeight: 600, color: VS.text1 }}>No projects yet</p>
          <p style={{ fontSize: 12, marginTop: 4 }}>Projects assigned to you will appear here.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {projects.map(project => {
            const open = expanded[project.id] ?? true;
            const ptasks = project.tasks;
            const pdone  = ptasks.filter(t => t.status === 'completed').length;
            return (
              <div key={project.id} style={{ background: VS.bg1, border: `1px solid ${VS.border}`, borderRadius: 10, overflow: 'hidden' }}>
                {/* Project header */}
                <button
                  onClick={() => setExpanded(e => ({ ...e, [project.id]: !e[project.id] }))}
                  style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px',
                    borderBottom: open ? `1px solid ${VS.border}` : 'none' }}
                >
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: project.color || VS.accent, flexShrink: 0 }} />
                  <span style={{ fontSize: 14, fontWeight: 600, color: VS.text0, flex: 1, textAlign: 'left' }}>{project.name}</span>
                  <span style={{ fontSize: 12, color: VS.text2 }}>{pdone}/{ptasks.length} tasks</span>
                  {/* Progress bar */}
                  <div style={{ width: 80, height: 4, background: VS.bg3, borderRadius: 2, overflow: 'hidden', marginLeft: 8 }}>
                    <div style={{ height: '100%', width: `${ptasks.length > 0 ? (pdone / ptasks.length) * 100 : 0}%`,
                      background: VS.teal, borderRadius: 2, transition: 'width 0.3s' }} />
                  </div>
                  {open ? <ChevronDown size={14} color={VS.text2} /> : <ChevronRight size={14} color={VS.text2} />}
                </button>

                {/* Task list */}
                {open && (
                  <div>
                    {ptasks.length === 0 ? (
                      <div style={{ padding: '20px 18px', fontSize: 13, color: VS.text2 }}>No tasks in this project yet.</div>
                    ) : ptasks.map((task, i) => (
                      <div
                        key={task.id}
                        style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 18px',
                          borderTop: i > 0 ? `1px solid ${VS.border}` : undefined,
                          background: 'transparent' }}
                      >
                        {/* Status dot */}
                        <div style={{ width: 8, height: 8, borderRadius: '50%',
                          background: statusColor[task.status] || VS.text2, flexShrink: 0 }} />

                        {/* Title */}
                        <span style={{ flex: 1, fontSize: 13, color: VS.text0,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          textDecoration: task.status === 'cancelled' ? 'line-through' : undefined }}>
                          {task.title}
                        </span>

                        {/* Priority badge */}
                        <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 4,
                          background: `${priorityColor[task.priority] || VS.text2}18`,
                          color: priorityColor[task.priority] || VS.text2, flexShrink: 0 }}>
                          {task.priority}
                        </span>

                        {/* Status */}
                        <span style={{ fontSize: 11, color: statusColor[task.status] || VS.text2, flexShrink: 0, minWidth: 72 }}>
                          {fmt(task.status)}
                        </span>

                        {/* Hours */}
                        <span style={{ fontSize: 11, color: VS.text2, flexShrink: 0, minWidth: 60, textAlign: 'right' }}>
                          {Number(task.actualHours) || 0}h / {Number(task.estimatedHours) || 0}h
                        </span>

                        {/* Due date */}
                        {task.dueDate && (
                          <span style={{ fontSize: 11, color: dueDateColor(task.dueDate), flexShrink: 0 }}>
                            {new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Total hours summary */}
      {totalHours > 0 && (
        <div style={{ marginTop: 20, padding: '12px 18px', background: VS.bg1,
          border: `1px solid ${VS.border}`, borderRadius: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
          <Clock size={14} color={VS.yellow} />
          <span style={{ fontSize: 13, color: VS.text2 }}>
            Total hours logged: <strong style={{ color: VS.text0 }}>{totalHours.toFixed(1)}h</strong>
          </span>
        </div>
      )}
    </div>
  );
}
