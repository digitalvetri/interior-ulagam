'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[root error boundary]', error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          fontFamily: 'system-ui, -apple-system, sans-serif',
          background: '#0b0b0c',
          color: '#f4f4f5',
          minHeight: '100vh',
          margin: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
        }}
      >
        <div style={{ textAlign: 'center', maxWidth: 480 }}>
          <p
            style={{
              margin: 0,
              fontSize: 12,
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
              color: '#f87171',
            }}
          >
            Application error
          </p>
          <h1 style={{ margin: '12px 0 8px', fontSize: 28 }}>
            The app crashed unexpectedly.
          </h1>
          <p style={{ margin: '0 0 16px', color: '#a1a1aa', fontSize: 14 }}>
            Refresh the page or click below to reset.
          </p>
          {error.digest && (
            <p
              style={{
                margin: '0 0 16px',
                color: '#71717a',
                fontFamily: 'ui-monospace, monospace',
                fontSize: 12,
              }}
            >
              Ref: {error.digest}
            </p>
          )}
          <button
            onClick={reset}
            style={{
              padding: '8px 16px',
              background: '#f4f4f5',
              color: '#0b0b0c',
              border: 'none',
              borderRadius: 6,
              fontSize: 14,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
