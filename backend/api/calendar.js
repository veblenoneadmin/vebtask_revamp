// backend/api/calendar.js — Calendar CRUD + Google Calendar sync
import express from 'express';
import { randomUUID } from 'crypto';
import { prisma } from '../lib/prisma.js';
import { requireAuth, withOrgScope } from '../lib/rbac.js';
import {
  hasGoogleCalendarAccess,
  createGoogleCalendarEvent,
  updateGoogleCalendarEvent,
  deleteGoogleCalendarEvent,
} from '../lib/google-calendar.js';

const router = express.Router();

// ── Lazy table init (same pattern as skills.js) ───────────────────────────────
let tablesReady = false;
async function ensureTables() {
  if (tablesReady) return;
  try {
    await prisma.$executeRawUnsafe(
      'CREATE TABLE IF NOT EXISTS `calendar_events` (' +
      '  `id` VARCHAR(191) NOT NULL,' +
      '  `title` VARCHAR(500) NOT NULL,' +
      '  `description` TEXT NULL,' +
      '  `location` VARCHAR(500) NULL,' +
      '  `startAt` DATETIME(3) NOT NULL,' +
      '  `endAt` DATETIME(3) NOT NULL,' +
      '  `allDay` TINYINT(1) NOT NULL DEFAULT 0,' +
      '  `color` VARCHAR(20) NOT NULL DEFAULT \'#007acc\',' +
      '  `meetLink` VARCHAR(500) NULL,' +
      '  `createdById` VARCHAR(36) NOT NULL,' +
      '  `orgId` VARCHAR(191) NOT NULL,' +
      '  `googleEventId` VARCHAR(500) NULL,' +
      '  `googleCalendarId` VARCHAR(500) NULL,' +
      '  `syncedToGoogle` TINYINT(1) NOT NULL DEFAULT 0,' +
      '  `googleSyncedAt` DATETIME(3) NULL,' +
      '  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),' +
      '  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),' +
      '  PRIMARY KEY (`id`),' +
      '  KEY `ce_orgId_idx` (`orgId`),' +
      '  KEY `ce_orgId_startAt_idx` (`orgId`,`startAt`),' +
      '  KEY `ce_createdById_idx` (`createdById`)' +
      ') DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci'
    );
    await prisma.$executeRawUnsafe(
      'CREATE TABLE IF NOT EXISTS `calendar_event_attendees` (' +
      '  `id` VARCHAR(191) NOT NULL,' +
      '  `eventId` VARCHAR(191) NOT NULL,' +
      '  `userId` VARCHAR(36) NOT NULL,' +
      '  `orgId` VARCHAR(191) NOT NULL,' +
      '  PRIMARY KEY (`id`),' +
      '  UNIQUE KEY `cea_event_user_key` (`eventId`,`userId`),' +
      '  KEY `cea_orgId_idx` (`orgId`),' +
      '  KEY `cea_userId_idx` (`userId`)' +
      ') DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci'
    );
    tablesReady = true;
    console.log('[Calendar] Tables ready');
  } catch (e) {
    console.error('[Calendar] Table init error:', e.message);
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Format a date as MySQL DATETIME string — avoids Prisma auto-detecting ISO strings */
function toMySQL(d) {
  return new Date(d).toISOString().slice(0, 19).replace('T', ' ');
}

async function replaceAttendees(eventId, userIds, orgId) {
  await prisma.$executeRawUnsafe('DELETE FROM calendar_event_attendees WHERE eventId = ?', eventId);
  for (const userId of userIds) {
    await prisma.$executeRawUnsafe(
      'INSERT IGNORE INTO calendar_event_attendees (id, eventId, userId, orgId) VALUES (?, ?, ?, ?)',
      randomUUID(), eventId, userId, orgId
    );
  }
}

async function shapeEvent(row, attendeeUserMap) {
  return {
    id:    row.id,
    title: row.title,
    start: row.startAt instanceof Date ? row.startAt.toISOString() : row.startAt,
    end:   row.endAt   instanceof Date ? row.endAt.toISOString()   : row.endAt,
    allDay: !!row.allDay,
    color:  row.color || '#007acc',
    extendedProps: {
      description:     row.description,
      location:        row.location,
      meetLink:        row.meetLink,
      createdById:     row.createdById,
      syncedToGoogle:  !!row.syncedToGoogle,
      googleEventId:   row.googleEventId,
      attendees:       attendeeUserMap,
    },
  };
}

// ── GET /api/calendar/status ──────────────────────────────────────────────────
router.get('/status', requireAuth, withOrgScope, async (req, res) => {
  try {
    const connected = await hasGoogleCalendarAccess(req.user.id);
    res.json({ googleConnected: connected });
  } catch (err) {
    res.status(500).json({ error: 'Failed to check Google Calendar status' });
  }
});

// ── GET /api/calendar/members ─────────────────────────────────────────────────
router.get('/members', requireAuth, withOrgScope, async (req, res) => {
  try {
    await ensureTables();
    const memberships = await prisma.membership.findMany({
      where: { orgId: req.orgId },
      include: { user: { select: { id: true, name: true, email: true, image: true } } },
      orderBy: { user: { name: 'asc' } },
    });
    res.json({
      members: memberships.map(m => ({
        id:    m.user.id,
        name:  m.user.name,
        email: m.user.email,
        image: m.user.image,
        role:  m.role,
      })),
    });
  } catch (err) {
    console.error('[Calendar] members error:', err);
    res.status(500).json({ error: 'Failed to fetch members' });
  }
});

// ── GET /api/calendar/events ──────────────────────────────────────────────────
router.get('/events', requireAuth, withOrgScope, async (req, res) => {
  try {
    await ensureTables();
    const { start, end } = req.query;

    let whereClause = 'WHERE orgId = ?';
    const params = [req.orgId];
    if (start) { whereClause += ' AND endAt >= ?';   params.push(toMySQL(start)); }
    if (end)   { whereClause += ' AND startAt <= ?'; params.push(toMySQL(end));   }

    const events = await prisma.$queryRawUnsafe(
      `SELECT * FROM calendar_events ${whereClause} ORDER BY startAt ASC`,
      ...params
    );

    if (events.length === 0) return res.json({ events: [] });

    // Fetch attendees for all events in one query
    const eventIds = events.map(e => e.id);
    const placeholders = eventIds.map(() => '?').join(',');
    const attendeeRows = await prisma.$queryRawUnsafe(
      `SELECT eventId, userId FROM calendar_event_attendees WHERE eventId IN (${placeholders})`,
      ...eventIds
    );

    // Hydrate user details
    const allUserIds = [...new Set(attendeeRows.map(a => a.userId))];
    const users = allUserIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: allUserIds } },
          select: { id: true, name: true, email: true, image: true },
        })
      : [];
    const userMap = Object.fromEntries(users.map(u => [u.id, u]));

    // Group attendees by event
    const attendeesByEvent = {};
    for (const row of attendeeRows) {
      if (!attendeesByEvent[row.eventId]) attendeesByEvent[row.eventId] = [];
      if (userMap[row.userId]) attendeesByEvent[row.eventId].push(userMap[row.userId]);
    }

    const shaped = await Promise.all(
      events.map(e => shapeEvent(e, attendeesByEvent[e.id] || []))
    );

    res.json({ events: shaped });
  } catch (err) {
    console.error('[Calendar] list error:', err);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

// ── POST /api/calendar/events ─────────────────────────────────────────────────
router.post('/events', requireAuth, withOrgScope, async (req, res) => {
  try {
    await ensureTables();
    const {
      title, description, location,
      startAt, endAt, allDay = false,
      color = '#007acc', attendeeIds = [],
      syncToGoogle = false,
    } = req.body;

    if (!title || !startAt || !endAt) {
      return res.status(400).json({ error: 'title, startAt, endAt are required' });
    }

    const id = randomUUID();
    const start = new Date(startAt);
    const end   = new Date(endAt);

    await prisma.$executeRawUnsafe(
      'INSERT INTO calendar_events ' +
      '(id, title, description, location, startAt, endAt, allDay, color, meetLink, createdById, orgId, syncedToGoogle, createdAt, updatedAt) ' +
      'VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, 0, NOW(3), NOW(3))',
      id, title, description || null, location || null,
      toMySQL(start), toMySQL(end), allDay ? 1 : 0, color,
      req.user.id, req.orgId
    );

    await replaceAttendees(id, attendeeIds, req.orgId);

    // Google Calendar sync
    let meetLink = null;
    let googleConnected = false;
    if (syncToGoogle) {
      googleConnected = await hasGoogleCalendarAccess(req.user.id);
      if (googleConnected) {
        const attendeeUsers = attendeeIds.length > 0
          ? await prisma.user.findMany({ where: { id: { in: attendeeIds } }, select: { email: true } })
          : [];
        const result = await createGoogleCalendarEvent(req.user.id, {
          title, description, location, startAt: start, endAt: end, allDay, color,
          attendeeEmails: attendeeUsers.map(u => u.email),
        });
        if (result.googleEventId) {
          meetLink = result.meetLink;
          await prisma.$executeRawUnsafe(
            'UPDATE calendar_events SET googleEventId = ?, googleCalendarId = ?, meetLink = ?, syncedToGoogle = 1, googleSyncedAt = NOW(3) WHERE id = ?',
            result.googleEventId, result.googleCalendarId, result.meetLink, id
          );
        }
      }
    }

    const rows = await prisma.$queryRawUnsafe('SELECT * FROM calendar_events WHERE id = ?', id);
    const shaped = await shapeEvent(rows[0], []);

    res.status(201).json({ event: shaped, googleConnected, meetLink });
  } catch (err) {
    console.error('[Calendar] create error:', err);
    res.status(500).json({ error: 'Failed to create event' });
  }
});

// ── PUT /api/calendar/events/:id ──────────────────────────────────────────────
router.put('/events/:id', requireAuth, withOrgScope, async (req, res) => {
  try {
    await ensureTables();
    const { id } = req.params;

    const rows = await prisma.$queryRawUnsafe(
      'SELECT * FROM calendar_events WHERE id = ? AND orgId = ?', id, req.orgId
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Event not found' });
    const existing = rows[0];

    const {
      title, description, location,
      startAt, endAt, allDay, color,
      attendeeIds,
    } = req.body;

    const newTitle    = title       !== undefined ? title       : existing.title;
    const newDesc     = description !== undefined ? description : existing.description;
    const newLoc      = location    !== undefined ? location    : existing.location;
    const newStart    = startAt     ? new Date(startAt) : existing.startAt;
    const newEnd      = endAt       ? new Date(endAt)   : existing.endAt;
    const newAllDay   = allDay      !== undefined ? (allDay ? 1 : 0) : existing.allDay;
    const newColor    = color       !== undefined ? color       : existing.color;

    await prisma.$executeRawUnsafe(
      'UPDATE calendar_events SET title=?, description=?, location=?, startAt=?, endAt=?, allDay=?, color=?, updatedAt=NOW(3) WHERE id=?',
      newTitle, newDesc || null, newLoc || null, toMySQL(newStart), toMySQL(newEnd), newAllDay, newColor, id
    );

    if (Array.isArray(attendeeIds)) {
      await replaceAttendees(id, attendeeIds, req.orgId);
    }

    // Sync update to Google if already synced
    if (existing.syncedToGoogle && existing.googleEventId) {
      const attIds = Array.isArray(attendeeIds) ? attendeeIds : [];
      const attendeeUsers = attIds.length > 0
        ? await prisma.user.findMany({ where: { id: { in: attIds } }, select: { email: true } })
        : [];
      await updateGoogleCalendarEvent(req.user.id, existing.googleEventId, existing.googleCalendarId, {
        title: newTitle, description: newDesc, location: newLoc,
        startAt: newStart, endAt: newEnd, allDay: !!newAllDay, color: newColor,
        attendeeEmails: attendeeUsers.map(u => u.email),
      });
    }

    const updated = await prisma.$queryRawUnsafe('SELECT * FROM calendar_events WHERE id = ?', id);
    res.json({ event: await shapeEvent(updated[0], []) });
  } catch (err) {
    console.error('[Calendar] update error:', err);
    res.status(500).json({ error: 'Failed to update event' });
  }
});

// ── DELETE /api/calendar/events/:id ──────────────────────────────────────────
router.delete('/events/:id', requireAuth, withOrgScope, async (req, res) => {
  try {
    await ensureTables();
    const { id } = req.params;

    const rows = await prisma.$queryRawUnsafe(
      'SELECT * FROM calendar_events WHERE id = ? AND orgId = ?', id, req.orgId
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Event not found' });
    const existing = rows[0];

    // Delete from Google Calendar if synced
    if (existing.syncedToGoogle && existing.googleEventId) {
      await deleteGoogleCalendarEvent(req.user.id, existing.googleEventId, existing.googleCalendarId);
    }

    await prisma.$executeRawUnsafe('DELETE FROM calendar_event_attendees WHERE eventId = ?', id);
    await prisma.$executeRawUnsafe('DELETE FROM calendar_events WHERE id = ?', id);

    res.json({ message: 'Event deleted' });
  } catch (err) {
    console.error('[Calendar] delete error:', err);
    res.status(500).json({ error: 'Failed to delete event' });
  }
});

export default router;
