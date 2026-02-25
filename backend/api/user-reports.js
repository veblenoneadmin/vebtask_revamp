// User Reports management API endpoints
import express from 'express';
import { prisma } from '../lib/prisma.js';
import { requireAuth, withOrgScope } from '../lib/rbac.js';
import { validateQuery, commonSchemas } from '../lib/validation.js';

const router = express.Router();

// ── GET /api/user-reports — role-aware list ───────────────────────────────────
// OWNER/ADMIN → all org reports
// STAFF       → only their own reports
// CLIENT      → only their own submitted reports
router.get('/', requireAuth, withOrgScope, validateQuery(commonSchemas.pagination), async (req, res) => {
  try {
    const userId = req.user.id;
    const orgId  = req.orgId;
    const { limit = 100, offset = 0, projectId, memberId, search, dateFrom, dateTo } = req.query;

    // ── Role lookup ──────────────────────────────────────────────────────────
    const membership = await prisma.membership.findUnique({
      where: { userId_orgId: { userId, orgId } },
      select: { role: true },
    });
    const role         = membership?.role || 'STAFF';
    const isPrivileged = role === 'OWNER' || role === 'ADMIN';

    // ── Build where clause ───────────────────────────────────────────────────
    const where = { orgId };

    // Non-privileged users only see their own reports
    if (!isPrivileged) {
      where.userId = userId;
    } else {
      // Admin can optionally filter by a specific member
      if (memberId) where.userId = memberId;
    }

    // Optional: filter by project
    if (projectId) where.projectId = projectId;

    // Optional: date range
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo)   where.createdAt.lte = new Date(new Date(dateTo).setHours(23, 59, 59, 999));
    }

    // Optional: text search on title, description, userName
    if (search) {
      where.OR = [
        { title:       { contains: search } },
        { description: { contains: search } },
        { userName:    { contains: search } },
      ];
    }

    const [reports, total] = await Promise.all([
      prisma.report.findMany({
        where,
        include: {
          user:    { select: { id: true, name: true, email: true, image: true } },
          project: { select: { id: true, name: true, color: true, status: true, budget: true } },
        },
        orderBy: { createdAt: 'desc' },
        take:    parseInt(limit),
        skip:    parseInt(offset),
      }),
      prisma.report.count({ where }),
    ]);

    // ── Analytics (from full unfiltered set for stats strip) ──────────────────
    const allOrgWhere = isPrivileged ? { orgId } : { orgId, userId };
    const allOrgReports = await prisma.report.findMany({
      where: allOrgWhere,
      select: { userId: true, projectId: true, createdAt: true },
    });

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

    // ── Member list for filter dropdown (admin only) ──────────────────────────
    let members = [];
    if (isPrivileged) {
      const memberships = await prisma.membership.findMany({
        where: { orgId, role: { in: ['OWNER', 'ADMIN', 'STAFF'] } },
        include: { user: { select: { id: true, name: true, email: true } } },
      });
      members = memberships.map(m => ({
        id:   m.userId,
        name: m.user?.name || m.user?.email || 'Unknown',
        role: m.role,
      }));
    }

    // ── Project list for filter dropdown ─────────────────────────────────────
    const projects = await prisma.project.findMany({
      where:   { orgId },
      select:  { id: true, name: true, color: true },
      orderBy: { name: 'asc' },
    });

    res.json({
      success:     true,
      role,
      isPrivileged,
      reports:     reports.map(r => formatReport(r)),
      total,
      analytics,
      members,
      projects,
    });
  } catch (error) {
    console.error('Error fetching user reports:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch user reports' });
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
      const proj = await prisma.project.findUnique({ where: { id: projectId }, select: { orgId: true } });
      if (!proj)                return res.status(400).json({ success: false, error: 'Project not found' });
      if (proj.orgId !== orgId) return res.status(400).json({ success: false, error: 'Project belongs to different organization' });
    }

    const report = await prisma.report.create({
      data: {
        title:     title || null,
        description,
        userName,
        image:     image || null,
        projectId: projectId || null,
        userId,
        orgId,
      },
      include: {
        user:    { select: { id: true, name: true, email: true, image: true } },
        project: { select: { id: true, name: true, color: true, status: true, budget: true } },
      },
    });

    console.log(`✅ Created report: ${report.id} by ${req.user.email}`);
    res.status(201).json({ success: true, report: formatReport(report) });
  } catch (error) {
    console.error('Error creating user report:', error);
    res.status(500).json({ success: false, error: 'Failed to create user report' });
  }
});

// ── GET /api/user-reports/:id ─────────────────────────────────────────────────
router.get('/:id', requireAuth, withOrgScope, async (req, res) => {
  try {
    const { id } = req.params;
    const orgId  = req.orgId;
    const userId = req.user.id;

    const membership = await prisma.membership.findUnique({
      where: { userId_orgId: { userId, orgId } },
      select: { role: true },
    });
    const isPrivileged = ['OWNER', 'ADMIN'].includes(membership?.role);

    const report = await prisma.report.findFirst({
      where: { id, orgId, ...(isPrivileged ? {} : { userId }) },
      include: {
        user:    { select: { id: true, name: true, email: true, image: true } },
        project: { select: { id: true, name: true, color: true, status: true, budget: true } },
      },
    });

    if (!report) return res.status(404).json({ success: false, error: 'Report not found or access denied' });
    res.json({ success: true, report: formatReport(report) });
  } catch (error) {
    console.error('Error fetching user report:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch user report' });
  }
});

// ── DELETE /api/user-reports/:id ──────────────────────────────────────────────
// OWNER/ADMIN can delete any report in the org; STAFF can only delete their own
router.delete('/:id', requireAuth, withOrgScope, async (req, res) => {
  try {
    const { id } = req.params;
    const orgId  = req.orgId;
    const userId = req.user.id;

    const membership = await prisma.membership.findUnique({
      where: { userId_orgId: { userId, orgId } },
      select: { role: true },
    });
    const isPrivileged = ['OWNER', 'ADMIN'].includes(membership?.role);

    const report = await prisma.report.findFirst({
      where: { id, orgId, ...(isPrivileged ? {} : { userId }) },
    });

    if (!report) return res.status(404).json({ success: false, error: 'Report not found or access denied' });

    await prisma.report.delete({ where: { id } });
    console.log(`🗑️ Deleted report: ${id} by ${req.user.email}`);
    res.json({ success: true, message: 'Report deleted successfully' });
  } catch (error) {
    console.error('Error deleting user report:', error);
    res.status(500).json({ success: false, error: 'Failed to delete user report' });
  }
});

// ── Helper ────────────────────────────────────────────────────────────────────
function formatReport(r) {
  return {
    id:          r.id,
    title:       r.title,
    description: r.description,
    userName:    r.userName,
    image:       r.image,
    project:     r.project ? {
      id:     r.project.id,
      name:   r.project.name,
      color:  r.project.color,
      status: r.project.status,
      budget: r.project.budget,
    } : null,
    user: r.user ? {
      id:    r.user.id,
      name:  r.user.name,
      email: r.user.email,
      image: r.user.image,
    } : null,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

export default router;
