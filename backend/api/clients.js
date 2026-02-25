// Client management API endpoints
import express from 'express';
import { prisma } from '../lib/prisma.js';
import { requireAuth, withOrgScope } from '../lib/rbac.js';
import { validateBody, validateQuery, commonSchemas, clientSchemas } from '../lib/validation.js';
import { checkDatabaseConnection, handleDatabaseError } from '../lib/api-error-handler.js';

const router = express.Router();


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
// Returns the Client record linked to the logged-in CLIENT user, with projects+tasks.
// Uses raw SQL so it works even when extended columns haven't been added yet.
router.get('/my', requireAuth, withOrgScope, async (req, res) => {
  try {
    const userId = req.user.id;
    const orgId  = req.orgId;

    // SELECT * returns whatever columns exist — no P2022 if new columns are missing
    // user_id is the DB column name (Prisma maps userId → user_id via @map)
    const rows = await prisma.$queryRawUnsafe(
      `SELECT * FROM clients WHERE user_id = ? AND orgId = ? LIMIT 1`,
      userId, orgId
    );

    const raw = rows[0] || null;

    if (!raw) {
      return res.json({ success: true, client: null, projects: [] });
    }

    // Fetch projects via Prisma (projects table has no missing columns)
    const projects = await prisma.project.findMany({
      where:   { clientId: raw.id, orgId },
      orderBy: { name: 'asc' },
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
    });

    res.json({
      success: true,
      client: {
        id:       raw.id,
        name:     raw.name,
        email:    raw.email    || null,
        company:  raw.company  || null,
        phone:    raw.phone    || null,
        address:  raw.address  || null,
        status:   raw.status   || 'active',
        priority: raw.priority || 'medium',
        notes:    raw.notes    || null,
        industry: raw.industry || null,
        orgId:    raw.orgId,
      },
      projects,
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
