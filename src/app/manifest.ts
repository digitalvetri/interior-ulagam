import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'InterioOS — Field',
    short_name: 'InterioOS',
    description: 'Field supervisor app for The Interior Studio',
    start_url: '/site-log',
    scope: '/',
    display: 'standalone',
    background_color: '#111827',
    theme_color: '#111827',
    orientation: 'portrait-primary',
    icons: [
      {
        src: '/brand/logo-icon.png',
        sizes: 'any',
        type: 'image/png',
        purpose: 'any',
      },
    ],
  };
}
