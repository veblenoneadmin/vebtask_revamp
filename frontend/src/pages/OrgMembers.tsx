import { useState, useEffect } from 'react';
import { useSession } from '../lib/auth-client';
import { Plus, Mail, MoreHorizontal, Shield, UserX } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../components/ui/dialog';

interface ApiUser {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  createdAt: string;
  memberships: Array<{
    id: string;
    role: 'OWNER' | 'ADMIN' | 'STAFF' | 'CLIENT';
    org: { name: string; slug: string };
  }>;
  _count: { timeLogs: number; createdTasks: number };
}

interface Member {
  id: string;
  role: 'OWNER' | 'ADMIN' | 'STAFF' | 'CLIENT';
  joinedAt: string;
  user: {
    id: string;
    name?: string;
    email: string;
    image?: string;
  };
  stats?: {
    totalHours: number;
    totalSessions: number;
  };
  canModify: boolean;
}

interface Invite {
  id: string;
  email: string;
  role: string;
  status: 'PENDING' | 'ACCEPTED' | 'EXPIRED' | 'REVOKED';
  expiresAt: string;
  invitedBy: {
    name?: string;
    email: string;
  };
}

export function OrgMembers() {
  const { data: session } = useSession();
  
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'ADMIN' | 'STAFF' | 'CLIENT'>('STAFF');
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  // Fetch members and invites
  const fetchData = async () => {
    try {
      setLoading(true);
      const [membersRes, invitesRes] = await Promise.all([
        fetch('/api/admin/users', { credentials: 'include' }),
        fetch('/api/admin/invites', { credentials: 'include' }),
      ]);

      if (membersRes.ok) {
        const data = await membersRes.json();
        const apiUsers: ApiUser[] = data.users || [];
        const convertedMembers: Member[] = apiUsers.map(user => ({
          id: user.id,
          role: user.memberships[0]?.role || 'STAFF',
          joinedAt: user.createdAt,
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
          },
          stats: {
            totalHours: user._count.timeLogs,
            totalSessions: user._count.createdTasks,
          },
          canModify: session?.user?.id !== user.id,
        }));
        setMembers(convertedMembers);
      }

      if (invitesRes.ok) {
        const data = await invitesRes.json();
        setInvites(data.invites || []);
      }
    } catch (error) {
      console.error('Error fetching members:', error);
      showToast('Failed to load members', false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [session?.user?.id]);

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'OWNER': return 'destructive';
      case 'ADMIN': return 'default';
      case 'STAFF': return 'secondary';
      case 'CLIENT': return 'outline';
      default: return 'outline';
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'PENDING': return 'secondary';
      case 'ACCEPTED': return 'default';
      case 'EXPIRED': return 'destructive';
      case 'REVOKED': return 'outline';
      default: return 'outline';
    }
  };

  const handleInviteSend = async () => {
    if (!inviteEmail.trim()) return;
    
    try {
      const res = await fetch('/api/admin/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });

      if (res.ok) {
        setInviteEmail('');
        setInviteRole('STAFF');
        setShowInviteDialog(false);
        fetchData();
        showToast('Invitation sent successfully!');
      } else {
        const err = await res.json();
        showToast(err.error || 'Failed to send invitation', false);
      }
    } catch (error) {
      console.error('Error sending invitation:', error);
      showToast('Failed to send invitation', false);
    }
  };

  const handleRoleChange = async (memberId: string, newRole: string) => {
    try {
      const res = await fetch(`/api/admin/users/${memberId}/role`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      });

      if (res.ok) {
        fetchData();
        showToast('Role updated successfully!');
      } else {
        const err = await res.json();
        showToast(err.error || 'Failed to update role', false);
      }
    } catch (error) {
      console.error('Error updating role:', error);
      showToast('Failed to update role', false);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    try {
      const res = await fetch(`/api/admin/users/${memberId}`, { method: 'DELETE' });
      if (res.ok) {
        fetchData();
        showToast('Member removed from organization.');
      } else {
        showToast('Failed to remove member.', false);
      }
    } catch (error) {
      console.error('Error removing member:', error);
      showToast('Failed to remove member.', false);
    }
  };

  const handleRevokeInvite = async (inviteId: string) => {
    try {
      const res = await fetch(`/api/admin/invites/${inviteId}/revoke`, { method: 'POST' });
      if (res.ok) {
        fetchData();
        showToast('Invitation revoked.');
      } else {
        showToast('Failed to revoke invitation.', false);
      }
    } catch (error) {
      console.error('Error revoking invite:', error);
      showToast('Failed to revoke invitation.', false);
    }
  };

  const filteredMembers = members.filter(member =>
    member.user.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    member.user.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg text-[13px] font-medium shadow-lg ${
            toast.ok
              ? 'bg-green-500/20 text-green-600 border border-green-500/30'
              : 'bg-red-500/20 text-red-600 border border-red-500/30'
          }`}
        >
          {toast.msg}
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="space-y-4 animate-pulse">
          <div className="flex items-center justify-between">
            <div className="h-8 w-64 rounded-lg bg-gray-200"></div>
            <div className="h-10 w-32 rounded-lg bg-gray-200"></div>
          </div>
          <div className="h-10 w-48 rounded-lg bg-gray-200"></div>
          <div className="h-96 rounded-lg bg-gray-200"></div>
        </div>
      )}

      {!loading && (
        <>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Organization Members</h1>
              <p className="text-muted-foreground">Manage your team members and their roles</p>
            </div>
            
            <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Invite Member
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Invite New Member</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 mt-4">
                  <div>
                    <label className="text-sm font-medium">Email Address</label>
                    <Input
                      type="email"
                      placeholder="user@example.com"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Role</label>
                    <select 
                      className="w-full mt-1 p-2 border rounded-md"
                      value={inviteRole}
                      onChange={(e) => setInviteRole(e.target.value as any)}
                    >
                      <option value="ADMIN">Admin</option>
                      <option value="STAFF">Staff</option>
                      <option value="CLIENT">Client</option>
                    </select>
                  </div>
                  <div className="flex justify-end space-x-2">
                    <Button variant="outline" onClick={() => setShowInviteDialog(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleInviteSend} disabled={!inviteEmail}>
                      <Mail className="mr-2 h-4 w-4" />
                      Send Invite
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {/* Search */}
          <div className="max-w-md">
            <Input
              placeholder="Search members..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Members List */}
          <Card>
            <CardHeader>
              <CardTitle>Members ({filteredMembers.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {filteredMembers.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No members found
                  </div>
                ) : (
                  filteredMembers.map((member) => (
                    <div key={member.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center space-x-4">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-medium text-sm">
                          {member.user.name?.[0] || member.user.email[0].toUpperCase()}
                        </div>
                        <div>
                          <div className="font-medium">{member.user.name || member.user.email}</div>
                          <div className="text-sm text-muted-foreground">{member.user.email}</div>
                          {member.stats && (
                            <div className="text-xs text-muted-foreground mt-1">
                              {member.stats.totalHours}h logged • {member.stats.totalSessions} tasks
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <Badge variant={getRoleBadgeVariant(member.role)}>
                          {member.role}
                        </Badge>
                        
                        {member.canModify && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {member.role !== 'ADMIN' && (
                                <DropdownMenuItem onClick={() => handleRoleChange(member.id, 'ADMIN')}>
                                  <Shield className="mr-2 h-4 w-4" />
                                  Make Admin
                                </DropdownMenuItem>
                              )}
                              {member.role !== 'STAFF' && (
                                <DropdownMenuItem onClick={() => handleRoleChange(member.id, 'STAFF')}>
                                  <Shield className="mr-2 h-4 w-4" />
                                  Make Staff
                                </DropdownMenuItem>
                              )}
                              {member.role !== 'CLIENT' && (
                                <DropdownMenuItem onClick={() => handleRoleChange(member.id, 'CLIENT')}>
                                  <Shield className="mr-2 h-4 w-4" />
                                  Make Client
                                </DropdownMenuItem>
                              )}
                              {member.role !== 'OWNER' && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem 
                                    onClick={() => handleRemoveMember(member.id)}
                                    className="text-destructive"
                                  >
                                    <UserX className="mr-2 h-4 w-4" />
                                    Remove Member
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* Pending Invites */}
          {invites.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Pending Invites ({invites.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {invites.map((invite) => (
                    <div key={invite.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center space-x-4">
                        <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                          <Mail className="h-5 w-5 text-gray-500" />
                        </div>
                        <div>
                          <div className="font-medium">{invite.email}</div>
                          <div className="text-sm text-muted-foreground">
                            Invited by {invite.invitedBy.name || invite.invitedBy.email}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Expires: {new Date(invite.expiresAt).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <Badge variant={getRoleBadgeVariant(invite.role)}>
                          {invite.role}
                        </Badge>
                        <Badge variant={getStatusBadgeVariant(invite.status)}>
                          {invite.status}
                        </Badge>
                        
                        {invite.status === 'PENDING' && (
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleRevokeInvite(invite.id)}
                          >
                            Revoke
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}