import { lt } from 'drizzle-orm';
import { defineJob } from '@/jobs/define';
import { db } from '@/lib/db';
import { sessions, verifications } from '@/lib/db/schema';

/**
 * Deletes expired sessions and verification tokens.
 *
 * Better Auth checks expiry when it reads a session but never sweeps the table,
 * so without this both grow by one row per login, forever.
 */
export const sessionCleanup = defineJob(
  { id: 'session-cleanup', name: 'Expired session cleanup' },
  { cron: '0 3 * * *' },
  async () => {
    const now = new Date();

    const removedSessions = await db
      .delete(sessions)
      .where(lt(sessions.expiresAt, now))
      .returning({ id: sessions.id });

    const removedVerifications = await db
      .delete(verifications)
      .where(lt(verifications.expiresAt, now))
      .returning({ id: verifications.id });

    return {
      sessions: removedSessions.length,
      verifications: removedVerifications.length,
    };
  },
);
