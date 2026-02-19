import { useState, useEffect, useCallback } from 'react';
import { useSession } from '../lib/auth-client';
import { useOrganization } from '../contexts/OrganizationContext';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { ClientDashboard } from './ClientDashboard';
import { widgetService } from '../lib/widgets/WidgetService';
import { defaultDashboardLayouts, widgetDataFetchers } from '../lib/widgets/widgetRegistry';
import {
  Timer,
  Calendar,
  Zap,
  CheckSquare
} from 'lucide-react';

export function Dashboard() {
  const { data: session } = useSession();
  const { currentOrg, isLoading: orgLoading } = useOrganization();
  const [widgets, setWidgets] = useState<any[]>([]);
  const [widgetData, setWidgetData] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  
  // Load data for widgets
  const loadWidgetData = useCallback(async (widgetInstances: any[]) => {
    if (!session?.user?.id) return;

    const data: Record<string, any> = {};
    
    for (const instance of widgetInstances) {
      try {
        const fetcher = (widgetDataFetchers as any)[instance.widgetId];
        if (fetcher) {
          data[instance.instanceId] = await fetcher(currentOrg?.id, session.user.id);
        }
      } catch (error) {
        console.error(`Failed to load data for widget ${instance.widgetId}:`, error);
        data[instance.instanceId] = { error: 'Failed to load data' };
      }
    }
    
    setWidgetData(data);
  }, [session?.user?.id, currentOrg?.id]);

  // Initialize dashboard widgets
  useEffect(() => {
    const initializeDashboard = async () => {
      try {
        // Use layout based on user role
        const defaultLayout = currentOrg?.role === 'ADMIN' || currentOrg?.role === 'OWNER' 
          ? defaultDashboardLayouts.manager 
          : currentOrg?.role === 'STAFF'
          ? defaultDashboardLayouts.minimal
          : currentOrg?.role === 'CLIENT'
          ? defaultDashboardLayouts.client
          : defaultDashboardLayouts.standard;
        setWidgets(defaultLayout);
        
        // Load initial data for all widgets
        await loadWidgetData(defaultLayout);
      } catch (error) {
        console.error('Failed to initialize dashboard:', error);
      } finally {
        setLoading(false);
      }
    };

    if (session?.user && currentOrg?.id) {
      initializeDashboard();
    }
  }, [session, currentOrg, loadWidgetData]);

  const handleWidgetRefresh = async (instanceId: string, widgetId: string) => {
    if (!session?.user?.id) return;
    const fetcher = (widgetDataFetchers as any)[widgetId];
    
    if (fetcher) {
      try {
        const newData = await fetcher(currentOrg?.id, session.user.id);
        setWidgetData(prev => ({
          ...prev,
          [instanceId]: newData
        }));
      } catch (error) {
        console.error(`Failed to refresh widget ${widgetId}:`, error);
      }
    }
  };

  const renderWidget = (instance: any) => {
    const widget = widgetService.getWidget(instance.widgetId);
    if (!widget) return null;

    const WidgetComponent = widget.component;
    const data = widgetData[instance.instanceId];
    const hasError = data?.error;
    
    return (
      <div
        key={instance.instanceId}
        className={`${getGridSizeClass(instance.position)} h-fit`}
        style={{
          gridColumn: `${instance.position.x + 1} / span ${instance.position.width}`,
          gridRow: `${instance.position.y + 1} / span ${instance.position.height}`
        }}
      >
        <WidgetComponent
          config={widget.defaultConfig}
          data={data}
          loading={!data && !hasError}
          error={hasError ? data.error : null}
          onRefresh={() => handleWidgetRefresh(instance.instanceId, instance.widgetId)}
          orgId={currentOrg?.id || ''}
          userId={session?.user?.id || ''}
        />
      </div>
    );
  };

  const getGridSizeClass = (position: any) => {
    return `col-span-${position.width} row-span-${position.height}`;
  };
  
  const quickActions = [
    { name: 'Start Timer', icon: Timer, href: '/timer', color: 'success' },
    { name: 'Add Task', icon: CheckSquare, href: '/tasks', color: 'warning' },
    { name: 'Calendar', icon: Calendar, href: '/calendar', color: 'info' },
  ];

  // Early returns after all hooks
  // If user is a CLIENT, show the client-specific dashboard
  if (currentOrg?.role === 'CLIENT') {
    return <ClientDashboard />;
  }

  // Wait for both session and org to load
  if (!session || orgLoading || !currentOrg) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-surface to-surface-elevated">
        <div className="flex flex-col items-center space-y-6 animate-fade-in">
          <div className="relative">
            <img 
              src="/veblen-logo.png" 
              alt="Veblen" 
              className="w-32 h-32 object-contain animate-pulse-glow"
            />
          </div>
          <div className="flex flex-col items-center space-y-2">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
            <div className="text-lg font-medium text-muted-foreground">Loading Dashboard...</div>
          </div>
        </div>
      </div>
    );
  }

  const userName = session?.user?.email?.split('@')[0]?.replace(/[^a-zA-Z]/g, '') || 'User';
  const displayName = userName.charAt(0).toUpperCase() + userName.slice(1);

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold gradient-text">Good morning, {displayName}! 👋</h1>
            <p className="text-muted-foreground mt-2">Loading your dashboard...</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="glass p-6">
              <div className="animate-pulse">
                <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
                <div className="h-8 bg-muted rounded w-1/2"></div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Welcome Header */}
      <div>
        <h1 className="text-3xl font-bold gradient-text">Good morning, {displayName}! 👋</h1>
        <p className="text-muted-foreground mt-2">Here's your personalized dashboard with live data.</p>
      </div>

      {/* Quick Actions Bar */}
      <Card className="glass p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="h-10 w-10 rounded-lg bg-gradient-primary flex items-center justify-center">
              <Zap className="h-5 w-5 text-white" />
            </div>
            <div className="flex space-x-2">
              {quickActions.map((action) => {
                const Icon = action.icon;
                return (
                  <Button
                    key={action.name}
                    variant="ghost"
                    size="sm"
                    onClick={() => window.location.href = action.href}
                    className="flex items-center space-x-2"
                  >
                    <Icon className="h-4 w-4" />
                    <span className="hidden sm:inline">{action.name}</span>
                  </Button>
                );
              })}
            </div>
          </div>
          <Badge variant="secondary" className="text-xs">
            {widgets.length} widgets active
          </Badge>
        </div>
      </Card>

      {/* Dynamic Widget Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 auto-rows-min">
        {widgets.map(renderWidget)}
      </div>
    </div>
  );
}