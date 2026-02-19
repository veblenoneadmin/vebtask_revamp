import { useState, useEffect, useRef } from 'react';
import { useSession } from '../lib/auth-client';
import { useApiClient } from '../lib/api-client';
import { useOrganization } from '../contexts/OrganizationContext';
import {
  Plus,
  X,
  MoreHorizontal,
  Edit2,
  Trash2,
  Search,
  MessageSquare,
  Link2,
  Folder,
  Filter,
  SlidersHorizontal,
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

// ── VS Code Dark+ theme tokens ────────────────────────────────────────────────
const VS = {
  bg0:     '#1e1e1e', // editor background
  bg1:     '#252526', // sidebar / panel
  bg2:     '#2d2d2d', // elevated surface (cards)
  bg3:     '#333333', // inputs / buttons
  border:  '#3c3c3c',
  border2: '#454545',
  text0:   '#d4d4d4', // primary text
  text1:   '#9d9d9d', // secondary text
  text2:   '#6a6a6a', // muted text
  blue:    '#569cd6', // keywords
  teal:    '#4ec9b0', // types
  yellow:  '#dcdcaa', // functions
  orange:  '#ce9178', // strings
  purple:  '#c586c0', // control flow
  red:     '#f44747', // errors
  green:   '#6a9955', // comments
  accent:  '#007acc', // VS Code brand blue
};

const COLUMNS: { id: Task['status']; label: string; accent: string; bg: string }[] = [
  { id: 'not_started', label: 'To Do',       accent: VS.blue,   bg: 'rgba(86,156,214,0.10)'  },
  { id: 'in_progress', label: 'In Progress', accent: VS.yellow, bg: 'rgba(220,220,170,0.10)' },
  { id: 'on_hold',     label: 'On Hold',     accent: VS.red,    bg: 'rgba(244,71,71,0.10)'   },
  { id: 'completed',   label: 'Done',        accent: VS.teal,   bg: 'rgba(78,201,176,0.10)'  },
];

const PRIORITY_CONFIG: Record<string, { label: string; bg: string; text: string; border: string }> = {
  Low:    { label: 'LOW',      bg: 'linear-gradient(135deg,#1a2e24,#223320)', text: VS.teal,   border: VS.teal   },
  Medium: { label: 'MODERATE', bg: 'linear-gradient(135deg,#2d2a1a,#38341e)', text: VS.yellow, border: VS.yellow },
  High:   { label: 'HIGH',     bg: 'linear-gradient(135deg,#2d1919,#3a1c1c)', text: VS.red,    border: VS.red    },
  Urgent: { label: 'URGENT',   bg: 'linear-gradient(135deg,#251828,#301e35)', text: VS.purple, border: VS.purple },
};

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  not_started: { label: 'Pending',     bg: 'rgba(86,156,214,0.15)',  text: VS.blue   },
  in_progress: { label: 'In Progress', bg: 'rgba(220,220,170,0.15)', text: VS.yellow },
  on_hold:     { label: 'On Hold',     bg: 'rgba(244,71,71,0.15)',   text: VS.red    },
  completed:   { label: 'Done',        bg: 'rgba(78,201,176,0.15)',  text: VS.teal   },
};

// Avatar color palette
const AVATAR_COLORS = [
  'linear-gradient(135deg,#6366f1,#8b5cf6)',
  'linear-gradient(135deg,#f59e0b,#ef4444)',
  'linear-gradient(135deg,#10b981,#06b6d4)',
  'linear-gradient(135deg,#ec4899,#f43f5e)',
  'linear-gradient(135deg,#3b82f6,#6366f1)',
];

function getInitials(name?: string) {
  if (!name) return '?';
  return name.split(/[\s@.]+/).filter(Boolean).map(s => s[0]?.toUpperCase()).slice(0, 2).join('');
}

function formatDate(dateStr?: string) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function avatarGradient(name?: string) {
  if (!name) return AVATAR_COLORS[0];
  const idx = name.charCodeAt(0) % AVATAR_COLORS.length;
  return AVATAR_COLORS[idx];
}

// ── Input style shared ────────────────────────────────────────────────────────
const inputCls = 'w-full px-3 py-2 rounded-lg text-sm placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-[#007acc]/50 transition-all';
const inputStyle: React.CSSProperties = { background: '#3c3c3c', border: '1px solid #454545', color: '#d4d4d4' };

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
    title: '', description: '', priority: 'Medium' as Task['priority'],
    projectId: '', estimatedHours: 0, dueDate: '', tags: '',
  });
  const [taskFormLoading, setTaskFormLoading] = useState(false);

  // Edit task
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [editTaskForm, setEditTaskForm] = useState({
    title: '', description: '', priority: 'Medium' as Task['priority'],
    projectId: '', estimatedHours: 0, dueDate: '', tags: '',
  });

  // Drag and drop
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);
  const dragCounter = useRef<Record<string, number>>({});

  // Card menu
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  // ── fetch user role ────────────────────────────────────────────────────────
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

  // ── fetch tasks ────────────────────────────────────────────────────────────
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

  // ── fetch projects ─────────────────────────────────────────────────────────
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

  // ── drag & drop ────────────────────────────────────────────────────────────
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
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: colId } : t));
    try {
      await apiClient.fetch(`/api/tasks/${taskId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: colId }),
      });
    } catch {
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: task.status } : t));
    }
  };

  // ── create task ────────────────────────────────────────────────────────────
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
        }),
      });
      if (data.task) {
        await fetchTasks();
        setNewTaskForm({ title: '', description: '', priority: 'Medium', projectId: '', estimatedHours: 0, dueDate: '', tags: '' });
        setShowNewTaskForm(false);
      }
    } catch { alert('Failed to create task.'); }
    finally { setTaskFormLoading(false); }
  };

  // ── update task ────────────────────────────────────────────────────────────
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
        }),
      });
      if (data.task) {
        await fetchTasks();
        setEditingTask(null);
      }
    } catch { alert('Failed to update task.'); }
    finally { setTaskFormLoading(false); }
  };

  // ── delete task ────────────────────────────────────────────────────────────
  const handleDeleteTask = async (taskId: string) => {
    if (!confirm('Delete this task?')) return;
    try {
      const data = await apiClient.fetch(`/api/tasks/${taskId}`, { method: 'DELETE' });
      if (data.message) setTasks(prev => prev.filter(t => t.id !== taskId));
    } catch { alert('Failed to delete task.'); }
  };

  // ── open edit form ─────────────────────────────────────────────────────────
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

  // ── filtered tasks ─────────────────────────────────────────────────────────
  const filtered = tasks.filter(t =>
    !searchTerm ||
    t.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const tasksForCol = (colId: string) => filtered.filter(t => t.status === colId);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: VS.accent }} />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full" style={{ minHeight: 'calc(100vh - 56px)' }}>

      {/* ── Top header bar ── */}
      <div
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-6 py-4"
        style={{ borderBottom: `1px solid ${VS.border}` }}
      >
        {/* Left: title + meta */}
        <div>
          <h1 className="text-lg font-bold tracking-tight" style={{ color: VS.text0 }}>
            {userRole === 'CLIENT' ? 'My Tasks' : 'Task Board'}
            <span className="ml-2 text-xs font-normal px-2 py-0.5 rounded align-middle"
              style={{ background: VS.bg3, color: VS.text2, border: `1px solid ${VS.border}` }}>
              Private
            </span>
          </h1>
          <p className="text-xs mt-0.5" style={{ color: VS.text2 }}>
            {tasks.length} tasks · {COLUMNS.length} stages
          </p>
        </div>

        {/* Right: search + actions */}
        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5" style={{ color: VS.text2 }} />
            <input
              type="text"
              placeholder="Search..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-8 pr-3 py-1.5 rounded text-sm focus:outline-none focus:ring-1 transition-all"
              style={{ background: VS.bg3, border: `1px solid ${VS.border}`, color: VS.text0, width: 160, outline: 'none' }}
            />
          </div>

          {/* Filter / Sort buttons */}
          <button
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs transition-colors"
            style={{ background: VS.bg3, border: `1px solid ${VS.border}`, color: VS.text1 }}
          >
            <Filter className="h-3.5 w-3.5" /> Filter
          </button>
          <button
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs transition-colors"
            style={{ background: VS.bg3, border: `1px solid ${VS.border}`, color: VS.text1 }}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" /> Sort
          </button>

          {/* Add New */}
          {userRole !== 'CLIENT' && (
            <button
              onClick={() => { setNewTaskColumnStatus('not_started'); setShowNewTaskForm(true); }}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded text-xs font-semibold text-white transition-all hover:opacity-90"
              style={{ background: VS.accent }}
            >
              <Plus className="h-3.5 w-3.5" />
              Add New
            </button>
          )}
        </div>
      </div>

      {/* ── Kanban columns ── */}
      <div className="flex-1 flex gap-4 overflow-x-auto p-5" style={{ alignItems: 'flex-start' }}>
        {COLUMNS.map(col => {
          const colTasks = tasksForCol(col.id);
          const isOver = dragOverCol === col.id;

          return (
            <div
              key={col.id}
              className="flex-shrink-0 flex flex-col rounded-2xl overflow-hidden transition-all duration-200"
              style={{
                width: 300,
                background: isOver ? col.bg : VS.bg1,
                border: `1px solid ${isOver ? col.accent + '66' : VS.border}`,
                borderTop: `3px solid ${col.accent}`,
              }}
              onDragEnter={e => handleColumnDragEnter(e, col.id)}
              onDragLeave={e => handleColumnDragLeave(e, col.id)}
              onDragOver={handleColumnDragOver}
              onDrop={e => handleDrop(e, col.id)}
            >
              {/* ── Column header ── */}
              <div className="px-4 pt-4 pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold tracking-wide" style={{ color: VS.text0 }}>
                      {col.label.toUpperCase()}
                    </span>
                    <span
                      className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                      style={{ background: col.bg, color: col.accent }}
                    >
                      {colTasks.length}
                    </span>
                  </div>
                  {userRole !== 'CLIENT' && (
                    <button
                      onClick={() => { setNewTaskColumnStatus(col.id); setShowNewTaskForm(true); }}
                      className="h-6 w-6 rounded-full flex items-center justify-center transition-all hover:opacity-80"
                      style={{ background: col.bg, color: col.accent }}
                      title="Add task"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                <p className="text-[11px] mt-0.5" style={{ color: VS.text2 }}>
                  {colTasks.length} {colTasks.length === 1 ? 'task' : 'tasks'}
                  {colTasks.reduce((s, t) => s + (t.estimatedHours || 0), 0) > 0 &&
                    ` · ${colTasks.reduce((s, t) => s + (t.estimatedHours || 0), 0)}h estimated`}
                </p>
              </div>

              {/* ── Cards ── */}
              <div
                className="flex-1 overflow-y-auto pb-3 px-3"
                style={{ maxHeight: 'calc(100vh - 260px)', paddingTop: '16px' }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
                {colTasks.map(task => {
                  const pCfg = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.Medium;
                  const sCfg = STATUS_CONFIG[task.status] || STATUS_CONFIG.not_started;
                  const isDragging = draggingId === task.id;
                  const date = formatDate(task.dueDate);
                  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'completed';
                  const tagCount = Array.isArray(task.tags) ? task.tags.length : 0;

                  return (
                    /*
                     * Wrapper: draggable, position:relative (no overflow so badge can bleed above).
                     * Badge sits at top:0, transform:translateY(-50%) → centered ON the card's top border.
                     * Card div has overflow:hidden (for rounded corners) but badge is a sibling, not a child,
                     * so it is NOT clipped by the card's overflow:hidden.
                     */
                    <div
                      key={task.id}
                      draggable
                      onDragStart={e => handleDragStart(e, task.id)}
                      onDragEnd={handleDragEnd}
                      className="relative group cursor-grab active:cursor-grabbing"
                      style={{ opacity: isDragging ? 0.45 : 1 }}
                    >
                      {/* ── Card ── rendered FIRST so badge paints over it */}
                      <div
                        className="rounded-2xl overflow-hidden transition-all duration-150"
                        style={{
                          background: VS.bg2,
                          border: `1px solid ${pCfg.border}55`,
                          boxShadow: isDragging
                            ? `0 0 0 2px ${pCfg.border}50`
                            : '0 4px 20px rgba(0,0,0,0.4)',
                        }}
                      >
                        {/* Content */}
                        <div className="px-4 pt-6 pb-3">

                          {/* ⋯ context menu */}
                          {userRole !== 'CLIENT' && (
                            <div className="absolute top-[18px] right-3 z-20">
                              <button
                                onClick={e => { e.stopPropagation(); setOpenMenuId(openMenuId === task.id ? null : task.id); }}
                                className="h-6 w-6 flex items-center justify-center rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                style={{ color: VS.text2, background: VS.bg3 }}
                              >
                                <MoreHorizontal className="h-3.5 w-3.5" />
                              </button>
                              {openMenuId === task.id && (
                                <>
                                  <div className="fixed inset-0 z-10" onClick={() => setOpenMenuId(null)} />
                                  <div
                                    className="absolute right-0 top-full mt-1 z-20 rounded-xl overflow-hidden py-1 min-w-[130px]"
                                    style={{ background: VS.bg1, border: `1px solid ${VS.border}`, boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }}
                                  >
                                    <button
                                      onClick={() => handleEditTask(task)}
                                      className="flex items-center gap-2 w-full px-3 py-2 text-xs hover:bg-white/5 transition-colors"
                                      style={{ color: VS.text0 }}
                                    >
                                      <Edit2 className="h-3 w-3" /> Edit task
                                    </button>
                                    <div style={{ height: 1, background: VS.border, margin: '2px 0' }} />
                                    <button
                                      onClick={() => { setOpenMenuId(null); handleDeleteTask(task.id); }}
                                      className="flex items-center gap-2 w-full px-3 py-2 text-xs hover:bg-red-500/10 transition-colors"
                                      style={{ color: VS.red }}
                                    >
                                      <Trash2 className="h-3 w-3" /> Delete
                                    </button>
                                  </div>
                                </>
                              )}
                            </div>
                          )}

                          {/* Title */}
                          <p className="text-[15px] font-bold leading-snug mb-2 pr-6" style={{ color: VS.text0 }}>
                            {task.title}
                          </p>

                          {/* Description */}
                          <p className="text-[13px] leading-relaxed line-clamp-2 mb-4" style={{ color: VS.text2 }}>
                            {task.description || (task.project ? `Part of ${task.project}` : '\u00a0')}
                          </p>

                          {/* Avatars (left) + Status badge (right) */}
                          <div className="flex items-center justify-between">
                            <div className="flex -space-x-2">
                              {task.assignee ? (
                                <div
                                  className="h-8 w-8 rounded-full flex items-center justify-center text-[10px] font-bold text-white ring-2 ring-[#2d2d2d]"
                                  title={task.assignee}
                                  style={{ background: avatarGradient(task.assignee) }}
                                >
                                  {getInitials(task.assignee)}
                                </div>
                              ) : (
                                <div
                                  className="h-8 w-8 rounded-full flex items-center justify-center text-[10px] font-bold ring-2 ring-[#2d2d2d]"
                                  style={{ background: VS.bg3, color: VS.text2, border: `1px dashed ${VS.border2}` }}
                                >
                                  ?
                                </div>
                              )}
                            </div>

                            <span
                              className="text-[11px] font-semibold px-3 py-1 rounded-full"
                              style={{ background: sCfg.bg, color: sCfg.text, border: `1px solid ${sCfg.text}44` }}
                            >
                              {sCfg.label}
                            </span>
                          </div>
                        </div>

                        {/* ── Dashed separator ── */}
                        <div style={{ borderTop: `1px dashed ${VS.border}` }} />

                        {/* ── Stats row ── */}
                        <div className="flex items-center justify-between px-4 py-2.5">
                          <div className="flex items-center gap-3">
                            <span className="flex items-center gap-1.5 text-[12px]" style={{ color: VS.text2 }}>
                              <MessageSquare className="h-3.5 w-3.5" />
                              {tagCount}
                            </span>
                            <span className="flex items-center gap-1.5 text-[12px]" style={{ color: VS.text2 }}>
                              <Link2 className="h-3.5 w-3.5" />
                              {task.estimatedHours || 0}
                            </span>
                            <span className="flex items-center gap-1.5 text-[12px]" style={{ color: VS.text2 }}>
                              <Folder className="h-3.5 w-3.5" />
                              {task.actualHours || 0}
                            </span>
                          </div>
                          <span
                            className="text-[12px] font-medium"
                            style={{ color: isOverdue ? VS.red : VS.text2 }}
                          >
                            {date || '—'}
                          </span>
                        </div>
                      </div>

                      {/* ── Priority badge: rendered AFTER card so it paints on top ── */}
                      <div
                        className="absolute left-1/2 z-30 px-4 py-[3px] rounded-full text-[11px] font-bold tracking-widest whitespace-nowrap"
                        style={{
                          top: 0,
                          transform: 'translate(-50%, -50%)',
                          background: pCfg.bg,
                          color: pCfg.text,
                          border: `1px solid ${pCfg.border}99`,
                          boxShadow: `0 2px 8px ${pCfg.border}40`,
                        }}
                      >
                        {pCfg.label}
                      </div>
                    </div>
                  );
                })}
                </div>

                {/* Empty state */}
                {colTasks.length === 0 && !isOver && (
                  <div
                    className="flex flex-col items-center justify-center py-10 rounded-xl"
                    style={{ border: `1px dashed ${VS.border}` }}
                  >
                    <div
                      className="h-8 w-8 rounded-full flex items-center justify-center mb-2"
                      style={{ background: VS.bg3 }}
                    >
                      <Plus className="h-4 w-4" style={{ color: VS.text2 }} />
                    </div>
                    <p className="text-xs" style={{ color: VS.text2 }}>No tasks here</p>
                  </div>
                )}
              </div>

              {/* ── + Add New (bottom) ── */}
              {userRole !== 'CLIENT' && (
                <div className="px-3 pb-3">
                  <button
                    onClick={() => { setNewTaskColumnStatus(col.id); setShowNewTaskForm(true); }}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-medium transition-all"
                    style={{
                      border: `1px dashed ${VS.border}`,
                      color: VS.text2,
                      background: 'transparent',
                    }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLElement).style.background = col.bg;
                      (e.currentTarget as HTMLElement).style.color = col.accent;
                      (e.currentTarget as HTMLElement).style.borderColor = col.accent + '88';
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLElement).style.background = 'transparent';
                      (e.currentTarget as HTMLElement).style.color = VS.text2;
                      (e.currentTarget as HTMLElement).style.borderColor = VS.border;
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
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.75)' }}
          onClick={e => { if (e.target === e.currentTarget) setShowNewTaskForm(false); }}
        >
          <div
            className="w-full max-w-md rounded-2xl p-6 space-y-4"
            style={{ background: VS.bg1, border: `1px solid ${VS.border}`, boxShadow: '0 24px 64px rgba(0,0,0,0.7)' }}
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold" style={{ color: VS.text0 }}>New Task</h3>
                <p className="text-[11px] mt-0.5" style={{ color: VS.text2 }}>
                  Adding to{' '}
                  <span style={{ color: COLUMNS.find(c => c.id === newTaskColumnStatus)?.accent }}>
                    {COLUMNS.find(c => c.id === newTaskColumnStatus)?.label}
                  </span>
                </p>
              </div>
              <button
                onClick={() => setShowNewTaskForm(false)}
                className="h-7 w-7 rounded-lg flex items-center justify-center transition-colors hover:bg-white/5"
                style={{ color: VS.text1 }}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateTask} className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold mb-1.5 uppercase tracking-wide" style={{ color: VS.text2 }}>Title</label>
                <input
                  type="text"
                  value={newTaskForm.title}
                  onChange={e => setNewTaskForm(p => ({ ...p, title: e.target.value }))}
                  placeholder="Task title..."
                  className={inputCls}
                  style={inputStyle}
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold mb-1.5 uppercase tracking-wide" style={{ color: VS.text2 }}>Description</label>
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
                  <label className="block text-[11px] font-semibold mb-1.5 uppercase tracking-wide" style={{ color: VS.text2 }}>Priority</label>
                  <select
                    value={newTaskForm.priority}
                    onChange={e => setNewTaskForm(p => ({ ...p, priority: e.target.value as Task['priority'] }))}
                    className={inputCls}
                    style={{ ...inputStyle, color: PRIORITY_CONFIG[newTaskForm.priority]?.text || VS.text1 }}
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Urgent">Urgent</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold mb-1.5 uppercase tracking-wide" style={{ color: VS.text2 }}>Est. Hours</label>
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
                  <label className="block text-[11px] font-semibold mb-1.5 uppercase tracking-wide" style={{ color: VS.text2 }}>Project</label>
                  <select
                    value={newTaskForm.projectId}
                    onChange={e => setNewTaskForm(p => ({ ...p, projectId: e.target.value }))}
                    className={inputCls}
                    style={{ ...inputStyle, color: VS.text1 }}
                  >
                    <option value="">No project</option>
                    {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold mb-1.5 uppercase tracking-wide" style={{ color: VS.text2 }}>Due Date</label>
                  <input
                    type="date"
                    value={newTaskForm.dueDate}
                    onChange={e => setNewTaskForm(p => ({ ...p, dueDate: e.target.value }))}
                    className={inputCls}
                    style={{ ...inputStyle, color: VS.text1 }}
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold mb-1.5 uppercase tracking-wide" style={{ color: VS.text2 }}>
                  Tags <span className="normal-case font-normal" style={{ color: VS.text2 }}>(comma separated)</span>
                </label>
                <input
                  type="text"
                  value={newTaskForm.tags}
                  onChange={e => setNewTaskForm(p => ({ ...p, tags: e.target.value }))}
                  placeholder="frontend, urgent, client"
                  className={inputCls}
                  style={inputStyle}
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewTaskForm(false)}
                  className="flex-1 py-2.5 rounded-xl text-sm transition-colors"
                  style={{ background: VS.bg3, border: `1px solid ${VS.border}`, color: VS.text1 }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={taskFormLoading}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90"
                  style={{ background: VS.accent, opacity: taskFormLoading ? 0.6 : 1 }}
                >
                  {taskFormLoading ? 'Creating...' : 'Create Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Edit Task Modal ── */}
      {editingTask && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.75)' }}
          onClick={e => { if (e.target === e.currentTarget) setEditingTask(null); }}
        >
          <div
            className="w-full max-w-md rounded-2xl p-6 space-y-4"
            style={{ background: VS.bg1, border: `1px solid ${VS.border}`, boxShadow: '0 24px 64px rgba(0,0,0,0.7)' }}
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold" style={{ color: VS.text0 }}>Edit Task</h3>
                <p className="text-[11px] mt-0.5" style={{ color: VS.text2 }}>Update task details</p>
              </div>
              <button
                onClick={() => setEditingTask(null)}
                className="h-7 w-7 rounded-lg flex items-center justify-center transition-colors hover:bg-white/5"
                style={{ color: VS.text1 }}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateTask} className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold mb-1.5 uppercase tracking-wide" style={{ color: VS.text2 }}>Title</label>
                <input
                  type="text"
                  value={editTaskForm.title}
                  onChange={e => setEditTaskForm(p => ({ ...p, title: e.target.value }))}
                  className={inputCls}
                  style={inputStyle}
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold mb-1.5 uppercase tracking-wide" style={{ color: VS.text2 }}>Description</label>
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
                  <label className="block text-[11px] font-semibold mb-1.5 uppercase tracking-wide" style={{ color: VS.text2 }}>Priority</label>
                  <select
                    value={editTaskForm.priority}
                    onChange={e => setEditTaskForm(p => ({ ...p, priority: e.target.value as Task['priority'] }))}
                    className={inputCls}
                    style={{ ...inputStyle, color: PRIORITY_CONFIG[editTaskForm.priority]?.text || VS.text1 }}
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Urgent">Urgent</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold mb-1.5 uppercase tracking-wide" style={{ color: VS.text2 }}>Est. Hours</label>
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
                  <label className="block text-[11px] font-semibold mb-1.5 uppercase tracking-wide" style={{ color: VS.text2 }}>Project</label>
                  <select
                    value={editTaskForm.projectId}
                    onChange={e => setEditTaskForm(p => ({ ...p, projectId: e.target.value }))}
                    className={inputCls}
                    style={{ ...inputStyle, color: VS.text1 }}
                  >
                    <option value="">No project</option>
                    {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold mb-1.5 uppercase tracking-wide" style={{ color: VS.text2 }}>Due Date</label>
                  <input
                    type="date"
                    value={editTaskForm.dueDate}
                    onChange={e => setEditTaskForm(p => ({ ...p, dueDate: e.target.value }))}
                    className={inputCls}
                    style={{ ...inputStyle, color: VS.text1 }}
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold mb-1.5 uppercase tracking-wide" style={{ color: VS.text2 }}>Tags</label>
                <input
                  type="text"
                  value={editTaskForm.tags}
                  onChange={e => setEditTaskForm(p => ({ ...p, tags: e.target.value }))}
                  className={inputCls}
                  style={inputStyle}
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingTask(null)}
                  className="flex-1 py-2.5 rounded-xl text-sm transition-colors"
                  style={{ background: VS.bg3, border: `1px solid ${VS.border}`, color: VS.text1 }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={taskFormLoading}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90"
                  style={{ background: VS.accent, opacity: taskFormLoading ? 0.6 : 1 }}
                >
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
