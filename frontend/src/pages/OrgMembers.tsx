import { useState } from 'react';
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

// Mock invites data

const mockInvites: Invite[] = [
  {
    id: '1',
    email: 'newuser@example.com',
    role: 'STAFF',
    status: 'PENDING',
    expiresAt: '2024-12-01T00:00:00Z',
    invitedBy: {
      name: 'John Doe',
      email: 'john@example.com'
    }
  }
];

export function OrgMembers() {
  const { data: session } = useSession();
  
  // Generate mock data with real user info
  const getMockMembers = (): Member[] => [
    {
      id: session?.user?.id || '1',
      role: 'OWNER',
      joinedAt: '2024-01-15T00:00:00Z',
      user: {
        id: session?.user?.id || '1',
        name: session?.user?.name || 'Current User',
        email: session?.user?.email || 'user@example.com'
      },
      stats: {
        totalHours: 0,
        totalSessions: 0
      },
      canModify: false
    },
    {
      id: '2', 
      role: 'ADMIN',
      joinedAt: '2024-02-01T00:00:00Z',
      user: {
        id: '2',
        name: 'Jane Smith',
        email: 'jane@example.com'
      },
      stats: {
        totalHours: 85.2,
        totalSessions: 32
      },
      canModify: true
    }
  ];
  
  const [members] = useState<Member[]>(getMockMembers());
  const [invites] = useState<Invite[]>(mockInvites);
  const [searchQuery, setSearchQuery] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'ADMIN' | 'STAFF' | 'CLIENT'>('STAFF');
  const [showInviteDialog, setShowInviteDialog] = useState(false);

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
    if (!inviteEmail || !session?.user?.id) return;
    
    try {
      // Get the current user's organization ID
      const orgResponse = await fetch(`/api/organizations?userId=${session.user.id}`);
      if (orgResponse.ok) {
        const orgData = await orgResponse.json();
        const organizationId = orgData.organizations?.[0]?.id;
        
        if (organizationId) {
          const inviteResponse = await fetch(`/api/invites`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              email: inviteEmail.trim(),
              role: inviteRole,
              organizationId: organizationId,
              message: `You've been invited to join our team on VebTask!`
            }),
          });
          
          if (inviteResponse.ok) {
            console.log(`✅ Invite sent to ${inviteEmail}`);
            // TODO: Show success message to user
            // TODO: Refresh invites list
          } else {
            console.error(`❌ Failed to send invite to ${inviteEmail}`);
            // TODO: Show error message to user
          }
        }
      }
    } catch (error) {
      console.error('Error sending invitation:', error);
      // TODO: Show error message to user
    }
    
    setShowInviteDialog(false);
    setInviteEmail('');
    setInviteRole('STAFF');
  };

  const handleRoleChange = (memberId: string, newRole: string) => {
    // TODO: Implement actual role change API call
    console.log('Changing role for member:', memberId, 'to:', newRole);
  };

  const handleRemoveMember = (memberId: string) => {
    // TODO: Implement actual remove member API call
    console.log('Removing member:', memberId);
  };

  const handleRevokeInvite = (inviteId: string) => {
    // TODO: Implement actual revoke invite API call
    console.log('Revoking invite:', inviteId);
  };

  const filteredMembers = members.filter(member =>
    member.user.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    member.user.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
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
            {filteredMembers.map((member) => (
              <div key={member.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center space-x-4">
                  <div className="w-10 h-10 rounded-full bg-gradient-primary flex items-center justify-center text-white font-medium">
                    {member.user.name?.[0] || member.user.email[0].toUpperCase()}
                  </div>
                  <div>
                    <div className="font-medium">{member.user.name || member.user.email}</div>
                    <div className="text-sm text-muted-foreground">{member.user.email}</div>
                    {member.stats && (
                      <div className="text-xs text-muted-foreground mt-1">
                        {member.stats.totalHours}h logged • {member.stats.totalSessions} sessions
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
                        <DropdownMenuItem onClick={() => handleRoleChange(member.id, 'ADMIN')}>
                          <Shield className="mr-2 h-4 w-4" />
                          Make Admin
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleRoleChange(member.id, 'STAFF')}>
                          <Shield className="mr-2 h-4 w-4" />
                          Make Staff
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleRoleChange(member.id, 'CLIENT')}>
                          <Shield className="mr-2 h-4 w-4" />
                          Make Client
                        </DropdownMenuItem>
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
            ))}
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
    </div>
  );
}