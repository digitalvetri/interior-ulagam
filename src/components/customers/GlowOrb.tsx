export function GlowOrb({ color, size = 72 }: { color: string; size?: number; intensity?: number }) {
  const blur = Math.round(size * 0.35);
  return (
    <div
      className="glow-orb"
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        flexShrink: 0,
        background: `radial-gradient(circle at 38% 35%, #fff 0%, ${color} 28%, ${color}88 62%, transparent 100%)`,
        boxShadow: `0 0 ${blur}px ${color}66`,
      }}
    />
  );
}
