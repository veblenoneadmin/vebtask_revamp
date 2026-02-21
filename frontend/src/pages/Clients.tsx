import { useState, useEffect } from 'react';
import { useSession } from '../lib/auth-client';
import { useApiClient } from '../lib/api-client';
import { useOrganization } from '../contexts/OrganizationContext';
import {
  Building2,
  Mail,
  Phone,
  MapPin,
  DollarSign,
  Clock,
  Plus,
  Edit,
  Trash2,
  Search,
  Filter,
  FileText,
  TrendingUp,
  Users
} from 'lucide-react';

const VS = {
  bg0: '#1e1e1e', bg1: '#252526', bg2: '#2d2d2d', bg3: '#333333',
  border: '#3c3c3c', text0: '#f0f0f0', text1: '#c0c0c0', text2: '#909090',
  blue: '#569cd6', teal: '#4ec9b0', yellow: '#dcdcaa', orange: '#ce9178',
  purple: '#c586c0', red: '#f44747', green: '#6a9955', accent: '#007acc',
};

interface Client {
  id: string;
  name: string;
  company: string;
  email: string;
  phone: string;
  address: string;
  avatar?: string;
  status: 'active' | 'inactive' | 'potential';
  totalProjects: number;
  totalHours: number;
  totalEarnings: number;
  hourlyRate: number;
  lastActivity: string;
  contactPerson: string;
  industry: string;
  notes: string;
  priority: 'high' | 'medium' | 'low';
}

export function Clients() {
  const { data: session } = useSession();
  const { currentOrg } = useOrganization();
  const apiClient = useApiClient();
  const [clients, setClients] = useState<Client[]>([]);
  const [, setLoading] = useState(true);
  const [, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showNewClientModal, setShowNewClientModal] = useState(false);
  const [newClientLoading, setNewClientLoading] = useState(false);
  const [newClientForm, setNewClientForm] = useState({
    name: '',
    company: '',
    email: '',
    phone: '',
    address: '',
    contactPerson: '',
    industry: '',
    hourlyRate: 95,
    priority: 'medium' as 'low' | 'medium' | 'high',
    notes: ''
  });

  const fetchClients = async () => {
    if (!session?.user?.id) return;

    try {
      setLoading(true);
      setError(null);
      const data = await apiClient.fetch(`/api/clients?userId=${session.user.id}&orgId=${currentOrg?.id || ''}&limit=100`);

      if (data.success) {
        setClients(data.clients || []);
      } else {
        setError('Failed to fetch clients');
        setClients([]);
      }
    } catch (err: any) {
      setError(err.message);
      setClients([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClients();
  }, [session?.user?.id, currentOrg?.id]);

  const filteredClients = clients.filter(client => {
    const matchesSearch =
      client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.company.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.contactPerson.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.industry.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || client.status === filterStatus;
    const matchesPriority = filterPriority === 'all' || client.priority === filterPriority;

    return matchesSearch && matchesStatus && matchesPriority;
  });

  const getStatusBadgeStyle = (status: string): React.CSSProperties => {
    switch (status) {
      case 'active':
        return { background: `${VS.teal}18`, border: `1px solid ${VS.teal}33`, color: VS.teal };
      case 'inactive':
        return { background: `${VS.text2}18`, border: `1px solid ${VS.text2}33`, color: VS.text2 };
      case 'potential':
        return { background: `${VS.yellow}18`, border: `1px solid ${VS.yellow}33`, color: VS.yellow };
      default:
        return { background: `${VS.text2}18`, border: `1px solid ${VS.text2}33`, color: VS.text2 };
    }
  };

  const getPriorityBadgeStyle = (priority: string): React.CSSProperties => {
    switch (priority) {
      case 'high':
        return { background: `${VS.red}18`, border: `1px solid ${VS.red}33`, color: VS.red };
      case 'medium':
        return { background: `${VS.yellow}18`, border: `1px solid ${VS.yellow}33`, color: VS.yellow };
      case 'low':
        return { background: `${VS.blue}18`, border: `1px solid ${VS.blue}33`, color: VS.blue };
      default:
        return { background: `${VS.text2}18`, border: `1px solid ${VS.text2}33`, color: VS.text2 };
    }
  };

  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.user?.id) return;

    try {
      setNewClientLoading(true);

      const data = await apiClient.fetch('/api/clients', {
        method: 'POST',
        body: JSON.stringify({
          userId: session.user.id,
          orgId: currentOrg?.id,
          name: newClientForm.name,
          company: newClientForm.company,
          email: newClientForm.email,
          phone: newClientForm.phone,
          address: newClientForm.address,
          hourlyRate: newClientForm.hourlyRate,
          contactPerson: newClientForm.contactPerson,
          industry: newClientForm.industry,
          notes: newClientForm.notes,
          priority: newClientForm.priority
        })
      });

      if (data.success) {
        await fetchClients();
      } else {
        throw new Error('Failed to create client');
      }
      setShowNewClientModal(false);
      setNewClientForm({
        name: '',
        company: '',
        email: '',
        phone: '',
        address: '',
        contactPerson: '',
        industry: '',
        hourlyRate: 95,
        priority: 'medium',
        notes: ''
      });
    } catch (error: any) {
      console.error('Error creating client:', error);
    } finally {
      setNewClientLoading(false);
    }
  };

  const clientStats = {
    totalClients: clients.length,
    activeClients: clients.filter(c => c.status === 'active').length,
    totalRevenue: clients.reduce((sum, client) => sum + client.totalEarnings, 0),
    avgHourlyRate:
      clients.length > 0
        ? Math.round(clients.reduce((sum, client) => sum + client.hourlyRate, 0) / clients.length)
        : 0
  };

  const inputStyle: React.CSSProperties = {
    background: VS.bg2,
    border: `1px solid ${VS.border}`,
    borderRadius: 8,
    color: VS.text0,
    padding: '8px 12px',
    outline: 'none',
    width: '100%',
    fontSize: 14,
  };

  const statsCards = [
    { icon: Users, color: VS.blue, label: 'Total Clients', value: clientStats.totalClients.toString() },
    { icon: TrendingUp, color: VS.teal, label: 'Active Clients', value: clientStats.activeClients.toString() },
    { icon: DollarSign, color: VS.accent, label: 'Total Revenue', value: `$${clientStats.totalRevenue.toLocaleString()}` },
    { icon: Clock, color: VS.yellow, label: 'Avg. Rate/Hour', value: `$${clientStats.avgHourlyRate}` },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: VS.text0, margin: 0 }}>Clients</h1>
          <p style={{ color: VS.text2, marginTop: 4, fontSize: 14 }}>Manage your client relationships and contacts</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Grid/List Toggle */}
          <div style={{ background: VS.bg2, borderRadius: 8, padding: 4, display: 'flex', gap: 2 }}>
            <button
              onClick={() => setViewMode('grid')}
              style={{
                padding: '4px 14px',
                borderRadius: 6,
                border: 'none',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 500,
                transition: 'background 0.15s, color 0.15s',
                background: viewMode === 'grid' ? VS.bg3 : 'transparent',
                color: viewMode === 'grid' ? VS.text0 : VS.text2,
              }}
            >
              Grid
            </button>
            <button
              onClick={() => setViewMode('list')}
              style={{
                padding: '4px 14px',
                borderRadius: 6,
                border: 'none',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 500,
                transition: 'background 0.15s, color 0.15s',
                background: viewMode === 'list' ? VS.bg3 : 'transparent',
                color: viewMode === 'list' ? VS.text0 : VS.text2,
              }}
            >
              List
            </button>
          </div>
          {/* Add Client Button */}
          <button
            onClick={() => setShowNewClientModal(true)}
            style={{
              background: VS.accent,
              color: 'white',
              border: 'none',
              borderRadius: 8,
              padding: '8px 16px',
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Plus size={16} />
            Add Client
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        {statsCards.map(({ icon: Icon, color, label, value }) => (
          <div
            key={label}
            style={{
              background: VS.bg1,
              border: `1px solid ${VS.border}`,
              borderRadius: 12,
              padding: 20,
              display: 'flex',
              alignItems: 'center',
              gap: 16,
            }}
          >
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                background: `${color}18`,
                border: `1px solid ${color}33`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Icon size={20} color={color} />
            </div>
            <div>
              <p style={{ fontSize: 22, fontWeight: 700, color: VS.text0, margin: 0 }}>{value}</p>
              <p style={{ fontSize: 12, color: VS.text2, margin: 0 }}>{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filter Bar */}
      <div
        style={{
          background: VS.bg1,
          border: `1px solid ${VS.border}`,
          borderRadius: 12,
          padding: 16,
        }}
      >
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Search */}
          <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
            <Search
              size={15}
              color={VS.text2}
              style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
            />
            <input
              type="text"
              placeholder="Search clients..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              style={{ ...inputStyle, paddingLeft: 32 }}
            />
          </div>

          {/* Status Filter */}
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            style={{ ...inputStyle, width: 'auto', cursor: 'pointer' }}
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="potential">Potential</option>
          </select>

          {/* Priority Filter */}
          <select
            value={filterPriority}
            onChange={e => setFilterPriority(e.target.value)}
            style={{ ...inputStyle, width: 'auto', cursor: 'pointer' }}
          >
            <option value="all">All Priority</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>

          <button
            style={{
              background: VS.bg2,
              border: `1px solid ${VS.border}`,
              borderRadius: 8,
              color: VS.text1,
              padding: '8px 14px',
              cursor: 'pointer',
              fontSize: 13,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Filter size={14} />
            More Filters
          </button>
        </div>
      </div>

      {/* Clients Display */}
      {viewMode === 'grid' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          {filteredClients.map(client => (
            <div
              key={client.id}
              style={{
                background: VS.bg1,
                border: `1px solid ${VS.border}`,
                borderRadius: 12,
                padding: 20,
              }}
            >
              {/* Card Header */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 10,
                      background: `${VS.accent}22`,
                      border: `1px solid ${VS.accent}44`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <Building2 size={22} color={VS.accent} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: 15, fontWeight: 600, color: VS.text0, margin: 0 }}>{client.name}</h3>
                    <p style={{ fontSize: 12, color: VS.text2, margin: 0 }}>{client.contactPerson}</p>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 500,
                      padding: '2px 8px',
                      borderRadius: 4,
                      textTransform: 'capitalize',
                      ...getStatusBadgeStyle(client.status),
                    }}
                  >
                    {client.status}
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 500,
                      padding: '2px 8px',
                      borderRadius: 4,
                      textTransform: 'capitalize',
                      ...getPriorityBadgeStyle(client.priority),
                    }}
                  >
                    {client.priority}
                  </span>
                </div>
              </div>

              {/* Contact Details */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: VS.text1 }}>
                  <Mail size={14} color={VS.text2} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{client.email}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: VS.text1 }}>
                  <Phone size={14} color={VS.text2} />
                  <span>{client.phone}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: VS.text1 }}>
                  <MapPin size={14} color={VS.text2} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{client.address}</span>
                </div>
              </div>

              {/* Stats Row */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr 1fr',
                  gap: 8,
                  paddingTop: 14,
                  marginTop: 4,
                  borderTop: `1px solid ${VS.border}`,
                  marginBottom: 14,
                }}
              >
                <div style={{ textAlign: 'center' }}>
                  <p style={{ fontSize: 14, fontWeight: 600, color: VS.text0, margin: 0 }}>{client.totalProjects}</p>
                  <p style={{ fontSize: 11, color: VS.text2, margin: 0 }}>Projects</p>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <p style={{ fontSize: 14, fontWeight: 600, color: VS.text0, margin: 0 }}>{client.totalHours}h</p>
                  <p style={{ fontSize: 11, color: VS.text2, margin: 0 }}>Hours</p>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <p style={{ fontSize: 14, fontWeight: 600, color: VS.teal, margin: 0 }}>${client.totalEarnings.toLocaleString()}</p>
                  <p style={{ fontSize: 11, color: VS.text2, margin: 0 }}>Revenue</p>
                </div>
              </div>

              {/* Card Footer */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingTop: 12,
                  borderTop: `1px solid ${VS.border}`,
                }}
              >
                <span style={{ fontSize: 12, color: VS.text2 }}>
                  Last activity: {new Date(client.lastActivity).toLocaleDateString()}
                </span>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    style={{
                      background: VS.bg2,
                      border: `1px solid ${VS.border}`,
                      borderRadius: 6,
                      color: VS.text1,
                      padding: '5px 8px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    <Edit size={14} />
                  </button>
                  <button
                    style={{
                      background: VS.bg2,
                      border: `1px solid ${VS.border}`,
                      borderRadius: 6,
                      color: VS.red,
                      padding: '5px 8px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}

          {filteredClients.length === 0 && (
            <div
              style={{
                gridColumn: '1 / -1',
                textAlign: 'center',
                padding: '48px 0',
              }}
            >
              <Building2 size={48} color={VS.text2} style={{ margin: '0 auto 16px' }} />
              <h3 style={{ fontSize: 18, fontWeight: 600, color: VS.text0, marginBottom: 8 }}>No clients found</h3>
              <p style={{ color: VS.text2, marginBottom: 16 }}>
                {searchTerm || filterStatus !== 'all' || filterPriority !== 'all'
                  ? 'Try adjusting your filters or search term'
                  : 'Add your first client to get started'}
              </p>
              <button
                onClick={() => setShowNewClientModal(true)}
                style={{
                  background: VS.accent,
                  color: 'white',
                  border: 'none',
                  borderRadius: 8,
                  padding: '8px 16px',
                  cursor: 'pointer',
                  fontSize: 14,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <Plus size={16} />
                Add Client
              </button>
            </div>
          )}
        </div>
      ) : (
        /* List View */
        <div
          style={{
            background: VS.bg1,
            border: `1px solid ${VS.border}`,
            borderRadius: 12,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '16px 20px',
              borderBottom: `1px solid ${VS.border}`,
            }}
          >
            <h2 style={{ fontSize: 16, fontWeight: 600, color: VS.text0, margin: 0 }}>
              All Clients ({filteredClients.length})
            </h2>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${VS.border}` }}>
                  {['Client', 'Contact', 'Industry', 'Projects', 'Revenue', 'Rate', 'Status', 'Actions'].map(col => (
                    <th
                      key={col}
                      style={{
                        textAlign: 'left',
                        padding: '12px 16px',
                        fontSize: 12,
                        fontWeight: 500,
                        color: VS.text2,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredClients.map(client => (
                  <tr
                    key={client.id}
                    style={{ borderBottom: `1px solid ${VS.border}` }}
                    onMouseEnter={e => (e.currentTarget.style.background = VS.bg2)}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: 8,
                            background: `${VS.accent}22`,
                            border: `1px solid ${VS.accent}44`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          <Building2 size={18} color={VS.accent} />
                        </div>
                        <div>
                          <p style={{ fontSize: 14, fontWeight: 500, color: VS.text0, margin: 0 }}>{client.name}</p>
                          <p style={{ fontSize: 12, color: VS.text2, margin: 0 }}>{client.company}</p>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <p style={{ fontSize: 14, fontWeight: 500, color: VS.text0, margin: 0 }}>{client.contactPerson}</p>
                      <p style={{ fontSize: 12, color: VS.text2, margin: 0 }}>{client.email}</p>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 13, color: VS.text1 }}>{client.industry}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, color: VS.text0 }}>
                        <FileText size={14} color={VS.text2} />
                        <span style={{ fontWeight: 500 }}>{client.totalProjects}</span>
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: VS.teal }}>${client.totalEarnings.toLocaleString()}</span>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 13, color: VS.text1 }}>${client.hourlyRate}/hr</td>
                    <td style={{ padding: '12px 16px' }}>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 500,
                          padding: '3px 8px',
                          borderRadius: 4,
                          textTransform: 'capitalize',
                          ...getStatusBadgeStyle(client.status),
                        }}
                      >
                        {client.status}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          style={{
                            background: VS.bg2,
                            border: `1px solid ${VS.border}`,
                            borderRadius: 6,
                            color: VS.text1,
                            padding: '5px 8px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                          }}
                        >
                          <Edit size={14} />
                        </button>
                        <button
                          style={{
                            background: VS.bg2,
                            border: `1px solid ${VS.border}`,
                            borderRadius: 6,
                            color: VS.red,
                            padding: '5px 8px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {filteredClients.length === 0 && (
              <div style={{ textAlign: 'center', padding: '48px 0' }}>
                <Building2 size={48} color={VS.text2} style={{ margin: '0 auto 16px' }} />
                <h3 style={{ fontSize: 18, fontWeight: 600, color: VS.text0, marginBottom: 8 }}>No clients found</h3>
                <p style={{ color: VS.text2, marginBottom: 16 }}>
                  {searchTerm || filterStatus !== 'all' || filterPriority !== 'all'
                    ? 'Try adjusting your filters or search term'
                    : 'Add your first client to get started'}
                </p>
                <button
                  onClick={() => setShowNewClientModal(true)}
                  style={{
                    background: VS.accent,
                    color: 'white',
                    border: 'none',
                    borderRadius: 8,
                    padding: '8px 16px',
                    cursor: 'pointer',
                    fontSize: 14,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <Plus size={16} />
                  Add Client
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add Client Modal */}
      {showNewClientModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.75)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
          onClick={e => { if (e.target === e.currentTarget) setShowNewClientModal(false); }}
        >
          <div
            style={{
              background: VS.bg1,
              border: `1px solid ${VS.border}`,
              borderRadius: 12,
              width: '95%',
              maxWidth: 640,
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                background: VS.bg2,
                borderBottom: `1px solid ${VS.border}`,
                padding: '20px 24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderRadius: '12px 12px 0 0',
              }}
            >
              <h2 style={{ fontSize: 18, fontWeight: 600, color: VS.text0, margin: 0 }}>Add New Client</h2>
              <button
                onClick={() => setShowNewClientModal(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: VS.text2,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 4,
                  borderRadius: 4,
                }}
              >
                <Plus size={20} style={{ transform: 'rotate(45deg)' }} />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleCreateClient} style={{ padding: 24 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: VS.text1, marginBottom: 6 }}>
                    Client Name *
                  </label>
                  <input
                    type="text"
                    value={newClientForm.name}
                    onChange={e => setNewClientForm(prev => ({ ...prev, name: e.target.value }))}
                    required
                    placeholder="Enter client name"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: VS.text1, marginBottom: 6 }}>
                    Company
                  </label>
                  <input
                    type="text"
                    value={newClientForm.company}
                    onChange={e => setNewClientForm(prev => ({ ...prev, company: e.target.value }))}
                    placeholder="Company name"
                    style={inputStyle}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: VS.text1, marginBottom: 6 }}>
                    Email *
                  </label>
                  <input
                    type="email"
                    value={newClientForm.email}
                    onChange={e => setNewClientForm(prev => ({ ...prev, email: e.target.value }))}
                    required
                    placeholder="client@company.com"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: VS.text1, marginBottom: 6 }}>
                    Phone
                  </label>
                  <input
                    type="tel"
                    value={newClientForm.phone}
                    onChange={e => setNewClientForm(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="+1 (555) 123-4567"
                    style={inputStyle}
                  />
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: VS.text1, marginBottom: 6 }}>
                  Address
                </label>
                <input
                  type="text"
                  value={newClientForm.address}
                  onChange={e => setNewClientForm(prev => ({ ...prev, address: e.target.value }))}
                  placeholder="Client address"
                  style={inputStyle}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: VS.text1, marginBottom: 6 }}>
                    Contact Person *
                  </label>
                  <input
                    type="text"
                    value={newClientForm.contactPerson}
                    onChange={e => setNewClientForm(prev => ({ ...prev, contactPerson: e.target.value }))}
                    required
                    placeholder="John Smith"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: VS.text1, marginBottom: 6 }}>
                    Industry
                  </label>
                  <input
                    type="text"
                    value={newClientForm.industry}
                    onChange={e => setNewClientForm(prev => ({ ...prev, industry: e.target.value }))}
                    placeholder="Technology, Finance, etc."
                    style={inputStyle}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: VS.text1, marginBottom: 6 }}>
                    Hourly Rate ($)
                  </label>
                  <input
                    type="number"
                    value={newClientForm.hourlyRate}
                    onChange={e => setNewClientForm(prev => ({ ...prev, hourlyRate: parseFloat(e.target.value) || 0 }))}
                    min="0"
                    step="5"
                    placeholder="95"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: VS.text1, marginBottom: 6 }}>
                    Priority
                  </label>
                  <select
                    value={newClientForm.priority}
                    onChange={e => setNewClientForm(prev => ({ ...prev, priority: e.target.value as 'low' | 'medium' | 'high' }))}
                    style={{ ...inputStyle, cursor: 'pointer' }}
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: 24 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: VS.text1, marginBottom: 6 }}>
                  Notes
                </label>
                <textarea
                  value={newClientForm.notes}
                  onChange={e => setNewClientForm(prev => ({ ...prev, notes: e.target.value }))}
                  rows={3}
                  placeholder="Additional notes about the client..."
                  style={{ ...inputStyle, resize: 'vertical' }}
                />
              </div>

              {/* Modal Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setShowNewClientModal(false)}
                  style={{
                    background: VS.bg2,
                    border: `1px solid ${VS.border}`,
                    borderRadius: 8,
                    color: VS.text1,
                    padding: '8px 20px',
                    cursor: 'pointer',
                    fontSize: 14,
                    fontWeight: 500,
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={newClientLoading}
                  style={{
                    background: newClientLoading ? VS.bg3 : VS.accent,
                    border: 'none',
                    borderRadius: 8,
                    color: 'white',
                    padding: '8px 20px',
                    cursor: newClientLoading ? 'not-allowed' : 'pointer',
                    fontSize: 14,
                    fontWeight: 500,
                    opacity: newClientLoading ? 0.7 : 1,
                  }}
                >
                  {newClientLoading ? 'Adding...' : 'Add Client'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
