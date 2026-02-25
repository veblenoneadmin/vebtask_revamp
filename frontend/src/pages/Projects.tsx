import { useState, useEffect } from 'react';
import { useSession } from '../lib/auth-client';
import { useApiClient } from '../lib/api-client';
import { useOrganization } from '../contexts/OrganizationContext';
import {
  Building2,
  Plus,
  Calendar,
  DollarSign,
  Clock,
  Target,
  AlertCircle,
  CheckCircle2,
  MoreHorizontal,
  Activity,
  Edit3,
  Trash2,
  CheckSquare,
} from 'lucide-react';
import { ProjectModal } from '../components/ProjectModal';

// ── VS Code Dark+ tokens ───────────────────────────────────────────────────────
const VS = {
  bg0:    '#1e1e1e',
  bg1:    '#252526',
  bg2:    '#2d2d2d',
  bg3:    '#333333',
  border: '#3c3c3c',
  border2:'#454545',
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

const PROJECT_STATUS: Record<string, { label: string; accent: string; bg: string; text: string }> = {
  planning:  { label: 'Planning',  accent: VS.blue,   bg: 'rgba(86,156,214,0.12)',  text: VS.blue   },
  active:    { label: 'Active',    accent: VS.teal,   bg: 'rgba(78,201,176,0.12)',  text: VS.teal   },
  on_hold:   { label: 'On Hold',   accent: VS.red,    bg: 'rgba(244,71,71,0.12)',   text: VS.red    },
  completed: { label: 'Completed', accent: VS.green,  bg: 'rgba(106,153,85,0.12)',  text: VS.green  },
  cancelled: { label: 'Cancelled', accent: VS.orange, bg: 'rgba(206,145,120,0.12)', text: VS.orange },
};

const PROJECT_PRIORITY: Record<string, { label: string; text: string; border: string }> = {
  high:   { label: 'HIGH', text: VS.red,    border: VS.red    },
  medium: { label: 'MED',  text: VS.yellow, border: VS.yellow },
  low:    { label: 'LOW',  text: VS.teal,   border: VS.teal   },
};

interface DatabaseProject {
  id: string;
  name: string;
  description: string | null;
  status: 'planning' | 'active' | 'on_hold' | 'completed' | 'cancelled';
  priority: 'high' | 'medium' | 'low';
  client?: { id: string; name: string; email: string } | null;
  clientId?: string | null;
  clientName?: string | null;
  startDate: string | null;
  endDate: string | null;
  budget: number | null;
  spent: number;
  progress: number;
  estimatedHours: number;
  hoursLogged: number;
  color: string;
  createdAt: string;
  updatedAt: string;
  orgId: string;
  teamMembers?: string[];
  tasks?: { total: number; completed: number; inProgress: number; pending: number };
  tags?: string[];
}

const parseClientFromDescription = (description: string | null): string | null => {
  if (!description) return null;
  const match = description.match(/^CLIENT:([^|]+)\|DESC:/);
  return match ? match[1] : null;
};

const parseDescriptionFromCombined = (description: string | null): string => {
  if (!description) return '';
  const match = description.match(/^CLIENT:[^|]+\|DESC:(.*)$/);
  return match ? match[1] : description;
};

function fmtDate(dateStr: string | null) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getStatusIcon(status: string) {
  switch (status) {
    case 'active':    return <Activity className="h-4 w-4" />;
    case 'completed': return <CheckCircle2 className="h-4 w-4" />;
    case 'on_hold':   return <AlertCircle className="h-4 w-4" />;
    case 'planning':  return <Target className="h-4 w-4" />;
    default:          return <Building2 className="h-4 w-4" />;
  }
}

const inputCls = 'px-3 py-1.5 rounded text-xs focus:outline-none focus:ring-1 focus:ring-[#007acc]/50 transition-all';
const inputStyle: React.CSSProperties = { background: VS.bg3, border: `1px solid ${VS.border}`, color: VS.text1 };

export function Projects() {
  const { data: session } = useSession();
  const { currentOrg } = useOrganization();
  const apiClient = useApiClient();

  const [projects, setProjects] = useState<DatabaseProject[]>([]);
  const [clients, setClients] = useState<{ id: string; name: string; email?: string; company?: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);
  const [editingProject, setEditingProject] = useState<DatabaseProject | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterPriority, setFilterPriority] = useState('all');

  const fetchClients = async () => {
    try {
      const data = await apiClient.fetch('/api/clients/slim');
      if (data.success) setClients(data.clients || []);
      else console.warn('fetchClients failed:', data);
    } catch (err) {
      console.error('fetchClients error:', err);
    }
  };

  const fetchProjects = async () => {
    if (!session?.user?.id) return;
    try {
      setLoading(true);
      const orgId = currentOrg?.id || 'org_1757046595553';
      const data = await apiClient.fetch(`/api/projects?userId=${session.user.id}&orgId=${orgId}&limit=100`);
      if (data.success) setProjects(data.projects || []);
      else setProjects([]);
    } catch { setProjects([]); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    fetchProjects();
    fetchClients();
  }, [session?.user?.id, currentOrg?.id]);

  const handleDeleteProject = async (project: DatabaseProject) => {
    if (!confirm(`Delete "${project.name}"? This cannot be undone.`)) return;
    if (!session?.user?.id) return;
    try {
      const data = await apiClient.fetch(`/api/projects/${project.id}`, { method: 'DELETE' });
      if (data.success) await fetchProjects();
      else throw new Error(data.error);
    } catch { alert('Failed to delete project.'); }
  };

  const handleUpdateProject = async (projectData: any) => {
    if (!session?.user?.id || !editingProject) return;
    try {
      const clientName = projectData.clientName || '';
      const description = projectData.description || '';
      const combinedDescription = clientName ? `CLIENT:${clientName}|DESC:${description}` : description;
      const data = await apiClient.fetch(`/api/projects/${editingProject.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: projectData.name, description: combinedDescription,
          priority: projectData.priority || 'medium', status: projectData.status || 'planning',
          budget: projectData.budget ? parseFloat(projectData.budget) : undefined,
          startDate: projectData.startDate ? new Date(projectData.startDate).toISOString() : undefined,
          endDate: projectData.endDate ? new Date(projectData.endDate).toISOString() : undefined,
          color: projectData.color || 'bg-primary',
          clientId: projectData.clientId || undefined,
        }),
      });
      if (data.success) { await fetchProjects(); setEditingProject(null); }
    } catch { /* ignore */ }
  };

  const handleCreateProject = async (projectData: any) => {
    if (!session?.user?.id) return;
    try {
      const orgId = currentOrg?.id || 'org_1757046595553';
      const clientName = projectData.clientName || '';
      const description = projectData.description || '';
      const combinedDescription = clientName ? `CLIENT:${clientName}|DESC:${description}` : description;
      const data = await apiClient.fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orgId, name: projectData.name, description: combinedDescription,
          priority: projectData.priority || 'medium', status: projectData.status || 'planning',
          budget: projectData.budget ? parseFloat(projectData.budget) : undefined,
          startDate: projectData.startDate ? new Date(projectData.startDate).toISOString() : undefined,
          endDate: projectData.endDate ? new Date(projectData.endDate).toISOString() : undefined,
          color: projectData.color || 'bg-primary',
          clientId: projectData.clientId || undefined,
        }),
      });
      if (data.success) { await fetchProjects(); setShowNewProjectModal(false); }
    } catch { /* ignore */ }
  };

  const filteredProjects = projects.filter(p => {
    if (filterStatus !== 'all' && p.status !== filterStatus) return false;
    if (filterPriority !== 'all' && p.priority !== filterPriority) return false;
    return true;
  });

  const stats = {
    total:     projects.length,
    active:    projects.filter(p => p.status === 'active').length,
    completed: projects.filter(p => p.status === 'completed').length,
    totalHours: projects.reduce((s, p) => s + p.hoursLogged, 0),
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: VS.accent }} />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full" style={{ minHeight: 'calc(100vh - 56px)' }}>

      {/* ── Header bar ── */}
      <div
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-6 py-4"
        style={{ borderBottom: `1px solid ${VS.border}` }}
      >
        {/* Left: title + meta */}
        <div>
          <h1 className="text-lg font-bold tracking-tight" style={{ color: VS.text0 }}>
            Projects
            <span className="ml-2 text-xs font-normal px-2 py-0.5 rounded align-middle"
              style={{ background: VS.bg3, color: VS.text2, border: `1px solid ${VS.border}` }}>
              Portfolio
            </span>
          </h1>
          <p className="text-xs mt-0.5" style={{ color: VS.text2 }}>
            {filteredProjects.length}{filteredProjects.length !== projects.length ? ` / ${projects.length}` : ''} projects
          </p>
        </div>

        {/* Right: filters + actions */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Status filter */}
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className={inputCls}
            style={inputStyle}
          >
            <option value="all">All Status</option>
            <option value="planning">Planning</option>
            <option value="active">Active</option>
            <option value="on_hold">On Hold</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>

          {/* Priority filter */}
          <select
            value={filterPriority}
            onChange={e => setFilterPriority(e.target.value)}
            className={inputCls}
            style={inputStyle}
          >
            <option value="all">All Priority</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>

          {/* New Project */}
          <button
            onClick={() => setShowNewProjectModal(true)}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded text-xs font-semibold text-white transition-all hover:opacity-90"
            style={{ background: VS.accent }}
          >
            <Plus className="h-3.5 w-3.5" />
            New Project
          </button>
        </div>
      </div>

      {/* ── Stats strip ── */}
      <div
        className="grid grid-cols-2 sm:grid-cols-4 gap-px shrink-0"
        style={{ background: VS.border, borderBottom: `1px solid ${VS.border}` }}
      >
        {[
          { label: 'Total',     value: stats.total,     icon: Building2,    color: VS.blue   },
          { label: 'Active',    value: stats.active,    icon: Activity,     color: VS.teal   },
          { label: 'Completed', value: stats.completed, icon: CheckCircle2, color: VS.green  },
          { label: 'Hrs Logged', value: `${stats.totalHours}h`, icon: Clock, color: VS.yellow },
        ].map(s => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="flex items-center gap-3 px-5 py-3" style={{ background: VS.bg1 }}>
              <div className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: `${s.color}18`, border: `1px solid ${s.color}44` }}>
                <Icon className="h-3.5 w-3.5" style={{ color: s.color }} />
              </div>
              <div>
                <p className="text-base font-bold leading-tight" style={{ color: VS.text0 }}>{s.value}</p>
                <p className="text-[10px]" style={{ color: VS.text2 }}>{s.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Projects grid ── */}
      <div className="flex-1 overflow-y-auto p-5">
        {filteredProjects.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center py-20 rounded-2xl"
            style={{ border: `1px dashed ${VS.border}` }}
          >
            <div className="h-12 w-12 rounded-2xl flex items-center justify-center mb-4"
              style={{ background: VS.bg3 }}>
              <Building2 className="h-6 w-6" style={{ color: VS.text2 }} />
            </div>
            <p className="text-sm font-semibold" style={{ color: VS.text1 }}>No projects found</p>
            <p className="text-xs mt-1" style={{ color: VS.text2 }}>
              {filterStatus !== 'all' || filterPriority !== 'all' ? 'Try adjusting your filters' : 'Create your first project to get started'}
            </p>
            <button
              onClick={() => setShowNewProjectModal(true)}
              className="mt-4 flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-white"
              style={{ background: VS.accent }}
            >
              <Plus className="h-3.5 w-3.5" /> New Project
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredProjects.map(project => {
              const sCfg = PROJECT_STATUS[project.status] || PROJECT_STATUS.planning;
              const pCfg = PROJECT_PRIORITY[project.priority] || PROJECT_PRIORITY.medium;
              const client = project.client?.name || parseClientFromDescription(project.description);
              const desc = parseDescriptionFromCombined(project.description);
              const isOver = project.endDate && new Date(project.endDate) < new Date() && project.status !== 'completed' && project.status !== 'cancelled';

              return (
                <div
                  key={project.id}
                  className="rounded-2xl overflow-hidden transition-all duration-150 relative group"
                  style={{
                    background: VS.bg2,
                    border: `1px solid ${sCfg.accent}44`,
                    borderTop: `3px solid ${sCfg.accent}`,
                    boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
                  }}
                >
                  {/* ── Card header ── */}
                  <div className="px-4 pt-5 pb-3">
                    <div className="flex items-start gap-2">
                      {/* Icon */}
                      <div
                        className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0 text-white"
                        style={{ background: `linear-gradient(135deg, ${sCfg.accent}, ${sCfg.accent}99)` }}
                      >
                        {getStatusIcon(project.status)}
                      </div>

                      {/* Title + client */}
                      <div className="flex-1 min-w-0">
                        <p className="text-[14px] font-bold leading-snug" style={{ color: VS.text0 }}>
                          {project.name}
                        </p>
                        <p className="text-[11px] truncate mt-0.5" style={{ color: VS.text2 }}>
                          {client || 'No client assigned'}
                        </p>
                      </div>

                      {/* Context menu */}
                      <div className="relative shrink-0">
                        <button
                          onClick={e => { e.stopPropagation(); setOpenMenuId(openMenuId === project.id ? null : project.id); }}
                          className="h-6 w-6 flex items-center justify-center rounded-lg transition-all opacity-0 group-hover:opacity-100"
                          style={{ color: VS.text2, background: VS.bg3 }}
                        >
                          <MoreHorizontal className="h-3.5 w-3.5" />
                        </button>
                        {openMenuId === project.id && (
                          <>
                            <div className="fixed inset-0 z-10" onClick={() => setOpenMenuId(null)} />
                            <div
                              className="absolute right-0 top-full mt-1 z-20 rounded-xl overflow-hidden py-1 min-w-[130px]"
                              style={{ background: VS.bg1, border: `1px solid ${VS.border}`, boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }}
                            >
                              <button
                                onClick={() => { setEditingProject(project); setOpenMenuId(null); }}
                                className="flex items-center gap-2 w-full px-3 py-2 text-xs hover:bg-white/5 transition-colors"
                                style={{ color: VS.text0 }}
                              >
                                <Edit3 className="h-3 w-3" /> Edit project
                              </button>
                              <div style={{ height: 1, background: VS.border, margin: '2px 0' }} />
                              <button
                                onClick={() => { setOpenMenuId(null); handleDeleteProject(project); }}
                                className="flex items-center gap-2 w-full px-3 py-2 text-xs hover:bg-red-500/10 transition-colors"
                                style={{ color: VS.red }}
                              >
                                <Trash2 className="h-3 w-3" /> Delete
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Description */}
                    <p className="text-[12px] mt-2.5 line-clamp-2 leading-relaxed" style={{ color: VS.text2 }}>
                      {desc || '\u00a0'}
                    </p>

                    {/* Status + Priority badges */}
                    <div className="mt-2.5 flex items-center gap-2 flex-wrap">
                      <span
                        className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full"
                        style={{ background: sCfg.bg, color: sCfg.text, border: `1px solid ${sCfg.accent}44` }}
                      >
                        {sCfg.label}
                      </span>
                      <span
                        className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded"
                        style={{ background: `${pCfg.border}18`, color: pCfg.text, border: `1px solid ${pCfg.border}44` }}
                      >
                        {pCfg.label}
                      </span>
                    </div>
                  </div>

                  {/* ── Progress ── */}
                  <div className="px-4 pb-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[11px]" style={{ color: VS.text2 }}>Progress</span>
                      <span className="text-[11px] font-semibold" style={{ color: VS.text1 }}>{project.progress}%</span>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: VS.bg3 }}>
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{ width: `${project.progress}%`, background: `linear-gradient(90deg, ${sCfg.accent}, ${sCfg.accent}88)` }}
                      />
                    </div>
                  </div>

                  {/* ── Dashed separator ── */}
                  <div style={{ borderTop: `1px dashed ${VS.border}` }} />

                  {/* ── Stats row ── */}
                  <div className="flex items-center justify-between px-4 py-2.5">
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1 text-[12px]" style={{ color: VS.text2 }}>
                        <CheckSquare className="h-3.5 w-3.5" />
                        {project.tasks?.completed || 0}/{project.tasks?.total || 0}
                      </span>
                      <span className="flex items-center gap-1 text-[12px]" style={{ color: VS.text2 }}>
                        <Clock className="h-3.5 w-3.5" />
                        {project.hoursLogged}h
                      </span>
                      {project.budget && project.budget > 0 && (
                        <span className="flex items-center gap-1 text-[12px]" style={{ color: VS.text2 }}>
                          <DollarSign className="h-3.5 w-3.5" />
                          {Math.round(((project.spent || 0) / project.budget) * 100)}%
                        </span>
                      )}
                    </div>

                    {/* End date */}
                    <span
                      className="text-[12px] font-medium"
                      style={{ color: isOver ? VS.red : VS.text2 }}
                    >
                      {project.endDate ? (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5" />
                          {fmtDate(project.endDate)}
                        </span>
                      ) : '—'}
                    </span>
                  </div>

                  {/* ── Budget bar (if applicable) ── */}
                  {project.budget && project.budget > 0 && (
                    <div className="px-4 pb-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px]" style={{ color: VS.text2 }}>
                          Budget ${(project.spent || 0).toLocaleString()} / ${project.budget.toLocaleString()}
                        </span>
                      </div>
                      <div className="h-1 rounded-full overflow-hidden" style={{ background: VS.bg3 }}>
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.min(((project.spent || 0) / project.budget) * 100, 100)}%`,
                            background: (project.spent || 0) > project.budget ? VS.red : VS.green,
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Create / Edit modals ── */}
      <ProjectModal
        isOpen={showNewProjectModal}
        onClose={() => setShowNewProjectModal(false)}
        onSave={handleCreateProject}
        clients={clients}
      />
      <ProjectModal
        isOpen={!!editingProject}
        onClose={() => setEditingProject(null)}
        onSave={handleUpdateProject}
        clients={clients}
        project={editingProject ? {
          id: editingProject.id,
          name: editingProject.name,
          description: parseDescriptionFromCombined(editingProject.description),
          color: editingProject.color,
          status: editingProject.status,
          startDate: editingProject.startDate,
          endDate: editingProject.endDate,
          createdAt: new Date(editingProject.createdAt),
          updatedAt: new Date(editingProject.updatedAt),
          clientName: parseClientFromDescription(editingProject.description) || undefined,
        } : undefined}
      />

      {/* Click-outside for context menus */}
      {openMenuId && <div className="fixed inset-0 z-[5]" onClick={() => setOpenMenuId(null)} />}
    </div>
  );
}
