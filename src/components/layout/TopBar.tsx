'use client';
import { useState, useEffect } from 'react';
import { Bell, LogOut } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

const ROLE_COLORS: Record<string, string> = {
  owner:      'bg-[#6b3a1f] text-[#e8c87a]',
  designer:   'bg-[#4a6741] text-[#a8d5a2]',
  accountant: 'bg-[#3a4a6b] text-[#a2b8d5]',
  supervisor: 'bg-[#6b5c3a] text-[#d5c4a2]',
};

export function TopBar() {
  const [fullName, setFullName] = useState('');
  const [role, setRole]         = useState('');
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      const meta = data.user?.user_metadata ?? {};
      setFullName((meta.full_name as string) ?? (data.user?.email ?? ''));
      setRole((meta.role as string) ?? '');
    });
  }, []);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
  }

  const roleColor = ROLE_COLORS[role] ?? 'bg-[#6b3a1f] text-[#e8c87a]';
  const initials  = fullName
    ? fullName.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
    : '?';

  return (
    <header className="glass-topbar flex h-14 items-center justify-between px-6">
      <div className="flex items-center gap-3">
        <h1 className="text-sm font-semibold text-[#2c1a0e]">The Interior Studio</h1>
      </div>

      <div className="flex items-center gap-3">
        {/* Notification bell */}
        <button
          type="button"
          className="rounded-lg p-2 text-[#8b6347] hover:bg-[#6b3a1f]/10 hover:text-[#6b3a1f] transition-colors"
          aria-label="Notifications"
        >
          <Bell className="h-4 w-4" />
        </button>

        {/* User avatar + role */}
        <div className="flex items-center gap-2">
          <div
            className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${roleColor}`}
            title={fullName}
          >
            {initials}
          </div>
          <div className="hidden sm:block">
            <p className="text-xs font-medium text-[#2c1a0e] leading-none">{fullName}</p>
            <p className="text-[10px] text-[#8b6347] capitalize mt-0.5">{role}</p>
          </div>
        </div>

        {/* Sign out */}
        <button
          type="button"
          onClick={handleSignOut}
          className="rounded-lg p-2 text-[#8b6347] hover:bg-red-50 hover:text-red-600 transition-colors"
          aria-label="Sign out"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
