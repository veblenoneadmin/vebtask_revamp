import { useState, useEffect } from 'react';
import {
  Users, UserPlus, Mail, Trash2, Edit3, Crown,
  UserCog, Shield, Clock, CheckSquare, X, Check, Eye, EyeOff, UserCheck,
} from 'lucide-react';

// ── VS Code Dark+ tokens ───────────────────────────────────────────────────────
const VS = {
  bg0:    '#1e1e1e',
  bg1:    '#252526',
  bg2:    '#2d2d2d',
  bg3:    '#333333',
  border: '#3c3c3c',
  border2:'#454545',
  text0:  '#f0f0f0',
  text1:  '#c0c0c0',
  text2:  '#909090',
  blue:   '#569cd6',
  teal:   '#4ec9b0',
  yellow: '#dcdcaa',
  orange: '#ce9178',
  purple: '#c586c0',
  red:    '#f44747',
  green:  '#6a9955',
  accent: '#007acc',
};

// ── Types ──────────────────────────────────────────────────────────────────────
interface OrgUser {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
  createdAt: string;
  memberships: Array<{
    id: string;
    role: 'OWNER' | 'ADMIN' | 'STAFF' | 'CLIENT';
    org: { name: string; slug: string };
  }>;
  _count: { timeLogs: number; createdTasks: number };
}

interface Invite {
  id: string;
  email: string;
  role: 'ADMIN' | 'STAFF' | 'CLIENT';
  status: 'PENDING' | 'ACCEPTED' | 'EXPIRED' | 'REVOKED';
  createdAt: string;
  expiresAt: string;
  invitedBy: { name: string; email: string };
}

// ── Role config ────────────────────────────────────────────────────────────────
const ROLE_CFG: Record<string, { color: string; bg: string; icon: React.ElementType; label: string }> = {
  OWNER: { color: VS.yellow,  bg: 'rgba(220,220,170,0.12)', icon: Crown,   label: 'Owner'  },
  ADMIN: { color: VS.blue,    bg: 'rgba(86,156,214,0.12)',  icon: Shield,  label: 'Admin'  },
  STAFF: { color: VS.teal,    bg: 'rgba(78,201,176,0.12)',  icon: UserCog, label: 'Staff'  },
  CLIENT:{ color: VS.text2,   bg: 'rgba(144,144,144,0.12)', icon: Users,   label: 'Client' },
};

const inputCls = 'w-full px-3 py-2 rounded-lg text-[13px] focus:outline-none focus:ring-1 focus:ring-[#007acc]/50 transition-all';
const inputStyle: React.CSSProperties = { background: VS.bg3, border: `1px solid ${VS.border2}`, color: VS.text0 };

// ── Component ──────────────────────────────────────────────────────────────────
export function Admin() {
  const [activeTab, setActiveTab]   = useState<'users' | 'invites'>('users');
  const [users, setUsers]           = useState<OrgUser[]>([]);
  const [invites, setInvites]       = useState<Invite[]>([]);
  const [loading, setLoading]       = useState(true);
  const [toast, setToast]           = useState<{ msg: string; ok: boolean } | null>(null);

  // Invite form
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole]   = useState<'ADMIN' | 'STAFF' | 'CLIENT'>('STAFF');
  const [inviting, setInviting]       = useState(false);

  // Edit role
  const [editingUser, setEditingUser] = useState<OrgUser | null>(null);
  const [editingRole, setEditingRole] = useState<'ADMIN' | 'STAFF' | 'CLIENT'>('STAFF');
  const [saving, setSaving]           = useState(false);

  // Remove member
  const [removingId, setRemovingId] = useState<string | null>(null);

  // Add user form
  const [showAddUser, setShowAddUser]       = useState(false);
  const [addName, setAddName]               = useState('');
  const [addEmail, setAddEmail]             = useState('');
  const [addPassword, setAddPassword]       = useState('');
  const [addRole, setAddRole]               = useState<'ADMIN' | 'STAFF' | 'CLIENT'>('STAFF');
  const [showPassword, setShowPassword]     = useState(false);
  const [addingUser, setAddingUser]         = useState(false);

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  }

  const fetchData = async () => {
    try {
      setLoading(true);
      const [uRes, iRes] = await Promise.all([
        fetch('/api/admin/users', { credentials: 'include' }),
        fetch('/api/admin/invites', { credentials: 'include' }),
      ]);
      if (uRes.ok) setUsers((await uRes.json()).users ?? []);
      if (iRes.ok) setInvites((await iRes.json()).invites ?? []);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setInviting(true);
    try {
      const res = await fetch('/api/admin/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });
      if (res.ok) {
        setInviteEmail('');
        setShowInvite(false);
        fetchData();
        showToast('Invitation sent successfully!');
      } else {
        const err = await res.json();
        showToast(err.error || 'Failed to send invitation', false);
      }
    } catch { showToast('Failed to send invitation', false); }
    finally { setInviting(false); }
  };

  const handleUpdateRole = async () => {
    if (!editingUser) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/users/${editingUser.id}/role`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: editingRole }),
      });
      if (res.ok) {
        setEditingUser(null);
        fetchData();
        showToast('Role updated successfully!');
      } else {
        const err = await res.json();
        showToast(err.error || 'Failed to update role', false);
      }
    } catch { showToast('Failed to update role', false); }
    finally { setSaving(false); }
  };

  const handleRemoveMember = async (userId: string) => {
    setRemovingId(userId);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, { method: 'DELETE' });
      if (res.ok) {
        fetchData();
        showToast('Member removed from organization.');
      } else {
        showToast('Failed to remove member.', false);
      }
    } catch { showToast('Failed to remove member.', false); }
    finally { setRemovingId(null); }
  };

  const handleRevokeInvite = async (inviteId: string) => {
    try {
      const res = await fetch(`/api/admin/invites/${inviteId}/revoke`, { method: 'POST' });
      if (res.ok) { fetchData(); showToast('Invitation revoked.'); }
      else showToast('Failed to revoke invitation.', false);
    } catch { showToast('Failed to revoke invitation.', false); }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddingUser(true);
    try {
      const res = await fetch('/api/admin/users/create', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: addName, email: addEmail, password: addPassword, role: addRole }),
      });
      const data = await res.json();
      if (res.ok) {
        setShowAddUser(false);
        setAddName(''); setAddEmail(''); setAddPassword(''); setAddRole('STAFF');
        fetchData();
        showToast(data.message || 'User created successfully!');
      } else {
        showToast(data.error || 'Failed to create user', false);
      }
    } catch { showToast('Failed to create user', false); }
    finally { setAddingUser(false); }
  };

  // ── KPI stats ───────────────────────────────────────────────────────────────
  const pendingInvites = invites.filter(i => i.status === 'PENDING').length;
  const totalTasks     = users.reduce((a, u) => a + u._count.createdTasks, 0);
  const totalTimeLogs  = users.reduce((a, u) => a + u._count.timeLogs, 0);

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 w-64 rounded-lg" style={{ background: VS.bg2 }} />
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-24 rounded-xl" style={{ background: VS.bg1 }} />)}
        </div>
        <div className="h-96 rounded-xl" style={{ background: VS.bg1 }} />
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* ── Toast ── */}
      {toast && (
        <div
          className="fixed top-4 right-4 z-[300] flex items-center gap-2 px-4 py-3 rounded-xl text-[13px] font-medium shadow-2xl"
          style={{
            background: toast.ok ? 'rgba(78,201,176,0.15)' : 'rgba(244,71,71,0.15)',
            border: `1px solid ${toast.ok ? VS.teal : VS.red}55`,
            color: toast.ok ? VS.teal : VS.red,
          }}
        >
          {toast.ok ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
          {toast.msg}
        </div>
      )}

      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: VS.text0 }}>User Management</h1>
          <p className="text-[13px] mt-1" style={{ color: VS.text2 }}>
            Manage team members, roles, and invitations
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAddUser(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-semibold transition-all hover:opacity-90"
            style={{ background: VS.bg2, border: `1px solid ${VS.border2}`, color: VS.text0 }}
          >
            <UserCheck className="h-4 w-4" />
            Add User
          </button>
          <button
            onClick={() => setShowInvite(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-semibold transition-all hover:opacity-90"
            style={{ background: VS.accent, color: '#fff' }}
          >
            <UserPlus className="h-4 w-4" />
            Invite Member
          </button>
        </div>
      </div>

      {/* ── KPI strip ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Members',   value: users.length,    icon: Users,       color: VS.blue   },
          { label: 'Pending Invites', value: pendingInvites,  icon: Mail,        color: VS.yellow },
          { label: 'Total Tasks',     value: totalTasks,      icon: CheckSquare, color: VS.teal   },
          { label: 'Time Logs',       value: totalTimeLogs,   icon: Clock,       color: VS.purple },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="rounded-xl p-4 flex items-center gap-3"
            style={{ background: VS.bg1, border: `1px solid ${VS.border}` }}>
            <div className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: `${color}18`, border: `1px solid ${color}33` }}>
              <Icon className="h-5 w-5" style={{ color }} />
            </div>
            <div>
              <div className="text-xl font-bold tabular-nums" style={{ color: VS.text0 }}>{value}</div>
              <div className="text-[11px]" style={{ color: VS.text2 }}>{label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Tab bar ── */}
      <div className="flex gap-1 p-1 rounded-lg w-fit" style={{ background: VS.bg2, border: `1px solid ${VS.border}` }}>
        {([['users', 'Members', Users], ['invites', 'Invitations', Mail]] as const).map(([key, label, Icon]) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className="flex items-center gap-2 px-4 py-2 rounded-md text-[13px] font-medium transition-all"
            style={activeTab === key
              ? { background: VS.bg3, color: VS.text0, border: `1px solid ${VS.border2}` }
              : { color: VS.text2 }
            }
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
            <span
              className="text-[11px] px-1.5 py-0.5 rounded-full"
              style={{ background: VS.bg2, color: VS.text2 }}
            >
              {key === 'users' ? users.length : invites.length}
            </span>
          </button>
        ))}
      </div>

      {/* ── Members table ── */}
      {activeTab === 'users' && (
        <div className="rounded-xl overflow-hidden" style={{ background: VS.bg1, border: `1px solid ${VS.border}` }}>
          {/* Table header */}
          <div
            className="grid gap-4 px-5 py-3 text-[11px] font-semibold uppercase tracking-widest"
            style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', background: VS.bg2, color: VS.text2 }}
          >
            <span>Member</span>
            <span>Role</span>
            <span>Status</span>
            <span>Activity</span>
            <span>Actions</span>
          </div>

          {users.length === 0 ? (
            <div className="py-12 text-center text-[13px]" style={{ color: VS.text2 }}>
              No members found
            </div>
          ) : users.map((user, i) => {
            const role = user.memberships[0]?.role ?? 'CLIENT';
            const cfg  = ROLE_CFG[role] ?? ROLE_CFG.CLIENT;
            const Icon = cfg.icon;
            const initials = (user.name || user.email).charAt(0).toUpperCase();
            const isOwner = role === 'OWNER';
            return (
              <div
                key={user.id}
                className="grid gap-4 px-5 py-4 items-center transition-colors hover:bg-white/[0.02]"
                style={{
                  gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr',
                  borderTop: i === 0 ? 'none' : `1px solid ${VS.border}`,
                }}
              >
                {/* Member info */}
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="h-9 w-9 rounded-full flex items-center justify-center shrink-0 text-[13px] font-bold"
                    style={{ background: `${cfg.color}22`, color: cfg.color }}
                  >
                    {initials}
                  </div>
                  <div className="min-w-0">
                    <div className="text-[13px] font-medium truncate" style={{ color: VS.text0 }}>
                      {user.name || 'No name'}
                    </div>
                    <div className="text-[11px] truncate" style={{ color: VS.text2 }}>{user.email}</div>
                  </div>
                </div>

                {/* Role */}
                <div>
                  <span
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold"
                    style={{ background: cfg.bg, color: cfg.color }}
                  >
                    <Icon className="h-3 w-3" />
                    {cfg.label}
                  </span>
                </div>

                {/* Status */}
                <div>
                  <span
                    className="inline-flex px-2.5 py-1 rounded-full text-[11px] font-semibold"
                    style={user.emailVerified
                      ? { background: 'rgba(78,201,176,0.12)', color: VS.teal }
                      : { background: 'rgba(220,220,170,0.12)', color: VS.yellow }
                    }
                  >
                    {user.emailVerified ? 'Verified' : 'Pending'}
                  </span>
                </div>

                {/* Activity */}
                <div className="text-[12px]" style={{ color: VS.text2 }}>
                  <div>{user._count.timeLogs} time logs</div>
                  <div>{user._count.createdTasks} tasks</div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  {!isOwner && (
                    <>
                      <button
                        onClick={() => { setEditingUser(user); setEditingRole(role as any); }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors hover:bg-white/5"
                        style={{ background: VS.bg2, border: `1px solid ${VS.border}`, color: VS.blue }}
                      >
                        <Edit3 className="h-3 w-3" />
                        Edit Role
                      </button>
                      <button
                        onClick={() => handleRemoveMember(user.id)}
                        disabled={removingId === user.id}
                        className="h-7 w-7 rounded-lg flex items-center justify-center transition-colors hover:bg-white/5 disabled:opacity-40"
                        style={{ background: VS.bg2, border: `1px solid ${VS.border}`, color: VS.red }}
                        title="Remove member"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </>
                  )}
                  {isOwner && (
                    <span className="text-[11px]" style={{ color: VS.text2 }}>Owner</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Invitations table ── */}
      {activeTab === 'invites' && (
        <div className="rounded-xl overflow-hidden" style={{ background: VS.bg1, border: `1px solid ${VS.border}` }}>
          <div
            className="grid gap-4 px-5 py-3 text-[11px] font-semibold uppercase tracking-widest"
            style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', background: VS.bg2, color: VS.text2 }}
          >
            <span>Email</span>
            <span>Role</span>
            <span>Status</span>
            <span>Invited By</span>
            <span>Actions</span>
          </div>

          {invites.length === 0 ? (
            <div className="py-12 text-center">
              <Mail className="h-10 w-10 mx-auto mb-3" style={{ color: VS.text2 }} />
              <p className="text-[13px] font-medium" style={{ color: VS.text1 }}>No invitations yet</p>
              <p className="text-[12px] mt-1" style={{ color: VS.text2 }}>Invite team members to get started</p>
              <button
                onClick={() => setShowInvite(true)}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-semibold"
                style={{ background: VS.accent, color: '#fff' }}
              >
                <UserPlus className="h-4 w-4" /> Send Invitation
              </button>
            </div>
          ) : invites.map((inv, i) => {
            const cfg = ROLE_CFG[inv.role] ?? ROLE_CFG.CLIENT;
            const statusStyle = {
              PENDING:  { bg: 'rgba(220,220,170,0.12)', color: VS.yellow },
              ACCEPTED: { bg: 'rgba(78,201,176,0.12)',  color: VS.teal   },
              EXPIRED:  { bg: 'rgba(144,144,144,0.12)', color: VS.text2  },
              REVOKED:  { bg: 'rgba(244,71,71,0.12)',   color: VS.red    },
            }[inv.status] ?? { bg: VS.bg2, color: VS.text2 };
            return (
              <div
                key={inv.id}
                className="grid gap-4 px-5 py-4 items-center hover:bg-white/[0.02] transition-colors"
                style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', borderTop: i === 0 ? 'none' : `1px solid ${VS.border}` }}
              >
                <div className="text-[13px] truncate" style={{ color: VS.text1 }}>{inv.email}</div>
                <div>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold"
                    style={{ background: cfg.bg, color: cfg.color }}>
                    {cfg.label}
                  </span>
                </div>
                <div>
                  <span className="inline-flex px-2.5 py-1 rounded-full text-[11px] font-semibold"
                    style={{ background: statusStyle.bg, color: statusStyle.color }}>
                    {inv.status}
                  </span>
                </div>
                <div className="text-[12px] truncate" style={{ color: VS.text2 }}>
                  {inv.invitedBy.name || inv.invitedBy.email}
                </div>
                <div>
                  {inv.status === 'PENDING' && (
                    <button
                      onClick={() => handleRevokeInvite(inv.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors hover:bg-white/5"
                      style={{ background: VS.bg2, border: `1px solid ${VS.border}`, color: VS.red }}
                    >
                      <Trash2 className="h-3 w-3" /> Revoke
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Invite Modal ── */}
      {showInvite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.75)' }}
          onClick={e => { if (e.target === e.currentTarget) setShowInvite(false); }}>
          <div className="w-full max-w-md rounded-2xl overflow-hidden"
            style={{ background: VS.bg0, border: `1px solid ${VS.border}`, boxShadow: '0 24px 60px rgba(0,0,0,0.7)' }}>
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4"
              style={{ background: VS.bg1, borderBottom: `1px solid ${VS.border}` }}>
              <div className="flex items-center gap-2">
                <UserPlus className="h-4 w-4" style={{ color: VS.accent }} />
                <h3 className="text-[14px] font-bold" style={{ color: VS.text0 }}>Invite Team Member</h3>
              </div>
              <button onClick={() => setShowInvite(false)} className="h-7 w-7 rounded-lg flex items-center justify-center hover:bg-white/5" style={{ color: VS.text1 }}>
                <X className="h-4 w-4" />
              </button>
            </div>
            {/* Body */}
            <form onSubmit={handleInvite} className="p-5 space-y-4">
              <div>
                <label className="block text-[12px] font-semibold mb-1.5" style={{ color: VS.text2 }}>Email Address</label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  className={inputCls}
                  style={inputStyle}
                  placeholder="colleague@company.com"
                  required
                />
              </div>
              <div>
                <label className="block text-[12px] font-semibold mb-1.5" style={{ color: VS.text2 }}>Role</label>
                <select
                  value={inviteRole}
                  onChange={e => setInviteRole(e.target.value as any)}
                  className={inputCls}
                  style={inputStyle}
                >
                  <option value="STAFF">Staff — standard member</option>
                  <option value="ADMIN">Admin — manage members & settings</option>
                  <option value="CLIENT">Client — limited view access</option>
                </select>
              </div>
              <div className="flex justify-end gap-3 pt-1">
                <button type="button" onClick={() => setShowInvite(false)}
                  className="px-4 py-2 rounded-lg text-[13px] font-medium transition-colors hover:bg-white/5"
                  style={{ background: VS.bg2, border: `1px solid ${VS.border}`, color: VS.text1 }}>
                  Cancel
                </button>
                <button type="submit" disabled={inviting}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-semibold disabled:opacity-50 transition-all hover:opacity-90"
                  style={{ background: VS.accent, color: '#fff' }}>
                  <Mail className="h-4 w-4" />
                  {inviting ? 'Sending…' : 'Send Invite'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Edit Role Modal ── */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.75)' }}
          onClick={e => { if (e.target === e.currentTarget) setEditingUser(null); }}>
          <div className="w-full max-w-md rounded-2xl overflow-hidden"
            style={{ background: VS.bg0, border: `1px solid ${VS.border}`, boxShadow: '0 24px 60px rgba(0,0,0,0.7)' }}>
            <div className="flex items-center justify-between px-5 py-4"
              style={{ background: VS.bg1, borderBottom: `1px solid ${VS.border}` }}>
              <div className="flex items-center gap-2">
                <Edit3 className="h-4 w-4" style={{ color: VS.blue }} />
                <h3 className="text-[14px] font-bold" style={{ color: VS.text0 }}>Change Role</h3>
              </div>
              <button onClick={() => setEditingUser(null)} className="h-7 w-7 rounded-lg flex items-center justify-center hover:bg-white/5" style={{ color: VS.text1 }}>
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              {/* User preview */}
              <div className="flex items-center gap-3 p-3 rounded-lg" style={{ background: VS.bg2 }}>
                <div className="h-9 w-9 rounded-full flex items-center justify-center text-[13px] font-bold shrink-0"
                  style={{ background: `${ROLE_CFG[editingUser.memberships[0]?.role ?? 'CLIENT'].color}22`, color: ROLE_CFG[editingUser.memberships[0]?.role ?? 'CLIENT'].color }}>
                  {(editingUser.name || editingUser.email).charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="text-[13px] font-medium" style={{ color: VS.text0 }}>{editingUser.name || 'No name'}</div>
                  <div className="text-[11px]" style={{ color: VS.text2 }}>{editingUser.email}</div>
                </div>
              </div>
              <div>
                <label className="block text-[12px] font-semibold mb-1.5" style={{ color: VS.text2 }}>New Role</label>
                <select
                  value={editingRole}
                  onChange={e => setEditingRole(e.target.value as any)}
                  className={inputCls}
                  style={inputStyle}
                >
                  <option value="STAFF">Staff</option>
                  <option value="ADMIN">Admin</option>
                  <option value="CLIENT">Client</option>
                </select>
              </div>
              <div className="flex justify-end gap-3 pt-1">
                <button type="button" onClick={() => setEditingUser(null)}
                  className="px-4 py-2 rounded-lg text-[13px] font-medium hover:bg-white/5"
                  style={{ background: VS.bg2, border: `1px solid ${VS.border}`, color: VS.text1 }}>
                  Cancel
                </button>
                <button onClick={handleUpdateRole} disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-semibold disabled:opacity-50 hover:opacity-90"
                  style={{ background: VS.blue, color: '#fff' }}>
                  <Check className="h-4 w-4" />
                  {saving ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Add User Modal ── */}
      {showAddUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.75)' }}
          onClick={e => { if (e.target === e.currentTarget) setShowAddUser(false); }}>
          <div className="w-full max-w-md rounded-2xl overflow-hidden"
            style={{ background: VS.bg0, border: `1px solid ${VS.border}`, boxShadow: '0 24px 60px rgba(0,0,0,0.7)' }}>
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4"
              style={{ background: VS.bg1, borderBottom: `1px solid ${VS.border}` }}>
              <div className="flex items-center gap-2">
                <UserCheck className="h-4 w-4" style={{ color: VS.teal }} />
                <h3 className="text-[14px] font-bold" style={{ color: VS.text0 }}>Add User Manually</h3>
              </div>
              <button onClick={() => setShowAddUser(false)}
                className="h-7 w-7 rounded-lg flex items-center justify-center hover:bg-white/5" style={{ color: VS.text1 }}>
                <X className="h-4 w-4" />
              </button>
            </div>
            {/* Body */}
            <form onSubmit={handleAddUser} className="p-5 space-y-4">
              <p className="text-[12px]" style={{ color: VS.text2 }}>
                Creates the account immediately — no email invite required. The user can log in right away.
              </p>
              <div>
                <label className="block text-[12px] font-semibold mb-1.5" style={{ color: VS.text2 }}>Full Name</label>
                <input
                  type="text"
                  value={addName}
                  onChange={e => setAddName(e.target.value)}
                  className={inputCls}
                  style={inputStyle}
                  placeholder="Jane Smith"
                  required
                />
              </div>
              <div>
                <label className="block text-[12px] font-semibold mb-1.5" style={{ color: VS.text2 }}>Email Address</label>
                <input
                  type="email"
                  value={addEmail}
                  onChange={e => setAddEmail(e.target.value)}
                  className={inputCls}
                  style={inputStyle}
                  placeholder="jane@company.com"
                  required
                />
              </div>
              <div>
                <label className="block text-[12px] font-semibold mb-1.5" style={{ color: VS.text2 }}>Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={addPassword}
                    onChange={e => setAddPassword(e.target.value)}
                    className={inputCls}
                    style={{ ...inputStyle, paddingRight: '2.5rem' }}
                    placeholder="Minimum 6 characters"
                    minLength={6}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2"
                    style={{ color: VS.text2 }}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-[12px] font-semibold mb-1.5" style={{ color: VS.text2 }}>Role</label>
                <select
                  value={addRole}
                  onChange={e => setAddRole(e.target.value as any)}
                  className={inputCls}
                  style={inputStyle}
                >
                  <option value="STAFF">Staff — standard member</option>
                  <option value="ADMIN">Admin — manage members &amp; settings</option>
                  <option value="CLIENT">Client — limited view access</option>
                </select>
              </div>
              <div className="flex justify-end gap-3 pt-1">
                <button type="button" onClick={() => setShowAddUser(false)}
                  className="px-4 py-2 rounded-lg text-[13px] font-medium hover:bg-white/5"
                  style={{ background: VS.bg2, border: `1px solid ${VS.border}`, color: VS.text1 }}>
                  Cancel
                </button>
                <button type="submit" disabled={addingUser}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-semibold disabled:opacity-50 hover:opacity-90"
                  style={{ background: VS.teal, color: VS.bg0 }}>
                  <UserCheck className="h-4 w-4" />
                  {addingUser ? 'Creating…' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
