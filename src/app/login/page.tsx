import { LoginForm } from '@/components/auth/LoginForm';

export default function LoginPage() {
  return (
    <div className="login-shell login-bg">
      {/* ── Left: dark hero — dot grid + editorial quote ─────────────────── */}
      <div className="login-hero">
        <div className="login-hero-grid" aria-hidden />

        <div className="login-hero-content">
          <div className="login-hero-brand">
            <div className="login-hero-brand-mark">IS</div>
            <span className="login-hero-brand-label">Interior Studio</span>
          </div>

          <div className="login-hero-body">
            <h2 className="login-hero-headline">
              Everything the studio needs, in <span className="serif-em">one</span> place.
            </h2>
            <p className="login-hero-sub">
              From the first WhatsApp message to the final handover — pipeline,
              quotations, procurement, milestone billing and site logs. Built for
              the way Indian design studios actually run.
            </p>
          </div>

          <div className="login-hero-stats">
            <div>
              <p className="login-hero-stat-value num">250+</p>
              <p className="login-hero-stat-label">Projects delivered</p>
            </div>
            <div>
              <p className="login-hero-stat-value num">4.9</p>
              <p className="login-hero-stat-label">Client rating</p>
            </div>
            <div>
              <p className="login-hero-stat-value num">12+</p>
              <p className="login-hero-stat-label">Cities served</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Right: glass sign-in card over ambient glow ─────────────────── */}
      <div className="login-form-panel">
        <div className="login-form-shell animate-fade-in">
          <div className="flex items-center gap-3 lg:hidden">
            <div
              className="h-9 w-9 rounded-lg flex items-center justify-center font-bold"
              style={{
                background: 'linear-gradient(135deg, var(--acc), var(--acc-lo))',
                color: 'var(--bg)',
                boxShadow: '0 0 0 1px var(--acc-tint-hi), 0 8px 24px var(--acc-glow)',
              }}
            >
              IS
            </div>
            <span className="text-base font-semibold" style={{ color: 'var(--ink)' }}>
              Interior Studio
            </span>
          </div>

          <div className="login-form-header">
            <span className="eyebrow" style={{ color: 'var(--acc)' }}>
              Studio OS · Sign in
            </span>
            <h1 className="login-form-title">
              Welcome <span className="serif-em">back.</span>
            </h1>
            <p className="login-form-subtitle">
              Sign in to pick up where you left off.
            </p>
          </div>

          <LoginForm />

          <p className="login-form-footer">Built by DigitalVetri</p>
        </div>
      </div>
    </div>
  );
}
