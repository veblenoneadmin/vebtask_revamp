import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { 
  Users, 
  UserPlus, 
  Settings, 
  Shield, 
  Mail, 
  Trash2,
  Edit3,
  Crown,
  UserCog,
  Building2,
  Clock,
  BarChart3
} from 'lucide-react';

interface User {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
  createdAt: string;
  memberships: Array<{
    id: string;
    role: 'OWNER' | 'ADMIN' | 'STAFF' | 'CLIENT';
    org: {
      name: string;
      slug: string;
    };
  }>;
  _count: {
    timeLogs: number;
    createdTasks: number;
  };
}

interface Invite {
  id: string;
  email: string;
  role: 'ADMIN' | 'STAFF' | 'CLIENT';
  status: 'PENDING' | 'ACCEPTED' | 'EXPIRED' | 'REVOKED';
  createdAt: string;
  expiresAt: string;
  invitedBy: {
    name: string;
    email: string;
  };
}

export function Admin() {
  const [activeTab, setActiveTab] = useState('users');
  const [users, setUsers] = useState<User[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // New user invite form
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'ADMIN' | 'STAFF' | 'CLIENT'>('STAFF');
  const [inviting, setInviting] = useState(false);
  
  // User editing
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editingRole, setEditingRole] = useState<'ADMIN' | 'STAFF' | 'CLIENT'>('STAFF');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch all users in the organization
      const usersResponse = await fetch('/api/admin/users');
      if (usersResponse.ok) {
        const usersData = await usersResponse.json();
        setUsers(usersData.users || []);
      }
      
      // Fetch pending invites
      const invitesResponse = await fetch('/api/admin/invites');
      if (invitesResponse.ok) {
        const invitesData = await invitesResponse.json();
        setInvites(invitesData.invites || []);
      }
      
    } catch (err) {
      setError('Failed to load admin data');
      console.error('Admin data fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleInviteUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    
    try {
      setInviting(true);
      const response = await fetch('/api/admin/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: inviteEmail,
          role: inviteRole
        })
      });
      
      if (response.ok) {
        setInviteEmail('');
        setShowInviteForm(false);
        fetchData(); // Refresh data
        alert('Invitation sent successfully!');
      } else {
        const error = await response.json();
        alert(`Failed to send invitation: ${error.error}`);
      }
    } catch (err) {
      alert('Failed to send invitation');
    } finally {
      setInviting(false);
    }
  };

  const handleUpdateUserRole = async (userId: string, newRole: 'ADMIN' | 'STAFF' | 'CLIENT') => {
    try {
      const response = await fetch(`/api/admin/users/${userId}/role`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole })
      });
      
      if (response.ok) {
        fetchData(); // Refresh data
        setEditingUser(null);
        alert('User role updated successfully!');
      } else {
        const error = await response.json();
        alert(`Failed to update role: ${error.error}`);
      }
    } catch (err) {
      alert('Failed to update user role');
    }
  };

  const handleRevokeInvite = async (inviteId: string) => {
    if (!confirm('Are you sure you want to revoke this invitation?')) return;
    
    try {
      const response = await fetch(`/api/admin/invites/${inviteId}/revoke`, {
        method: 'POST'
      });
      
      if (response.ok) {
        fetchData(); // Refresh data
      } else {
        alert('Failed to revoke invitation');
      }
    } catch (err) {
      alert('Failed to revoke invitation');
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'OWNER': return <Crown className="w-4 h-4 text-yellow-600" />;
      case 'ADMIN': return <Shield className="w-4 h-4 text-blue-600" />;
      case 'STAFF': return <UserCog className="w-4 h-4 text-green-600" />;
      case 'CLIENT': return <Users className="w-4 h-4 text-gray-600" />;
      default: return <Users className="w-4 h-4" />;
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'OWNER': return 'bg-yellow-100 text-yellow-800';
      case 'ADMIN': return 'bg-blue-100 text-blue-800';
      case 'STAFF': return 'bg-green-100 text-green-800';
      case 'CLIENT': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-6"></div>
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold gradient-text">Administration</h1>
          <p className="text-muted-foreground">Manage users, permissions, and system settings</p>
        </div>
        <div className="flex items-center space-x-2">
          <Building2 className="w-5 h-5 text-primary" />
          <span className="font-medium text-foreground">Veblen Organization</span>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="glass p-6 shadow-elevation">
          <div className="flex items-center">
            <div className="h-12 w-12 rounded-xl bg-gradient-primary flex items-center justify-center shadow-glow mr-4">
              <Users className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total Users</p>
              <p className="text-2xl font-bold text-foreground">{users.length}</p>
            </div>
          </div>
        </div>
        
        <div className="glass p-6 shadow-elevation">
          <div className="flex items-center">
            <div className="h-12 w-12 rounded-xl bg-gradient-success flex items-center justify-center shadow-glow mr-4">
              <Mail className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Pending Invites</p>
              <p className="text-2xl font-bold text-foreground">{invites.filter(i => i.status === 'PENDING').length}</p>
            </div>
          </div>
        </div>
        
        <div className="glass p-6 shadow-elevation">
          <div className="flex items-center">
            <div className="h-12 w-12 rounded-xl bg-gradient-info flex items-center justify-center shadow-glow mr-4">
              <Clock className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Active Sessions</p>
              <p className="text-2xl font-bold text-foreground">{users.filter(u => u.memberships.length > 0).length}</p>
            </div>
          </div>
        </div>
        
        <div className="glass p-6 shadow-elevation">
          <div className="flex items-center">
            <div className="h-12 w-12 rounded-xl bg-gradient-warning flex items-center justify-center shadow-glow mr-4">
              <BarChart3 className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total Tasks</p>
              <p className="text-2xl font-bold text-foreground">{users.reduce((acc, u) => acc + u._count.createdTasks, 0)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex space-x-1 glass p-1 rounded-lg w-fit">
        <button
          onClick={() => setActiveTab('users')}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center ${
            activeTab === 'users'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground hover:bg-surface-elevated'
          }`}
        >
          <Users className="w-4 h-4 mr-2" />
          Users ({users.length})
        </button>
        <button
          onClick={() => setActiveTab('invites')}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center ${
            activeTab === 'invites'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground hover:bg-surface-elevated'
          }`}
        >
          <Mail className="w-4 h-4 mr-2" />
          Invitations ({invites.length})
        </button>
        <button
          onClick={() => setActiveTab('settings')}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center ${
            activeTab === 'settings'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground hover:bg-surface-elevated'
          }`}
        >
          <Settings className="w-4 h-4 mr-2" />
          System Settings
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'users' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">User Management</h2>
            <button
              onClick={() => setShowInviteForm(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center space-x-2"
            >
              <UserPlus className="w-4 h-4" />
              <span>Invite User</span>
            </button>
          </div>

          {/* Users Table */}
          <Card className="glass shadow-elevation">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Users className="mr-2 h-5 w-5" />
                Organization Users
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-border">
                  <thead className="bg-surface-elevated/50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        User
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Role
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Activity
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="glass divide-y divide-border">
                  {users.map((user) => (
                    <tr key={user.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                            <span className="text-sm font-medium text-gray-700">
                              {user.name?.charAt(0).toUpperCase() || user.email.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">{user.name || 'No name'}</div>
                            <div className="text-sm text-gray-500">{user.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center space-x-2">
                          {getRoleIcon(user.memberships[0]?.role || 'CLIENT')}
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getRoleBadgeColor(user.memberships[0]?.role || 'CLIENT')}`}>
                            {user.memberships[0]?.role || 'CLIENT'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          user.emailVerified ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {user.emailVerified ? 'Active' : 'Pending'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div>{user._count.timeLogs} time logs</div>
                        <div>{user._count.createdTasks} tasks</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        {user.memberships[0]?.role !== 'OWNER' && (
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => {
                                setEditingUser(user);
                                setEditingRole(user.memberships[0]?.role as any || 'CLIENT');
                              }}
                              className="text-blue-600 hover:text-blue-900 flex items-center space-x-1"
                            >
                              <Edit3 className="w-4 h-4" />
                              <span>Edit</span>
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 'invites' && (
        <div className="space-y-6">
          <h2 className="text-xl font-semibold">Pending Invitations</h2>
          
          {invites.length > 0 ? (
            <div className="bg-white shadow-sm rounded-lg border border-gray-200">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Email
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Role
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Invited By
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {invites.map((invite) => (
                      <tr key={invite.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {invite.email}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center space-x-2">
                            {getRoleIcon(invite.role)}
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getRoleBadgeColor(invite.role)}`}>
                              {invite.role}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            invite.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
                            invite.status === 'ACCEPTED' ? 'bg-green-100 text-green-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {invite.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {invite.invitedBy.name || invite.invitedBy.email}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          {invite.status === 'PENDING' && (
                            <button
                              onClick={() => handleRevokeInvite(invite.id)}
                              className="text-red-600 hover:text-red-900 flex items-center space-x-1"
                            >
                              <Trash2 className="w-4 h-4" />
                              <span>Revoke</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
              <Mail className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No pending invitations</h3>
              <p className="text-gray-500 mb-4">Invite team members to start collaborating</p>
              <button
                onClick={() => setShowInviteForm(true)}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
              >
                Send Invitation
              </button>
            </div>
          )}
        </div>
      )}

      {activeTab === 'settings' && (
        <div className="space-y-6">
          <h2 className="text-xl font-semibold">System Settings</h2>
          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <h3 className="text-lg font-medium mb-4">Organization Settings</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Organization Name</label>
                <input
                  type="text"
                  value="Veblen"
                  readOnly
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Organization Slug</label>
                <input
                  type="text"
                  value="veblen"
                  readOnly
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Invite Form Modal */}
      {showInviteForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Invite User</h3>
            <form onSubmit={handleInviteUser} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="user@example.com"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Role
                </label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as any)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="CLIENT">Client</option>
                  <option value="STAFF">Staff</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowInviteForm(false)}
                  className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={inviting}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {inviting ? 'Sending...' : 'Send Invitation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Role Modal */}
      {editingUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Edit User Role</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  User
                </label>
                <div className="px-3 py-2 bg-gray-50 rounded-md">
                  <div className="font-medium">{editingUser.name || 'No name'}</div>
                  <div className="text-sm text-gray-500">{editingUser.email}</div>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  New Role
                </label>
                <select
                  value={editingRole}
                  onChange={(e) => setEditingRole(e.target.value as any)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="CLIENT">Client</option>
                  <option value="STAFF">Staff</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleUpdateUserRole(editingUser.id, editingRole)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Update Role
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}
    </div>
  );
}