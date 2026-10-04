import { eq } from 'drizzle-orm';
import { auth } from '@/lib/auth/config';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { generateTemporaryPassword } from '@/lib/auth/temp-password';

/**
 * Owner-initiated reset: replace a staff member's password with a fresh
 * temporary one, sign them out everywhere, and require them to choose their own
 * at next sign-in. Returns the temporary password for the owner to hand over —
 * there is no mail transport to send it instead. Returns null when the user has
 * no password login to reset.
 */
export async function resetToTemporaryPassword(userId: string): Promise<string | null> {
  const ctx = await auth.$context;
  const accounts = await ctx.internalAdapter.findAccounts(userId);
  if (!accounts.some((a) => a.providerId === 'credential')) return null;

  const temporaryPassword = generateTemporaryPassword();
  await ctx.internalAdapter.updatePassword(userId, await ctx.password.hash(temporaryPassword));
  await ctx.internalAdapter.deleteUserSessions(userId);
  await db.update(users).set({ mustChangePassword: true }).where(eq(users.id, userId));
  return temporaryPassword;
}
