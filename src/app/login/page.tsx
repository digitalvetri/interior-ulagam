import { LoginForm } from '@/components/auth/LoginForm';
import { LoginScene3DLazy } from '@/components/auth/LoginScene3DLazy';

export default function LoginPage() {
  return (
    <div className="login-shell">
      {/* ── Left: the studio showcase — a live 3D interior ──────────────── */}
      <div className="login-hero">
        <div className="login-hero-grid" aria-hidden="true" />
        <div className="login-hero-glow" aria-hidden="true" />
        <div className="login-hero-glow login-hero-glow--top" aria-hidden="true" />

        <div className="login-hero-content">
          <div className="login-hero-brand login-rise" style={{ animationDelay: '0ms' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/kd-mark-white.png" alt="" className="h-9 w-auto" width={46} height={36} />
            <div className="leading-tight">
              <span className="block">Konst Design</span>
              <span className="login-hero-brand-sub">Design &amp; Build · Coimbatore</span>
            </div>
          </div>

          <div className="login-hero-copy login-rise" style={{ animationDelay: '120ms' }}>
            <p className="login-eyebrow">Studio workspace</p>
            <h2>
              Where spaces become <em>experiences.</em>
            </h2>
          </div>

          <div className="login-hero-illustration">
            <LoginScene3DLazy />
            <p className="login-scene-hint" aria-hidden="true">Move your cursor — the room follows</p>
          </div>

          <div className="login-hero-stats login-rise" style={{ animationDelay: '240ms' }}>
            <div>
              <strong>14+</strong>
              <span>Years of craft</span>
            </div>
            <div>
              <strong>4.9★</strong>
              <span>Client rating</span>
            </div>
            <div>
              <strong>2</strong>
              <span>Studio locations</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Right: sign-in form panel ────────────────────────────────────── */}
      <div className="login-form-panel">
        <div className="login-form-blob login-form-blob--a" aria-hidden="true" />
        <div className="login-form-blob login-form-blob--b" aria-hidden="true" />
        <div className="login-form-blob login-form-blob--c" aria-hidden="true" />

        <div className="w-full max-w-sm login-glass-card login-rise" style={{ animationDelay: '80ms' }}>
          <div className="mb-7 flex justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/logo-icon.png" alt="Konst Design" className="h-14 w-auto object-contain lg:h-16" width={140} height={64} />
          </div>

          <div className="mb-8 text-center">
            <h1 className="login-form-title">Welcome back</h1>
            <p className="login-form-subtitle">Sign in to your studio workspace</p>
          </div>

          <LoginForm />
          <p className="mt-6 text-center text-xs text-[var(--text-tertiary)]">
            Forgot your password? Ask your studio owner to reset it from Employees.
          </p>
        </div>

        <p className="login-form-footer">Secure sign-in · Built by <span>DigitalVetri</span></p>
      </div>
    </div>
  );
}
