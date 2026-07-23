import { LoginForm } from '@/components/auth/LoginForm';

export default function LoginPage() {
  return (
    <div className="login-bg flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm animate-fade-in">
        <div className="login-card px-8 py-10">
          {/* Brand */}
          <div className="mb-8 flex flex-col items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://theinteriorstudios.in/wp-content/uploads/2025/09/cropped-intlogo.png"
              alt="The Interior Studio"
              className="h-16 w-16 rounded-xl object-contain"
              width={64} height={64}
            />
            <div className="text-center">
              <h1
                className="text-xl font-bold"
                style={{ color: '#3D2314' }}
              >
                The Interior Studio
              </h1>
              <p className="mt-0.5 text-sm" style={{ color: '#6B6B6B' }}>
                Studio workspace
              </p>
            </div>
          </div>

          <LoginForm />
        </div>

        <p className="mt-5 text-center text-xs" style={{ color: '#A8927F' }}>
          Built by DigitalVetri
        </p>
      </div>
    </div>
  );
}
