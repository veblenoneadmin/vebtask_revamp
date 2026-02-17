import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useSession } from '../lib/auth-client';
import { useApiClient } from '../lib/api-client';
import { useOrganization } from '../contexts/OrganizationContext';
import { Card, CardContent, CardHeader } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import {
  Building2,
  Plus,
  Users,
  Calendar,
  DollarSign,
  Clock,
  Target,
  AlertCircle,
  CheckCircle2,
  MoreVertical,
  Activity,
  Edit3,
  Trash2,
  Eye,
  X
} from 'lucide-react';
import { cn } from '../lib/utils';
import { ProjectModal } from '../components/ProjectModal';

interface DatabaseProject {
  id: string;
  name: string;
  description: string | null;
  status: 'planning' | 'active' | 'on_hold' | 'completed' | 'cancelled';
  priority: 'high' | 'medium' | 'low';
  client?: {
    id: string;
    name: string;
    email: string;
  } | null;
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
  // Frontend-only fields for display compatibility
  teamMembers?: string[];
  tasks?: {
    total: number;
    completed: number;
    inProgress: number;
    pending: number;
  };
  tags?: string[];
}

// TEMP: Helper functions to parse client name from description until DB migration
const parseClientFromDescription = (description: string | null): string | null => {
  if (!description) return null;
  const match = description.match(/^CLIENT:([^|]+)\|DESC:/);
  console.log('🔍 Parsing client from description:', description, 'Result:', match ? match[1] : null);
  return match ? match[1] : null;
};

const parseDescriptionFromCombined = (description: string | null): string => {
  if (!description) return '';
  const match = description.match(/^CLIENT:[^|]+\|DESC:(.*)$/);
  return match ? match[1] : description;
};

export function Projects() {
  const { data: session } = useSession();
  const { currentOrg } = useOrganization();
  const apiClient = useApiClient();
  const [projects, setProjects] = useState<DatabaseProject[]>([]);
  const [, setLoading] = useState(true);
  const [, setError] = useState<string | null>(null);
  const [, setSelectedProject] = useState<DatabaseProject | null>(null);
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);
  const [editingProject, setEditingProject] = useState<DatabaseProject | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState<string | null>(null);
  const [showFullTitle, setShowFullTitle] = useState<string | null>(null);
  const [showFullDescription, setShowFullDescription] = useState<string | null>(null);

  // Fetch projects from server
  const fetchProjects = async () => {
    if (!session?.user?.id) return;

    try {
      setLoading(true);
      setError(null);

      // EMERGENCY FIX: Use hardcoded orgId if currentOrg is not available
      const orgId = currentOrg?.id || 'org_1757046595553';
      console.log('🔧 Fetching projects with orgId:', orgId, 'from:', currentOrg?.id ? 'currentOrg' : 'hardcoded fallback');

      const data = await apiClient.fetch(`/api/projects?userId=${session.user.id}&orgId=${orgId}&limit=100`);
      
      if (data.success) {
        // Use real API data - fallback to empty array if no projects
        setProjects(data.projects || []);
        console.log('📊 Loaded projects from database:', data.projects?.length || 0);
      } else {
        console.warn('Failed to fetch projects:', data.error);
        setError(data.error || 'Failed to fetch projects');
        setProjects([]);
      }
    } catch (err: any) {
      console.error('Error fetching projects:', err);
      setError(err.message);
      setProjects([]);
    } finally {
      setLoading(false);
    }
  };

  // Fetch projects on component mount and when session changes
  useEffect(() => {
    fetchProjects();
  }, [session?.user?.id, currentOrg?.id]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownOpen) {
        const target = event.target as Element;
        if (!target.closest('.relative')) {
          setDropdownOpen(null);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [dropdownOpen]);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const filteredProjects = projects.filter(project => {
    const matchesStatus = filterStatus === 'all' || project.status === filterStatus;
    const matchesPriority = filterPriority === 'all' || project.priority === filterPriority;
    return matchesStatus && matchesPriority;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-success bg-success/10 border-success/20';
      case 'completed': return 'text-info bg-info/10 border-info/20';
      case 'on_hold': return 'text-warning bg-warning/10 border-warning/20';
      case 'planning': return 'text-primary bg-primary/10 border-primary/20';
      case 'cancelled': return 'text-error bg-error/10 border-error/20';
      default: return 'text-muted-foreground bg-muted/10 border-border';
    }
  };


  const handleDeleteProject = async (project: DatabaseProject) => {
    if (!confirm(`Are you sure you want to delete "${project.name}"? This action cannot be undone.`)) {
      return;
    }

    if (!session?.user?.id) return;

    try {
      console.log('🗑️ Deleting project:', project.id);

      const data = await apiClient.fetch(`/api/projects/${project.id}`, {
        method: 'DELETE',
      });

      if (data.success) {
        console.log('✅ Project deleted successfully');
        // Refresh the projects list
        await fetchProjects();
      } else {
        console.error('❌ Failed to delete project:', data.error);
        throw new Error(data.error || 'Failed to delete project');
      }
    } catch (error: any) {
      console.error('❌ Error deleting project:', error);
      alert('Failed to delete project. Please try again.');
    }
  };

  const handleUpdateProject = async (projectData: any) => {
    if (!session?.user?.id || !editingProject) return;

    try {
      console.log('✏️ Updating project:', editingProject.id, projectData);

      // TEMP: Store client name in description until DB migration
      const clientName = projectData.clientName || '';
      const description = projectData.description || '';
      const combinedDescription = clientName
        ? `CLIENT:${clientName}|DESC:${description}`
        : description;

      const payload = {
        name: projectData.name,
        description: combinedDescription,
        priority: projectData.priority || 'medium',
        status: projectData.status || 'planning',
        budget: projectData.budget ? parseFloat(projectData.budget) : undefined,
        startDate: projectData.startDate ? new Date(projectData.startDate).toISOString() : undefined,
        endDate: projectData.endDate ? new Date(projectData.endDate).toISOString() : undefined,
        color: projectData.color || 'bg-primary'
      };

      const data = await apiClient.fetch(`/api/projects/${editingProject.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      if (data.success) {
        console.log('✅ Project updated successfully');
        // Refresh the projects list
        await fetchProjects();
        setEditingProject(null);
      } else {
        console.error('❌ Failed to update project:', data.error);
        throw new Error(data.error || 'Failed to update project');
      }
    } catch (error: any) {
      console.error('❌ Error updating project:', error);
    }
  };

  const handleCreateProject = async (projectData: any) => {
    if (!session?.user?.id) {
      console.error('Missing required data:', { userId: session?.user?.id, orgId: currentOrg?.id });
      return;
    }

    try {
      console.log('🚀 Creating project:', projectData);

      // EMERGENCY FIX: Use hardcoded orgId if currentOrg is not available
      const orgId = currentOrg?.id || 'org_1757046595553';
      console.log('🔧 Using orgId:', orgId, 'from:', currentOrg?.id ? 'currentOrg' : 'hardcoded fallback');

      // TEMP: Store client name in description until DB migration
      const clientName = projectData.clientName || '';
      const description = projectData.description || '';
      const combinedDescription = clientName
        ? `CLIENT:${clientName}|DESC:${description}`
        : description;

      console.log('🔍 Creating project with:', {
        clientName,
        description,
        combinedDescription
      });

      const payload = {
        orgId: orgId,
        name: projectData.name,
        description: combinedDescription,
        priority: projectData.priority || 'medium',
        status: projectData.status || 'planning',
        budget: projectData.budget ? parseFloat(projectData.budget) : undefined,
        startDate: projectData.startDate ? new Date(projectData.startDate).toISOString() : undefined,
        endDate: projectData.endDate ? new Date(projectData.endDate).toISOString() : undefined,
        color: projectData.color || 'bg-primary'
      };

      const data = await apiClient.fetch('/api/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      console.log('📊 API Response:', data);

      if (data.success) {
        console.log('✅ Project created successfully:', data.project);
        // Refresh the entire projects list from server
        await fetchProjects();
        setShowNewProjectModal(false);
      } else {
        console.error('❌ Failed to create project:', data.error);
        throw new Error(data.error || 'Failed to create project');
      }
    } catch (error: any) {
      console.error('❌ Error creating project:', error);
    }
  };
  
  // Use the function to prevent unused warning

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return <Activity className="h-4 w-4" />;
      case 'completed': return <CheckCircle2 className="h-4 w-4" />;
      case 'on_hold': return <AlertCircle className="h-4 w-4" />;
      case 'planning': return <Target className="h-4 w-4" />;
      default: return <Building2 className="h-4 w-4" />;
    }
  };


  const ProjectTitle = ({ project }: { project: DatabaseProject }) => {
    const title = project.name;

    // UPDATED LOGIC:
    // - If title length <= 12: show entire title in one line only (NO eye button)
    // - If title length > 12: show first 12 chars + "..." + eye button
    if (title.length > 12) {
      // Over 12 characters: first 12 chars + "..." + eye button
      return (
        <div className="flex items-center gap-1 whitespace-nowrap">
          <h3 className="text-base font-semibold leading-tight whitespace-nowrap">
            {title.substring(0, 12)}...
          </h3>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowFullTitle(project.id);
            }}
            className="p-1 rounded hover:bg-surface-elevated transition-colors flex-shrink-0"
            title="Click to view full title"
          >
            <Eye className="h-3 w-3 text-muted-foreground hover:text-white" />
          </button>
        </div>
      );
    } else {
      // 12 or less characters: show entire title in one line only
      return (
        <h3 className="text-base font-semibold leading-tight whitespace-nowrap">
          {title}
        </h3>
      );
    }
  };

  const ProjectDescription = ({ project }: { project: DatabaseProject }) => {
    const description = parseDescriptionFromCombined(project.description);
    const maxLength = 20;
    const needsTruncation = description.length > maxLength;

    const displayDescription = needsTruncation
      ? `${description.substring(0, maxLength)}...`
      : description;

    if (!description.trim()) {
      return <p className="text-sm text-muted-foreground">No description available</p>;
    }

    return (
      <div className="flex items-center gap-2">
        <p className="text-sm text-muted-foreground flex-1">
          {displayDescription}
        </p>
        {needsTruncation && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowFullDescription(project.id);
            }}
            className="p-1 rounded hover:bg-surface-elevated transition-colors flex-shrink-0"
            title="Click to view full description"
          >
            <Eye className="h-3 w-3 text-muted-foreground hover:text-white" />
          </button>
        )}
      </div>
    );
  };

  const projectStats = {
    total: projects.length,
    active: projects.filter(p => p.status === 'active').length,
    completed: projects.filter(p => p.status === 'completed').length,
    totalBudget: projects.reduce((sum, p) => sum + (Number(p.budget) || 0), 0),
    totalSpent: projects.reduce((sum, p) => sum + p.spent, 0),
    totalHours: projects.reduce((sum, p) => sum + p.hoursLogged, 0)
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold gradient-text">Projects</h1>
          <p className="text-muted-foreground mt-2">Manage and track your project portfolio</p>
        </div>
        <div className="flex items-center space-x-2">
          <div className="flex items-center bg-surface-elevated rounded-lg p-1">
            <button
              onClick={() => setViewMode('grid')}
              className={cn(
                "px-3 py-1 rounded text-sm font-medium transition-colors",
                viewMode === 'grid' ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground"
              )}
            >
              Grid
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={cn(
                "px-3 py-1 rounded text-sm font-medium transition-colors",
                viewMode === 'list' ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground"
              )}
            >
              List
            </button>
          </div>
          <Button 
            onClick={() => setShowNewProjectModal(true)}
            className="bg-gradient-primary hover:bg-gradient-primary/90 text-white shadow-glow"
          >
            <Plus className="h-4 w-4 mr-2" />
            New Project
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="glass shadow-elevation">
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="h-12 w-12 rounded-xl bg-gradient-primary flex items-center justify-center shadow-glow mr-4">
                <Building2 className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold">{projectStats.total}</p>
                <p className="text-sm text-muted-foreground">Total Projects</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass shadow-elevation">
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="h-12 w-12 rounded-xl bg-gradient-success flex items-center justify-center shadow-glow mr-4">
                <Activity className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold">{projectStats.active}</p>
                <p className="text-sm text-muted-foreground">Active Projects</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass shadow-elevation">
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="h-12 w-12 rounded-xl bg-gradient-info flex items-center justify-center shadow-glow mr-4">
                <DollarSign className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold">${(projectStats.totalBudget / 1000).toFixed(0)}k</p>
                <p className="text-sm text-muted-foreground">Total Budget</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass shadow-elevation">
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="h-12 w-12 rounded-xl bg-gradient-warning flex items-center justify-center shadow-glow mr-4">
                <Clock className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold">{projectStats.totalHours}</p>
                <p className="text-sm text-muted-foreground">Hours Logged</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="glass shadow-elevation">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row gap-4 items-center">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-4 py-2 glass-surface border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="all">All Status</option>
              <option value="planning">Planning</option>
              <option value="active">Active</option>
              <option value="on_hold">On Hold</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>

            <select
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value)}
              className="px-4 py-2 glass-surface border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="all">All Priority</option>
              <option value="high">High Priority</option>
              <option value="medium">Medium Priority</option>
              <option value="low">Low Priority</option>
            </select>

            <div className="ml-auto text-sm text-muted-foreground">
              Showing {filteredProjects.length} of {projects.length} projects
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Projects Grid/List */}
      <div className={cn(
        viewMode === 'grid' 
          ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          : "space-y-4"
      )}>
        {filteredProjects.map((project) => (
          <Card
            key={project.id}
            className={cn(
              "glass shadow-elevation cursor-pointer transition-all duration-200 hover:shadow-lg hover:-translate-y-1 relative overflow-hidden",
              viewMode === 'list' && "w-full"
            )}
            onClick={() => setSelectedProject(project)}
          >
            {/* Color Indicator Bar */}
            <div
              className="absolute left-0 top-0 bottom-0 w-2 z-10 rounded-r-sm"
              style={{ backgroundColor: project.color }}
            />
            <CardHeader className="pb-4 pl-6">
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-3 flex-1 min-w-0">
                  <div
                    className="h-10 w-10 rounded-xl flex items-center justify-center shadow-glow text-white flex-shrink-0"
                    style={{ backgroundColor: project.color }}
                  >
                    {getStatusIcon(project.status)}
                    <span className="sr-only">{project.status}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <ProjectTitle project={project} />
                    <p className="text-sm text-muted-foreground truncate">
                      {project.client?.name || parseClientFromDescription(project.description) || 'No client assigned'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2 flex-shrink-0 ml-2">
                  <Badge className={cn("text-xs", getStatusColor(project.status))}>
                    {getStatusIcon(project.status)}
                    <span className="ml-1 capitalize">{project.status.replace('_', ' ')}</span>
                  </Badge>
                  <div className="relative">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 w-6 p-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDropdownOpen(dropdownOpen === project.id ? null : project.id);
                      }}
                    >
                      <MoreVertical className="h-3 w-3" />
                    </Button>
                    {dropdownOpen === project.id && (
                      <div className="absolute right-0 top-8 z-50 bg-surface-elevated border border-border rounded-lg shadow-lg py-2 min-w-[120px]">
                        <button
                          className="w-full px-3 py-2 text-sm text-left hover:bg-muted flex items-center gap-2"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingProject(project);
                            setDropdownOpen(null);
                          }}
                        >
                          <Edit3 className="h-3 w-3" />
                          Edit
                        </button>
                        <button
                          className="w-full px-3 py-2 text-sm text-left hover:bg-muted text-red-400 hover:text-red-300 flex items-center gap-2"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDropdownOpen(null);
                            handleDeleteProject(project);
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="space-y-4 pl-6">
              <ProjectDescription project={project} />
              
              {/* Progress Bar */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Progress</span>
                  <span className="text-sm text-muted-foreground">{project.progress}%</span>
                </div>
                <div className="w-full h-2 bg-surface-elevated rounded-full">
                  <div 
                    className="h-full bg-gradient-primary rounded-full transition-all duration-300"
                    style={{ width: `${project.progress}%` }}
                  />
                </div>
              </div>

              {/* Project Stats */}
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-2 glass-surface rounded-lg">
                  <p className="text-lg font-bold">{project.tasks?.completed || 0}/{project.tasks?.total || 0}</p>
                  <p className="text-xs text-muted-foreground">Tasks</p>
                </div>
                <div className="text-center p-2 glass-surface rounded-lg">
                  <p className="text-lg font-bold">{project.hoursLogged}h</p>
                  <p className="text-xs text-muted-foreground">Logged</p>
                </div>
              </div>

              {/* Budget Info */}
              {(project.budget && project.budget > 0) && (
                <div className="flex items-center justify-between p-2 glass-surface rounded-lg">
                  <div>
                    <p className="text-sm font-medium">${(project.spent || 0).toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">of ${project.budget.toLocaleString()}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">{Math.round(((project.spent || 0) / project.budget) * 100)}%</p>
                    <p className="text-xs text-muted-foreground">spent</p>
                  </div>
                </div>
              )}

              {/* Team Members */}
              {project.teamMembers && project.teamMembers.length > 0 && (
                <div className="flex items-center space-x-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <div className="flex -space-x-2">
                    {project.teamMembers.slice(0, 3).map((member, index) => (
                      <div
                        key={index}
                        className="h-6 w-6 rounded-full bg-gradient-primary border-2 border-background flex items-center justify-center"
                        title={member}
                      >
                        <span className="text-xs font-medium text-white">
                          {member.split('@')[0].charAt(0).toUpperCase()}
                        </span>
                      </div>
                    ))}
                    {project.teamMembers.length > 3 && (
                      <div className="h-6 w-6 rounded-full bg-muted border-2 border-background flex items-center justify-center">
                        <span className="text-xs text-muted-foreground">+{project.teamMembers.length - 3}</span>
                      </div>
                    )}
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {project.teamMembers.length} member{project.teamMembers.length !== 1 ? 's' : ''}
                  </span>
                </div>
              )}

              {/* Tags */}
              {project.tags && project.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {project.tags.slice(0, 3).map((tag) => (
                    <span key={tag} className="px-2 py-1 bg-muted/20 text-muted-foreground text-xs rounded">
                      #{tag}
                    </span>
                  ))}
                  {project.tags.length > 3 && (
                    <span className="px-2 py-1 bg-muted/20 text-muted-foreground text-xs rounded">
                      +{project.tags.length - 3}
                    </span>
                  )}
                </div>
              )}

              {/* Dates */}
              <div className="space-y-2 pt-3 border-t border-border">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Calendar className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium text-white">Project Timeline</span>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-2">
                  <div className="flex items-center justify-between p-2 bg-surface-elevated rounded-lg">
                    <span className="text-xs text-muted-foreground">Start Date</span>
                    <span className="text-sm font-medium text-white">
                      {project.startDate ? new Date(project.startDate).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      }) : 'Not set'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-2 bg-surface-elevated rounded-lg">
                    <span className="text-xs text-muted-foreground">End Date</span>
                    <span className="text-sm font-medium text-white">
                      {project.endDate ? new Date(project.endDate).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      }) : 'Not set'}
                    </span>
                  </div>
                  {project.startDate && project.endDate && (
                    <div className="flex items-center justify-between p-2 bg-primary/10 border border-primary/20 rounded-lg">
                      <span className="text-xs text-primary">Duration</span>
                      <span className="text-sm font-medium text-primary">
                        {Math.ceil((new Date(project.endDate).getTime() - new Date(project.startDate).getTime()) / (1000 * 60 * 60 * 24))} days
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredProjects.length === 0 && (
        <Card className="glass shadow-elevation">
          <CardContent className="text-center py-12">
            <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No projects found</h3>
            <p className="text-muted-foreground mb-4">
              {filterStatus !== 'all' || filterPriority !== 'all' 
                ? 'Try adjusting your filters'
                : 'Create your first project to get started'
              }
            </p>
            <Button onClick={() => setShowNewProjectModal(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Project
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Create Project Modal */}
      <ProjectModal
        isOpen={showNewProjectModal}
        onClose={() => setShowNewProjectModal(false)}
        onSave={handleCreateProject}
      />

      {/* Edit Project Modal */}
      <ProjectModal
        isOpen={!!editingProject}
        onClose={() => setEditingProject(null)}
        onSave={handleUpdateProject}
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
          clientName: parseClientFromDescription(editingProject.description) || undefined
        } : undefined}
      />


      {/* Full Title Modal */}
      {showFullTitle && createPortal(
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
            if (e.target === e.currentTarget) {
              setShowFullTitle(null);
            }
          }}
        >
          <div
            className="modal-content glass shadow-elevation"
            style={{
              maxWidth: '500px',
              width: '95%',
              maxHeight: '90vh',
              overflowY: 'auto',
              position: 'relative',
              backgroundColor: '#1a1a1a',
              borderRadius: '12px',
              border: '1px solid #333'
            }}
          >
            <div className="modal-header" style={{
              background: 'linear-gradient(135deg, #646cff, #8b5cf6)',
              borderRadius: '8px 8px 0 0',
              padding: '20px',
              color: 'white'
            }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Eye className="w-5 h-5" />
                  <h2 className="text-lg font-bold m-0">Full Project Title</h2>
                </div>
                <button
                  className="bg-white/20 hover:bg-white/30 rounded-lg p-2"
                  onClick={() => setShowFullTitle(null)}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div style={{ padding: '20px' }}>
              <p className="text-white text-base leading-relaxed">
                {projects.find(p => p.id === showFullTitle)?.name}
              </p>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Full Description Modal */}
      {showFullDescription && createPortal(
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
            if (e.target === e.currentTarget) {
              setShowFullDescription(null);
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
            <div className="modal-header" style={{
              background: 'linear-gradient(135deg, #10b981, #059669)',
              borderRadius: '8px 8px 0 0',
              padding: '20px',
              color: 'white'
            }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Eye className="w-5 h-5" />
                  <h2 className="text-lg font-bold m-0">Full Project Description</h2>
                </div>
                <button
                  className="bg-white/20 hover:bg-white/30 rounded-lg p-2"
                  onClick={() => setShowFullDescription(null)}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div style={{ padding: '20px' }}>
              <p className="text-white text-base leading-relaxed">
                {parseDescriptionFromCombined(projects.find(p => p.id === showFullDescription)?.description || '')}
              </p>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}