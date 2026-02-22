import { useState, useEffect } from 'react';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, Users, Clock, CheckCircle, AlertTriangle, Award, Zap } from 'lucide-react';
import './KPIReport.css';

interface KPIReportProps {
  orgId: string;
  period?: 'daily' | 'weekly' | 'monthly' | 'yearly';
  date?: string;
}

const COLORS = {
  'starPerformers': '#10b981',
  'overworked': '#f59e0b',
  'coasters': '#3b82f6',
  'underperformers': '#ef4444',
};

export function KPIReport({ orgId, period = 'weekly', date }: KPIReportProps) {
  const [reportData, setReportData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'performance' | 'projects' | 'actions'>('overview');

  useEffect(() => {
    fetchReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, period, date]);

  const fetchReport = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({
        orgId,
        period,
        ...(date && { date }),
      });
      const response = await fetch(`/api/kpi/generate?${params}`);
      if (!response.ok) throw new Error('Failed to fetch KPI report');
      const data = await response.json();
      setReportData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="kpi-loading">Loading KPI Report...</div>;
  if (error) return <div className="kpi-error">Error: {error}</div>;
  if (!reportData) return <div className="kpi-empty">No data available</div>;

  const { summary, trends, performance, projects, actionItems, reportMeta } = reportData as {
    summary: Record<string, unknown>;
    trends: Record<string, unknown>;
    performance: PerformanceData;
    projects: Array<Record<string, unknown>>;
    actionItems: Array<Record<string, unknown>>;
    reportMeta: Record<string, unknown>;
  };

  return (
    <div className="kpi-report-container">
      <div className="kpi-header">
        <div>
          <h1>KPI Report</h1>
          <p className="kpi-period">
            {String(reportMeta.period).charAt(0).toUpperCase() + String(reportMeta.period).slice(1)} Report
            <span className="kpi-date">
              {String((reportMeta.dateRange as Record<string, unknown>)?.start)} to {String((reportMeta.dateRange as Record<string, unknown>)?.end)}
            </span>
          </p>
        </div>
        <button onClick={fetchReport} className="kpi-refresh-btn">
          ↻ Refresh
        </button>
      </div>

      {/* Summary Cards */}
      <div className="kpi-summary-grid">
        <SummaryCard
          icon={<Clock className="icon" />}
          title="Total Hours"
          value={summary.totalHours as number}
          unit="hrs"
          trend={trends.hours as number}
        />
        <SummaryCard
          icon={<CheckCircle className="icon" />}
          title="Reports"
          value={summary.totalReports as number}
          trend={trends.reports as number}
        />
        <SummaryCard
          icon={<Users className="icon" />}
          title="Active Employees"
          value={summary.activeEmployees as number}
          total={summary.memberCount as number}
          trend={trends.activeEmployees as number}
        />
        <SummaryCard
          icon={<TrendingUp className="icon" />}
          title="Completion Rate"
          value={summary.completionRate as number}
          unit="%"
          trend={trends.completionRate as number}
        />
      </div>

      {/* Tab Navigation */}
      <div className="kpi-tabs">
        <button
          className={`tab ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          Overview
        </button>
        <button
          className={`tab ${activeTab === 'performance' ? 'active' : ''}`}
          onClick={() => setActiveTab('performance')}
        >
          Performance
        </button>
        <button
          className={`tab ${activeTab === 'projects' ? 'active' : ''}`}
          onClick={() => setActiveTab('projects')}
        >
          Projects
        </button>
        <button
          className={`tab ${activeTab === 'actions' ? 'active' : ''}`}
          onClick={() => setActiveTab('actions')}
        >
          Action Items ({(actionItems as Array<Record<string, unknown>>).length})
        </button>
      </div>

      {/* Tab Content */}
      <div className="kpi-content">
        {activeTab === 'overview' && (
          <OverviewTab summary={summary} projects={projects} />
        )}
        {activeTab === 'performance' && (
          <PerformanceTab performance={performance} />
        )}
        {activeTab === 'projects' && (
          <ProjectsTab projects={projects} />
        )}
        {activeTab === 'actions' && (
          <ActionsTab actionItems={actionItems} />
        )}
      </div>
    </div>
  );
}

interface SummaryCardProps {
  icon: React.ReactNode;
  title: string;
  value: number | string;
  unit?: string;
  total?: number;
  trend?: number | null;
}

function SummaryCard({ icon, title, value, unit, total, trend }: SummaryCardProps) {
  return (
    <div className="summary-card">
      <div className="card-header">
        <div className="card-icon">{icon}</div>
        <h3>{title}</h3>
      </div>
      <div className="card-value">
        {value}{unit}
      </div>
      {total && <div className="card-total">of {total}</div>}
      {trend !== undefined && trend !== null && (
        <div className={`card-trend ${trend >= 0 ? 'positive' : 'negative'}`}>
          {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}%
        </div>
      )}
    </div>
  );
}
interface OverviewTabProps {
  summary: Record<string, unknown>;
  projects: Array<Record<string, unknown>>;
}

function OverviewTab({ summary, projects }: OverviewTabProps) {
  return (
    <div className="tab-content">
      <div className="overview-grid">
        <div className="card">
          <h3>Top Project</h3>
          {summary.topProject ? (
            <div className="top-project">
              <div className="project-name">{String((summary.topProject as Record<string, unknown>)?.name)}</div>
              <div className="project-value">{String((summary.topProject as Record<string, unknown>)?.hours)} hours</div>
            </div>
          ) : (
            <p className="text-gray-500">No project data</p>
          )}
        </div>

        <div className="card">
          <h3>Hours Distribution</h3>
          {projects.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={projects.slice(0, 5)}
                  dataKey="hours"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label
                >
                  {projects.map((_: Record<string, unknown>, index: number) => (
                    <Cell key={`cell-${index}`} fill={Object.values(COLORS)[index % Object.values(COLORS).length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-gray-500">No data</p>
          )}
        </div>
      </div>

      <div className="card full-width">
        <h3>Project Hours</h3>
        {projects.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={projects.slice(0, 10)}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" angle={-45} textAnchor="end" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="hours" fill="#3b82f6" />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-gray-500">No project data</p>
        )}
      </div>
    </div>
  );
}

interface Employee {
  id: string;
  name: string;
  hours: number;
  tasksCompleted: number;
  performanceScore: number;
  [key: string]: unknown;
}

interface PerformanceData {
  starPerformers: Employee[];
  overworked: Employee[];
  coasters: Employee[];
  underperformers: Employee[];
}

function PerformanceTab({ performance }: { performance: PerformanceData }) {
  const performanceArr = [
    { name: 'Star Performers', value: (performance.starPerformers || []).length, color: COLORS.starPerformers },
    { name: 'Overworked', value: (performance.overworked || []).length, color: COLORS.overworked },
    { name: 'Coasters', value: (performance.coasters || []).length, color: COLORS.coasters },
    { name: 'Underperformers', value: (performance.underperformers || []).length, color: COLORS.underperformers },
  ];

  return (
    <div className="tab-content">
      <div className="performance-grid">
        {Object.entries(performance).map(([category, employees]) => (
          <PerformanceCard
            key={category}
            category={category}
            employees={employees as Employee[]}
          />
        ))}
      </div>

      <div className="card full-width">
        <h3>Performance Distribution</h3>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={performanceArr}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="value" fill="#3b82f6">
              {performanceArr.map((item, idx) => (
                <Cell key={idx} fill={item.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

interface PerformanceCardProps {
  category: string;
  employees: Array<{
    id: string;
    name: string;
    hours: number;
    tasksCompleted: number;
    performanceScore: number;
  }>;
}

function PerformanceCard({ category, employees }: PerformanceCardProps) {
  const categoryLabels = {
    starPerformers: { label: 'Star Performers', icon: Award },
    overworked: { label: 'Overworked', icon: Zap },
    coasters: { label: 'Coasters', icon: Users },
    underperformers: { label: 'Underperformers', icon: AlertTriangle },
  };

  const { label, icon: Icon } = categoryLabels[category as keyof typeof categoryLabels] || { label: category, icon: Users };

  return (
    <div className="performance-card">
      <div className="performance-header">
        <Icon className="icon" />
        <h3>{label}</h3>
      </div>
      <div className="count-badge">{employees.length}</div>
      <div className="employees-list">
        {employees.slice(0, 3).map((emp: Record<string, unknown>) => (
          <div key={emp.id as string | number} className="employee-item">
            <span className="name">{emp.name as string}</span>
            <span className="score">{emp.hours as number}h</span>
          </div>
        ))}
        {employees.length > 3 && (
          <div className="text-gray-500 text-sm">+{employees.length - 3} more</div>
        )}
      </div>
    </div>
  );
}

function ProjectsTab({ projects }: { projects: Array<Record<string, unknown>> }) {
  return (
    <div className="tab-content">
      <div className="card full-width">
        <h3>Project Hours Comparison</h3>
        {projects.length > 0 ? (
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={projects}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
              <YAxis />
              <Tooltip />
              <Bar dataKey="hours" fill="#3b82f6" />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-gray-500">No project data</p>
        )}
      </div>

      <div className="projects-table">
        <table>
          <thead>
            <tr>
              <th>Project</th>
              <th>Hours</th>
              <th>Tasks</th>
              <th>Contributors</th>
            </tr>
          </thead>
          <tbody>
            {projects.map((project: Record<string, unknown>) => (
              <tr key={project.id as string | number}>
                <td className="project-name">{project.name as string}</td>
                <td>{(project.hours as number).toFixed(1)}h</td>
                <td>{project.tasksCount as number}</td>
                <td>{project.contributors as number}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ActionsTab({ actionItems }: { actionItems: Array<Record<string, unknown>> }) {
  if (actionItems.length === 0) {
    return (
      <div className="tab-content">
        <div className="card full-width">
          <p className="text-green-600 text-center py-8">✓ No action items required</p>
        </div>
      </div>
    );
  }

  return (
    <div className="tab-content">
        {actionItems.map((item: Record<string, unknown>, idx: number) => (
        <div key={idx} className={`action-card severity-${String(item.severity)}`}>
          <div className="action-header">
            <span className="action-type">{String(item.type)}</span>
            <span className={`severity ${String(item.severity)}`}>{String(item.severity)}</span>
          </div>
          <div className="action-content">
            <h4>{String((item.employee as Record<string, unknown>)?.name)}</h4>
            <p className="employee-email">{String((item.employee as Record<string, unknown>)?.email)}</p>
            <div className="reasons">
              <h5>Issues:</h5>
              <ul>
                {(item.reasons as string[]).map((reason: string, i: number) => (
                  <li key={i}>{reason}</li>
                ))}
              </ul>
            </div>
            <p className="recommendation">
              <strong>Recommendation:</strong> {String(item.recommendation)}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
