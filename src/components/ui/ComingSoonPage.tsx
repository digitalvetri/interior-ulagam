import Link from 'next/link';

export function ComingSoonPage({
  icon: Icon, title, description, cta,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  cta?: { href: string; label: string };
}) {
  return (
    <div className="space-y-1.5 animate-fade-in">
      <h1 className="text-2xl font-bold" style={{ color: 'var(--text-heading)' }}>{title}</h1>
      <p className="text-sm max-w-lg" style={{ color: 'var(--text-secondary)' }}>{description}</p>

      <div className="premium-card mt-6 flex flex-col items-center justify-center py-16 px-6 text-center">
        <div className="stat-badge mb-5" style={{ backgroundColor: 'var(--teal-soft)' }}>
          <Icon className="h-5 w-5" style={{ color: 'var(--teal)' }} />
        </div>
        {cta ? (
          <Link href={cta.href} className="btn-primary inline-flex items-center px-4 py-2 text-sm rounded-lg">
            {cta.label}
          </Link>
        ) : (
          <span
            className="inline-block rounded-full px-3 py-1 text-xs font-semibold"
            style={{ backgroundColor: 'var(--teal-soft)', color: 'var(--text-accent)' }}
          >
            Coming soon
          </span>
        )}
      </div>
    </div>
  );
}
