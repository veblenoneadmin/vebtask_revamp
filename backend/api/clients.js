// Client management API endpoints
import express from 'express';
import { randomUUID } from 'crypto';
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

    // Try user_id lookup first; fall back to email if column doesn't exist yet
    let raw = null;
    try {
      const rows = await prisma.$queryRawUnsafe(
        `SELECT * FROM clients WHERE user_id = ? AND orgId = ? LIMIT 1`,
        userId, orgId
      );
      raw = rows[0] || null;
    } catch (e) {
      // MySQL error 1054 = unknown column — user_id not added to DB yet
      if (e.meta?.code === '1054' || e.code === 'P2010') {
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { email: true },
        });
        if (user?.email) {
          const rows = await prisma.$queryRawUnsafe(
            `SELECT * FROM clients WHERE email = ? AND orgId = ? LIMIT 1`,
            user.email, orgId
          );
          raw = rows[0] || null;
        }
      } else {
        throw e;
      }
    }

    // If no client record found, auto-create one for CLIENT role users
    if (!raw) {
      try {
        const membership = await prisma.membership.findFirst({
          where: { userId, orgId, role: 'CLIENT' },
        });
        if (membership) {
          const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { name: true, email: true },
          });
          if (user) {
            const clientId = randomUUID();
            const clientName = user.name || user.email || 'Client';
            // Insert only original columns that always exist
            await prisma.$executeRawUnsafe(
              `INSERT INTO clients (id, name, email, orgId, createdAt, updatedAt)
               VALUES (?, ?, ?, ?, NOW(), NOW())`,
              clientId, clientName, user.email || '', orgId
            );
            // Link user_id once the column exists (silently skip if not yet)
            try {
              await prisma.$executeRawUnsafe(
                `UPDATE clients SET user_id = ? WHERE id = ?`, userId, clientId
              );
            } catch (_) { /* user_id column not yet added — will link on next restart */ }
            const newRows = await prisma.$queryRawUnsafe(
              `SELECT * FROM clients WHERE id = ? LIMIT 1`, clientId
            );
            raw = newRows[0] || null;
            console.log(`👤 Auto-created Client record for ${user.email}`);
          }
        }
      } catch (e) {
        console.warn(`⚠️  Could not auto-create client record: ${e.message}`);
      }
    }

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
            id:        true,
            title:     true,
            status:    true,
            priority:  true,
            dueDate:   true,
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

// ── GET /api/clients/my/projects ──────────────────────────────────────────────
// Returns full project data for the logged-in CLIENT user.
// Uses the same proven client-finding logic as /api/clients/my.
router.get('/my/projects', requireAuth, withOrgScope, async (req, res) => {
  try {
    const userId = req.user.id;
    const orgId  = req.orgId;

    console.log(`[ClientProjects] lookup — userId=${userId} orgId=${orgId}`);

    // Find client record (mirrors /api/clients/my logic exactly)
    let raw = null;
    try {
      const rows = await prisma.$queryRawUnsafe(
        `SELECT * FROM clients WHERE user_id = ? AND orgId = ? LIMIT 1`,
        userId, orgId
      );
      raw = rows[0] || null;
      if (raw) console.log(`[ClientProjects] found by user_id: ${raw.id}`);
    } catch (e) {
      if (e.meta?.code === '1054' || e.code === 'P2010') {
        const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
        if (user?.email) {
          const rows = await prisma.$queryRawUnsafe(
            `SELECT * FROM clients WHERE LOWER(email) = LOWER(?) AND orgId = ? LIMIT 1`,
            user.email, orgId
          );
          raw = rows[0] || null;
          if (raw) console.log(`[ClientProjects] found by email: ${raw.id}`);
          else {
            const all = await prisma.$queryRawUnsafe(`SELECT id, name, email FROM clients WHERE orgId = ?`, orgId);
            console.log(`[ClientProjects] no match. clients in org: ${JSON.stringify(all.map(c => ({ id: c.id, email: c.email })))}`);
          }
        }
      } else { throw e; }
    }

    // Also try email fallback if user_id lookup returned nothing but didn't throw
    if (!raw) {
      try {
        const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
        if (user?.email) {
          const rows = await prisma.$queryRawUnsafe(
            `SELECT * FROM clients WHERE LOWER(email) = LOWER(?) AND orgId = ? LIMIT 1`,
            user.email, orgId
          );
          raw = rows[0] || null;
          if (raw) console.log(`[ClientProjects] found by email fallback: ${raw.id}`);
          else {
            const all = await prisma.$queryRawUnsafe(`SELECT id, name, email FROM clients WHERE orgId = ?`, orgId);
            console.log(`[ClientProjects] no client. all clients in org: ${JSON.stringify(all.map(c => ({ id: c.id, email: c.email })))}`);
          }
        }
      } catch { /* non-fatal */ }
    }

    if (!raw) {
      return res.json({ success: true, projects: [], total: 0 });
    }

    console.log(`[ClientProjects] clientId=${raw.id} — fetching projects...`);

    // Fetch full project data
    const projects = await prisma.project.findMany({
      where:   { clientId: raw.id, orgId },
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
      include: {
        client: { select: { id: true, name: true, email: true } },
      },
    });

    console.log(`[ClientProjects] returned ${projects.length} projects for clientId=${raw.id}`);
    res.json({ success: true, projects, total: projects.length });
  } catch (error) {
    return handleDatabaseError(error, res, 'fetch my client projects');
  }
});

// ── GET /api/clients ──────────────────────────────────────────────────────────
// Uses raw SQL to avoid P2022 when extended columns haven't been added yet.
router.get('/', requireAuth, withOrgScope, validateQuery(commonSchemas.pagination), async (req, res) => {
  try {
    if (!(await checkDatabaseConnection(res))) return;
    const { limit = 100 } = req.query;
    const orgId = req.orgId;

    // Raw SQL: fetch clients without Prisma column validation
    const clients = await prisma.$queryRawUnsafe(
      `SELECT * FROM clients WHERE orgId = ? ORDER BY updatedAt DESC, createdAt DESC LIMIT ?`,
      orgId, parseInt(limit)
    );

    // Count projects per client via a separate query (no JOIN = no collation risk)
    const projectCounts = await prisma.$queryRawUnsafe(
      `SELECT clientId, COUNT(*) AS cnt FROM projects WHERE orgId = ? AND clientId IS NOT NULL GROUP BY clientId`,
      orgId
    );
    const countMap = {};
    for (const row of projectCounts) {
      countMap[row.clientId] = Number(row.cnt ?? 0);
    }

    const formatted = clients.map(c => ({
      id:            c.id,
      name:          c.name          || '',
      email:         c.email         || '',
      phone:         c.phone         || '',
      address:       c.address       || '',
      company:       c.company       || '',
      status:        c.status        || 'active',
      hourlyRate:    c.hourly_rate   ? Number(c.hourly_rate) : 0,
      contactPerson: c.contact_person || '',
      industry:      c.industry      || '',
      priority:      c.priority      || 'medium',
      notes:         c.notes         || '',
      userId:        c.user_id       || null,
      orgId:         c.orgId,
      totalProjects: countMap[c.id]  || 0,
      totalHours:    0,
      totalEarnings: 0,
      lastActivity:  c.updatedAt,
      createdAt:     c.createdAt,
      updatedAt:     c.updatedAt,
    }));

    res.json({ success: true, clients: formatted, total: formatted.length });
  } catch (error) {
    return handleDatabaseError(error, res, 'fetch clients');
  }
});

// ── GET /api/clients/slim ─────────────────────────────────────────────────────
// Lightweight endpoint for dropdowns — raw SQL, no JOINs, returns id/name/email/company only
router.get('/slim', requireAuth, withOrgScope, async (req, res) => {
  try {
    const orgId = req.orgId;
    // Check if company column exists before selecting it
    let hasCompany = false;
    try {
      const cols = await prisma.$queryRawUnsafe(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'clients' AND COLUMN_NAME = 'company'`
      );
      hasCompany = cols.length > 0;
    } catch { /* ignore */ }

    const rows = await prisma.$queryRawUnsafe(
      hasCompany
        ? `SELECT id, name, email, company FROM clients WHERE orgId = ? ORDER BY name ASC`
        : `SELECT id, name, email FROM clients WHERE orgId = ? ORDER BY name ASC`,
      orgId
    );
    res.json({
      success: true,
      clients: rows.map(r => ({
        id:      r.id,
        name:    r.name    || '',
        email:   r.email   || '',
        company: r.company || '',
      }))
    });
  } catch (error) {
    console.error('Error fetching slim clients:', error);
    res.status(500).json({ success: false, clients: [], error: 'Failed to fetch clients' });
  }
});

// ── GET /api/clients/:id/projects ─────────────────────────────────────────────
// Returns a single client's projects with their tasks
router.get('/:id/projects', requireAuth, withOrgScope, async (req, res) => {
  try {
    const { id } = req.params;
    const orgId  = req.orgId;

    // Use raw SQL to check client exists (avoids P2022 on missing columns)
    const clientRows = await prisma.$queryRawUnsafe(
      `SELECT id FROM clients WHERE id = ? AND orgId = ? LIMIT 1`, id, orgId
    );
    if (!clientRows.length) return res.status(404).json({ success: false, error: 'Client not found' });

    const projects = await prisma.project.findMany({
      where:   { clientId: id, orgId },
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
    });

    res.json({ success: true, projects });
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

    const clientId = randomUUID();
    // Insert base columns first (always exist)
    await prisma.$executeRawUnsafe(
      `INSERT INTO clients (id, name, email, orgId, createdAt, updatedAt) VALUES (?, ?, ?, ?, NOW(), NOW())`,
      clientId, name, email, orgId
    );
    // Then set extended columns separately (added by ensureClientsSchema — may not exist on first deploy)
    const extFields = [
      ['company',        company        || null],
      ['phone',          phone          || null],
      ['address',        address        || null],
      ['hourly_rate',    hourlyRate     ? parseFloat(hourlyRate) : null],
      ['contact_person', contactPerson  || null],
      ['industry',       industry       || null],
      ['priority',       priority       || 'medium'],
      ['notes',          notes          || null],
      ['status',         'active'],
      ['user_id',        userId         || null],
    ];
    for (const [col, val] of extFields) {
      try {
        await prisma.$executeRawUnsafe(
          `UPDATE clients SET ${col} = ? WHERE id = ?`, val, clientId
        );
      } catch (_) { /* column not yet added — ensureClientsSchema will handle it */ }
    }

    const rows = await prisma.$queryRawUnsafe(`SELECT * FROM clients WHERE id = ? LIMIT 1`, clientId);
    const raw = rows[0] || {};
    console.log(`✅ Created client: ${name}`);
    res.status(201).json({
      success: true,
      client: {
        id: raw.id, name: raw.name || '', email: raw.email || '',
        company: raw.company || '', status: raw.status || 'active',
        orgId: raw.orgId, createdAt: raw.createdAt, updatedAt: raw.updatedAt,
      }
    });
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

    // Verify client belongs to this org (raw SQL — avoids P2022)
    const existing = await prisma.$queryRawUnsafe(
      `SELECT id FROM clients WHERE id = ? AND orgId = ? LIMIT 1`, id, orgId
    );
    if (!existing.length) return res.status(404).json({ success: false, error: 'Client not found' });

    // Map camelCase request fields → snake_case DB columns
    const colMap = {
      name: 'name', email: 'email', phone: 'phone', address: 'address',
      company: 'company', contactPerson: 'contact_person', industry: 'industry',
      priority: 'priority', notes: 'notes', status: 'status', hourlyRate: 'hourly_rate',
    };
    for (const [key, col] of Object.entries(colMap)) {
      if (req.body[key] !== undefined) {
        const val = key === 'hourlyRate' ? (req.body[key] ? parseFloat(req.body[key]) : null) : req.body[key];
        try {
          await prisma.$executeRawUnsafe(`UPDATE clients SET ${col} = ?, updatedAt = NOW() WHERE id = ?`, val, id);
        } catch (_) { /* column not yet added */ }
      }
    }
    await prisma.$executeRawUnsafe(`UPDATE clients SET updatedAt = NOW() WHERE id = ?`, id);

    const rows = await prisma.$queryRawUnsafe(`SELECT * FROM clients WHERE id = ? LIMIT 1`, id);
    const raw = rows[0] || {};
    console.log(`📝 Updated client ${id}`);
    res.json({
      success: true,
      client: {
        id: raw.id, name: raw.name || '', email: raw.email || '',
        company: raw.company || '', status: raw.status || 'active',
        hourlyRate: raw.hourly_rate ? Number(raw.hourly_rate) : 0,
        contactPerson: raw.contact_person || '', industry: raw.industry || '',
        priority: raw.priority || 'medium', notes: raw.notes || '',
        orgId: raw.orgId, createdAt: raw.createdAt, updatedAt: raw.updatedAt,
      },
      message: 'Client updated'
    });
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

    const existing = await prisma.$queryRawUnsafe(
      `SELECT id FROM clients WHERE id = ? AND orgId = ? LIMIT 1`, id, orgId
    );
    if (!existing.length) return res.status(404).json({ success: false, error: 'Client not found' });

    await prisma.$executeRawUnsafe(`DELETE FROM clients WHERE id = ?`, id);
    console.log(`🗑️ Deleted client ${id}`);
    res.json({ success: true, message: 'Client deleted' });
  } catch (error) {
    return handleDatabaseError(error, res, 'delete client');
  }
});

export default router;
