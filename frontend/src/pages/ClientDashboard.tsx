import { useState, useEffect } from 'react';
import { useSession } from '../lib/auth-client';
import { useApiClient } from '../lib/api-client';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Progress } from '../components/ui/progress';
import { 
  CheckCircle2, 
  Clock, 
  Calendar,
  TrendingUp,
  FileText,
  BarChart3,
  AlertCircle,
  Loader2
} from 'lucide-react';

interface TaskSummary {
  id: string;
  title: string;
  description?: string;
  status: 'not_started' | 'in_progress' | 'completed' | 'cancelled';
  priority: 'Urgent' | 'High' | 'Medium' | 'Low';
  estimatedHours?: number;
  actualHours?: number;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
  userId: string;
  orgId: string;
}

interface TimeEntry {
  id: string;
  taskId: string;
  taskTitle: string;
  begin: string;
  end?: string;
  duration: number;
  description?: string;
  category: string;
  isBillable: boolean;
}

interface DashboardStats {
  totalTasks: number;
  completedTasks: number;
  activeTasks: number;
  totalHours: number;
  thisWeekHours: number;
  completionRate: number;
}

export function ClientDashboard() {
  const { data: session } = useSession();
  const apiClient = useApiClient();
  const [tasks, setTasks] = useState<TaskSummary[]>([]);
  const [recentTimeEntries, setRecentTimeEntries] = useState<TimeEntry[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    totalTasks: 0,
    completedTasks: 0,
    activeTasks: 0,
    totalHours: 0,
    thisWeekHours: 0,
    completionRate: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session?.user?.id) return;

    const loadDashboardData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch tasks
        const tasksResponse = await apiClient.fetch(`/api/tasks/recent?userId=${session.user.id}&limit=50`);
        if (tasksResponse.success) {
          setTasks(tasksResponse.tasks || []);
        }

        // Fetch recent time entries
        const timeResponse = await apiClient.fetch(`/api/timers/recent?userId=${session.user.id}&limit=10`);
        if (timeResponse.entries) {
          setRecentTimeEntries(timeResponse.entries.map((entry: any) => ({
            id: entry.id,
            taskId: entry.taskId,
            taskTitle: entry.taskTitle || 'Untitled Task',
            begin: entry.startTime,
            end: entry.endTime,
            duration: entry.duration || 0,
            description: entry.description || '',
            category: entry.category || 'work',
            isBillable: false // Will be enhanced later
          })));
        }

        // Calculate stats from tasks
        if (tasksResponse.success && tasksResponse.tasks) {
          const allTasks = tasksResponse.tasks;
          const completed = allTasks.filter((t: TaskSummary) => t.status === 'completed').length;
          const active = allTasks.filter((t: TaskSummary) => 
            t.status === 'in_progress' || t.status === 'not_started'
          ).length;
          const totalHours = allTasks.reduce((sum: number, t: TaskSummary) => sum + (t.actualHours || 0), 0);
          
          // Calculate this week's hours from time entries
          const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
          const thisWeekEntries = timeResponse.entries?.filter((entry: any) => 
            new Date(entry.startTime) >= oneWeekAgo
          ) || [];
          const thisWeekHours = thisWeekEntries.reduce((sum: number, entry: any) => 
            sum + (entry.duration || 0), 0) / 3600; // Convert seconds to hours

          setStats({
            totalTasks: allTasks.length,
            completedTasks: completed,
            activeTasks: active,
            totalHours,
            thisWeekHours: Math.round(thisWeekHours * 10) / 10,
            completionRate: allTasks.length > 0 ? Math.round((completed / allTasks.length) * 100) : 0
          });
        }

      } catch (err: any) {
        console.error('Error loading dashboard data:', err);
        setError(err.message || 'Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    };

    loadDashboardData();
  }, [session?.user?.id, apiClient]);

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'Urgent': return 'destructive';
      case 'High': return 'destructive';
      case 'Medium': return 'secondary';
      case 'Low': return 'outline';
      default: return 'secondary';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-600';
      case 'in_progress': return 'text-blue-600';
      case 'not_started': return 'text-gray-600';
      default: return 'text-gray-600';
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2">Loading dashboard...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2 text-destructive">
              <AlertCircle className="h-4 w-4" />
              <span>{error}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Client Dashboard</h1>
        <Badge variant="outline">
          {stats.activeTasks} Active Tasks
        </Badge>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Tasks</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalTasks}</div>
            <p className="text-xs text-muted-foreground">
              {stats.completedTasks} completed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.completionRate}%</div>
            <Progress value={stats.completionRate} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Hours</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalHours.toFixed(1)}h</div>
            <p className="text-xs text-muted-foreground">
              All time
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">This Week</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.thisWeekHours}h</div>
            <p className="text-xs text-muted-foreground">
              Last 7 days
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tasks and Time Entries */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Recent Tasks */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <FileText className="h-5 w-5" />
              <span>Recent Tasks</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {tasks.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No tasks found</p>
                <p className="text-sm">Tasks will appear here once created</p>
              </div>
            ) : (
              <div className="space-y-4">
                {tasks.slice(0, 5).map((task) => (
                  <div key={task.id} className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-medium truncate">{task.title}</h4>
                      <div className="flex items-center space-x-2 mt-1">
                        <Badge variant={getPriorityColor(task.priority)} className="text-xs">
                          {task.priority}
                        </Badge>
                        <span className={`text-xs ${getStatusColor(task.status)}`}>
                          {task.status.replace('_', ' ')}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium">
                        {task.actualHours || 0}h / {task.estimatedHours || 0}h
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatDate(task.updatedAt)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Time Entries */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <BarChart3 className="h-5 w-5" />
              <span>Recent Time Entries</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentTimeEntries.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No time entries found</p>
                <p className="text-sm">Time tracking data will appear here</p>
              </div>
            ) : (
              <div className="space-y-4">
                {recentTimeEntries.map((entry) => (
                  <div key={entry.id} className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-medium truncate">{entry.taskTitle}</h4>
                      <div className="flex items-center space-x-2 mt-1">
                        <Badge variant="outline" className="text-xs">
                          {entry.category}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {formatDate(entry.begin)}
                        </span>
                      </div>
                      {entry.description && (
                        <p className="text-xs text-muted-foreground mt-1 truncate">
                          {entry.description}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium">
                        {formatDuration(entry.duration)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {entry.end ? 'Completed' : 'Running'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}