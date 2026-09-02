import { Sidebar } from '@/components/layout/Sidebar';
import { TopBar } from '@/components/layout/TopBar';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen" style={{ backgroundColor: 'var(--surface-app)' }}>
      <Sidebar />
      {/* On mobile, the Sidebar renders as a fixed drawer so we need top padding for the mobile header bar */}
      <div className="flex flex-1 flex-col overflow-hidden pt-14 md:pt-0">
        <TopBar />
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
