// backend/api/super-admin.js
// Completely DB-free super admin — credentials live in env vars only.
// Uses an HMAC-signed cookie (sa_token) for session. No user record in the DB.
import express from 'express';
import { createHmac, timingSafeEqual } from 'crypto';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../lib/rbac.js';

const router = express.Router();

// ── Token helpers ─────────────────────────────────────────────────────────────
export function generateSaToken(secret) {
  const ts = Date.now().toString();
  const sig = createHmac('sha256', secret).update(ts).digest('hex');
  return `${ts}.${sig}`;
}

export function verifySaToken(token, secret) {
  if (!token || !secret) return false;
  try {
    const dot = token.indexOf('.');
    if (dot === -1) return false;
    const ts  = token.slice(0, dot);
    const sig = token.slice(dot + 1);
    const expected = createHmac('sha256', secret).update(ts).digest('hex');
    const a = Buffer.from(sig, 'hex');
    const b = Buffer.from(expected, 'hex');
    return a.length === b.length && timingSafeEqual(a, b);
  } catch { return false; }
}

function getSaSecret() { return process.env.SUPER_ADMIN_PASSWORD || ''; }

const COOKIE_NAME = 'sa_token';
const COOKIE_OPTS = {
  httpOnly: true,
  secure:   process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge:   7 * 24 * 60 * 60 * 1000, // 7 days
  path:     '/',
};

// ── GET /api/super-admin/check ────────────────────────────────────────────────
// Used by OrganizationContext — works via cookie, no auth middleware needed.
router.get('/check', (req, res) => {
  const token  = parseSaCookie(req);
  const secret = getSaSecret();
  res.json({ isSuperAdmin: !!(token && verifySaToken(token, secret)) });
});

// ── GET /api/super-admin/me ───────────────────────────────────────────────────
// Returns a virtual user object when the sa_token cookie is valid.
router.get('/me', (req, res) => {
  const token  = parseSaCookie(req);
  const secret = getSaSecret();
  if (!token || !verifySaToken(token, secret)) {
    return res.status(401).json({ isSuperAdmin: false });
  }
  res.json({
    isSuperAdmin: true,
    user: { id: '__superadmin__', email: 'system@internal', name: 'Super Admin' },
  });
});

// ── POST /api/super-admin/login ───────────────────────────────────────────────
// No user record created. Validates password against SUPER_ADMIN_PASSWORD env var.
router.post('/login', (req, res) => {
  const { password } = req.body;
  const secret = getSaSecret();

  if (!secret) {
    return res.status(503).json({ error: 'Super admin not configured' });
  }
  if (!password || password !== secret) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = generateSaToken(secret);
  res.cookie(COOKIE_NAME, token, COOKIE_OPTS);
  res.json({ success: true });
});

// ── POST /api/super-admin/logout ──────────────────────────────────────────────
router.post('/logout', (req, res) => {
  res.clearCookie(COOKIE_NAME, { path: '/' });
  res.json({ success: true });
});

// ── GET /api/super-admin/orgs ─────────────────────────────────────────────────
// Lists ALL orgs for the super admin org-switcher. Cookie-authenticated.
router.get('/orgs', (req, res, next) => {
  const token  = parseSaCookie(req);
  const secret = getSaSecret();
  if (!token || !verifySaToken(token, secret)) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
}, async (req, res) => {
  try {
    const orgs = await prisma.organization.findMany({
      select: { id: true, name: true, slug: true },
      orderBy: { name: 'asc' },
    });
    res.json({ organizations: orgs.map(o => ({ ...o, role: 'OWNER' })) });
  } catch (err) {
    console.error('[SuperAdmin] orgs error:', err);
    res.status(500).json({ error: 'Failed to fetch organizations' });
  }
});

// ── Helper: parse sa_token from Cookie header ─────────────────────────────────
export function parseSaCookie(req) {
  const cookies = req.headers.cookie || '';
  const match = cookies.split(';').map(c => c.trim()).find(c => c.startsWith(`${COOKIE_NAME}=`));
  return match ? decodeURIComponent(match.slice(COOKIE_NAME.length + 1)) : null;
}

export default router;
