'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, Lock, Eye, EyeOff } from 'lucide-react';

export function LoginForm() {
  const [email, setEmail]             = useState('');
  const [password, setPassword]       = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetch('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as { error?: string };
      setError(
        res.status === 429
          ? 'Too many login attempts. Please wait a minute and try again.'
          : (body.error ?? 'Invalid email or password. Please try again.'),
      );
      setLoading(false);
      return;
    }

    /* All roles land on Dashboard as per spec */
    router.push('/dashboard');
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label htmlFor="email" className="studio-label block mb-1.5">
          Email address
        </label>
        <div className="studio-input-group">
          <Mail className="studio-input-icon" size={17} strokeWidth={1.75} />
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="studio-input studio-input--icon w-full text-sm"
            placeholder="you@studio.com"
            suppressHydrationWarning
          />
        </div>
      </div>

      <div>
        <label htmlFor="password" className="studio-label block mb-1.5">
          Password
        </label>
        <div className="studio-input-group">
          <Lock className="studio-input-icon" size={17} strokeWidth={1.75} />
          <input
            id="password"
            type={showPassword ? 'text' : 'password'}
            required
            autoComplete="current-password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="studio-input studio-input--icon studio-input--icon-right w-full text-sm"
            placeholder="••••••••"
            suppressHydrationWarning
          />
          <button
            type="button"
            onClick={() => setShowPassword(v => !v)}
            className="studio-input-toggle"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            tabIndex={-1}
          >
            {showPassword ? <EyeOff size={17} strokeWidth={1.75} /> : <Eye size={17} strokeWidth={1.75} />}
          </button>
        </div>
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="btn-primary w-full py-2.5 text-sm mt-1"
      >
        {loading ? 'Signing in…' : 'Login'}
      </button>
    </form>
  );
}
