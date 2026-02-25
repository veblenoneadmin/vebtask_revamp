import { useState, useEffect, useCallback } from 'react';
import { useSession } from '../lib/auth-client';
import { useApiClient } from '../lib/api-client';
import { useOrganization } from '../contexts/OrganizationContext';
import { createPortal } from 'react-dom';
import {
  FileText, Plus, Users, Target, X, Save, Building2, Trash2,
  Calendar, Search, FolderOpen, Clock, TrendingUp,
} from 'lucide-react';

// ── VS Code Dark+ tokens ──────────────────────────────────────────────────────
const VS = {
  bg0:    '#1e1e1e', bg1: '#252526', bg2: '#2d2d2d', bg3: '#333333',
  border: '#3c3c3c', text0: '#f0f0f0', text1: '#c0c0c0', text2: '#909090',
  blue:   '#569cd6', teal: '#4ec9b0', yellow: '#dcdcaa', orange: '#ce9178',
  purple: '#c586c0', red: '#f44747', green: '#6a9955', accent: '#007acc',
};

// ── Interfaces ────────────────────────────────────────────────────────────────
interface Report {
  id: string;
  title: string | null;
  description: string;
  userName: string;
  image: string | null;
  project: { id: string; name: string; color: string; status: string; budget: number | null } | null;
  user: { id: string; name: string | null; email: string; image: string | null } | null;
  createdAt: string;
  updatedAt: string;
}
interface ProjectItem { id: string; name: string; color: string; }
interface MemberItem  { id: string; name: string; role: string; }
interface Analytics   { total: number; thisWeek: number; uniqueProjects: number; uniqueMembers: number; }

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}
function fmtRelative(iso: string) {
  const diff  = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins  < 1)  return 'just now';
  if (mins  < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days  < 7)  return `${days}d ago`;
  return fmtDate(iso);
}
function getColor(color?: string | null): string {
  if (!color) return '#6b7280';
  if (color.startsWith('#')) return color;
  const map: Record<string, string> = {
    'bg-blue': '#3b82f6', 'bg-teal': '#14b8a6', 'bg-purple': '#8b5cf6',
    'bg-green': '#22c55e', 'bg-red': '#ef4444', 'bg-orange': '#f97316',
    'bg-yellow': '#eab308', 'bg-primary': '#3b82f6',
  };
  return map[color] || '#6b7280';
}

// ── Avatar ────────────────────────────────────────────────────────────────────
function Avatar({ name, image, size = 28 }: { name: string; image?: string | null; size?: number }) {
  const initials = name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '?';
  const palette  = [VS.blue, VS.purple, VS.teal, VS.yellow, VS.orange, VS.accent];
  const color    = palette[(name?.charCodeAt(0) ?? 0) % palette.length];
  return image
    ? <img src={image} alt={name} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
    : <div style={{ width: size, height: size, borderRadius: '50%', background: `${color}28`, border: `1px solid ${color}55`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.36, fontWeight: 700, color, flexShrink: 0 }}>{initials}</div>;
}

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, color, icon: Icon }: { label: string; value: string | number; sub?: string; color: string; icon: React.ElementType }) {
  return (
    <div className="rounded-xl p-4 flex flex-col gap-3" style={{ background: VS.bg1, border: `1px solid ${VS.border}` }}>
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: VS.text2 }}>{label}</span>
        <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ background: `${color}18`, border: `1px solid ${color}33` }}>
          <Icon className="h-4 w-4" style={{ color }} />
        </div>
      </div>
      <div>
        <div className="text-2xl font-bold tabular-nums leading-none" style={{ color: VS.text0 }}>{value}</div>
        {sub && <div className="text-[11px] mt-1" style={{ color: VS.text2 }}>{sub}</div>}
      </div>
    </div>
  );
}

// ── Report Create Modal ───────────────────────────────────────────────────────
function ReportModal({ isOpen, onClose, onSave, projects }: {
  isOpen: boolean; onClose: () => void;
  onSave: (data: any) => Promise<void>; projects: ProjectItem[];
}) {
  const { data: session } = useSession();
  const [selectedProject, setSelectedProject] = useState('');
  const [userName, setUserName]               = useState('');
  const [description, setDescription]         = useState('');
  const [uploadedImage, setUploadedImage]     = useState<string | null>(null);
  const [saving, setSaving]                   = useState(false);

  useEffect(() => {
    if (isOpen && session?.user) {
      setUserName(session.user.name || session.user.email?.split('@')[0] || '');
    }
  }, [isOpen, session]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = ev => setUploadedImage(ev.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave({ userName, description, image: uploadedImage, projectId: selectedProject || null });
      setSelectedProject(''); setUserName(''); setDescription(''); setUploadedImage(null);
      onClose();
    } catch (err: any) {
      alert(err.message || 'Failed to save report');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  const inp: React.CSSProperties = { width: '100%', background: VS.bg2, border: `1px solid ${VS.border}`, borderRadius: 8, padding: '8px 12px', color: VS.text0, fontSize: 14, outline: 'none', boxSizing: 'border-box' };
  const lbl: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: VS.text2, marginBottom: 6 };

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: VS.bg1, border: `1px solid ${VS.border}`, borderRadius: 12, width: '95%', maxWidth: 640, maxHeight: '90vh', overflowY: 'auto' }}>

        {/* Header */}
        <div style={{ background: VS.bg2, borderBottom: `1px solid ${VS.border}`, padding: '18px 24px', borderRadius: '12px 12px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 38, height: 38, borderRadius: 8, background: VS.bg3, border: `1px solid ${VS.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: VS.blue }}>
              <FileText size={17} />
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 600, color: VS.text0 }}>Create Report</div>
              <div style={{ fontSize: 12, color: VS.text2, marginTop: 2 }}>Submit a progress report for a project</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: VS.text2, cursor: 'pointer', padding: 6, borderRadius: 6, display: 'flex', alignItems: 'center' }}>
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ padding: 24 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

            <div>
              <label style={lbl}><Users size={12} />Your Name *</label>
              <input type="text" value={userName} onChange={e => setUserName(e.target.value)} required placeholder="Enter your name" style={inp} />
            </div>

            <div>
              <label style={lbl}><Building2 size={12} />Project *</label>
              <select value={selectedProject} onChange={e => setSelectedProject(e.target.value)} required style={inp}>
                <option value="" style={{ background: VS.bg2 }}>Choose a project…</option>
                {projects.map(p => <option key={p.id} value={p.id} style={{ background: VS.bg2 }}>{p.name}</option>)}
              </select>
            </div>

            <div>
              <label style={lbl}><FileText size={12} />Report Description *</label>
              <textarea value={description} onChange={e => setDescription(e.target.value)} required
                placeholder="Describe progress, blockers, or any relevant information…" rows={4}
                style={{ ...inp, resize: 'none', fontFamily: 'inherit' }} />
            </div>

            <div>
              <label style={lbl}><Plus size={12} />Attach Screenshot (optional)</label>
              <input type="file" accept="image/*" onChange={handleImageUpload}
                style={{ ...inp, padding: '6px 12px', cursor: 'pointer', color: VS.text1 }} />
              {uploadedImage && (
                <div style={{ marginTop: 10, position: 'relative' }}>
                  <img src={uploadedImage} alt="Preview" style={{ width: '100%', maxHeight: 240, objectFit: 'contain', borderRadius: 8, border: `1px solid ${VS.border}` }} />
                  <button type="button" onClick={() => setUploadedImage(null)}
                    style={{ position: 'absolute', top: 8, right: 8, background: VS.red, border: 'none', borderRadius: '50%', width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', cursor: 'pointer' }}>
                    <X size={13} />
                  </button>
                </div>
              )}
            </div>

            {/* Project preview */}
            {selectedProject && (() => {
              const p = projects.find(x => x.id === selectedProject);
              return p ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: VS.bg2, borderRadius: 8, border: `1px solid ${VS.border}` }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: getColor(p.color), flexShrink: 0 }} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: VS.text0 }}>{p.name}</span>
                  <Target size={12} style={{ color: VS.text2, marginLeft: 'auto' }} />
                </div>
              ) : null;
            })()}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 20, marginTop: 20, borderTop: `1px solid ${VS.border}` }}>
            <button type="button" onClick={onClose} style={{ background: VS.bg3, color: VS.text1, border: `1px solid ${VS.border}`, borderRadius: 8, padding: '8px 18px', fontSize: 14, cursor: 'pointer' }}>
              Cancel
            </button>
            <button type="submit" disabled={saving || !userName || !selectedProject || !description}
              style={{ background: VS.accent, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 18px', fontSize: 14, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving || !userName || !selectedProject || !description ? 0.5 : 1, display: 'flex', alignItems: 'center', gap: 7 }}>
              <Save size={15} />{saving ? 'Saving…' : 'Submit Report'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export function Reports() {
  const { data: session } = useSession();
  const { currentOrg }    = useOrganization();
  const apiClient         = useApiClient();

  const [reports, setReports]           = useState<Report[]>([]);
  const [analytics, setAnalytics]       = useState<Analytics>({ total: 0, thisWeek: 0, uniqueProjects: 0, uniqueMembers: 0 });
  const [projects, setProjects]         = useState<ProjectItem[]>([]);
  const [members, setMembers]           = useState<MemberItem[]>([]);
  const [isPrivileged, setIsPrivileged] = useState(false);
  const [userRole, setUserRole]         = useState('STAFF');
  const [loading, setLoading]           = useState(true);
  const [showModal, setShowModal]       = useState(false);

  // Filters
  const [search, setSearch]                 = useState('');
  const [filterProject, setFilterProject]   = useState('');
  const [filterMember, setFilterMember]     = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo]     = useState('');

  // ── Fetch reports + metadata ───────────────────────────────────────────────
  const fetchReports = useCallback(async () => {
    if (!session?.user?.id || !currentOrg?.id) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ orgId: currentOrg.id, limit: '200' });
      if (filterProject)  params.set('projectId', filterProject);
      if (filterMember)   params.set('memberId',  filterMember);
      if (filterDateFrom) params.set('dateFrom',  filterDateFrom);
      if (filterDateTo)   params.set('dateTo',    filterDateTo);
      if (search)         params.set('search',    search);

      const data = await apiClient.fetch(`/api/user-reports?${params}`);
      if (data.success) {
        setReports(data.reports || []);
        setAnalytics(data.analytics || { total: 0, thisWeek: 0, uniqueProjects: 0, uniqueMembers: 0 });
        setProjects(data.projects  || []);
        setMembers(data.members    || []);
        setIsPrivileged(data.isPrivileged ?? false);
        setUserRole(data.role ?? 'STAFF');
      }
    } catch (err) {
      console.error('Error fetching reports:', err);
    } finally {
      setLoading(false);
    }
  }, [session?.user?.id, currentOrg?.id, filterProject, filterMember, filterDateFrom, filterDateTo, search]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchReports(); }, [fetchReports]);

  // ── Create ────────────────────────────────────────────────────────────────
  const handleSave = async (reportData: any) => {
    const projectName = projects.find(p => p.id === reportData.projectId)?.name;
    const data = await apiClient.fetch('/api/user-reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title:       projectName ? `${projectName} — Report` : 'Project Report',
        description: reportData.description,
        userName:    reportData.userName,
        image:       reportData.image,
        projectId:   reportData.projectId,
      }),
    });
    if (!data.success) throw new Error(data.error || 'Failed to save');
    await fetchReports();
  };

  // ── Delete ────────────────────────────────────────────────────────────────
  const handleDelete = async (id: string) => {
    if (!confirm('Delete this report? This cannot be undone.')) return;
    try {
      const data = await apiClient.fetch(`/api/user-reports/${id}`, { method: 'DELETE' });
      if (data.success) await fetchReports();
      else alert(data.error || 'Failed to delete');
    } catch (err: any) {
      alert(err.message || 'Failed to delete');
    }
  };

  const clearFilters = () => {
    setSearch(''); setFilterProject(''); setFilterMember('');
    setFilterDateFrom(''); setFilterDateTo('');
  };
  const hasFilters = !!(search || filterProject || filterMember || filterDateFrom || filterDateTo);

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: VS.text0 }}>Reports</h1>
          <p className="text-[13px] mt-1" style={{ color: VS.text2 }}>
            {isPrivileged
              ? `All team reports · ${userRole.charAt(0) + userRole.slice(1).toLowerCase()} view`
              : 'Your submitted reports'}
          </p>
        </div>
        <button onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-semibold"
          style={{ background: VS.accent, color: '#fff', border: 'none', cursor: 'pointer' }}>
          <Plus size={15} />New Report
        </button>
      </div>

      {/* ── Analytics strip ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Reports"    value={analytics.total}          sub="all time"          icon={FileText}   color={VS.blue}   />
        <StatCard label="This Week"        value={analytics.thisWeek}       sub="reports submitted" icon={Clock}      color={VS.teal}   />
        <StatCard label="Projects Covered" value={analytics.uniqueProjects} sub="with reports"      icon={FolderOpen} color={VS.orange} />
        {isPrivileged
          ? <StatCard label="Contributors" value={analytics.uniqueMembers} sub="team members"  icon={Users}      color={VS.purple} />
          : <StatCard label="Your Reports" value={analytics.total}         sub="submitted by you" icon={TrendingUp} color={VS.yellow} />
        }
      </div>

      {/* ── Filters ── */}
      <div className="rounded-xl p-4 space-y-3" style={{ background: VS.bg1, border: `1px solid ${VS.border}` }}>

        {/* Row 1: search + dropdowns */}
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-2.5 h-4 w-4" style={{ color: VS.text2 }} />
            <input type="text" placeholder="Search reports…" value={search} onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-lg text-[13px] outline-none"
              style={{ background: VS.bg2, border: `1px solid ${VS.border}`, color: VS.text0 }} />
          </div>

          <select value={filterProject} onChange={e => setFilterProject(e.target.value)}
            className="px-3 py-2 rounded-lg text-[13px] outline-none"
            style={{ background: VS.bg2, border: `1px solid ${VS.border}`, color: filterProject ? VS.text0 : VS.text2 }}>
            <option value="">All Projects</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>

          {isPrivileged && (
            <select value={filterMember} onChange={e => setFilterMember(e.target.value)}
              className="px-3 py-2 rounded-lg text-[13px] outline-none"
              style={{ background: VS.bg2, border: `1px solid ${VS.border}`, color: filterMember ? VS.text0 : VS.text2 }}>
              <option value="">All Members</option>
              {members.map(m => <option key={m.id} value={m.id}>{m.name} ({m.role.toLowerCase()})</option>)}
            </select>
          )}
        </div>

        {/* Row 2: date range + clear */}
        <div className="flex flex-wrap gap-3 items-center">
          <Calendar size={14} style={{ color: VS.text2 }} />
          <span className="text-[12px]" style={{ color: VS.text2 }}>Date range:</span>
          <input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)}
            style={{ background: VS.bg2, border: `1px solid ${VS.border}`, borderRadius: 8, padding: '5px 10px', color: VS.text0, fontSize: 12, outline: 'none', colorScheme: 'dark' }} />
          <span style={{ color: VS.text2, fontSize: 12 }}>→</span>
          <input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)}
            style={{ background: VS.bg2, border: `1px solid ${VS.border}`, borderRadius: 8, padding: '5px 10px', color: VS.text0, fontSize: 12, outline: 'none', colorScheme: 'dark' }} />
          {hasFilters && (
            <button onClick={clearFilters}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px]"
              style={{ background: VS.bg3, color: VS.text2, border: `1px solid ${VS.border}`, cursor: 'pointer' }}>
              <X size={12} />Clear
            </button>
          )}
        </div>
      </div>

      {/* ── Content ── */}
      {loading ? (
        <div className="flex flex-col items-center py-16 gap-3" style={{ background: VS.bg1, borderRadius: 12, border: `1px solid ${VS.border}` }}>
          <div className="w-7 h-7 rounded-full border-2 animate-spin" style={{ borderColor: `${VS.accent}44`, borderTopColor: VS.accent }} />
          <span className="text-[13px]" style={{ color: VS.text2 }}>Loading reports…</span>
        </div>

      ) : reports.length === 0 ? (
        <div className="flex flex-col items-center py-16 gap-3" style={{ background: VS.bg1, borderRadius: 12, border: `1px solid ${VS.border}` }}>
          <FileText size={44} style={{ color: VS.text2, opacity: 0.4 }} />
          <p className="text-[15px] font-semibold" style={{ color: VS.text1 }}>
            {hasFilters ? 'No reports match your filters' : 'No reports yet'}
          </p>
          <p className="text-[13px]" style={{ color: VS.text2 }}>
            {hasFilters ? 'Try adjusting or clearing your filters' : 'Create the first report to get started'}
          </p>
          {hasFilters
            ? <button onClick={clearFilters} className="mt-1 px-4 py-2 rounded-lg text-[13px] font-semibold"
                style={{ background: VS.bg3, color: VS.text1, border: `1px solid ${VS.border}`, cursor: 'pointer' }}>Clear Filters</button>
            : <button onClick={() => setShowModal(true)} className="mt-1 flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-semibold"
                style={{ background: `${VS.accent}18`, color: VS.accent, border: `1px solid ${VS.accent}33`, cursor: 'pointer' }}>
                <Plus size={14} />Create Report</button>
          }
        </div>

      ) : (
        <>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: VS.text2 }}>
              {reports.length} report{reports.length !== 1 ? 's' : ''}{hasFilters ? ' · filtered' : ''}
            </span>
          </div>

          <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
            {reports.map(report => {
              const projectColor = getColor(report.project?.color);
              const displayName  = report.user?.name || report.userName;
              const isOwn        = report.user?.id === session?.user?.id;

              return (
                <div key={report.id} className="rounded-xl overflow-hidden"
                  style={{ background: VS.bg1, border: `1px solid ${VS.border}`, position: 'relative' }}>

                  {/* Project color accent bar */}
                  <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: 3, background: projectColor }} />

                  {/* Top */}
                  <div style={{ padding: '13px 15px 10px 18px', borderBottom: `1px solid ${VS.border}`, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {report.project && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
                          <div style={{ width: 7, height: 7, borderRadius: '50%', background: projectColor, flexShrink: 0 }} />
                          <span style={{ fontSize: 10, fontWeight: 700, color: projectColor, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                            {report.project.name}
                          </span>
                          <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 3, background: `${VS.teal}18`, color: VS.teal, border: `1px solid ${VS.teal}30`, textTransform: 'capitalize', marginLeft: 'auto' }}>
                            {report.project.status}
                          </span>
                        </div>
                      )}
                      <div style={{ fontSize: 14, fontWeight: 600, color: VS.text0 }}>
                        {report.title || 'Project Report'}
                      </div>
                    </div>
                    {(isPrivileged || isOwn) && (
                      <button onClick={() => handleDelete(report.id)}
                        style={{ background: 'transparent', border: 'none', color: VS.text2, cursor: 'pointer', padding: 4, borderRadius: 6, display: 'flex', alignItems: 'center', flexShrink: 0 }}
                        onMouseEnter={e => (e.currentTarget.style.color = VS.red)}
                        onMouseLeave={e => (e.currentTarget.style.color = VS.text2)}>
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>

                  {/* Body */}
                  <div style={{ padding: '11px 15px 13px 18px' }}>

                    {/* Submitter + timestamp */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                      <Avatar name={displayName} image={report.user?.image} size={24} />
                      <span style={{ fontSize: 12, fontWeight: 600, color: VS.text1, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {displayName}
                        {isPrivileged && !isOwn && (
                          <span style={{ fontSize: 10, marginLeft: 5, padding: '1px 5px', borderRadius: 3, background: `${VS.blue}18`, color: VS.blue, border: `1px solid ${VS.blue}25` }}>team</span>
                        )}
                      </span>
                      <span style={{ fontSize: 11, color: VS.text2, flexShrink: 0 }}>{fmtRelative(report.createdAt)}</span>
                    </div>

                    {/* Description */}
                    <div style={{ fontSize: 13, color: VS.text1, lineHeight: 1.55, background: VS.bg2, borderRadius: 6, padding: '8px 10px', marginBottom: report.image ? 10 : 0 }}>
                      {report.description.length > 150
                        ? `${report.description.slice(0, 150)}…`
                        : report.description}
                    </div>

                    {/* Attached image */}
                    {report.image && (
                      <div style={{ marginTop: 10 }}>
                        <img src={report.image} alt="Attachment"
                          style={{ width: '100%', maxHeight: 180, objectFit: 'contain', borderRadius: 6, border: `1px solid ${VS.border}`, cursor: 'zoom-in' }}
                          onClick={() => window.open(report.image!, '_blank')} />
                      </div>
                    )}

                    {/* Footer */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, paddingTop: 8, borderTop: `1px solid ${VS.border}` }}>
                      <span style={{ fontSize: 11, color: VS.text2, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Calendar size={11} />{fmtDate(report.createdAt)}
                      </span>
                      {report.project?.budget && (
                        <span style={{ fontSize: 11, color: VS.text2 }}>
                          Budget: <strong style={{ color: VS.text1 }}>${Number(report.project.budget).toLocaleString()}</strong>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ── Modal ── */}
      <ReportModal isOpen={showModal} onClose={() => setShowModal(false)} onSave={handleSave} projects={projects} />
    </div>
  );
}
