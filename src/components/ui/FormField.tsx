import { cn } from '@/lib/utils';

interface FormFieldProps {
  label: string;
  error?: string;
  required?: boolean;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}

export function FormField({ label, error, required, hint, className, children }: FormFieldProps) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label className="text-sm font-medium" style={{ color: 'var(--text-heading)' }}>
        {label}
        {required && <span className="ml-0.5 text-[var(--danger)]">*</span>}
      </label>
      {children}
      {hint && !error && (
        <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{hint}</p>
      )}
      {error && (
        <p className="text-xs font-medium" style={{ color: 'var(--danger)' }}>{error}</p>
      )}
    </div>
  );
}
