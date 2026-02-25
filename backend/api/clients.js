// Client management API endpoints
import express from 'express';
import { prisma } from '../lib/prisma.js';
import { requireAuth, withOrgScope } from '../lib/rbac.js';
import { validateBody, validateQuery, commonSchemas, clientSchemas } from '../lib/validation.js';
import { checkDatabaseConnection, handleDatabaseError } from '../lib/api-error-handler.js';

const router = express.Router();

// ── Startup migration — add columns that may not exist yet ────────────────────
(async () => {
  if (!process.env.DATABASE_URL) return;
  try {
    const cols = [
      "ALTER TABLE clients ADD COLUMN IF NOT EXISTS company       VARCHAR(255) NULL",
      "ALTER TABLE clients ADD COLUMN IF NOT EXISTS status        VARCHAR(20)  NOT NULL DEFAULT 'active'",
      "ALTER TABLE clients ADD COLUMN IF NOT EXISTS hourly_rate   DECIMAL(10,2) NULL",
      "ALTER TABLE clients ADD COLUMN IF NOT EXISTS contact_person VARCHAR(255) NULL",
      "ALTER TABLE clients ADD COLUMN IF NOT EXISTS industry      VARCHAR(255) NULL",
      "ALTER TABLE clients ADD COLUMN IF NOT EXISTS priority      VARCHAR(20)  NOT NULL DEFAULT 'medium'",
      "ALTER TABLE clients ADD COLUMN IF NOT EXISTS notes         TEXT NULL",
      "ALTER TABLE clients ADD COLUMN IF NOT EXISTS user_id       VARCHAR(36) NULL",
    ];
    for (const sql of cols) {
      await prisma.$executeRawUnsafe(sql);
    }
    // Add index on user_id if missing
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS clients_user_id_idx ON clients(user_id)`
    ).catch(() => {});
    console.log('✅ clients table columns ensured');
  } catch (e) {
    console.warn('⚠️  clients migration warning:', e.message);
  }
})();

// ── Helper ────────────────────────────────────────────────────────────────────
function formatClient(c) {
  return {
    id:            c.id,
    name:          c.name,
    email:         c.email,
    phone:         c.phone,
    address:       c.address,
    company:       c.company || '',
    status:        c.status  || 'active',
    hourlyRate:    c.hourlyRate ? Number(c.hourlyRate) : 0,
    contactPerson: c.contactPerson || '',
    industry:      c.industry || '',
    priority:      c.priority || 'medium',
    notes:         c.notes || '',
    userId:        c.userId || null,
    orgId:         c.orgId,
    totalProjects: c.projects?.length ?? 0,
    totalHours:    0,
    totalEarnings: 0,
    lastActivity:  c.updatedAt,
    createdAt:     c.createdAt,
    updatedAt:     c.updatedAt,
  };
}

// ── GET /api/clients/my ───────────────────────────────────────────────────────
// Returns the Client record linked to the logged-in CLIENT user, with projects+tasks
router.get('/my', requireAuth, withOrgScope, async (req, res) => {
  try {
    const userId = req.user.id;
    const orgId  = req.orgId;

    // Fetch client with only safe/original fields — avoids column-name
    // mismatches on newly-added fields (hourlyRate, contactPerson, etc.)
    const client = await prisma.client.findFirst({
      where: { userId, orgId },
      select: {
        id:        true,
        name:      true,
        email:     true,
        phone:     true,
        address:   true,
        company:   true,
        status:    true,
        industry:  true,
        priority:  true,
        notes:     true,
        orgId:     true,
        createdAt: true,
        updatedAt: true,
        projects: {
          where:    { orgId },
          orderBy:  { name: 'asc' },
          select: {
            id:     true,
            name:   true,
            color:  true,
            status: true,
            tasks: {
              where:   { orgId },
              orderBy: { createdAt: 'desc' },
              select: {
                id:             true,
                title:          true,
                status:         true,
                priority:       true,
                estimatedHours: true,
                actualHours:    true,
                dueDate:        true,
                createdAt:      true,
                updatedAt:      true,
              },
            },
          },
        },
      },
    });

    if (!client) {
      return res.json({ success: true, client: null, projects: [] });
    }

    res.json({
      success:  true,
      client: {
        id:       client.id,
        name:     client.name,
        email:    client.email    || null,
        company:  client.company  || null,
        phone:    client.phone    || null,
        address:  client.address  || null,
        status:   client.status   || 'active',
        priority: client.priority || 'medium',
        notes:    client.notes    || null,
        industry: client.industry || null,
        orgId:    client.orgId,
      },
      projects: client.projects,
    });
  } catch (error) {
    return handleDatabaseError(error, res, 'fetch my client');
  }
});

// ── GET /api/clients ──────────────────────────────────────────────────────────
router.get('/', requireAuth, withOrgScope, validateQuery(commonSchemas.pagination), async (req, res) => {
  try {
    if (!(await checkDatabaseConnection(res))) return;
    const { limit = 100 } = req.query;
    const orgId = req.orgId;

    const clients = await prisma.client.findMany({
      where:   { orgId },
      include: { projects: { select: { id: true } } },
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
      take:    parseInt(limit),
    });

    res.json({ success: true, clients: clients.map(formatClient), total: clients.length });
  } catch (error) {
    return handleDatabaseError(error, res, 'fetch clients');
  }
});

// ── GET /api/clients/:id/projects ─────────────────────────────────────────────
// Returns a single client's projects with their tasks
router.get('/:id/projects', requireAuth, withOrgScope, async (req, res) => {
  try {
    const { id } = req.params;
    const orgId  = req.orgId;

    const client = await prisma.client.findFirst({
      where: { id, orgId },
      include: {
        projects: {
          where:   { orgId },
          orderBy: { name: 'asc' },
          include: {
            tasks: {
              where:   { orgId },
              orderBy: { createdAt: 'desc' },
              select: {
                id: true, title: true, status: true, priority: true,
                estimatedHours: true, actualHours: true,
                dueDate: true, createdAt: true, updatedAt: true,
              },
            },
          },
        },
      },
    });

    if (!client) return res.status(404).json({ success: false, error: 'Client not found' });

    res.json({ success: true, projects: client.projects });
  } catch (error) {
    return handleDatabaseError(error, res, 'fetch client projects');
  }
});

// ── POST /api/clients ─────────────────────────────────────────────────────────
router.post('/', requireAuth, withOrgScope, validateBody(clientSchemas.create), async (req, res) => {
  try {
    if (!(await checkDatabaseConnection(res))) return;
    const orgId = req.orgId;
    const { name, email, company, phone, address, hourlyRate, contactPerson, industry, priority, notes, userId } = req.body;

    if (!name || !email) {
      return res.status(400).json({ error: 'name and email are required' });
    }

    const client = await prisma.client.create({
      data: {
        orgId,
        name,
        email,
        company:       company       || null,
        phone:         phone         || null,
        address:       address       || null,
        hourlyRate:    hourlyRate    ? parseFloat(hourlyRate) : null,
        contactPerson: contactPerson || null,
        industry:      industry      || null,
        priority:      priority      || 'medium',
        notes:         notes         || null,
        status:        'active',
        userId:        userId        || null,
      },
    });

    console.log(`✅ Created client: ${name}`);
    res.status(201).json({ success: true, client: formatClient(client) });
  } catch (error) {
    return handleDatabaseError(error, res, 'create client');
  }
});

// ── PATCH /api/clients/:id ────────────────────────────────────────────────────
router.patch('/:id', requireAuth, withOrgScope, async (req, res) => {
  try {
    if (!(await checkDatabaseConnection(res))) return;
    const { id } = req.params;
    const orgId  = req.orgId;

    // Verify client belongs to this org
    const existing = await prisma.client.findFirst({ where: { id, orgId } });
    if (!existing) return res.status(404).json({ success: false, error: 'Client not found' });

    const allowed = ['name','email','phone','company','address','hourlyRate','contactPerson','industry','priority','notes','status'];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        updates[key] = key === 'hourlyRate' ? (req.body[key] ? parseFloat(req.body[key]) : null) : req.body[key];
      }
    }

    const client = await prisma.client.update({ where: { id }, data: updates });
    console.log(`📝 Updated client ${id}`);
    res.json({ success: true, client: formatClient(client), message: 'Client updated' });
  } catch (error) {
    return handleDatabaseError(error, res, 'update client');
  }
});

// ── DELETE /api/clients/:id ───────────────────────────────────────────────────
router.delete('/:id', requireAuth, withOrgScope, async (req, res) => {
  try {
    if (!(await checkDatabaseConnection(res))) return;
    const { id } = req.params;
    const orgId  = req.orgId;

    const existing = await prisma.client.findFirst({ where: { id, orgId } });
    if (!existing) return res.status(404).json({ success: false, error: 'Client not found' });

    await prisma.client.delete({ where: { id } });
    console.log(`🗑️ Deleted client ${id}`);
    res.json({ success: true, message: 'Client deleted' });
  } catch (error) {
    return handleDatabaseError(error, res, 'delete client');
  }
});

export default router;
