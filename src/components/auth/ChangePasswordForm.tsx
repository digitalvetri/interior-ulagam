'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Lock } from 'lucide-react';

export function ChangePasswordForm({ forced }: { forced: boolean }) {
  const [currentPassword, setCurrent] = useState('');
  const [newPassword, setNew]         = useState('');
  const [confirm, setConfirm]         = useState('');
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    // Must match minPasswordLength in src/lib/auth/config.ts.
    if (newPassword.length < 12) { setError('New password must be at least 12 characters.'); return; }
    if (newPassword !== confirm) { setError('The two new passwords do not match.'); return; }
    if (newPassword === currentPassword) { setError('Choose a password different from the current one.'); return; }

    setLoading(true);
    const res = await fetch('/api/v1/settings/password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as { error?: string };
      setError(body.error ?? 'Could not change the password. Please try again.');
      setLoading(false);
      return;
    }
    router.push('/dashboard');
    router.refresh();
  }

  const field = (id: string, label: string, value: string, set: (v: string) => void, autoComplete: string) => (
    <div>
      <label htmlFor={id} className="studio-label block mb-1.5">{label}</label>
      <div className="studio-input-group">
        <Lock className="studio-input-icon" size={17} strokeWidth={1.75} />
        <input
          id={id}
          type="password"
          required
          autoComplete={autoComplete}
          value={value}
          onChange={e => set(e.target.value)}
          className="studio-input studio-input--icon w-full text-sm"
        />
      </div>
    </div>
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {field('current', forced ? 'Temporary password' : 'Current password', currentPassword, setCurrent, 'current-password')}
      {field('new', 'New password (min. 12 characters)', newPassword, setNew, 'new-password')}
      {field('confirm', 'Confirm new password', confirm, setConfirm, 'new-password')}

      {error && (
        <p className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <button type="submit" disabled={loading} className="btn-primary w-full py-2.5 text-sm mt-1">
        {loading ? 'Saving…' : 'Save password'}
      </button>
      {!forced && (
        <button type="button" onClick={() => router.back()} className="w-full text-sm text-[var(--text-secondary)] hover:underline">
          Cancel
        </button>
      )}
    </form>
  );
}
