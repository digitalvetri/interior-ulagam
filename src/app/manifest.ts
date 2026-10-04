import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Konst Design — Field',
    short_name: 'KonstOS',
    description: 'Field supervisor app for Konst Design',
    start_url: '/site-log',
    scope: '/',
    display: 'standalone',
    background_color: '#F6F3EC',
    theme_color: '#1F4A36',
    orientation: 'portrait-primary',
    icons: [
      { src: '/brand/app-icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/brand/app-icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/brand/app-icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
