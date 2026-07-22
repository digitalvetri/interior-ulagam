export default function FieldLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white">
      <header className="p-4 border-b text-sm font-semibold">
        Interior Studio OS
      </header>
      <main className="p-4">{children}</main>
    </div>
  );
}
