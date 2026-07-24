import { Sidebar } from '@/components/layout/Sidebar';
import { TopBar } from '@/components/layout/TopBar';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen" style={{ backgroundColor: '#F8F5F2' }}>
      <Sidebar />
      {/* On mobile, the Sidebar renders as a fixed drawer so we need top padding for the mobile header bar */}
      <div className="flex flex-1 flex-col overflow-hidden pt-14 lg:pt-0">
        <TopBar />
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
