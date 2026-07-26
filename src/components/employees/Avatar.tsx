'use client';

import Image from 'next/image';

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('') || '?';
}

function hueFor(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffffff;
  return Math.abs(h) % 360;
}

export function EmployeeAvatar({
  name, photoUrl, size = 40,
}: {
  name: string;
  photoUrl: string | null;
  size?: number;
}) {
  if (photoUrl) {
    return (
      <Image
        src={photoUrl}
        alt={name}
        width={size}
        height={size}
        className="flex-shrink-0 rounded-full object-cover ring-2 ring-white dark:ring-slate-900"
        style={{ width: size, height: size }}
      />
    );
  }
  const hue = hueFor(name);
  const fontSize = Math.max(11, Math.round(size * 0.36));
  return (
    <span
      aria-hidden="true"
      className="flex flex-shrink-0 items-center justify-center rounded-full font-semibold text-white ring-2 ring-white dark:ring-slate-900"
      style={{
        width: size,
        height: size,
        fontSize,
        backgroundColor: `hsl(${hue}, 55%, 45%)`,
      }}
    >
      {initials(name)}
    </span>
  );
}
