// backend/api/fireflies.js — Fireflies webhook receiver + notification dispatcher

import express from 'express';
import { randomUUID } from 'crypto';
import { prisma } from '../lib/prisma.js';
import { fetchTranscript } from '../lib/fireflies.js';

const router = express.Router();

// ── Ensure notifications table exists ────────────────────────────────────────
let notifTableReady = false;
async function ensureNotifTable() {
  if (notifTableReady) return;
  try {
    await prisma.$executeRawUnsafe(
      'CREATE TABLE IF NOT EXISTS `notifications` (' +
      '  `id` VARCHAR(191) NOT NULL,' +
      '  `userId` VARCHAR(36) NOT NULL,' +
      '  `orgId` VARCHAR(191) NOT NULL,' +
      '  `title` VARCHAR(500) NOT NULL,' +
      '  `body` TEXT NULL,' +
      '  `link` VARCHAR(500) NULL,' +
      '  `type` VARCHAR(50) NOT NULL DEFAULT \'info\',' +
      '  `isRead` TINYINT(1) NOT NULL DEFAULT 0,' +
      '  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),' +
      '  PRIMARY KEY (`id`),' +
      '  KEY `notif_userId_idx` (`userId`),' +
      '  KEY `notif_orgId_userId_idx` (`orgId`, `userId`),' +
      '  KEY `notif_createdAt_idx` (`createdAt`)' +
      ') DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci'
    );
    notifTableReady = true;
  } catch (_e) { /* table likely exists */ }
}

// ── Build notification body from Fireflies summary ───────────────────────────
function buildBody(transcript) {
  const { date, duration, summary } = transcript;

  const dateStr = date
    ? new Date(typeof date === 'number' ? date : date).toLocaleDateString('en-AU', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
      })
    : null;

  const durationMin = duration ? Math.round(duration / 60) : null;

  const lines = [];
  if (dateStr)    lines.push(`Date: ${dateStr}`);
  if (durationMin) lines.push(`Duration: ${durationMin} min`);

  if (summary?.overview) {
    lines.push('');
    lines.push('Summary:');
    lines.push(summary.overview);
  }

  if (summary?.action_items) {
    lines.push('');
    lines.push('Action Items:');
    lines.push(summary.action_items);
  }

  if (summary?.keywords) {
    lines.push('');
    lines.push(`Keywords: ${summary.keywords}`);
  }

  return lines.join('\n');
}

// ── POST /api/fireflies/webhook ───────────────────────────────────────────────
// Fireflies calls this when a transcript is ready.
// No auth headers from Fireflies — we validate by successfully fetching the transcript.
router.post('/webhook', async (req, res) => {
  // Respond immediately so Fireflies doesn't retry
  res.json({ received: true });

  try {
    const { meetingId, transcriptId } = req.body;
    const id = meetingId || transcriptId;

    if (!id) {
      console.warn('[Fireflies] Webhook received with no meetingId/transcriptId');
      return;
    }

    console.log(`[Fireflies] Webhook received — fetching transcript: ${id}`);

    const transcript = await fetchTranscript(id);
    if (!transcript) {
      console.warn(`[Fireflies] No transcript returned for id: ${id}`);
      return;
    }

    const { title, participants = [] } = transcript;

    if (!participants.length) {
      console.log('[Fireflies] No participants — nothing to notify');
      return;
    }

    // Match participants to EverSense Ai users by email
    const lcEmails = participants.map(e => String(e).toLowerCase().trim()).filter(Boolean);
    if (!lcEmails.length) return;

    const placeholders = lcEmails.map(() => '?').join(',');
    const users = await prisma.$queryRawUnsafe(
      `SELECT id, email FROM User WHERE LOWER(email) IN (${placeholders})`,
      ...lcEmails
    );

    if (!users.length) {
      console.log(`[Fireflies] No matching users found for emails: ${lcEmails.join(', ')}`);
      return;
    }

    await ensureNotifTable();

    const notifTitle = `Meeting Summary: ${title || 'Untitled Meeting'}`;
    const notifBody  = buildBody(transcript);
    let notified = 0;

    for (const user of users) {
      // Find all orgs this user belongs to
      const memberships = await prisma.membership.findMany({
        where:  { userId: user.id },
        select: { orgId: true },
      });

      for (const { orgId } of memberships) {
        await prisma.$executeRawUnsafe(
          'INSERT INTO notifications (id, userId, orgId, title, body, type, isRead, createdAt) VALUES (?, ?, ?, ?, ?, ?, 0, NOW())',
          randomUUID(), user.id, orgId, notifTitle, notifBody, 'meeting'
        );
        notified++;
      }
    }

    console.log(`[Fireflies] Sent ${notified} notification(s) for: "${title}"`);
  } catch (err) {
    console.error('[Fireflies] Webhook processing error:', err.message);
  }
});

// ── GET /api/fireflies/status ─────────────────────────────────────────────────
// Returns whether the Fireflies API key is configured.
router.get('/status', async (req, res) => {
  res.json({ connected: !!process.env.FIREFLIES_API_KEY });
});

export default router;
