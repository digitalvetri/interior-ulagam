import { redirect } from 'next/navigation';
import { getAuthContext, mustChangePassword } from '@/lib/auth';
import { ChangePasswordForm } from '@/components/auth/ChangePasswordForm';

// Outside (dashboard) on purpose: the dashboard layout redirects here while a
// temporary password is in force, so this page must not sit behind that check.
export default async function ChangePasswordPage() {
  const ctx = await getAuthContext();
  if (!ctx) redirect('/login');
  const forced = await mustChangePassword(ctx.userId);

  return (
    <div className="login-form-panel min-h-screen">
      <div className="w-full max-w-sm animate-fade-in login-glass-card">
        <div className="mb-6 flex flex-col items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/logo-icon.png" alt="Konst Design" className="h-16 w-auto object-contain" width={140} height={64} />
        </div>
        <div className="mb-8">
          <h1 className="login-form-title">{forced ? 'Set your password' : 'Change password'}</h1>
          <p className="login-form-subtitle">
            {forced
              ? 'You signed in with a temporary password. Choose your own to continue.'
              : 'You will stay signed in here; other devices will be signed out.'}
          </p>
        </div>
        <ChangePasswordForm forced={forced} />
      </div>
    </div>
  );
}
