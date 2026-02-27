// backend/api/super-admin.js
// Routes only accessible to the SUPER_ADMIN_EMAIL account.
// The super admin should have NO membership records so they are naturally
// invisible in every org-scoped DB query.
import express from 'express';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../lib/rbac.js';

const router = express.Router();

function requireSuperAdmin(req, res, next) {
  if (!req.isSuperAdmin) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
}

// ── GET /api/super-admin/check ─────────────────────────────────────────────
// Called by OrganizationContext to detect super admin login.
router.get('/check', requireAuth, (req, res) => {
  res.json({ isSuperAdmin: !!req.isSuperAdmin });
});

// ── GET /api/super-admin/orgs ──────────────────────────────────────────────
// Returns ALL organizations so the super admin can select one to view.
router.get('/orgs', requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const orgs = await prisma.organization.findMany({
      select: { id: true, name: true, slug: true },
      orderBy: { name: 'asc' },
    });
    res.json({
      organizations: orgs.map(o => ({ ...o, role: 'OWNER' })),
    });
  } catch (err) {
    console.error('[SuperAdmin] orgs error:', err);
    res.status(500).json({ error: 'Failed to fetch organizations' });
  }
});

// ── POST /api/super-admin/remove-memberships ───────────────────────────────
// One-time setup: removes the super admin's own membership records so they
// become completely invisible in all org-scoped queries.
router.post('/remove-memberships', requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const deleted = await prisma.membership.deleteMany({
      where: { userId: req.user.id },
    });
    console.log(`[SuperAdmin] ✅ Removed ${deleted.count} memberships for ${req.user.email}`);
    res.json({ success: true, removed: deleted.count, message: 'Super admin is now fully invisible' });
  } catch (err) {
    console.error('[SuperAdmin] remove-memberships error:', err);
    res.status(500).json({ error: 'Failed to remove memberships' });
  }
});

export default router;
