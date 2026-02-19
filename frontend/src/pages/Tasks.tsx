import { useState, useEffect, useRef } from 'react';
import { useSession } from '../lib/auth-client';
import { useApiClient } from '../lib/api-client';
import { useOrganization } from '../contexts/OrganizationContext';
import { Button } from '../components/ui/button';
import {
  Plus,
  X,
  Calendar,
  Clock,
  MoreHorizontal,
  Edit2,
  Trash2,
  Search,
} from 'lucide-react';

interface Task {
  id: string;
  title: string;
  description: string;
  priority: 'Urgent' | 'High' | 'Medium' | 'Low';
  status: 'not_started' | 'in_progress' | 'completed' | 'on_hold';
  estimatedHours: number;
  actualHours: number;
  dueDate?: string;
  assignee?: string;
  project?: string;
  projectId?: string;
  isBillable: boolean;
  hourlyRate?: number;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

interface Project {
  id: string;
  name: string;
  description?: string;
  status: string;
  color: string;
}

const COLUMNS: { id: Task['status']; label: string; accent: string; dimAccent: string }[] = [
  { id: 'not_started', label: 'To Do',        accent: '#6366f1', dimAccent: 'rgba(99,102,241,0.12)' },
  { id: 'in_progress', label: 'In Progress',  accent: '#f59e0b', dimAccent: 'rgba(245,158,11,0.12)' },
  { id: 'on_hold',     label: 'On Hold',      accent: '#ef4444', dimAccent: 'rgba(239,68,68,0.12)' },
  { id: 'completed',   label: 'Done',         accent: '#10b981', dimAccent: 'rgba(16,185,129,0.12)' },
];

const PRIORITY_CONFIG: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  Low:    { label: 'LOW',      bg: 'rgba(16,185,129,0.15)',  text: '#34d399', dot: '#10b981' },
  Medium: { label: 'MODERATE', bg: 'rgba(245,158,11,0.15)',  text: '#fbbf24', dot: '#f59e0b' },
  High:   { label: 'HIGH',     bg: 'rgba(239,68,68,0.15)',   text: '#f87171', dot: '#ef4444' },
  Urgent: { label: 'URGENT',   bg: 'rgba(139,92,246,0.15)',  text: '#c084fc', dot: '#8b5cf6' },
};

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  not_started: { label: 'Pending',     bg: 'rgba(99,102,241,0.12)',  text: '#818cf8' },
  in_progress: { label: 'In Progress', bg: 'rgba(245,158,11,0.12)',  text: '#fbbf24' },
  on_hold:     { label: 'On Hold',     bg: 'rgba(239,68,68,0.12)',   text: '#f87171' },
  completed:   { label: 'Done',        bg: 'rgba(16,185,129,0.12)',  text: '#34d399' },
};

function getInitials(name?: string) {
  if (!name) return '?';
  return name.split(/[\s@.]+/).filter(Boolean).map(s => s[0]?.toUpperCase()).slice(0, 2).join('');
}

function formatDate(dateStr?: string) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function Tasks() {
  const { data: session } = useSession();
  const { currentOrg } = useOrganization();
  const apiClient = useApiClient();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string>('CLIENT');
  const [searchTerm, setSearchTerm] = useState('');

  // New task form
  const [showNewTaskForm, setShowNewTaskForm] = useState(false);
  const [newTaskColumnStatus, setNewTaskColumnStatus] = useState<Task['status']>('not_started');
  const [newTaskForm, setNewTaskForm] = useState({
    title: '',
    description: '',
    priority: 'Medium' as Task['priority'],
    projectId: '',
    estimatedHours: 0,
    dueDate: '',
    tags: ''
  });
  const [taskFormLoading, setTaskFormLoading] = useState(false);

  // Edit task
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [editTaskForm, setEditTaskForm] = useState({
    title: '',
    description: '',
    priority: 'Medium' as Task['priority'],
    projectId: '',
    estimatedHours: 0,
    dueDate: '',
    tags: ''
  });

  // Drag and drop
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);
  const dragCounter = useRef<Record<string, number>>({});

  // Card menu
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  // ── fetch user role ──────────────────────────────────────────────
  useEffect(() => {
    const go = async () => {
      if (!session?.user?.id) return;
      try {
        const res = await fetch('/api/organizations');
        if (res.ok) {
          const d = await res.json();
          if (d.organizations?.length > 0) setUserRole(d.organizations[0].role || 'CLIENT');
        }
      } catch { /* ignore */ }
    };
    if (session) go();
  }, [session]);

  // ── fetch tasks ──────────────────────────────────────────────────
  const fetchTasks = async () => {
    if (!session?.user?.id || !currentOrg?.id) return;
    try {
      setLoading(true);
      const data = await apiClient.fetch('/api/tasks', { method: 'GET' });
      if (data.success) {
        setTasks((data.tasks || []).map((t: any) => ({ ...t, tags: t.tags || [] })));
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchTasks(); }, [session?.user?.id, currentOrg?.id]);

  // ── fetch projects (for forms) ────────────────────────────────────
  const fetchProjects = async () => {
    if (!session?.user?.id || !currentOrg?.id) return;
    try {
      const data = await apiClient.fetch('/api/projects?limit=100');
      if (data.success) setProjects(data.projects || []);
    } catch { /* ignore */ }
  };

  useEffect(() => {
    if (showNewTaskForm || editingTask) fetchProjects();
  }, [showNewTaskForm, editingTask]);

  // ── drag & drop ──────────────────────────────────────────────────
  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    setDraggingId(taskId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', taskId);
  };

  const handleDragEnd = () => {
    setDraggingId(null);
    setDragOverCol(null);
    dragCounter.current = {};
  };

  const handleColumnDragEnter = (e: React.DragEvent, colId: string) => {
    e.preventDefault();
    dragCounter.current[colId] = (dragCounter.current[colId] || 0) + 1;
    setDragOverCol(colId);
  };

  const handleColumnDragLeave = (_e: React.DragEvent, colId: string) => {
    dragCounter.current[colId] = (dragCounter.current[colId] || 1) - 1;
    if (dragCounter.current[colId] <= 0) {
      dragCounter.current[colId] = 0;
      setDragOverCol(prev => (prev === colId ? null : prev));
    }
  };

  const handleColumnDragOver = (e: React.DragEvent) => { e.preventDefault(); };

  const handleDrop = async (e: React.DragEvent, colId: Task['status']) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('text/plain') || draggingId;
    setDraggingId(null);
    setDragOverCol(null);
    dragCounter.current = {};
    if (!taskId) return;
    const task = tasks.find(t => t.id === taskId);
    if (!task || task.status === colId) return;

    // Optimistic update
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: colId } : t));
    try {
      await apiClient.fetch(`/api/tasks/${taskId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: colId })
      });
    } catch {
      // Revert on failure
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: task.status } : t));
    }
  };

  // ── create task ──────────────────────────────────────────────────
  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.user?.id || !currentOrg?.id) return;
    try {
      setTaskFormLoading(true);
      const selectedProject = projects.find(p => p.id === newTaskForm.projectId);
      const title = newTaskForm.title.trim() || (selectedProject ? `${selectedProject.name} Task` : 'New Task');
      const data = await apiClient.fetch('/api/tasks', {
        method: 'POST',
        body: JSON.stringify({
          title,
          description: newTaskForm.description,
          userId: session.user.id,
          orgId: currentOrg.id,
          priority: newTaskForm.priority,
          status: newTaskColumnStatus,
          projectId: newTaskForm.projectId || undefined,
          estimatedHours: newTaskForm.estimatedHours,
          dueDate: newTaskForm.dueDate ? new Date(newTaskForm.dueDate + 'T00:00:00.000Z').toISOString() : undefined,
          tags: newTaskForm.tags ? newTaskForm.tags.split(',').map(t => t.trim()).filter(Boolean) : undefined,
        })
      });
      if (data.task) {
        await fetchTasks();
        setNewTaskForm({ title: '', description: '', priority: 'Medium', projectId: '', estimatedHours: 0, dueDate: '', tags: '' });
        setShowNewTaskForm(false);
      }
    } catch { alert('Failed to create task.'); }
    finally { setTaskFormLoading(false); }
  };

  // ── update task ──────────────────────────────────────────────────
  const handleUpdateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTask) return;
    try {
      setTaskFormLoading(true);
      const selectedProject = projects.find(p => p.id === editTaskForm.projectId);
      const title = editTaskForm.title.trim() || (selectedProject ? `${selectedProject.name} Task` : 'General Task');
      const data = await apiClient.fetch(`/api/tasks/${editingTask.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          title,
          description: editTaskForm.description || '',
          priority: editTaskForm.priority,
          estimatedHours: editTaskForm.estimatedHours || 0,
          projectId: editTaskForm.projectId || null,
          dueDate: editTaskForm.dueDate ? new Date(editTaskForm.dueDate + 'T00:00:00.000Z').toISOString() : null,
          tags: editTaskForm.tags ? editTaskForm.tags.split(',').map(t => t.trim()).filter(Boolean) : null,
        })
      });
      if (data.task) {
        await fetchTasks();
        setEditingTask(null);
      }
    } catch { alert('Failed to update task.'); }
    finally { setTaskFormLoading(false); }
  };

  // ── delete task ──────────────────────────────────────────────────
  const handleDeleteTask = async (taskId: string) => {
    if (!confirm('Delete this task?')) return;
    try {
      const data = await apiClient.fetch(`/api/tasks/${taskId}`, { method: 'DELETE' });
      if (data.message) setTasks(prev => prev.filter(t => t.id !== taskId));
    } catch { alert('Failed to delete task.'); }
  };

  // ── open edit form ───────────────────────────────────────────────
  const handleEditTask = (task: Task) => {
    setOpenMenuId(null);
    setEditingTask(task);
    setEditTaskForm({
      title: task.title,
      description: task.description,
      priority: task.priority,
      projectId: task.projectId || '',
      estimatedHours: task.estimatedHours,
      dueDate: task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : '',
      tags: Array.isArray(task.tags) ? task.tags.join(', ') : '',
    });
  };

  // ── filtered tasks ───────────────────────────────────────────────
  const filtered = tasks.filter(t =>
    !searchTerm ||
    t.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const tasksForCol = (colId: string) => filtered.filter(t => t.status === colId);

  // ── estimated hours total per column ─────────────────────────────
  const colHours = (colId: string) =>
    tasksForCol(colId).reduce((s, t) => s + (t.estimatedHours || 0), 0);

  // ── input style shared ───────────────────────────────────────────
  const inputCls = 'w-full px-3 py-2 rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-violet-500/50 transition-all';
  const inputStyle = { background: '#111', border: '1px solid #222' };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: '#6366f1' }} />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#e2e8f0' }}>
            {userRole === 'CLIENT' ? 'My Tasks' : 'Task Board'}
          </h1>
          <p className="text-sm mt-0.5" style={{ color: '#555' }}>
            {tasks.length} tasks across {COLUMNS.length} stages
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5" style={{ color: '#444' }} />
            <input
              type="text"
              placeholder="Search tasks..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-8 pr-3 py-2 rounded-lg text-sm placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-violet-500/50 transition-all"
              style={{ background: '#0d0d0d', border: '1px solid #1e1e1e', color: '#ccc', width: 180 }}
            />
          </div>
          {userRole !== 'CLIENT' && (
            <Button
              onClick={() => { setNewTaskColumnStatus('not_started'); setShowNewTaskForm(true); }}
              className="bg-gradient-primary text-white text-sm h-9"
            >
              <Plus className="h-4 w-4 mr-1.5" />
              New Task
            </Button>
          )}
        </div>
      </div>

      {/* ── Kanban Board ── */}
      <div className="flex gap-4 overflow-x-auto pb-4" style={{ minHeight: 'calc(100vh - 220px)' }}>
        {COLUMNS.map(col => {
          const colTasks = tasksForCol(col.id);
          const isOver = dragOverCol === col.id;

          return (
            <div
              key={col.id}
              className="flex-shrink-0 flex flex-col rounded-xl transition-all duration-200"
              style={{
                width: 280,
                background: isOver ? col.dimAccent : '#0a0a0a',
                border: `1px solid ${isOver ? col.accent + '55' : '#181818'}`,
              }}
              onDragEnter={e => handleColumnDragEnter(e, col.id)}
              onDragLeave={e => handleColumnDragLeave(e, col.id)}
              onDragOver={handleColumnDragOver}
              onDrop={e => handleDrop(e, col.id)}
            >
              {/* Column header */}
              <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid #141414' }}>
                <div className="flex items-center gap-2">
                  <div className="h-2.5 w-2.5 rounded-full" style={{ background: col.accent }} />
                  <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#aaa' }}>
                    {col.label}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {colHours(col.id) > 0 && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: '#1a1a1a', color: '#555' }}>
                      {colHours(col.id)}h
                    </span>
                  )}
                  <span
                    className="text-[11px] font-semibold h-5 w-5 flex items-center justify-center rounded"
                    style={{ background: col.dimAccent, color: col.accent }}
                  >
                    {colTasks.length}
                  </span>
                </div>
              </div>

              {/* Cards */}
              <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
                {colTasks.map(task => {
                  const pCfg = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.Medium;
                  const sCfg = STATUS_CONFIG[task.status] || STATUS_CONFIG.not_started;
                  const isDragging = draggingId === task.id;
                  const date = formatDate(task.dueDate);
                  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'completed';

                  return (
                    <div
                      key={task.id}
                      draggable
                      onDragStart={e => handleDragStart(e, task.id)}
                      onDragEnd={handleDragEnd}
                      className="rounded-xl p-3.5 cursor-grab active:cursor-grabbing relative group transition-all duration-150"
                      style={{
                        background: isDragging ? '#161616' : '#111',
                        border: `1px solid ${isDragging ? col.accent + '40' : '#1e1e1e'}`,
                        opacity: isDragging ? 0.5 : 1,
                        boxShadow: isDragging ? `0 0 0 2px ${col.accent}30` : 'none',
                      }}
                    >
                      {/* Priority badge + menu */}
                      <div className="flex items-center justify-between mb-2.5">
                        <div
                          className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide"
                          style={{ background: pCfg.bg, color: pCfg.text }}
                        >
                          <div className="h-1.5 w-1.5 rounded-full" style={{ background: pCfg.dot }} />
                          {pCfg.label}
                        </div>
                        {userRole !== 'CLIENT' && (
                          <div className="relative">
                            <button
                              onClick={e => { e.stopPropagation(); setOpenMenuId(openMenuId === task.id ? null : task.id); }}
                              className="h-6 w-6 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 transition-opacity"
                              style={{ color: '#555' }}
                            >
                              <MoreHorizontal className="h-3.5 w-3.5" />
                            </button>
                            {openMenuId === task.id && (
                              <>
                                <div className="fixed inset-0 z-10" onClick={() => setOpenMenuId(null)} />
                                <div
                                  className="absolute right-0 top-full mt-1 z-20 rounded-lg overflow-hidden py-1 min-w-[120px]"
                                  style={{ background: '#141414', border: '1px solid #222', boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }}
                                >
                                  <button
                                    onClick={() => handleEditTask(task)}
                                    className="flex items-center gap-2 w-full px-3 py-1.5 text-xs hover:bg-white/5 transition-colors"
                                    style={{ color: '#aaa' }}
                                  >
                                    <Edit2 className="h-3 w-3" /> Edit
                                  </button>
                                  <button
                                    onClick={() => { setOpenMenuId(null); handleDeleteTask(task.id); }}
                                    className="flex items-center gap-2 w-full px-3 py-1.5 text-xs hover:bg-red-500/10 transition-colors"
                                    style={{ color: '#f87171' }}
                                  >
                                    <Trash2 className="h-3 w-3" /> Delete
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Title */}
                      <p className="text-sm font-semibold leading-snug mb-1" style={{ color: '#e2e8f0' }}>
                        {task.title}
                      </p>

                      {/* Description */}
                      {task.description && (
                        <p className="text-xs leading-relaxed mb-3 line-clamp-2" style={{ color: '#555' }}>
                          {task.description}
                        </p>
                      )}

                      {/* Project tag */}
                      {task.project && (
                        <div className="mb-2.5">
                          <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: '#1a1a1a', color: '#666' }}>
                            {task.project}
                          </span>
                        </div>
                      )}

                      {/* Footer */}
                      <div className="flex items-center justify-between mt-2.5 pt-2.5" style={{ borderTop: '1px solid #1a1a1a' }}>
                        {/* Assignee avatar */}
                        <div className="flex items-center gap-1.5">
                          {task.assignee && (
                            <div
                              className="h-6 w-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white"
                              title={task.assignee}
                              style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
                            >
                              {getInitials(task.assignee)}
                            </div>
                          )}
                          {task.estimatedHours > 0 && (
                            <div className="flex items-center gap-1 text-[10px]" style={{ color: '#555' }}>
                              <Clock className="h-3 w-3" />
                              {task.estimatedHours}h
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          {/* Status badge */}
                          <span
                            className="text-[9px] font-semibold px-1.5 py-0.5 rounded uppercase tracking-wide"
                            style={{ background: sCfg.bg, color: sCfg.text }}
                          >
                            {sCfg.label}
                          </span>
                          {/* Due date */}
                          {date && (
                            <div
                              className="flex items-center gap-1 text-[10px]"
                              style={{ color: isOverdue ? '#f87171' : '#555' }}
                            >
                              <Calendar className="h-3 w-3" />
                              {date}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Empty column state */}
                {colTasks.length === 0 && (
                  <div
                    className="flex flex-col items-center justify-center py-8 rounded-xl border border-dashed"
                    style={{ borderColor: '#1e1e1e', color: '#333' }}
                  >
                    <div className="h-6 w-6 rounded-full mb-2" style={{ background: col.dimAccent }} />
                    <p className="text-xs">No tasks</p>
                  </div>
                )}
              </div>

              {/* + Add New */}
              {userRole !== 'CLIENT' && (
                <div className="px-3 pb-3 pt-1">
                  <button
                    onClick={() => { setNewTaskColumnStatus(col.id); setShowNewTaskForm(true); }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-colors duration-150"
                    style={{ color: '#444', background: 'transparent' }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLElement).style.background = '#141414';
                      (e.currentTarget as HTMLElement).style.color = '#888';
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLElement).style.background = 'transparent';
                      (e.currentTarget as HTMLElement).style.color = '#444';
                    }}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add New
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── New Task Modal ── */}
      {showNewTaskForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.7)' }}
          onClick={e => { if (e.target === e.currentTarget) setShowNewTaskForm(false); }}>
          <div className="w-full max-w-md rounded-2xl p-6 space-y-4" style={{ background: '#0d0d0d', border: '1px solid #1e1e1e' }}>
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold" style={{ color: '#e2e8f0' }}>
                New Task — <span style={{ color: COLUMNS.find(c => c.id === newTaskColumnStatus)?.accent }}>{COLUMNS.find(c => c.id === newTaskColumnStatus)?.label}</span>
              </h3>
              <button onClick={() => setShowNewTaskForm(false)} className="text-gray-600 hover:text-gray-400 transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateTask} className="space-y-3">
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: '#555' }}>Title</label>
                <input
                  type="text"
                  value={newTaskForm.title}
                  onChange={e => setNewTaskForm(p => ({ ...p, title: e.target.value }))}
                  placeholder="Task title"
                  className={inputCls}
                  style={inputStyle}
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: '#555' }}>Description</label>
                <textarea
                  value={newTaskForm.description}
                  onChange={e => setNewTaskForm(p => ({ ...p, description: e.target.value }))}
                  placeholder="What needs to be done?"
                  rows={3}
                  className={inputCls + ' resize-none'}
                  style={inputStyle}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: '#555' }}>Priority</label>
                  <select
                    value={newTaskForm.priority}
                    onChange={e => setNewTaskForm(p => ({ ...p, priority: e.target.value as Task['priority'] }))}
                    className={inputCls}
                    style={{ ...inputStyle, color: PRIORITY_CONFIG[newTaskForm.priority]?.text || '#ccc' }}
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Urgent">Urgent</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: '#555' }}>Est. Hours</label>
                  <input
                    type="number"
                    value={newTaskForm.estimatedHours}
                    onChange={e => setNewTaskForm(p => ({ ...p, estimatedHours: parseFloat(e.target.value) || 0 }))}
                    className={inputCls}
                    style={inputStyle}
                    min="0" step="0.5"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: '#555' }}>Project</label>
                  <select
                    value={newTaskForm.projectId}
                    onChange={e => setNewTaskForm(p => ({ ...p, projectId: e.target.value }))}
                    className={inputCls}
                    style={{ ...inputStyle, color: '#ccc' }}
                  >
                    <option value="">No project</option>
                    {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: '#555' }}>Due Date</label>
                  <input
                    type="date"
                    value={newTaskForm.dueDate}
                    onChange={e => setNewTaskForm(p => ({ ...p, dueDate: e.target.value }))}
                    className={inputCls}
                    style={{ ...inputStyle, color: '#ccc' }}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: '#555' }}>Tags <span style={{ color: '#333' }}>(comma separated)</span></label>
                <input
                  type="text"
                  value={newTaskForm.tags}
                  onChange={e => setNewTaskForm(p => ({ ...p, tags: e.target.value }))}
                  placeholder="frontend, urgent, client"
                  className={inputCls}
                  style={inputStyle}
                />
              </div>

              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setShowNewTaskForm(false)}
                  className="flex-1 py-2 rounded-lg text-sm transition-colors"
                  style={{ background: '#141414', border: '1px solid #222', color: '#666' }}>
                  Cancel
                </button>
                <button type="submit" disabled={taskFormLoading}
                  className="flex-1 py-2 rounded-lg text-sm font-medium text-white transition-all"
                  style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', opacity: taskFormLoading ? 0.6 : 1 }}>
                  {taskFormLoading ? 'Creating...' : 'Create Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Edit Task Modal ── */}
      {editingTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.7)' }}
          onClick={e => { if (e.target === e.currentTarget) setEditingTask(null); }}>
          <div className="w-full max-w-md rounded-2xl p-6 space-y-4" style={{ background: '#0d0d0d', border: '1px solid #1e1e1e' }}>
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold" style={{ color: '#e2e8f0' }}>Edit Task</h3>
              <button onClick={() => setEditingTask(null)} className="text-gray-600 hover:text-gray-400 transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateTask} className="space-y-3">
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: '#555' }}>Title</label>
                <input
                  type="text"
                  value={editTaskForm.title}
                  onChange={e => setEditTaskForm(p => ({ ...p, title: e.target.value }))}
                  className={inputCls}
                  style={inputStyle}
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: '#555' }}>Description</label>
                <textarea
                  value={editTaskForm.description}
                  onChange={e => setEditTaskForm(p => ({ ...p, description: e.target.value }))}
                  rows={3}
                  className={inputCls + ' resize-none'}
                  style={inputStyle}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: '#555' }}>Priority</label>
                  <select
                    value={editTaskForm.priority}
                    onChange={e => setEditTaskForm(p => ({ ...p, priority: e.target.value as Task['priority'] }))}
                    className={inputCls}
                    style={{ ...inputStyle, color: PRIORITY_CONFIG[editTaskForm.priority]?.text || '#ccc' }}
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Urgent">Urgent</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: '#555' }}>Est. Hours</label>
                  <input
                    type="number"
                    value={editTaskForm.estimatedHours}
                    onChange={e => setEditTaskForm(p => ({ ...p, estimatedHours: parseFloat(e.target.value) || 0 }))}
                    className={inputCls}
                    style={inputStyle}
                    min="0" step="0.5"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: '#555' }}>Project</label>
                  <select
                    value={editTaskForm.projectId}
                    onChange={e => setEditTaskForm(p => ({ ...p, projectId: e.target.value }))}
                    className={inputCls}
                    style={{ ...inputStyle, color: '#ccc' }}
                  >
                    <option value="">No project</option>
                    {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: '#555' }}>Due Date</label>
                  <input
                    type="date"
                    value={editTaskForm.dueDate}
                    onChange={e => setEditTaskForm(p => ({ ...p, dueDate: e.target.value }))}
                    className={inputCls}
                    style={{ ...inputStyle, color: '#ccc' }}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: '#555' }}>Tags</label>
                <input
                  type="text"
                  value={editTaskForm.tags}
                  onChange={e => setEditTaskForm(p => ({ ...p, tags: e.target.value }))}
                  className={inputCls}
                  style={inputStyle}
                />
              </div>

              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setEditingTask(null)}
                  className="flex-1 py-2 rounded-lg text-sm transition-colors"
                  style={{ background: '#141414', border: '1px solid #222', color: '#666' }}>
                  Cancel
                </button>
                <button type="submit" disabled={taskFormLoading}
                  className="flex-1 py-2 rounded-lg text-sm font-medium text-white transition-all"
                  style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', opacity: taskFormLoading ? 0.6 : 1 }}>
                  {taskFormLoading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
