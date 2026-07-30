import type { NextConfig } from "next";
import path from "path";

const isDev = process.env.NODE_ENV === 'development';

const connectSrcDirectives = [
  "'self'",
  "https://*.supabase.co",
  "wss://*.supabase.co",
  "https://api.groq.com",
  "https://generativelanguage.googleapis.com",
  // Turbopack HMR WebSocket — dev only
  ...(isDev ? ["ws://localhost:*", "wss://localhost:*"] : []),
];

const securityHeaders = [
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://theinteriorstudios.in",
      "font-src 'self'",
      `connect-src ${connectSrcDirectives.join(' ')}`,
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '),
  },
];

const nextConfig: NextConfig = {
  output: 'standalone',
  turbopack: {
    root: path.resolve(__dirname),
  },
  experimental: {
    optimizePackageImports: [
      'lucide-react',
      'framer-motion',
      '@radix-ui/react-dialog',
      '@radix-ui/react-select',
      '@radix-ui/react-label',
      '@radix-ui/react-slot',
      '@supabase/supabase-js',
      '@supabase/ssr',
      '@tanstack/react-query',
      'drizzle-orm',
      'inngest',
    ],
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'theinteriorstudios.in',
        pathname: '/wp-content/uploads/**',
      },
    ],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
