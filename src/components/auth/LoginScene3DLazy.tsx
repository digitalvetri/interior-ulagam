'use client';
import dynamic from 'next/dynamic';

const LazyScene = dynamic(
  () => import('./LoginScene3D').then(mod => mod.LoginScene3D),
  { ssr: false, loading: () => <div className="login-scene3d" aria-hidden="true" /> },
);

export function LoginScene3DLazy() {
  return <LazyScene />;
}
