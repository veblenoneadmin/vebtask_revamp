import { useState, useEffect } from 'react';
import { useSession } from '../lib/auth-client';
import { useApiClient } from '../lib/api-client';
import { useOrganization } from '../contexts/OrganizationContext';
import {
  FileText,
  Plus,
  Users,
  Target,
  X,
  Save,
  Building2,
  Trash2,
  Calendar,
} from 'lucide-react';
import { createPortal } from 'react-dom';

const VS = {
  bg0: '#1e1e1e', bg1: '#252526', bg2: '#2d2d2d', bg3: '#333333',
  border: '#3c3c3c', text0: '#f0f0f0', text1: '#c0c0c0', text2: '#909090',
  blue: '#569cd6', teal: '#4ec9b0', yellow: '#dcdcaa', orange: '#ce9178',
  purple: '#c586c0', red: '#f44747', green: '#6a9955', accent: '#007acc',
};

interface Project {
  id: string;
  name: string;
  description: string;
  status: string;
  budget?: number;
  spent?: number;
  completion?: number;
  color: string;
}

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (report: any) => void;
}

function ReportModal({ isOpen, onClose, onSave }: ReportModalProps) {
  const { data: session } = useSession();
  const { currentOrg } = useOrganization();
  const apiClient = useApiClient();
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState('');
  const [userName, setUserName] = useState('');
  const [description, setDescription] = useState('');
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && session?.user?.id) {
      fetchProjectsAndTasks();
    }
  }, [isOpen, session?.user?.id, currentOrg?.id]);

  const fetchProjectsAndTasks = async () => {
    if (!session?.user?.id) return;

    setLoading(true);
    try {
      const orgId = currentOrg?.id || 'org_1757046595553';
      console.log('🔧 Fetching projects with orgId:', orgId);

      const projectsData = await apiClient.fetch(`/api/projects?userId=${session.user.id}&orgId=${orgId}&limit=100`);

      if (projectsData.success) {
        setProjects(projectsData.projects || []);
        console.log('📊 Loaded projects for reports:', projectsData.projects?.length || 0);
      } else {
        console.warn('Failed to fetch projects:', projectsData.error);
        setProjects([]);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      setProjects([]);
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setUploadedImage(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const selectedProjectData = projects.find(p => p.id === selectedProject);

    const reportData = {
      userName,
      project: selectedProjectData,
      description,
      image: uploadedImage,
      createdAt: new Date().toISOString()
    };

    onSave(reportData);

    setSelectedProject('');
    setUserName('');
    setDescription('');
    setUploadedImage(null);
    onClose();
  };

  if (!isOpen) return null;

  const labelStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 11,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    color: VS.text2,
    marginBottom: 6,
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: VS.bg2,
    border: `1px solid ${VS.border}`,
    borderRadius: 8,
    padding: '8px 12px',
    color: VS.text0,
    fontSize: 14,
    outline: 'none',
    boxSizing: 'border-box',
  };

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.75)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: VS.bg1,
          border: `1px solid ${VS.border}`,
          borderRadius: 12,
          width: '95%',
          maxWidth: 680,
          maxHeight: '90vh',
          overflowY: 'auto',
          position: 'relative',
        }}
      >
        {/* Header */}
        <div
          style={{
            background: VS.bg2,
            borderBottom: `1px solid ${VS.border}`,
            padding: '20px 24px',
            borderRadius: '12px 12px 0 0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 8,
                background: VS.bg3,
                border: `1px solid ${VS.border}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: VS.blue,
              }}
            >
              <FileText size={18} />
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 600, color: VS.text0 }}>Create New Report</div>
              <div style={{ fontSize: 12, color: VS.text2, marginTop: 2 }}>
                Generate a report with project and task breakdown
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: VS.text2,
              cursor: 'pointer',
              padding: 6,
              borderRadius: 6,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ padding: 24 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* User Name */}
            <div>
              <label style={labelStyle}>
                <Users size={13} />
                Your Name *
              </label>
              <input
                type="text"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                required
                placeholder="Enter your name"
                style={inputStyle}
              />
            </div>

            {/* Project Selection */}
            <div>
              <label style={labelStyle}>
                <Building2 size={13} />
                Select Project *
              </label>
              <select
                value={selectedProject}
                onChange={(e) => setSelectedProject(e.target.value)}
                required
                style={inputStyle}
              >
                <option value="" style={{ background: VS.bg2 }}>Choose a project...</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id} style={{ background: VS.bg2 }}>
                    {project.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Description */}
            <div>
              <label style={labelStyle}>
                <FileText size={13} />
                Report Description *
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
                placeholder="Describe the report details, progress, issues, or any relevant information..."
                rows={4}
                style={{ ...inputStyle, resize: 'none', fontFamily: 'inherit' }}
              />
            </div>

            {/* Image Upload */}
            <div>
              <label style={labelStyle}>
                <Plus size={13} />
                Upload Screenshot/Image
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                style={{
                  ...inputStyle,
                  padding: '6px 12px',
                  cursor: 'pointer',
                  color: VS.text1,
                }}
              />
              {uploadedImage && (
                <div style={{ marginTop: 10, position: 'relative' }}>
                  <img
                    src={uploadedImage}
                    alt="Uploaded screenshot"
                    style={{
                      width: '100%',
                      maxHeight: 320,
                      objectFit: 'contain',
                      borderRadius: 8,
                      border: `1px solid ${VS.border}`,
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setUploadedImage(null)}
                    style={{
                      position: 'absolute',
                      top: 8,
                      right: 8,
                      background: VS.red,
                      border: 'none',
                      borderRadius: '50%',
                      width: 24,
                      height: 24,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#fff',
                      cursor: 'pointer',
                    }}
                  >
                    <X size={14} />
                  </button>
                </div>
              )}
            </div>

            {/* Project Breakdown */}
            {selectedProject && (
              <div>
                <label style={labelStyle}>
                  <Target size={13} />
                  Project Breakdown
                </label>
                {(() => {
                  const project = projects.find(p => p.id === selectedProject);
                  return project ? (
                    <div
                      style={{
                        background: VS.bg2,
                        border: `1px solid ${VS.border}`,
                        borderRadius: 8,
                        padding: 16,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                        <span style={{ fontWeight: 600, color: VS.text0 }}>{project.name}</span>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            padding: '2px 8px',
                            borderRadius: 4,
                            background: VS.bg3,
                            color: VS.teal,
                            border: `1px solid ${VS.border}`,
                            textTransform: 'capitalize',
                          }}
                        >
                          {project.status}
                        </span>
                      </div>
                      <p style={{ fontSize: 13, color: VS.text2, margin: '0 0 10px 0' }}>{project.description}</p>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 13 }}>
                        {project.budget !== undefined && (
                          <div>
                            <span style={{ color: VS.text2 }}>Budget: </span>
                            <span style={{ fontWeight: 600, color: VS.text0 }}>${project.budget.toLocaleString()}</span>
                          </div>
                        )}
                        {project.completion !== undefined && (
                          <div>
                            <span style={{ color: VS.text2 }}>Progress: </span>
                            <span style={{ fontWeight: 600, color: VS.text0 }}>{project.completion}%</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : null;
                })()}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 10,
              paddingTop: 20,
              marginTop: 20,
              borderTop: `1px solid ${VS.border}`,
            }}
          >
            <button
              type="button"
              onClick={onClose}
              style={{
                background: VS.bg3,
                color: VS.text1,
                border: `1px solid ${VS.border}`,
                borderRadius: 8,
                padding: '8px 18px',
                fontSize: 14,
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !userName || !selectedProject || !description}
              style={{
                background: VS.accent,
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                padding: '8px 18px',
                fontSize: 14,
                fontWeight: 600,
                cursor: loading || !userName || !selectedProject || !description ? 'not-allowed' : 'pointer',
                opacity: loading || !userName || !selectedProject || !description ? 0.5 : 1,
                display: 'flex',
                alignItems: 'center',
                gap: 7,
              }}
            >
              <Save size={15} />
              Create Report
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

export function Reports() {
  const { data: session } = useSession();
  const { currentOrg } = useOrganization();
  const apiClient = useApiClient();
  const [showReportModal, setShowReportModal] = useState(false);
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string>('');

  const fetchReports = async () => {
    if (!session?.user?.id || !currentOrg?.id) return;

    setLoading(true);
    try {
      const orgId = currentOrg.id;
      console.log('🔧 Fetching reports with orgId:', orgId);

      const data = await apiClient.fetch(`/api/user-reports?orgId=${orgId}&limit=100`);

      if (data.success) {
        setReports(data.reports || []);
        console.log('📊 Loaded reports:', data.reports?.length || 0);
      } else {
        console.warn('Failed to fetch reports:', data.error);
        setReports([]);
      }
    } catch (error) {
      console.error('Error fetching reports:', error);
      setReports([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [session?.user?.id, currentOrg?.id]);

  const handleSaveReport = async (reportData: any) => {
    if (!session?.user?.id || !currentOrg?.id) {
      console.error('No user or organization found');
      alert('Please make sure you are logged in and have selected an organization.');
      return;
    }

    try {
      console.log('💾 Saving report:', reportData);

      const requestPayload = {
        title: reportData.project?.name || 'Project Report',
        description: reportData.description,
        userName: reportData.userName,
        image: reportData.image,
        projectId: reportData.project?.id || null
      };

      console.log('📤 Request payload:', requestPayload);

      console.log('🔧 Using simple endpoint with any available user/org');
      const data = await apiClient.fetch(`/api/simple/user-reports`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestPayload),
      });

      if (data.success) {
        console.log('✅ Report saved successfully');
        alert('Report created successfully!');
        await fetchReports();
      } else {
        console.error('Failed to save report:', data.error);
        alert(`Failed to save report: ${data.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error saving report:', error);
      alert(`Error saving report: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleDeleteReport = async (reportId: string) => {
    if (!confirm('Are you sure you want to delete this report? This action cannot be undone.')) {
      return;
    }

    if (!currentOrg?.id) {
      alert('Please make sure you have selected an organization.');
      return;
    }

    try {
      console.log('🗑️ Deleting report:', reportId);

      const data = await apiClient.fetch(`/api/simple/user-reports/${reportId}`, {
        method: 'DELETE',
      });

      if (data.success) {
        console.log('✅ Report deleted successfully');
        alert('Report deleted successfully!');
        await fetchReports();
      } else {
        console.error('Failed to delete report:', data.error);
        alert(`Failed to delete report: ${data.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error deleting report:', error);
      alert(`Error deleting report: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const tailwindToHex = (tailwindClass: string): string => {
    const colorMap: { [key: string]: string } = {
      'bg-primary': '#3b82f6',
      'bg-secondary': '#6b7280',
      'bg-success': '#10b981',
      'bg-warning': '#f59e0b',
      'bg-danger': '#ef4444',
      'bg-info': '#06b6d4',
      'bg-purple': '#8b5cf6',
      'bg-pink': '#ec4899',
      'bg-indigo': '#6366f1',
      'bg-green': '#22c55e',
      'bg-red': '#ef4444',
      'bg-blue': '#3b82f6',
      'bg-yellow': '#eab308',
      'bg-orange': '#f97316',
      'bg-teal': '#14b8a6',
      'bg-cyan': '#06b6d4',
    };
    return colorMap[tailwindClass] || '#6b7280';
  };

  const getProjectColor = (project?: any): string => {
    if (!project?.color) return '#6b7280';
    if (project.color.startsWith('#')) return project.color;
    return tailwindToHex(project.color);
  };

  const filteredReports = selectedDate
    ? reports.filter(report =>
        new Date(report.createdAt).toDateString() === new Date(selectedDate).toDateString()
      )
    : reports;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: VS.text0, margin: 0 }}>Reports</h1>
          <p style={{ fontSize: 13, color: VS.text2, marginTop: 4 }}>Create and manage your project reports</p>
        </div>
        <button
          onClick={() => setShowReportModal(true)}
          style={{
            background: VS.accent,
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            padding: '8px 16px',
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 7,
          }}
        >
          <Plus size={16} />
          Add Report
        </button>
      </div>

      {/* Date Filter */}
      <div
        className="rounded-xl p-5"
        style={{ background: VS.bg1, border: `1px solid ${VS.border}` }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Calendar size={16} style={{ color: VS.blue }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: VS.text1 }}>Filter by Date:</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <input
              type="date"
              value={selectedDate ? new Date(selectedDate).toISOString().split('T')[0] : ''}
              onChange={(e) => {
                if (e.target.value) {
                  const d = new Date(e.target.value + 'T00:00:00.000Z');
                  setSelectedDate(d.toISOString());
                } else {
                  setSelectedDate('');
                }
              }}
              title="Pick a date to filter reports"
              style={{
                background: VS.bg2,
                border: `1px solid ${VS.border}`,
                borderRadius: 8,
                padding: '8px 12px',
                color: VS.text0,
                fontSize: 13,
                outline: 'none',
                colorScheme: 'dark',
              }}
            />
            {selectedDate && (
              <button
                onClick={() => setSelectedDate('')}
                style={{
                  background: VS.bg3,
                  color: VS.text1,
                  border: `1px solid ${VS.border}`,
                  borderRadius: 8,
                  padding: '7px 13px',
                  fontSize: 13,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                }}
              >
                <X size={14} />
                Clear Filter
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Reports List */}
      <div>
        {loading ? (
          <div
            className="rounded-xl p-5"
            style={{
              background: VS.bg1,
              border: `1px solid ${VS.border}`,
              textAlign: 'center',
              padding: '64px 24px',
            }}
          >
            <div
              style={{
                width: 32,
                height: 32,
                border: `2px solid ${VS.border}`,
                borderTopColor: VS.accent,
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
                margin: '0 auto 16px',
              }}
            />
            <div style={{ fontSize: 16, fontWeight: 600, color: VS.text0, marginBottom: 6 }}>Loading Reports...</div>
            <div style={{ fontSize: 13, color: VS.text2 }}>Please wait while we fetch your reports.</div>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        ) : filteredReports.length === 0 ? (
          <div
            className="rounded-xl"
            style={{
              background: VS.bg1,
              border: `1px solid ${VS.border}`,
              textAlign: 'center',
              padding: '64px 24px',
            }}
          >
            <FileText size={52} style={{ color: VS.text2, margin: '0 auto 16px', opacity: 0.5 }} />
            {selectedDate ? (
              <>
                <div style={{ fontSize: 18, fontWeight: 600, color: VS.text0, marginBottom: 8 }}>
                  No Reports for Selected Date
                </div>
                <p style={{ fontSize: 13, color: VS.text2, marginBottom: 24 }}>
                  No reports were created on{' '}
                  {new Date(selectedDate).toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                  . Try selecting a different date or create a new report.
                </p>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                  <button
                    onClick={() => setSelectedDate('')}
                    style={{
                      background: VS.bg3,
                      color: VS.text1,
                      border: `1px solid ${VS.border}`,
                      borderRadius: 8,
                      padding: '8px 16px',
                      fontSize: 14,
                      cursor: 'pointer',
                    }}
                  >
                    Show All Reports
                  </button>
                  <button
                    onClick={() => setShowReportModal(true)}
                    style={{
                      background: VS.accent,
                      color: '#fff',
                      border: 'none',
                      borderRadius: 8,
                      padding: '8px 16px',
                      fontSize: 14,
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 7,
                    }}
                  >
                    <Plus size={15} />
                    Create Report
                  </button>
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 18, fontWeight: 600, color: VS.text0, marginBottom: 8 }}>No Reports Yet</div>
                <p style={{ fontSize: 13, color: VS.text2, marginBottom: 24 }}>
                  Create your first report to get started with project analysis and documentation.
                </p>
                <button
                  onClick={() => setShowReportModal(true)}
                  style={{
                    background: VS.accent,
                    color: '#fff',
                    border: 'none',
                    borderRadius: 8,
                    padding: '8px 18px',
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 7,
                  }}
                >
                  <Plus size={15} />
                  Create First Report
                </button>
              </>
            )}
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: 20,
            }}
          >
            {filteredReports.map((report) => {
              const projectColor = getProjectColor(report.project);

              return (
                <div
                  key={report.id}
                  style={{
                    background: VS.bg1,
                    border: `1px solid ${VS.border}`,
                    borderRadius: 12,
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                >
                  {/* Project color accent bar */}
                  <div
                    style={{
                      position: 'absolute',
                      left: 0,
                      top: 0,
                      bottom: 0,
                      width: 4,
                      background: projectColor,
                    }}
                  />

                  {/* Card Header */}
                  <div
                    style={{
                      padding: '16px 16px 12px 20px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      borderBottom: `1px solid ${VS.border}`,
                    }}
                  >
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 8,
                        background: VS.bg2,
                        border: `1px solid ${VS.border}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: VS.blue,
                      }}
                    >
                      <FileText size={16} />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          padding: '3px 8px',
                          borderRadius: 4,
                          background: VS.bg2,
                          color: VS.green,
                          border: `1px solid ${VS.border}`,
                        }}
                      >
                        {new Date(report.createdAt).toLocaleDateString()}
                      </span>
                      <button
                        onClick={() => handleDeleteReport(report.id)}
                        title="Delete report"
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: VS.text2,
                          cursor: 'pointer',
                          padding: 5,
                          borderRadius: 6,
                          display: 'flex',
                          alignItems: 'center',
                          transition: 'color 0.15s',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = VS.red)}
                        onMouseLeave={(e) => (e.currentTarget.style.color = VS.text2)}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>

                  {/* Card Body */}
                  <div style={{ padding: '14px 16px 16px 20px' }}>
                    <div style={{ fontSize: 15, fontWeight: 600, color: VS.text0, marginBottom: 4 }}>
                      {report.title || 'General Report'}
                    </div>
                    <div style={{ fontSize: 12, color: VS.text2, marginBottom: 10 }}>
                      Created by {report.userName}
                    </div>

                    {report.description && (
                      <div
                        style={{
                          fontSize: 13,
                          color: VS.text1,
                          background: VS.bg2,
                          borderRadius: 6,
                          padding: '8px 10px',
                          marginBottom: 12,
                          lineHeight: 1.5,
                        }}
                      >
                        {report.description.length > 100
                          ? `${report.description.substring(0, 100)}...`
                          : report.description}
                      </div>
                    )}

                    {report.image && (
                      <div style={{ marginBottom: 12 }}>
                        <img
                          src={report.image}
                          alt="Report screenshot"
                          style={{
                            width: '100%',
                            maxHeight: 200,
                            objectFit: 'contain',
                            borderRadius: 8,
                            border: `1px solid ${VS.border}`,
                            cursor: 'pointer',
                          }}
                          onClick={() => window.open(report.image, '_blank')}
                        />
                      </div>
                    )}

                    {report.project && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ color: VS.text2 }}>Status:</span>
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 600,
                              padding: '2px 8px',
                              borderRadius: 4,
                              background: VS.bg2,
                              color:
                                report.project.status === 'completed' ? VS.teal :
                                report.project.status === 'active' ? VS.blue :
                                VS.yellow,
                              border: `1px solid ${VS.border}`,
                              textTransform: 'capitalize',
                            }}
                          >
                            {report.project.status}
                          </span>
                        </div>
                        {report.project.budget && (
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: VS.text2 }}>Budget:</span>
                            <span style={{ fontWeight: 600, color: VS.text0 }}>
                              ${report.project.budget.toLocaleString()}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Report Modal */}
      <ReportModal
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
        onSave={handleSaveReport}
      />
    </div>
  );
}
