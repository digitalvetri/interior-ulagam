'use client';

import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { X, CheckCircle2, AlertTriangle, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

type ToastVariant = 'success' | 'error' | 'info';

interface ToastItem {
  id: string;
  message: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  toast: (message: string, variant?: ToastVariant) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const VARIANT_STYLES: Record<ToastVariant, { bg: string; color: string; icon: React.ElementType }> = {
  success: { bg: 'var(--success-soft)', color: 'var(--success-text)', icon: CheckCircle2 },
  error:   { bg: 'var(--danger-soft)',  color: 'var(--danger)',       icon: AlertTriangle },
  info:    { bg: 'var(--accent-soft)',  color: 'var(--accent-text)',  icon: Info },
};

function ToastItem({ item, onDismiss }: { item: ToastItem; onDismiss: (id: string) => void }) {
  const cfg = VARIANT_STYLES[item.variant];
  const Icon = cfg.icon;

  useEffect(() => {
    const t = setTimeout(() => onDismiss(item.id), 4000);
    return () => clearTimeout(t);
  }, [item.id, onDismiss]);

  return (
    <div
      className="flex items-start gap-3 rounded-xl px-4 py-3 shadow-lg text-sm font-medium max-w-sm w-full pointer-events-auto"
      style={{ background: cfg.bg, color: cfg.color, border: '1px solid transparent' }}
    >
      <Icon className="h-4 w-4 flex-shrink-0 mt-0.5" />
      <span className="flex-1">{item.message}</span>
      <button
        onClick={() => onDismiss(item.id)}
        className="flex-shrink-0 hover:opacity-60 transition-opacity"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const toast = useCallback((message: string, variant: ToastVariant = 'info') => {
    const id = Math.random().toString(36).slice(2);
    setToasts(prev => [...prev, { id, message, variant }]);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
        {toasts.map(item => (
          <ToastItem key={item.id} item={item} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx.toast;
}

/** Standalone toast without context — for quick non-critical notifications */
export function useSimpleToast() {
  const [message, setMessage] = useState<{ text: string; variant: ToastVariant } | null>(null);

  const show = useCallback((text: string, variant: ToastVariant = 'info') => {
    setMessage({ text, variant });
    setTimeout(() => setMessage(null), 4000);
  }, []);

  const node = message ? (
    <div className="fixed bottom-4 right-4 z-[100]">
      <div
        className={cn('flex items-center gap-2 rounded-xl px-4 py-3 shadow-lg text-sm font-medium max-w-sm')}
        style={{
          background: VARIANT_STYLES[message.variant].bg,
          color: VARIANT_STYLES[message.variant].color,
        }}
      >
        {message.text}
      </div>
    </div>
  ) : null;

  return { show, node };
}
