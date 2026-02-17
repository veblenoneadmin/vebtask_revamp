import { useState, useEffect } from 'react';
import { useSession } from '../lib/auth-client';
import { Card, CardContent, CardHeader } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { 
  User,
  Bell,
  Shield,
  Palette,
  DollarSign,
  Mail,
  Phone,
  MapPin,
  Save,
  Eye,
  EyeOff,
  Camera,
  Trash2
} from 'lucide-react';

export function Settings() {
  const { data: session } = useSession();
  const [activeTab, setActiveTab] = useState('profile');
  const [showPassword, setShowPassword] = useState(false);
  
  // Extract real user data from session
  const userName = session?.user?.name || '';
  const nameWords = userName.split(' ');
  const firstName = nameWords[0] || '';
  const lastName = nameWords.slice(1).join(' ') || '';
  
  // Form states with real user data
  const [profile, setProfile] = useState({
    firstName: firstName,
    lastName: lastName,
    email: session?.user?.email || '',
    phone: '',
    location: '',
    bio: '',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    hourlyRate: 0
  });

  const [notifications, setNotifications] = useState({
    emailNotifications: true,
    pushNotifications: true,
    taskReminders: true,
    weeklyReports: true,
    marketingEmails: false
  });

  // Update profile data when session changes
  useEffect(() => {
    if (session?.user) {
      const userName = session.user.name || '';
      const nameWords = userName.split(' ');
      const firstName = nameWords[0] || '';
      const lastName = nameWords.slice(1).join(' ') || '';
      
      setProfile(prev => ({
        ...prev,
        firstName: firstName,
        lastName: lastName,
        email: session.user.email || '',
      }));
    }
  }, [session]);

  console.log('Settings page loaded with user:', session?.user?.name);

  const tabs = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'preferences', label: 'Preferences', icon: Palette },
    { id: 'billing', label: 'Billing', icon: DollarSign },
    { id: 'security', label: 'Security', icon: Shield }
  ];

  const handleSave = (section: string) => {
    console.log(`Saving ${section}...`);
    // Here you would normally save to your backend
  };

  const renderProfileSettings = () => (
    <div className="space-y-6">
      {/* Profile Picture */}
      <Card className="glass shadow-elevation">
        <CardContent className="p-6">
          <h3 className="text-lg font-semibold mb-4">Profile Picture</h3>
          <div className="flex items-center space-x-4">
            <div className="h-20 w-20 rounded-full bg-gradient-primary flex items-center justify-center shadow-glow">
              <span className="text-2xl font-bold text-white">
                {profile.firstName[0]}{profile.lastName[0]}
              </span>
            </div>
            <div className="space-x-2">
              <Button size="sm" className="glass-surface">
                <Camera className="h-4 w-4 mr-2" />
                Upload Photo
              </Button>
              <Button size="sm" variant="outline" className="glass-surface">
                <Trash2 className="h-4 w-4 mr-2" />
                Remove
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Personal Information */}
      <Card className="glass shadow-elevation">
        <CardHeader>
          <h3 className="text-lg font-semibold">Personal Information</h3>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">First Name</label>
              <input
                type="text"
                value={profile.firstName}
                onChange={(e) => setProfile(prev => ({ ...prev, firstName: e.target.value }))}
                className="w-full px-3 py-2 glass-surface border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Last Name</label>
              <input
                type="text"
                value={profile.lastName}
                onChange={(e) => setProfile(prev => ({ ...prev, lastName: e.target.value }))}
                className="w-full px-3 py-2 glass-surface border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-2">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <input
                type="email"
                value={profile.email}
                onChange={(e) => setProfile(prev => ({ ...prev, email: e.target.value }))}
                className="w-full pl-10 pr-3 py-2 glass-surface border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Phone</label>
              <div className="relative">
                <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <input
                  type="tel"
                  value={profile.phone}
                  onChange={(e) => setProfile(prev => ({ ...prev, phone: e.target.value }))}
                  className="w-full pl-10 pr-3 py-2 glass-surface border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Location</label>
              <div className="relative">
                <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  value={profile.location}
                  onChange={(e) => setProfile(prev => ({ ...prev, location: e.target.value }))}
                  className="w-full pl-10 pr-3 py-2 glass-surface border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Bio</label>
            <textarea
              value={profile.bio}
              onChange={(e) => setProfile(prev => ({ ...prev, bio: e.target.value }))}
              rows={3}
              className="w-full px-3 py-2 glass-surface border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Timezone</label>
              <select
                value={profile.timezone}
                onChange={(e) => setProfile(prev => ({ ...prev, timezone: e.target.value }))}
                className="w-full px-3 py-2 glass-surface border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="America/Los_Angeles">Pacific Time (PT)</option>
                <option value="America/Denver">Mountain Time (MT)</option>
                <option value="America/Chicago">Central Time (CT)</option>
                <option value="America/New_York">Eastern Time (ET)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Default Hourly Rate</label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <input
                  type="number"
                  value={profile.hourlyRate}
                  onChange={(e) => setProfile(prev => ({ ...prev, hourlyRate: Number(e.target.value) }))}
                  className="w-full pl-10 pr-3 py-2 glass-surface border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>
          </div>

          <Button onClick={() => handleSave('profile')} className="bg-gradient-primary hover:bg-gradient-primary/90 text-white">
            <Save className="h-4 w-4 mr-2" />
            Save Changes
          </Button>
        </CardContent>
      </Card>
    </div>
  );

  const renderNotificationSettings = () => (
    <Card className="glass shadow-elevation">
      <CardHeader>
        <h3 className="text-lg font-semibold">Notification Preferences</h3>
      </CardHeader>
      <CardContent className="space-y-6">
        {Object.entries(notifications).map(([key, value]) => (
          <div key={key} className="flex items-center justify-between py-2">
            <div>
              <p className="font-medium">
                {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
              </p>
              <p className="text-sm text-muted-foreground">
                {key === 'emailNotifications' && 'Receive email notifications for important updates'}
                {key === 'pushNotifications' && 'Get push notifications on your devices'}
                {key === 'taskReminders' && 'Reminders for upcoming task deadlines'}
                {key === 'weeklyReports' && 'Weekly productivity and time tracking reports'}
                {key === 'marketingEmails' && 'Product updates and promotional content'}
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={value}
                onChange={(e) => setNotifications(prev => ({ ...prev, [key]: e.target.checked }))}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-muted peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
            </label>
          </div>
        ))}
        
        <Button onClick={() => handleSave('notifications')} className="bg-gradient-primary hover:bg-gradient-primary/90 text-white">
          <Save className="h-4 w-4 mr-2" />
          Save Preferences
        </Button>
      </CardContent>
    </Card>
  );

  const renderTab = () => {
    switch (activeTab) {
      case 'profile':
        return renderProfileSettings();
      case 'notifications':
        return renderNotificationSettings();
      case 'preferences':
        return (
          <Card className="glass shadow-elevation">
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold mb-4">App Preferences</h3>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Theme</label>
                    <select className="w-full px-3 py-2 glass-surface border border-border rounded-lg">
                      <option value="dark">Dark</option>
                      <option value="light">Light</option>
                      <option value="auto">Auto</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Date Format</label>
                    <select className="w-full px-3 py-2 glass-surface border border-border rounded-lg">
                      <option value="MM/dd/yyyy">MM/DD/YYYY</option>
                      <option value="dd/MM/yyyy">DD/MM/YYYY</option>
                      <option value="yyyy-MM-dd">YYYY-MM-DD</option>
                    </select>
                  </div>
                </div>
                <p className="text-center text-muted-foreground">More preference options coming soon...</p>
              </div>
            </CardContent>
          </Card>
        );
      case 'billing':
        return (
          <Card className="glass shadow-elevation">
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold mb-4">Billing & Subscription</h3>
              <div className="text-center py-8">
                <DollarSign className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">Billing features coming soon...</p>
              </div>
            </CardContent>
          </Card>
        );
      case 'security':
        return (
          <Card className="glass shadow-elevation">
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold mb-4">Security Settings</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Change Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Enter new password"
                      className="w-full pl-3 pr-10 py-2 glass-surface border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <p className="text-center text-muted-foreground">More security options coming soon...</p>
              </div>
            </CardContent>
          </Card>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold gradient-text">Settings</h1>
        <p className="text-muted-foreground mt-2">Manage your account preferences and configuration</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Sidebar Navigation */}
        <div className="lg:col-span-1">
          <Card className="glass shadow-elevation">
            <CardContent className="p-0">
              <div className="space-y-1">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`w-full flex items-center space-x-3 px-4 py-3 text-left transition-colors ${
                        activeTab === tab.id 
                          ? 'bg-primary/10 text-primary border-r-2 border-primary' 
                          : 'text-muted-foreground hover:text-foreground hover:bg-surface-elevated/50'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      <span className="font-medium">{tab.label}</span>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <div className="lg:col-span-3">
          {renderTab()}
        </div>
      </div>
    </div>
  );
}