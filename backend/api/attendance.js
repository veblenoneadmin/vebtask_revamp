// Attendance (Time In / Time Out) API endpoints
import express from 'express';
import { prisma } from '../lib/prisma.js';
import { requireAuth, withOrgScope } from '../lib/rbac.js';

const router = express.Router();

// Helper: get today's date string in YYYY-MM-DD (local to server)
function todayString() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

// GET /api/attendance/status
// Returns the active (not clocked-out) attendance log for the user today, if any
router.get('/status', requireAuth, withOrgScope, async (req, res) => {
  try {
    const { userId, orgId } = req.query;
    if (!userId || !orgId) {
      return res.status(400).json({ error: 'userId and orgId are required' });
    }

    const active = await prisma.attendanceLog.findFirst({
      where: { userId, orgId, timeOut: null },
      orderBy: { timeIn: 'desc' },
    });

    res.json({ active: active || null });
  } catch (error) {
    console.error('Error fetching attendance status:', error);
    res.status(500).json({ error: 'Failed to fetch attendance status' });
  }
});

// POST /api/attendance/time-in
// Clock in – creates a new AttendanceLog
router.post('/time-in', requireAuth, withOrgScope, async (req, res) => {
  try {
    const { userId, orgId, notes } = req.body;
    if (!userId || !orgId) {
      return res.status(400).json({ error: 'userId and orgId are required' });
    }

    // Prevent double clock-in
    const existing = await prisma.attendanceLog.findFirst({
      where: { userId, orgId, timeOut: null },
    });
    if (existing) {
      return res.status(409).json({ error: 'Already clocked in', active: existing });
    }

    const log = await prisma.attendanceLog.create({
      data: {
        userId,
        orgId,
        timeIn: new Date(),
        notes: notes || null,
        date: todayString(),
      },
    });

    console.log(`✅ Time In: user ${userId}`);
    res.status(201).json({ log, message: 'Clocked in successfully' });
  } catch (error) {
    console.error('Error clocking in:', error);
    res.status(500).json({ error: 'Failed to clock in' });
  }
});

// POST /api/attendance/time-out
// Clock out – client sends breakDuration (seconds) so net duration excludes break time
router.post('/time-out', requireAuth, withOrgScope, async (req, res) => {
  try {
    const { userId, orgId, notes, breakDuration = 0 } = req.body;
    if (!userId || !orgId) {
      return res.status(400).json({ error: 'userId and orgId are required' });
    }

    const active = await prisma.attendanceLog.findFirst({
      where: { userId, orgId, timeOut: null },
      orderBy: { timeIn: 'desc' },
    });

    if (!active) {
      return res.status(404).json({ error: 'No active clock-in found' });
    }

    const now = new Date();
    const gross = Math.floor((now.getTime() - active.timeIn.getTime()) / 1000);
    const duration = Math.max(0, gross - (breakDuration || 0));

    const log = await prisma.attendanceLog.update({
      where: { id: active.id },
      data: { timeOut: now, duration, notes: notes || active.notes },
    });

    console.log(`⏹️ Time Out: user ${userId}, duration ${duration}s (break ${breakDuration}s)`);
    res.json({ log, message: 'Clocked out successfully' });
  } catch (error) {
    console.error('Error clocking out:', error);
    res.status(500).json({ error: 'Failed to clock out' });
  }
});

// GET /api/attendance/today
// Returns all attendance logs for today for the user
router.get('/today', requireAuth, withOrgScope, async (req, res) => {
  try {
    const { userId, orgId } = req.query;
    if (!userId || !orgId) {
      return res.status(400).json({ error: 'userId and orgId are required' });
    }

    const today = todayString();
    const logs = await prisma.attendanceLog.findMany({
      where: { userId, orgId, date: today },
      orderBy: { timeIn: 'asc' },
    });

    const totalSeconds = logs.reduce((sum, l) => sum + (l.duration || 0), 0);

    res.json({ logs, totalSeconds, date: today });
  } catch (error) {
    console.error('Error fetching today attendance:', error);
    res.status(500).json({ error: 'Failed to fetch today attendance' });
  }
});

// GET /api/attendance/history
// Returns paginated attendance history for the user
router.get('/history', requireAuth, withOrgScope, async (req, res) => {
  try {
    const { userId, orgId, limit = 30, offset = 0 } = req.query;
    if (!userId || !orgId) {
      return res.status(400).json({ error: 'userId and orgId are required' });
    }

    const logs = await prisma.attendanceLog.findMany({
      where: { userId, orgId, timeOut: { not: null } },
      orderBy: { timeIn: 'desc' },
      take: parseInt(limit),
      skip: parseInt(offset),
    });

    const total = await prisma.attendanceLog.count({
      where: { userId, orgId, timeOut: { not: null } },
    });

    res.json({ logs, total });
  } catch (error) {
    console.error('Error fetching attendance history:', error);
    res.status(500).json({ error: 'Failed to fetch attendance history' });
  }
});

export default router;
