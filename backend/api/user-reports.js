// User Reports management API endpoints
import express from 'express';
import { randomUUID } from 'crypto';
import { prisma } from '../lib/prisma.js';
import { requireAuth, withOrgScope } from '../lib/rbac.js';

const router = express.Router();

// ── GET /api/user-reports — role-aware list ───────────────────────────────────
router.get('/', requireAuth, withOrgScope, async (req, res) => {
  try {
    const userId = req.user.id;
    const orgId  = req.orgId;
    const { limit = '100', offset = '0', projectId, memberId, search, dateFrom, dateTo } = req.query;

    // Safe integer parsing for LIMIT/OFFSET (will be inlined, not bound)
    const lim = Math.min(Math.max(parseInt(limit) || 50, 1), 500);
    const off = Math.max(parseInt(offset) || 0, 0);

    // ── Role lookup ──────────────────────────────────────────────────────────
    const memberRows = await prisma.$queryRawUnsafe(
      `SELECT role FROM memberships WHERE userId = ? AND orgId = ? LIMIT 1`,
      userId, orgId
    );
    const role         = memberRows[0]?.role || 'STAFF';
    const isPrivileged = role === 'OWNER' || role === 'ADMIN';

    // ── Always fetch the project list first (needed for modal even if reports fail) ─
    const projectList = await prisma.$queryRawUnsafe(
      `SELECT id, name, color FROM projects WHERE orgId = ? ORDER BY name ASC`,
      orgId
    );

    // ── Build dynamic WHERE clause ───────────────────────────────────────────
    const conditions = [`r.orgId = ?`];
    const params     = [orgId];

    if (!isPrivileged) {
      conditions.push(`r.userId = ?`);
      params.push(userId);
    } else if (memberId) {
      conditions.push(`r.userId = ?`);
      params.push(memberId);
    }

    if (projectId) {
      conditions.push(`r.projectId = ?`);
      params.push(projectId);
    }

    if (dateFrom) {
      conditions.push(`r.createdAt >= ?`);
      params.push(dateFrom);
    }
    if (dateTo) {
      conditions.push(`r.createdAt <= ?`);
      params.push(new Date(new Date(dateTo).setHours(23, 59, 59, 999)).toISOString().slice(0, 19).replace('T', ' '));
    }

    if (search) {
      conditions.push(`(r.title LIKE ? OR r.description LIKE ? OR r.userName LIKE ?)`);
      const s = `%${search}%`;
      params.push(s, s, s);
    }

    const whereSQL = conditions.join(' AND ');

    // ── Fetch reports — inline LIMIT/OFFSET (MySQL2 doesn't reliably bind these) ─
    const reports = await prisma.$queryRawUnsafe(
      `SELECT * FROM reports r WHERE ${whereSQL} ORDER BY r.createdAt DESC LIMIT ${lim} OFFSET ${off}`,
      ...params
    );

    const countRows = await prisma.$queryRawUnsafe(
      `SELECT COUNT(*) AS cnt FROM reports r WHERE ${whereSQL}`,
      ...params
    );
    const total = Number(countRows[0]?.cnt ?? 0);

    // ── Enrich with user + project data (separate queries, no JOIN) ───────────
    const userIds = [...new Set(reports.map(r => r.userId).filter(Boolean))];
    const projIds = [...new Set(reports.map(r => r.projectId).filter(Boolean))];

    const usersMap = {}, projsMap = {};

    if (userIds.length) {
      const ph    = userIds.map(() => '?').join(',');
      const users = await prisma.$queryRawUnsafe(
        `SELECT id, name, email, image FROM user WHERE id IN (${ph})`,
        ...userIds
      );
      users.forEach(u => { usersMap[u.id] = u; });
    }

    if (projIds.length) {
      const ph    = projIds.map(() => '?').join(',');
      const projs = await prisma.$queryRawUnsafe(
        `SELECT id, name, color, status, budget FROM projects WHERE id IN (${ph})`,
        ...projIds
      );
      projs.forEach(p => { projsMap[p.id] = p; });
    }

    // ── Analytics ────────────────────────────────────────────────────────────
    const analyticsSQL    = isPrivileged ? `orgId = ?` : `orgId = ? AND userId = ?`;
    const analyticsParams = isPrivileged ? [orgId] : [orgId, userId];
    const allOrgReports   = await prisma.$queryRawUnsafe(
      `SELECT userId, projectId, createdAt FROM reports WHERE ${analyticsSQL}`,
      ...analyticsParams
    );

    const now       = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    weekStart.setHours(0, 0, 0, 0);

    const analytics = {
      total:          allOrgReports.length,
      thisWeek:       allOrgReports.filter(r => new Date(r.createdAt) >= weekStart).length,
      uniqueProjects: new Set(allOrgReports.filter(r => r.projectId).map(r => r.projectId)).size,
      uniqueMembers:  new Set(allOrgReports.map(r => r.userId)).size,
    };

    // ── Member list (admin only) ──────────────────────────────────────────────
    let members = [];
    if (isPrivileged) {
      const mRows    = await prisma.$queryRawUnsafe(
        `SELECT userId, role FROM memberships WHERE orgId = ? AND role IN ('OWNER','ADMIN','STAFF')`,
        orgId
      );
      const mUserIds = mRows.map(m => m.userId).filter(Boolean);
      const mUsersMap = {};
      if (mUserIds.length) {
        const ph     = mUserIds.map(() => '?').join(',');
        const mUsers = await prisma.$queryRawUnsafe(
          `SELECT id, name, email FROM user WHERE id IN (${ph})`,
          ...mUserIds
        );
        mUsers.forEach(u => { mUsersMap[u.id] = u; });
      }
      members = mRows.map(m => ({
        id:   m.userId,
        name: mUsersMap[m.userId]?.name || mUsersMap[m.userId]?.email || 'Unknown',
        role: m.role,
      }));
    }

    // ── Format and respond ────────────────────────────────────────────────────
    const formattedReports = reports.map(r => ({
      id:          r.id,
      title:       r.title,
      description: r.description,
      userName:    r.userName,
      image:       r.image,
      project:     projsMap[r.projectId] ? {
        id:     projsMap[r.projectId].id,
        name:   projsMap[r.projectId].name,
        color:  projsMap[r.projectId].color,
        status: projsMap[r.projectId].status,
        budget: projsMap[r.projectId].budget,
      } : null,
      user: usersMap[r.userId] ? {
        id:    usersMap[r.userId].id,
        name:  usersMap[r.userId].name,
        email: usersMap[r.userId].email,
        image: usersMap[r.userId].image,
      } : null,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));

    res.json({
      success:     true,
      role,
      isPrivileged,
      reports:     formattedReports,
      total,
      analytics,
      members,
      projects:    projectList,
    });
  } catch (error) {
    console.error('Error fetching user reports:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch user reports', detail: error.message });
  }
});

// ── POST /api/user-reports — create a report ─────────────────────────────────
router.post('/', requireAuth, withOrgScope, async (req, res) => {
  try {
    const userId = req.user?.id;
    const orgId  = req.orgId;
    const { title, description, userName, image, projectId } = req.body;

    if (!userId) return res.status(401).json({ success: false, error: 'Authentication required' });
    if (!orgId)  return res.status(400).json({ success: false, error: 'Organization ID is required' });
    if (!description || !userName) {
      return res.status(400).json({ success: false, error: 'Description and userName are required' });
    }

    // Validate project if provided
    if (projectId) {
      const projRows = await prisma.$queryRawUnsafe(
        `SELECT orgId FROM projects WHERE id = ? LIMIT 1`, projectId
      );
      if (!projRows.length)            return res.status(400).json({ success: false, error: 'Project not found' });
      if (projRows[0].orgId !== orgId) return res.status(400).json({ success: false, error: 'Project belongs to different organization' });
    }

    // Insert via raw SQL to avoid any Prisma schema column validation issues
    const id = randomUUID();
    await prisma.$executeRawUnsafe(
      `INSERT INTO reports (id, title, description, userName, image, projectId, userId, orgId, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      id,
      title || null,
      description,
      userName,
      image || null,
      projectId || null,
      userId,
      orgId
    );

    console.log(`✅ Created report: ${id} by ${req.user.email}`);
    res.status(201).json({ success: true, report: { id, title: title || null, description, userName, createdAt: new Date() } });
  } catch (error) {
    console.error('Error creating user report:', error);
    res.status(500).json({ success: false, error: 'Failed to create user report', detail: error.message });
  }
});

// ── GET /api/user-reports/:id ─────────────────────────────────────────────────
router.get('/:id', requireAuth, withOrgScope, async (req, res) => {
  try {
    const { id } = req.params;
    const orgId  = req.orgId;
    const userId = req.user.id;

    const memberRows   = await prisma.$queryRawUnsafe(
      `SELECT role FROM memberships WHERE userId = ? AND orgId = ? LIMIT 1`,
      userId, orgId
    );
    const isPrivileged = ['OWNER', 'ADMIN'].includes(memberRows[0]?.role);

    const sql       = isPrivileged
      ? `SELECT * FROM reports WHERE id = ? AND orgId = ? LIMIT 1`
      : `SELECT * FROM reports WHERE id = ? AND orgId = ? AND userId = ? LIMIT 1`;
    const sqlParams = isPrivileged ? [id, orgId] : [id, orgId, userId];

    const rows = await prisma.$queryRawUnsafe(sql, ...sqlParams);
    if (!rows.length) return res.status(404).json({ success: false, error: 'Report not found or access denied' });

    const r = rows[0];
    res.json({ success: true, report: { id: r.id, title: r.title, description: r.description, userName: r.userName, image: r.image, createdAt: r.createdAt, updatedAt: r.updatedAt } });
  } catch (error) {
    console.error('Error fetching user report:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch user report' });
  }
});

// ── DELETE /api/user-reports/:id ──────────────────────────────────────────────
router.delete('/:id', requireAuth, withOrgScope, async (req, res) => {
  try {
    const { id } = req.params;
    const orgId  = req.orgId;
    const userId = req.user.id;

    const memberRows   = await prisma.$queryRawUnsafe(
      `SELECT role FROM memberships WHERE userId = ? AND orgId = ? LIMIT 1`,
      userId, orgId
    );
    const isPrivileged = ['OWNER', 'ADMIN'].includes(memberRows[0]?.role);

    const sql       = isPrivileged
      ? `SELECT id FROM reports WHERE id = ? AND orgId = ? LIMIT 1`
      : `SELECT id FROM reports WHERE id = ? AND orgId = ? AND userId = ? LIMIT 1`;
    const sqlParams = isPrivileged ? [id, orgId] : [id, orgId, userId];

    const rows = await prisma.$queryRawUnsafe(sql, ...sqlParams);
    if (!rows.length) return res.status(404).json({ success: false, error: 'Report not found or access denied' });

    await prisma.$executeRawUnsafe(`DELETE FROM reports WHERE id = ?`, id);
    console.log(`🗑️ Deleted report: ${id} by ${req.user.email}`);
    res.json({ success: true, message: 'Report deleted successfully' });
  } catch (error) {
    console.error('Error deleting user report:', error);
    res.status(500).json({ success: false, error: 'Failed to delete user report' });
  }
});

export default router;
