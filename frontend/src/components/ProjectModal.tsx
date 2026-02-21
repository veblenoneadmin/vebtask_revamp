import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { Project } from '../hooks/useTasks';
import { X, Save, Building2, Star, Calendar, DollarSign, Users, Target, Zap } from 'lucide-react';

const VS = {
  bg1: '#252526', bg2: '#2d2d2d', bg3: '#333333',
  border: '#3c3c3c', text0: '#f0f0f0', text1: '#c0c0c0', text2: '#909090',
  blue: '#569cd6', teal: '#4ec9b0', yellow: '#dcdcaa',
  red: '#f44747', green: '#6a9955', accent: '#007acc',
};

interface ProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (project: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onUpdate?: (projectId: string, updates: Partial<Project>) => void;
  project?: Project;
}

const PROJECT_COLORS = [
  { color: '#646cff', name: 'Primary', gradient: 'linear-gradient(135deg, #646cff, #8b5cf6)' },
  { color: '#10b981', name: 'Success', gradient: 'linear-gradient(135deg, #10b981, #059669)' },
  { color: '#f59e0b', name: 'Warning', gradient: 'linear-gradient(135deg, #f59e0b, #d97706)' },
  { color: '#ef4444', name: 'Error',   gradient: 'linear-gradient(135deg, #ef4444, #dc2626)' },
  { color: '#8b5cf6', name: 'Purple',  gradient: 'linear-gradient(135deg, #8b5cf6, #7c3aed)' },
  { color: '#06b6d4', name: 'Cyan',    gradient: 'linear-gradient(135deg, #06b6d4, #0891b2)' },
  { color: '#84cc16', name: 'Lime',    gradient: 'linear-gradient(135deg, #84cc16, #65a30d)' },
  { color: '#f97316', name: 'Orange',  gradient: 'linear-gradient(135deg, #f97316, #ea580c)' },
  { color: '#ec4899', name: 'Pink',    gradient: 'linear-gradient(135deg, #ec4899, #db2777)' },
  { color: '#6366f1', name: 'Indigo',  gradient: 'linear-gradient(135deg, #6366f1, #4f46e5)' },
];

const STATUS_OPTIONS = [
  { value: 'planning',  label: 'Planning',  dot: VS.blue   },
  { value: 'active',    label: 'Active',    dot: VS.teal   },
  { value: 'completed', label: 'Completed', dot: VS.green  },
  { value: 'on_hold',   label: 'On Hold',   dot: VS.yellow },
  { value: 'cancelled', label: 'Cancelled', dot: VS.red    },
];

const fieldStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  background: VS.bg3,
  border: `1px solid ${VS.border}`,
  borderRadius: 4,
  color: VS.text0,
  fontSize: 13,
  outline: 'none',
  boxSizing: 'border-box',
  fontFamily: 'inherit',
};

const labelStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  fontSize: 12,
  fontWeight: 600,
  color: VS.text1,
  marginBottom: 6,
};

export function ProjectModal({ isOpen, onClose, onSave, onUpdate, project }: ProjectModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    color: PROJECT_COLORS[0].color,
    status: 'planning' as 'planning' | 'active' | 'completed' | 'on_hold' | 'cancelled',
    clientName: '',
    budget: '',
    startDate: '',
    deadline: '',
    priority: 'medium' as 'low' | 'medium' | 'high',
  });
  const [selectedColorIndex, setSelectedColorIndex] = useState(0);

  useEffect(() => {
    if (project) {
      setFormData({
        name: project.name,
        description: project.description,
        color: project.color,
        status: project.status,
        clientName: project.clientName || '',
        budget: '',
        startDate: project.startDate ? new Date(project.startDate).toISOString().split('T')[0] : '',
        deadline: project.endDate ? new Date(project.endDate).toISOString().split('T')[0] : '',
        priority: 'medium',
      });
      const idx = PROJECT_COLORS.findIndex(c => c.color === project.color);
      setSelectedColorIndex(idx >= 0 ? idx : 0);
    } else {
      setFormData({
        name: '', description: '', color: PROJECT_COLORS[0].color,
        status: 'planning', clientName: '', budget: '',
        startDate: '', deadline: '', priority: 'medium',
      });
      setSelectedColorIndex(0);
    }
  }, [project, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const projectData = {
      name: formData.name,
      description: formData.description,
      color: formData.color,
      status: formData.status,
      priority: formData.priority,
      budget: formData.budget ? parseFloat(formData.budget) : null,
      startDate: formData.startDate ? new Date(formData.startDate).toISOString() : null,
      endDate: formData.deadline ? new Date(formData.deadline).toISOString() : null,
      clientId: null,
      clientName: formData.clientName,
    };
    if (project && onUpdate) {
      onUpdate(project.id, projectData);
    } else {
      onSave(projectData);
    }
    onClose();
  };

  const handleColorSelect = (index: number) => {
    setSelectedColorIndex(index);
    setFormData(prev => ({ ...prev, color: PROJECT_COLORS[index].color }));
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'high':   return <Zap size={14} color={VS.red} />;
      case 'medium': return <Target size={14} color={VS.yellow} />;
      case 'low':    return <Star size={14} color={VS.teal} />;
      default:       return <Target size={14} />;
    }
  };

  if (!isOpen) return null;

  const accentGrad = PROJECT_COLORS[selectedColorIndex].gradient;

  return createPortal(
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          width: '95%',
          maxWidth: 580,
          maxHeight: '90vh',
          overflowY: 'auto',
          background: VS.bg2,
          border: `1px solid ${VS.border}`,
          borderRadius: 8,
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
        }}
      >
        {/* Header */}
        <div style={{ background: accentGrad, borderRadius: '8px 8px 0 0', padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 38, height: 38, borderRadius: 8, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Building2 size={20} color="#fff" />
            </div>
            <div>
              <h2 style={{ color: '#fff', fontWeight: 700, fontSize: 16, margin: 0 }}>
                {project ? 'Edit Project' : 'Create New Project'}
              </h2>
              <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: 12, margin: 0, marginTop: 2 }}>
                {project ? 'Update project details' : 'Set up a new project to track progress'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 6, color: '#fff', padding: '6px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Project Name */}
          <div>
            <label style={labelStyle}><Building2 size={13} /> Project Name *</label>
            <input
              type="text"
              value={formData.name}
              onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
              required
              placeholder="Enter a compelling project name"
              style={fieldStyle}
            />
          </div>

          {/* Description */}
          <div>
            <label style={labelStyle}><Star size={13} /> Description</label>
            <textarea
              value={formData.description}
              onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
              rows={3}
              placeholder="Describe the project goals, scope, and key deliverables..."
              style={{ ...fieldStyle, resize: 'none', lineHeight: 1.5 }}
            />
          </div>

          {/* Client + Priority */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <label style={labelStyle}><Users size={13} /> Client Name</label>
              <input
                type="text"
                value={formData.clientName}
                onChange={e => setFormData(prev => ({ ...prev, clientName: e.target.value }))}
                placeholder="Client or company name"
                style={fieldStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>{getPriorityIcon(formData.priority)} Priority</label>
              <select
                value={formData.priority}
                onChange={e => setFormData(prev => ({ ...prev, priority: e.target.value as any }))}
                style={fieldStyle}
              >
                <option value="low">Low Priority</option>
                <option value="medium">Medium Priority</option>
                <option value="high">High Priority</option>
              </select>
            </div>
          </div>

          {/* Budget */}
          <div>
            <label style={labelStyle}><DollarSign size={13} /> Budget ($)</label>
            <input
              type="number"
              value={formData.budget}
              onChange={e => setFormData(prev => ({ ...prev, budget: e.target.value }))}
              placeholder="0"
              min="0"
              step="100"
              style={fieldStyle}
            />
          </div>

          {/* Start + End Date */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <label style={labelStyle}><Calendar size={13} /> Start Date</label>
              <input
                type="date"
                value={formData.startDate}
                onChange={e => setFormData(prev => ({ ...prev, startDate: e.target.value }))}
                style={fieldStyle}
              />
            </div>
            <div>
              <label style={labelStyle}><Calendar size={13} /> End Date</label>
              <input
                type="date"
                value={formData.deadline}
                onChange={e => setFormData(prev => ({ ...prev, deadline: e.target.value }))}
                style={fieldStyle}
              />
            </div>
          </div>

          {/* Status */}
          <div>
            <label style={labelStyle}><Target size={13} /> Project Status</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {STATUS_OPTIONS.map(s => {
                const active = formData.status === s.value;
                return (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, status: s.value as any }))}
                    style={{
                      padding: '8px 10px',
                      borderRadius: 4,
                      border: `1px solid ${active ? s.dot : VS.border}`,
                      background: active ? `${s.dot}18` : VS.bg3,
                      color: active ? s.dot : VS.text2,
                      fontSize: 12,
                      fontWeight: active ? 600 : 400,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      transition: 'all 0.15s',
                    }}
                  >
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: s.dot, flexShrink: 0 }} />
                    {s.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Color Theme */}
          <div>
            <label style={labelStyle}><Star size={13} /> Project Color Theme</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
              {PROJECT_COLORS.map((c, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleColorSelect(i)}
                  title={c.name}
                  style={{
                    height: 40,
                    borderRadius: 6,
                    background: c.gradient,
                    border: selectedColorIndex === i ? '2px solid #fff' : '2px solid transparent',
                    outline: selectedColorIndex === i ? `2px solid ${c.color}` : 'none',
                    cursor: 'pointer',
                    transform: selectedColorIndex === i ? 'scale(1.08)' : 'scale(1)',
                    transition: 'all 0.15s',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {selectedColorIndex === i && (
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#fff', display: 'block' }} />
                  )}
                </button>
              ))}
            </div>
            <p style={{ fontSize: 11, color: VS.text2, marginTop: 6 }}>
              Selected: {PROJECT_COLORS[selectedColorIndex].name}
            </p>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 16, borderTop: `1px solid ${VS.border}` }}>
            <button
              type="button"
              onClick={onClose}
              style={{ padding: '7px 18px', background: VS.bg3, border: `1px solid ${VS.border}`, borderRadius: 4, color: VS.text1, fontSize: 13, cursor: 'pointer' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              style={{ padding: '7px 18px', background: accentGrad, border: 'none', borderRadius: 4, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <Save size={14} />
              {project ? 'Update Project' : 'Create Project'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
