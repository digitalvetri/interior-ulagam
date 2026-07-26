import { LoginForm } from '@/components/auth/LoginForm';
import { LoginScene3D } from '@/components/auth/LoginScene3D';

export default function LoginPage() {
  return (
    <div className="login-shell">
      {/* ── Left: brand / architectural showcase panel ─────────────────── */}
      <div className="login-hero">
        <div className="login-hero-grid" aria-hidden="true" />
        <div className="login-hero-glow" aria-hidden="true" />

        <div className="login-hero-content">
          <div className="login-hero-brand">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-white p-1.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/brand/logo-icon.png"
                alt="InterioOS"
                className="h-full w-full object-contain"
                width={28}
                height={28}
              />
            </div>
            <span>InterioOS</span>
          </div>

          <div className="login-hero-illustration">
            <LoginScene3D />
          </div>

          <div className="login-hero-copy">
            <h2>Where blueprints become homes.</h2>
            <p>
              Design, track, and deliver every interior project — from the first
              concept sketch to final handover — inside one studio workspace.
            </p>
          </div>

          <div className="login-hero-stats">
            <div>
              <strong>250+</strong>
              <span>Projects delivered</span>
            </div>
            <div>
              <strong>4.9★</strong>
              <span>Client rating</span>
            </div>
            <div>
              <strong>12+</strong>
              <span>Cities served</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Right: sign-in form panel (glassmorphism) ───────────────────── */}
      <div className="login-form-panel">
        <div className="login-form-blob login-form-blob--a" aria-hidden="true" />
        <div className="login-form-blob login-form-blob--b" aria-hidden="true" />
        <div className="login-form-blob login-form-blob--c" aria-hidden="true" />

        <div className="w-full max-w-sm animate-fade-in login-glass-card">
          {/* Brand mark — mobile only, hero panel is hidden below lg */}
          <div className="mb-8 flex flex-col items-center gap-3 lg:hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand/logo-icon.png"
              alt="InterioOS"
              className="h-14 w-14 object-contain"
              width={56}
              height={56}
            />
            <div className="text-center">
              <h1 className="text-lg font-bold" style={{ color: 'var(--text-heading)' }}>
                InterioOS
              </h1>
            </div>
          </div>

          <div className="mb-9">
            <h1 className="login-form-title">Welcome back</h1>
            <p className="login-form-subtitle">Sign in to your studio workspace</p>
          </div>

          <LoginForm />
        </div>

        <p className="login-form-footer">Built by DigitalVetri</p>
      </div>
    </div>
  );
}
