'use client';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

function getRoleRedirect(role: string | undefined): string {
  switch (role) {
    case 'owner':      return '/leads';
    case 'designer':   return '/projects';
    case 'accountant': return '/accounts';
    case 'supervisor': return '/field/site-log';
    default:           return '/leads';
  }
}

export function LoginForm() {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password });

    if (authError) {
      setError('Invalid email or password. Please try again.');
      setLoading(false);
      return;
    }

    const role = data.user?.user_metadata?.role as string | undefined;
    router.push(getRoleRedirect(role));
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-[#2c1a0e] mb-1.5">
          Email address
        </label>
        <input
          id="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="glass-input w-full rounded-lg px-3.5 py-2.5 text-sm text-[#2c1a0e] placeholder:text-[#8b6347]/60"
          placeholder="you@studio.com"
        />
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-medium text-[#2c1a0e] mb-1.5">
          Password
        </label>
        <input
          id="password"
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="glass-input w-full rounded-lg px-3.5 py-2.5 text-sm text-[#2c1a0e] placeholder:text-[#8b6347]/60"
          placeholder="••••••••"
        />
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 border border-red-200">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="btn-primary w-full rounded-lg px-4 py-2.5 text-sm font-semibold mt-2"
      >
        {loading ? 'Signing in…' : 'Login'}
      </button>
    </form>
  );
}
