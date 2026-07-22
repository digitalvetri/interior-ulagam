import { LoginForm } from '@/components/auth/LoginForm';

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center wood-bg px-4">
      {/* Decorative wood-grain overlay */}
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `repeating-linear-gradient(
            105deg,
            #6b3a1f 0px, #6b3a1f 1px,
            transparent 1px, transparent 28px
          )`,
        }}
      />

      {/* Login card */}
      <div className="relative z-10 w-full max-w-sm">
        <div className="glass-card rounded-2xl px-8 py-10">
          {/* Logo */}
          <div className="mb-8 flex flex-col items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://theinteriorstudios.in/wp-content/uploads/2025/09/cropped-intlogo.png"
              alt="The Interior Studio logo"
              className="h-16 w-16 rounded-xl object-contain shadow-md"
              width={64}
              height={64}
            />
            <div className="text-center">
              <h1 className="text-xl font-bold text-[#2c1a0e]">The Interior Studio</h1>
              <p className="mt-0.5 text-sm text-[#8b6347]">Studio workspace</p>
            </div>
          </div>

          <LoginForm />
        </div>

        <p className="mt-6 text-center text-xs text-[#8b6347]/70">
          Built by DigitalVetri
        </p>
      </div>
    </div>
  );
}
