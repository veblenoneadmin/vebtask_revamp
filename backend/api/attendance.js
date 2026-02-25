// backend/api/attendance.js — Clock In / Clock Out API
import express from 'express';
import { prisma } from '../lib/prisma.js';
import { requireAuth, withOrgScope } from '../lib/rbac.js';

const router = express.Router();

const BREAK_LIMIT = 1800;  // 30 minutes in seconds
const WORK_DAY    = 8 * 3600; // 8-hour standard day in seconds

// ── One-time startup: add break_duration column if missing ────────────────────
async function ensureBreakDurationColumn() {
  try {
    await prisma.$executeRawUnsafe(
      'ALTER TABLE attendance_logs ADD COLUMN IF NOT EXISTS break_duration INT NOT NULL DEFAULT 0'
    );
  } catch {
    // Column already exists or DB not ready — silently ignore
  }
}
ensureBreakDurationColumn();

// ── Helper: today's date string YYYY-MM-DD ────────────────────────────────────
function todayStr() {
  return new Date().toISOString().split('T')[0];
}

// ── GET /api/attendance/status ────────────────────────────────────────────────
router.get('/status', requireAuth, withOrgScope, async (req, res) => {
  try {
    const userId = req.user.id;
    const orgId  = req.orgId;

    const active = await prisma.attendanceLog.findFirst({
      where: { userId, orgId, timeOut: null },
      orderBy: { timeIn: 'desc' },
    });

    res.json({ clockedIn: !!active, activeLog: active || null });
  } catch (err) {
    console.error('[Attendance] status error:', err);
    res.status(500).json({ error: 'Failed to get attendance status' });
  }
});

// ── POST /api/attendance/clock-in (alias: /time-in) ──────────────────────────
async function handleClockIn(req, res) {
  try {
    const userId = req.user.id;
    const orgId  = req.orgId;
    const { notes } = req.body;

    const existing = await prisma.attendanceLog.findFirst({
      where: { userId, orgId, timeOut: null },
    });
    if (existing) {
      return res.status(400).json({ error: 'Already clocked in', activeLog: existing });
    }

    const log = await prisma.attendanceLog.create({
      data: {
        userId,
        orgId,
        timeIn:        new Date(),
        duration:      0,
        breakDuration: 0,
        notes:         notes || null,
        date:          todayStr(),
      },
    });

    console.log(`[Attendance] ✅ Clock in: ${req.user.email} at ${log.timeIn}`);
    res.status(201).json({ message: 'Clocked in successfully', log });
  } catch (err) {
    console.error('[Attendance] clock-in error:', err);
    res.status(500).json({ error: 'Failed to clock in' });
  }
}
router.post('/clock-in', requireAuth, withOrgScope, handleClockIn);
router.post('/time-in',  requireAuth, withOrgScope, handleClockIn);

// ── POST /api/attendance/clock-out (alias: /time-out) ────────────────────────
async function handleClockOut(req, res) {
  try {
    const userId = req.user.id;
    const orgId  = req.orgId;
    const { notes, breakDuration: rawBreak } = req.body;

    const active = await prisma.attendanceLog.findFirst({
      where: { userId, orgId, timeOut: null },
      orderBy: { timeIn: 'desc' },
    });

    if (!active) {
      return res.status(400).json({ error: 'Not currently clocked in' });
    }

    const now           = new Date();
    const grossDuration = Math.floor((now.getTime() - active.timeIn.getTime()) / 1000);
    const breakDuration = Math.max(0, parseInt(rawBreak) || 0);
    const duration      = Math.max(0, grossDuration - breakDuration); // net worked time

    const log = await prisma.attendanceLog.update({
      where: { id: active.id },
      data: {
        timeOut:       now,
        duration,
        breakDuration,
        notes:         notes || active.notes,
      },
    });

    console.log(`[Attendance] ✅ Clock out: ${req.user.email}, net ${Math.round(duration/60)}min, break ${Math.round(breakDuration/60)}min`);
    res.json({ message: 'Clocked out successfully', log });
  } catch (err) {
    console.error('[Attendance] clock-out error:', err);
    res.status(500).json({ error: 'Failed to clock out' });
  }
}
router.post('/clock-out', requireAuth, withOrgScope, handleClockOut);
router.post('/time-out',  requireAuth, withOrgScope, handleClockOut);

// ── GET /api/attendance/logs — fetch logs (role-aware) ───────────────────────
// OWNER/ADMIN → all org logs with member info
// STAFF/CLIENT → own logs only
router.get('/logs', requireAuth, withOrgScope, async (req, res) => {
  try {
    const userId = req.user.id;
    const orgId  = req.orgId;
    const limit  = parseInt(req.query.limit || '100');

    const membership = await prisma.membership.findUnique({
      where: { userId_orgId: { userId, orgId } },
      select: { role: true },
    });
    const role         = membership?.role || 'STAFF';
    const isPrivileged = role === 'OWNER' || role === 'ADMIN';

    let logs;

    if (isPrivileged) {
      logs = await prisma.attendanceLog.findMany({
        where:   { orgId },
        orderBy: { timeIn: 'desc' },
        take:    limit,
        include: { user: { select: { id: true, name: true, email: true, image: true } } },
      });

      const memberships = await prisma.membership.findMany({
        where: { orgId },
        select: { userId: true, role: true },
      });
      const roleMap = Object.fromEntries(memberships.map(m => [m.userId, m.role]));

      return res.json({
        role,
        isPrivileged: true,
        logs: logs.map(l => formatLog(l, l.user, roleMap[l.userId] || 'STAFF')),
      });
    } else {
      logs = await prisma.attendanceLog.findMany({
        where:   { userId, orgId },
        orderBy: { timeIn: 'desc' },
        take:    limit,
        include: { user: { select: { id: true, name: true, email: true, image: true } } },
      });

      return res.json({
        role,
        isPrivileged: false,
        logs: logs.map(l => formatLog(l, l.user, role)),
      });
    }
  } catch (err) {
    console.error('[Attendance] logs error:', err);
    res.status(500).json({ error: 'Failed to fetch attendance logs' });
  }
});

// ── Format a log record for the API response ──────────────────────────────────
function formatLog(log, user, memberRole) {
  const breakDuration = log.breakDuration || 0;
  const overBreak     = Math.max(0, breakDuration - BREAK_LIMIT);
  const overtime      = log.timeOut ? Math.max(0, (log.duration || 0) - WORK_DAY) : 0;
  const durationMins  = log.duration ? Math.round(log.duration / 60) : null;

  return {
    id:            log.id,
    date:          log.date,
    timeIn:        log.timeIn,
    timeOut:       log.timeOut,
    duration:      log.duration,     // net seconds (excluding break)
    durationMins,
    breakDuration,                   // seconds of break taken
    overBreak,                       // seconds over the 30-min limit
    overtime,                        // seconds over 8-hour work day
    notes:         log.notes,
    isActive:      !log.timeOut,
    memberId:      log.userId,
    memberName:    user?.name || user?.email || 'Unknown',
    memberEmail:   user?.email || '',
    memberImage:   user?.image || null,
    memberRole,
  };
}

export default router;
