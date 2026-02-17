import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { Project } from '../hooks/useTasks';
import { X, Save, Building2, Star, Calendar, DollarSign, Users, Target, Zap } from 'lucide-react';

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
  { color: '#ef4444', name: 'Error', gradient: 'linear-gradient(135deg, #ef4444, #dc2626)' },
  { color: '#8b5cf6', name: 'Purple', gradient: 'linear-gradient(135deg, #8b5cf6, #7c3aed)' },
  { color: '#06b6d4', name: 'Cyan', gradient: 'linear-gradient(135deg, #06b6d4, #0891b2)' },
  { color: '#84cc16', name: 'Lime', gradient: 'linear-gradient(135deg, #84cc16, #65a30d)' },
  { color: '#f97316', name: 'Orange', gradient: 'linear-gradient(135deg, #f97316, #ea580c)' },
  { color: '#ec4899', name: 'Pink', gradient: 'linear-gradient(135deg, #ec4899, #db2777)' },
  { color: '#6366f1', name: 'Indigo', gradient: 'linear-gradient(135deg, #6366f1, #4f46e5)' }
];

export function ProjectModal({ isOpen, onClose, onSave, onUpdate, project }: ProjectModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    color: '#646cff',
    status: 'planning' as 'planning' | 'active' | 'completed' | 'on_hold' | 'cancelled',
    clientName: '',
    budget: '',
    startDate: '',
    deadline: '',
    priority: 'medium' as 'low' | 'medium' | 'high'
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
        priority: 'medium'
      });
      const colorIndex = PROJECT_COLORS.findIndex(c => c.color === project.color);
      setSelectedColorIndex(colorIndex >= 0 ? colorIndex : 0);
    } else {
      setFormData({
        name: '',
        description: '',
        color: PROJECT_COLORS[0].color,
        status: 'planning',
        clientName: '',
        budget: '',
        startDate: '',
        deadline: '',
        priority: 'medium'
      });
      setSelectedColorIndex(0);
    }
  }, [project, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Prepare data for API
    const projectData = {
      name: formData.name,
      description: formData.description,
      color: formData.color,
      status: formData.status,
      priority: formData.priority,
      budget: formData.budget ? parseFloat(formData.budget) : null,
      startDate: formData.startDate ? new Date(formData.startDate).toISOString() : null,
      endDate: formData.deadline ? new Date(formData.deadline).toISOString() : null,
      clientId: null, // Will be handled when client management is added
      clientName: formData.clientName // Include client name for temporary storage
    };
    
    if (project && onUpdate) {
      onUpdate(project.id, projectData);
    } else {
      onSave(projectData);
    }
    
    onClose();
  };

  if (!isOpen) return null;

  const handleColorSelect = (index: number) => {
    setSelectedColorIndex(index);
    setFormData(prev => ({ ...prev, color: PROJECT_COLORS[index].color }));
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'high': return <Zap className="w-4 h-4 text-red-500" />;
      case 'medium': return <Target className="w-4 h-4 text-yellow-500" />;
      case 'low': return <Star className="w-4 h-4 text-green-500" />;
      default: return <Target className="w-4 h-4" />;
    }
  };

  return createPortal(
    <div
      className="modal-overlay glass"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 99999
      }}
      onClick={(e) => {
        // Close modal when clicking on overlay (not the modal content)
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="modal-content glass shadow-elevation"
        style={{
          maxWidth: '600px',
          width: '95%',
          maxHeight: '90vh',
          overflowY: 'auto',
          position: 'relative',
          backgroundColor: '#1a1a1a',
          borderRadius: '12px',
          border: '1px solid #333'
        }}
      >
        {/* Enhanced Header */}
        <div className="modal-header" style={{ 
          background: PROJECT_COLORS[selectedColorIndex].gradient,
          borderRadius: '8px 8px 0 0',
          padding: '24px',
          color: 'white'
        }}>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold m-0">
                {project ? 'Edit Project' : 'Create New Project'}
              </h2>
              <p className="text-white/80 text-sm m-0 mt-1">
                {project ? 'Update project details' : 'Set up a new project to track progress'}
              </p>
            </div>
          </div>
          <button 
            className="modal-close bg-white/20 hover:bg-white/30 rounded-lg p-2"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="modal-form" style={{ padding: '24px' }}>
          {/* Project Name & Description */}
          <div className="space-y-6">
            <div className="form-group">
              <label className="flex items-center gap-2 text-sm font-semibold text-white mb-2">
                <Building2 className="w-4 h-4" />
                Project Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                required
                placeholder="Enter a compelling project name"
                className="w-full p-3 bg-surface-elevated border border-border rounded-lg text-white placeholder-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
              />
            </div>

            <div className="form-group">
              <label className="flex items-center gap-2 text-sm font-semibold text-white mb-2">
                <Star className="w-4 h-4" />
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                rows={3}
                placeholder="Describe the project goals, scope, and key deliverables..."
                className="w-full p-3 bg-surface-elevated border border-border rounded-lg text-white placeholder-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all resize-none"
              />
            </div>

            {/* Two-column layout for additional fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="form-group">
                <label className="flex items-center gap-2 text-sm font-semibold text-white mb-2">
                  <Users className="w-4 h-4" />
                  Client Name
                </label>
                <input
                  type="text"
                  value={formData.clientName}
                  onChange={(e) => setFormData(prev => ({ ...prev, clientName: e.target.value }))}
                  placeholder="Client or company name"
                  className="w-full p-3 bg-surface-elevated border border-border rounded-lg text-white placeholder-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                />
              </div>

              <div className="form-group">
                <label className="flex items-center gap-2 text-sm font-semibold text-white mb-2">
                  {getPriorityIcon(formData.priority)}
                  Priority
                </label>
                <select
                  value={formData.priority}
                  onChange={(e) => setFormData(prev => ({ ...prev, priority: e.target.value as any }))}
                  className="w-full p-3 bg-surface-elevated border border-border rounded-lg text-white focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                >
                  <option value="low" className="bg-surface-elevated">Low Priority</option>
                  <option value="medium" className="bg-surface-elevated">Medium Priority</option>
                  <option value="high" className="bg-surface-elevated">High Priority</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="flex items-center gap-2 text-sm font-semibold text-white mb-2">
                <DollarSign className="w-4 h-4" />
                Budget ($)
              </label>
              <input
                type="number"
                value={formData.budget}
                onChange={(e) => setFormData(prev => ({ ...prev, budget: e.target.value }))}
                placeholder="0"
                min="0"
                step="100"
                className="w-full p-3 bg-surface-elevated border border-border rounded-lg text-white placeholder-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="form-group">
                <label className="flex items-center gap-2 text-sm font-semibold text-white mb-2">
                  <Calendar className="w-4 h-4" />
                  Start Date
                </label>
                <input
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData(prev => ({ ...prev, startDate: e.target.value }))}
                  className="w-full p-3 bg-surface-elevated border border-border rounded-lg text-white focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                />
              </div>

              <div className="form-group">
                <label className="flex items-center gap-2 text-sm font-semibold text-white mb-2">
                  <Calendar className="w-4 h-4" />
                  End Date
                </label>
                <input
                  type="date"
                  value={formData.deadline}
                  onChange={(e) => setFormData(prev => ({ ...prev, deadline: e.target.value }))}
                  className="w-full p-3 bg-surface-elevated border border-border rounded-lg text-white focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                />
              </div>
            </div>

            {/* Status & Color Selection */}
            <div className="form-group">
              <label className="flex items-center gap-2 text-sm font-semibold text-white mb-3">
                <Target className="w-4 h-4" />
                Project Status
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { value: 'planning', label: 'Planning', color: 'bg-purple-500' },
                  { value: 'active', label: 'Active', color: 'bg-green-500' },
                  { value: 'completed', label: 'Completed', color: 'bg-blue-500' },
                  { value: 'on_hold', label: 'On Hold', color: 'bg-yellow-500' },
                  { value: 'cancelled', label: 'Cancelled', color: 'bg-red-500' }
                ].map((status) => (
                  <button
                    key={status.value}
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, status: status.value as any }))}
                    className={`p-3 rounded-lg border transition-all flex items-center justify-center gap-2 ${
                      formData.status === status.value
                        ? 'border-primary bg-primary/20 text-white'
                        : 'border-border bg-surface-elevated text-muted-foreground hover:border-primary/50'
                    }`}
                  >
                    <div className={`w-2 h-2 rounded-full ${status.color}`}></div>
                    {status.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Enhanced Color Picker */}
            <div className="form-group">
              <label className="flex items-center gap-2 text-sm font-semibold text-white mb-3">
                <Star className="w-4 h-4" />
                Project Color Theme
              </label>
              <div className="grid grid-cols-5 gap-3">
                {PROJECT_COLORS.map((colorOption, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => handleColorSelect(index)}
                    className={`relative h-12 rounded-lg transition-all group ${
                      selectedColorIndex === index 
                        ? 'ring-4 ring-white/50 scale-110' 
                        : 'hover:scale-105'
                    }`}
                    style={{ background: colorOption.gradient }}
                    title={colorOption.name}
                  >
                    {selectedColorIndex === index && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-3 h-3 bg-white rounded-full"></div>
                      </div>
                    )}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Selected: {PROJECT_COLORS[selectedColorIndex].name}
              </p>
            </div>
          </div>

          {/* Enhanced Action Buttons */}
          <div className="modal-actions flex justify-end gap-3 pt-6 mt-6 border-t border-border">
            <button 
              type="button" 
              className="px-6 py-2 bg-surface-elevated hover:bg-muted border border-border rounded-lg text-white transition-all"
              onClick={onClose}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="px-6 py-2 rounded-lg text-white font-medium transition-all flex items-center gap-2 shadow-glow"
              style={{ background: PROJECT_COLORS[selectedColorIndex].gradient }}
            >
              <Save size={16} />
              {project ? 'Update Project' : 'Create Project'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}