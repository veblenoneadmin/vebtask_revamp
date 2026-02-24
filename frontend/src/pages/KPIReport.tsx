import { useState, useEffect, useCallback } from 'react';
import { useSession } from '../lib/auth-client';
import { useOrganization } from '../contexts/OrganizationContext';
import { useApiClient } from '../lib/api-client';
import {
  Star, TrendingUp, TrendingDown, Minus, AlertTriangle, Coffee,
  Users, Clock, CheckSquare, Target, BarChart3,
  Download, RefreshCw, ChevronDown, DollarSign,
  Flame, AlertCircle, Eye, EyeOff, ChevronUp
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
interface UserKPI {
  user: { id: string; name: string; email: string; image?: string };
  role: string;
  currentHours: number;
  previousHours: number;
  hoursTrend: number | null;
  utilizationRate: number;
  completedTasks: number;
  inProgressTasks: number;
  totalTasks: number;
  overdueTaskCount: number;
  taskCompletionRate: number;
  billableHours: number;
  billableRatio: number;
  estimationAccuracy: number | null;
  sessionCount: number;
  avgSessionLength: number;
  activeDays: number;
  classification: 'star' | 'overworked' | 'underperformer' | 'coaster' | 'solid' | 'inactive' | 'client';
  classificationReason: string;
  score: number | null;
}

interface ProjectHealth {
  id: string; name: string; status: string; color: string;
  budget: number; spent: number; budgetUsed: number | null;
  estimatedHours: number; hoursLogged: number; hoursUsed: number | null;
  progress: number; isOverBudget: boolean; isOverTime: boolean;
  taskCount: number; completedTaskCount: number;
}

interface OrgKPIs {
  totalHours: number; previousHours: number; hoursTrend: number | null;
  totalCompleted: number; totalTasks: number; totalOverdue: number;
  taskCompletionRate: number; billableHours: number; billableRatio: number;
  activeMembers: number; totalMembers: number;
  classificationCounts: Record<string, number>;
}

interface KPIData {
  period: string; label: string;
  dateRange: { start: string; end: string };
  orgKPIs: OrgKPIs;
  users: UserKPI[];
  projectHealth: ProjectHealth[];
}

type Period = 'daily' | 'weekly' | 'monthly';

// ─── Classification Config ────────────────────────────────────────────────────
const CLASSIFICATIONS: Record<string, {
  label: string; color: string; bg: string; border: string;
  icon: React.ElementType; glow: string;
}> = {
  star:           { label: 'Star Performer', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)',  border: 'rgba(245,158,11,0.3)',  icon: Star,         glow: '0 0 20px rgba(245,158,11,0.3)' },
  overworked:     { label: 'Overworked',     color: '#ef4444', bg: 'rgba(239,68,68,0.12)',   border: 'rgba(239,68,68,0.3)',   icon: Flame,        glow: '0 0 20px rgba(239,68,68,0.25)' },
  underperformer: { label: 'Underperformer', color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)',  border: 'rgba(139,92,246,0.3)',  icon: TrendingDown, glow: '' },
  coaster:        { label: 'Coasting',       color: '#64748b', bg: 'rgba(100,116,139,0.12)', border: 'rgba(100,116,139,0.3)', icon: Coffee,       glow: '' },
  solid:          { label: 'Solid',          color: '#22c55e', bg: 'rgba(34,197,94,0.12)',   border: 'rgba(34,197,94,0.3)',   icon: CheckSquare,  glow: '' },
  inactive:       { label: 'Inactive',       color: '#475569', bg: 'rgba(71,85,105,0.10)',   border: 'rgba(71,85,105,0.25)', icon: AlertCircle,  glow: '' },
  client:         { label: 'Client',         color: '#38bdf8', bg: 'rgba(56,189,248,0.10)',  border: 'rgba(56,189,248,0.25)', icon: Eye,          glow: '' },
};

// ─── Small Components ─────────────────────────────────────────────────────────
function TrendBadge({ value }: { value: number | null }) {
  if (value === null) return <span style={{ color: '#64748b', fontSize: 12 }}>—</span>;
  const isUp = value > 0;
  const isFlat = value === 0;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, fontSize: 12, fontWeight: 600, color: isFlat ? '#64748b' : isUp ? '#22c55e' : '#ef4444' }}>
      {isFlat ? <Minus size={11} /> : isUp ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
      {Math.abs(value)}%
    </span>
  );
}

function MiniBar({ value, color = '#6366f1' }: { value: number; color?: string }) {
  return (
    <div style={{ width: '100%', height: 4, background: 'rgba(255,255,255,0.07)', borderRadius: 2, overflow: 'hidden' }}>
      <div style={{ width: `${Math.min(100, value)}%`, height: '100%', background: color, borderRadius: 2, transition: 'width 0.6s ease' }} />
    </div>
  );
}

function Avatar({ name, image, size = 36 }: { name: string; image?: string; size?: number }) {
  const initials = name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '?';
  const colors = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#22c55e', '#06b6d4'];
  const colorIndex = (name?.charCodeAt(0) ?? 0) % colors.length;
  return image ? (
    <img src={image} alt={name} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
  ) : (
    <div style={{ width: size, height: size, borderRadius: '50%', background: colors[colorIndex], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.35, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
      {initials}
    </div>
  );
}

function ScoreRing({ score }: { score: number }) {
  const radius = 20;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = score >= 80 ? '#f59e0b' : score >= 60 ? '#22c55e' : score >= 40 ? '#64748b' : '#ef4444';
  return (
    <div style={{ position: 'relative', width: 52, height: 52, flexShrink: 0 }}>
      <svg width="52" height="52" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="26" cy="26" r={radius} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="3.5" />
        <circle cx="26" cy="26" r={radius} fill="none" stroke={color} strokeWidth="3.5"
          strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.8s ease' }} />
      </svg>
      <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color }}>
        {score}
      </span>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function KPIReport() {
  useSession(); // required for auth context, value unused
  const { currentOrg } = useOrganization();
  const apiClient = useApiClient();

  const [period, setPeriod] = useState<Period>('weekly');
  const [data, setData] = useState<KPIData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [filterClass, setFilterClass] = useState<string | null>(null);
  const [showClients, setShowClients] = useState(false);
  const [sortBy, setSortBy] = useState<'score' | 'hours' | 'completion'>('score');

  const fetchData = useCallback(async () => {
    if (!currentOrg?.id) return;
    setLoading(true);
    setError(null);
    try {
      const result = await apiClient.fetch(`/api/kpi-report?orgId=${currentOrg.id}&period=${period}`);
      setData(result);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load KPI data');
    } finally {
      setLoading(false);
    }
  }, [currentOrg?.id, period]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Style helpers ─────────────────────────────────────────────────────────
  const periodBtnStyle = (active: boolean): React.CSSProperties => ({
    padding: '6px 18px', borderRadius: 8,
    border: active ? '1px solid #6366f1' : '1px solid rgba(255,255,255,0.1)',
    background: active ? 'rgba(99,102,241,0.15)' : 'transparent',
    color: active ? '#a5b4fc' : '#64748b',
    fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s',
  });

  const classCardStyle = (key: string, active: boolean): React.CSSProperties => ({
    borderRadius: 12, padding: '12px 14px', cursor: 'pointer', transition: 'all 0.2s',
    background: active ? (CLASSIFICATIONS[key]?.bg ?? 'hsl(240 6% 10%)') : 'hsl(240 6% 10%)',
    border: `1px solid ${active ? (CLASSIFICATIONS[key]?.border ?? 'rgba(255,255,255,0.07)') : 'rgba(255,255,255,0.07)'}`,
    boxShadow: active ? (CLASSIFICATIONS[key]?.glow ?? 'none') : 'none',
  });

  const userCardStyle = (u: UserKPI): React.CSSProperties => ({
    background: 'hsl(240 6% 10%)', borderRadius: 14,
    border: `1px solid ${CLASSIFICATIONS[u.classification]?.border ?? 'rgba(255,255,255,0.07)'}`,
    marginBottom: 10, overflow: 'hidden', transition: 'border-color 0.2s',
  });

  // ── Derived data ──────────────────────────────────────────────────────────
  const filteredUsers = (data?.users ?? [])
    .filter(u => showClients || u.classification !== 'client')
    .filter(u => !filterClass || u.classification === filterClass)
    .sort((a, b) => {
      if (sortBy === 'score') return (b.score ?? 0) - (a.score ?? 0);
      if (sortBy === 'hours') return b.currentHours - a.currentHours;
      return b.taskCompletionRate - a.taskCompletionRate;
    });

  const kpi = data?.orgKPIs;

  const handleExport = () => {
    if (!data) return;
    const rows = [
      ['Name', 'Role', 'Classification', 'Score', 'Hours', 'Utilization%', 'Tasks Completed', 'Completion%', 'Overdue', 'Billable%', 'Notes'],
      ...data.users.map(u => [
        u.user.name, u.role, u.classification, String(u.score ?? ''), String(u.currentHours),
        String(u.utilizationRate), String(u.completedTasks), String(u.taskCompletionRate),
        String(u.overdueTaskCount), String(u.billableRatio), u.classificationReason,
      ]),
    ];
    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kpi-report-${period}-${(data.label ?? '').replace(/\s+/g, '-')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Loading / error ───────────────────────────────────────────────────────
  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
      <div style={{ textAlign: 'center' }}>
        <style>{`@keyframes kpi-spin { to { transform: rotate(360deg); } }`}</style>
        <div style={{ width: 44, height: 44, border: '3px solid #6366f1', borderTopColor: 'transparent', borderRadius: '50%', animation: 'kpi-spin 0.8s linear infinite', margin: '0 auto 16px' }} />
        <div style={{ color: '#64748b', fontSize: 14 }}>Loading intelligence report…</div>
      </div>
    </div>
  );

  if (error) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
      <div style={{ textAlign: 'center', color: '#ef4444' }}>
        <AlertTriangle size={40} style={{ margin: '0 auto 12px' }} />
        <div style={{ fontSize: 15 }}>{error}</div>
        <button onClick={fetchData} style={{ marginTop: 16, ...periodBtnStyle(true) }}>Retry</button>
      </div>
    </div>
  );

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ fontFamily: '"DM Sans", "Inter", sans-serif', color: '#e2e8f0', paddingBottom: 60 }}>
      <link href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />

      {/* Header */}
      <div style={{ borderBottom: '1px solid rgba(255,255,255,0.07)', paddingBottom: 20, marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <BarChart3 size={22} style={{ color: '#6366f1' }} />
              <h1 style={{ fontFamily: '"Syne", sans-serif', fontSize: 24, fontWeight: 800, letterSpacing: '-0.5px', color: '#f8fafc', margin: 0 }}>
                KPI Intelligence Report
              </h1>
            </div>
            <div style={{ fontSize: 13, color: '#64748b' }}>
              {data?.label} · {currentOrg?.name} · Auto-classifying team performance
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: 6, background: 'hsl(240 6% 10%)', padding: 4, borderRadius: 10, border: '1px solid rgba(255,255,255,0.07)' }}>
              {(['daily', 'weekly', 'monthly'] as Period[]).map(p => (
                <button key={p} style={periodBtnStyle(period === p)} onClick={() => setPeriod(p)}>
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </button>
              ))}
            </div>
            <button onClick={fetchData} style={{ background: 'hsl(240 6% 10%)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, padding: '7px 10px', color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
              <RefreshCw size={15} />
            </button>
            <button onClick={handleExport} style={{ background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 8, padding: '7px 14px', color: '#a5b4fc', cursor: 'pointer', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Download size={14} /> Export CSV
            </button>
          </div>
        </div>
      </div>

      {/* Org KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 28 }}>
        {([
          { icon: Clock,        label: 'Total Hours',     value: `${kpi?.totalHours ?? 0}h`,           trend: kpi?.hoursTrend ?? null, color: '#6366f1' },
          { icon: CheckSquare,  label: 'Tasks Completed', value: `${kpi?.totalCompleted ?? 0}`,         trend: null,                   color: '#22c55e' },
          { icon: Target,       label: 'Completion Rate', value: `${kpi?.taskCompletionRate ?? 0}%`,    trend: null,                   color: '#f59e0b' },
          { icon: AlertTriangle,label: 'Overdue Tasks',   value: `${kpi?.totalOverdue ?? 0}`,           trend: null,                   color: '#ef4444' },
          { icon: DollarSign,   label: 'Billable Hours',  value: `${kpi?.billableHours ?? 0}h`,         trend: null,                   color: '#06b6d4' },
          { icon: Users,        label: 'Active Members',  value: `${kpi?.activeMembers ?? 0}/${kpi?.totalMembers ?? 0}`, trend: null, color: '#8b5cf6' },
        ] as Array<{ icon: React.ElementType; label: string; value: string; trend: number | null; color: string }>).map(({ icon: Icon, label, value, trend, color }) => (
          <div key={label} style={{ background: 'hsl(240 6% 10%)', borderRadius: 14, border: '1px solid rgba(255,255,255,0.07)', padding: '18px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={{ width: 34, height: 34, borderRadius: 9, background: `${color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon size={16} style={{ color }} />
              </div>
              {trend !== null && <TrendBadge value={trend} />}
            </div>
            <div style={{ fontSize: 28, fontWeight: 800, fontFamily: '"Syne", sans-serif', lineHeight: 1, color: '#f8fafc' }}>{value}</div>
            <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#475569', marginTop: 6 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Classification Summary */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#475569', marginBottom: 14 }}>Performance Classification</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 10 }}>
          {Object.entries(CLASSIFICATIONS).filter(([k]) => k !== 'client').map(([key, cfg]) => {
            const count = kpi?.classificationCounts?.[key] ?? 0;
            const Icon = cfg.icon;
            const isActive = filterClass === key;
            return (
              <div key={key} style={classCardStyle(key, isActive)} onClick={() => setFilterClass(isActive ? null : key)}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6 }}>
                  <Icon size={14} style={{ color: cfg.color }} />
                  <span style={{ fontSize: 10, fontWeight: 700, color: cfg.color, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{cfg.label}</span>
                </div>
                <div style={{ fontSize: 26, fontWeight: 800, color: '#f8fafc', fontFamily: '"Syne", sans-serif', lineHeight: 1 }}>{count}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#475569' }}>
          Team Members ({filteredUsers.length})
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: '#475569', fontWeight: 600 }}>Sort:</span>
          {(['score', 'hours', 'completion'] as const).map(s => (
            <button key={s} onClick={() => setSortBy(s)} style={{ fontSize: 12, fontWeight: 600, padding: '4px 10px', borderRadius: 6, cursor: 'pointer', border: sortBy === s ? '1px solid #6366f1' : '1px solid rgba(255,255,255,0.08)', background: sortBy === s ? 'rgba(99,102,241,0.12)' : 'transparent', color: sortBy === s ? '#a5b4fc' : '#475569' }}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
          <button onClick={() => setShowClients(!showClients)} style={{ fontSize: 12, fontWeight: 600, padding: '4px 10px', borderRadius: 6, cursor: 'pointer', border: '1px solid rgba(255,255,255,0.08)', background: 'transparent', color: '#475569', display: 'flex', alignItems: 'center', gap: 5 }}>
            {showClients ? <EyeOff size={12} /> : <Eye size={12} />} Clients
          </button>
        </div>
      </div>

      {/* User Cards */}
      <div style={{ marginBottom: 36 }}>
        {filteredUsers.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#475569' }}>No members match the selected filter.</div>
        )}
        {filteredUsers.map(u => {
          const cfg = CLASSIFICATIONS[u.classification];
          const Icon = cfg.icon;
          const isExpanded = expandedUser === u.user.id;
          return (
            <div key={u.user.id} style={userCardStyle(u)}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px', cursor: 'pointer' }} onClick={() => setExpandedUser(isExpanded ? null : u.user.id)}>
                <Avatar name={u.user.name || u.user.email} image={u.user.image} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: '#f1f5f9', fontFamily: '"Syne", sans-serif' }}>
                      {u.user.name || u.user.email}
                    </span>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.color, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Icon size={10} /> {cfg.label}
                    </span>
                    <span style={{ fontSize: 11, color: '#475569' }}>{u.role}</span>
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 3 }}>{u.classificationReason}</div>
                  <div style={{ marginTop: 8 }}><MiniBar value={u.utilizationRate} color={cfg.color} /></div>
                </div>
                <div style={{ display: 'flex', gap: 20, alignItems: 'center', flexShrink: 0 }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 16, fontWeight: 800, color: '#f1f5f9', fontFamily: '"Syne", sans-serif' }}>{u.currentHours}h</div>
                    <TrendBadge value={u.hoursTrend} />
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 16, fontWeight: 800, color: '#f1f5f9', fontFamily: '"Syne", sans-serif' }}>{u.taskCompletionRate}%</div>
                    <div style={{ fontSize: 10, color: '#475569' }}>Done</div>
                  </div>
                  {u.score !== null && <ScoreRing score={u.score} />}
                  <div style={{ color: '#475569' }}>{isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</div>
                </div>
              </div>

              {isExpanded && (
                <div style={{ padding: '0 20px 18px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12, marginTop: 14 }}>
                    {([
                      { label: 'Utilization',    value: `${u.utilizationRate}%`,  sub: 'vs expected hours',       color: u.utilizationRate >= 90 ? '#22c55e' : u.utilizationRate >= 70 ? '#f59e0b' : '#ef4444' },
                      { label: 'Completed',      value: `${u.completedTasks}`,    sub: `of ${u.totalTasks} total`, color: '#6366f1' },
                      { label: 'Overdue',        value: `${u.overdueTaskCount}`,  sub: 'tasks past due',          color: u.overdueTaskCount > 0 ? '#ef4444' : '#22c55e' },
                      { label: 'Billable',       value: `${u.billableRatio}%`,    sub: `${u.billableHours}h`,     color: '#06b6d4' },
                      { label: 'Avg Session',    value: `${u.avgSessionLength}h`, sub: `${u.sessionCount} sessions`, color: '#8b5cf6' },
                      { label: 'Active Days',    value: `${u.activeDays}`,        sub: 'days with logs',          color: '#f59e0b' },
                      { label: 'In Progress',    value: `${u.inProgressTasks}`,   sub: 'active tasks',            color: '#38bdf8' },
                      ...(u.estimationAccuracy !== null ? [{ label: 'Est. Accuracy', value: `${u.estimationAccuracy}%`, sub: 'estimate accuracy', color: (u.estimationAccuracy ?? 0) >= 80 ? '#22c55e' : '#f59e0b' }] : []),
                    ] as Array<{ label: string; value: string; sub: string; color: string }>).map(({ label, value, sub, color }) => (
                      <div key={label} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: '10px 14px', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <div style={{ fontSize: 20, fontWeight: 800, color, fontFamily: '"Syne", sans-serif', lineHeight: 1 }}>{value}</div>
                        <div style={{ fontSize: 11, fontWeight: 600, color: '#cbd5e1', marginTop: 4 }}>{label}</div>
                        <div style={{ fontSize: 10, color: '#475569', marginTop: 2 }}>{sub}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Project Health */}
      {(data?.projectHealth ?? []).length > 0 && (
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#475569', marginBottom: 14 }}>Project Health</div>
          {(data?.projectHealth ?? []).map(p => (
            <div key={p.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', alignItems: 'center', gap: 16, padding: '14px 18px', background: 'hsl(240 6% 10%)', borderRadius: 12, marginBottom: 8, border: `1px solid ${p.isOverBudget || p.isOverTime ? 'rgba(239,68,68,0.3)' : 'rgba(255,255,255,0.07)'}` }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: p.color, flexShrink: 0 }} />
                  <span style={{ fontWeight: 600, fontSize: 14, color: '#f1f5f9' }}>{p.name}</span>
                  {p.isOverBudget && <span style={{ fontSize: 10, background: 'rgba(239,68,68,0.15)', color: '#ef4444', padding: '2px 7px', borderRadius: 10, fontWeight: 700 }}>Over Budget</span>}
                  {p.isOverTime && <span style={{ fontSize: 10, background: 'rgba(245,158,11,0.15)', color: '#f59e0b', padding: '2px 7px', borderRadius: 10, fontWeight: 700 }}>Over Time</span>}
                </div>
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                  {p.hoursUsed !== null && (
                    <div style={{ width: 120 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#64748b', marginBottom: 3 }}>
                        <span>{p.hoursLogged}h / {p.estimatedHours}h</span><span>{p.hoursUsed}%</span>
                      </div>
                      <MiniBar value={p.hoursUsed} color={p.hoursUsed > 100 ? '#ef4444' : '#6366f1'} />
                    </div>
                  )}
                  {p.budgetUsed !== null && (
                    <div style={{ width: 120 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#64748b', marginBottom: 3 }}>
                        <span>${p.spent} / ${p.budget}</span><span>{p.budgetUsed}%</span>
                      </div>
                      <MiniBar value={p.budgetUsed} color={p.budgetUsed > 100 ? '#ef4444' : '#22c55e'} />
                    </div>
                  )}
                </div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#f8fafc', fontFamily: '"Syne", sans-serif' }}>{p.progress}%</div>
                <div style={{ fontSize: 10, color: '#475569' }}>Progress</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#f8fafc' }}>{p.completedTaskCount}/{p.taskCount}</div>
                <div style={{ fontSize: 10, color: '#475569' }}>Tasks</div>
              </div>
              <div>
                <span style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 8, textTransform: 'capitalize', background: p.status === 'active' ? 'rgba(34,197,94,0.12)' : p.status === 'completed' ? 'rgba(99,102,241,0.12)' : 'rgba(100,116,139,0.12)', color: p.status === 'active' ? '#22c55e' : p.status === 'completed' ? '#a5b4fc' : '#64748b' }}>
                  {p.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default KPIReport;
