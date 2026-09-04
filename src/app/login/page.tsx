import { LoginForm } from '@/components/auth/LoginForm';
import { LoginScene3DLazy } from '@/components/auth/LoginScene3DLazy';

export default function LoginPage() {
  return (
    <div className="login-shell">
      {/* ── Left: brand panel ─────────────────────────────────────────────── */}
      <div className="login-hero">
        <div className="login-hero-grid" aria-hidden="true" />
        <div className="login-hero-glow" aria-hidden="true" />

        <div className="login-hero-content">
          <div className="login-hero-brand">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-white p-1.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/brand/logo-icon.png"
                alt="Konst Design"
                className="h-full w-full object-contain"
                width={28}
                height={28}
              />
            </div>
            <span>Konst Design</span>
          </div>

          <div className="login-hero-illustration">
            <LoginScene3DLazy />
          </div>

          <div className="login-hero-copy">
            <h2>Where spaces become experiences.</h2>
            <p>
              Design, track, and deliver every interior project — from the first
              concept sketch to final handover — inside one studio workspace.
            </p>
          </div>

          <div className="login-hero-stats">
            <div>
              <strong>14+</strong>
              <span>Years of expertise</span>
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

        <div className="w-full max-w-sm animate-fade-in login-glass-card">
          {/* Brand mark — mobile only */}
          <div className="mb-8 flex flex-col items-center gap-3 lg:hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand/logo-icon.png"
              alt="Konst Design"
              className="h-14 w-auto object-contain"
              width={120}
              height={56}
            />
          </div>

          {/* Logo shown on desktop right panel above form */}
          <div className="mb-6 hidden lg:flex lg:flex-col lg:items-center lg:gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand/logo-icon.png"
              alt="Konst Design"
              className="h-16 w-auto object-contain"
              width={140}
              height={64}
            />
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
