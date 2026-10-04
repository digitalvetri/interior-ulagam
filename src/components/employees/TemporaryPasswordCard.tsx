'use client';

import { useState } from 'react';
import { Check, Copy, KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Shows a staff member's temporary password exactly once — it is not stored in
 * readable form, so closing this is the last chance to copy it.
 */
export function TemporaryPasswordCard({ email, password }: { email: string | null; password: string }) {
  const [copied, setCopied] = useState(false);
  const loginUrl = typeof window !== 'undefined' ? `${window.location.origin}/login` : '/login';
  const message = `Your Konst Design login\n${loginUrl}\nEmail: ${email ?? ''}\nTemporary password: ${password}\nYou will be asked to set your own password after signing in.`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be blocked (e.g. on plain http); the password stays visible to copy by hand.
    }
  }

  return (
    <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-amber-900">
        <KeyRound className="h-4 w-4" /> Login details — shown only once
      </div>
      <div className="space-y-1 text-sm text-amber-950">
        {email && <div>Email: <span className="font-medium">{email}</span></div>}
        <div>
          Temporary password:{' '}
          <span className="select-all rounded bg-white px-1.5 py-0.5 font-mono font-semibold tracking-wide">{password}</span>
        </div>
      </div>
      <p className="text-xs text-amber-900/80">
        Send these to the employee (e.g. on WhatsApp). They must set their own password when they first sign in.
        If it is lost, use Reset password on their profile.
      </p>
      <Button type="button" size="sm" variant="outline" onClick={copy} className="gap-1.5 bg-white">
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        {copied ? 'Copied' : 'Copy login details'}
      </Button>
    </div>
  );
}
