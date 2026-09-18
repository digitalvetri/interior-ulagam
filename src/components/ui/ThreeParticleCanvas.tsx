'use client';
import { useEffect, useRef } from 'react';

interface Props {
  particleCount?: number;
  className?: string;
  style?: React.CSSProperties;
}

export function ThreeParticleCanvas({ particleCount = 120, className, style }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let animId: number;
    let renderer: any; // eslint-disable-line @typescript-eslint/no-explicit-any

    (async () => {
      try {
        const THREE = await import('three');
        const parent = canvas.parentElement;
        const W = parent?.clientWidth  ?? 320;
        const H = parent?.clientHeight ?? 200;

        renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false });
        renderer.setSize(W, H, false);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));

        const scene  = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(60, W / H, 0.1, 200);
        camera.position.set(0, 0, 40);

        const N      = particleCount;
        const spread = 30;
        const pos    = new Float32Array(N * 3);
        const vel: { x: number; y: number }[] = [];
        for (let i = 0; i < N; i++) {
          pos[i * 3]     = (Math.random() - 0.5) * spread * 2;
          pos[i * 3 + 1] = (Math.random() - 0.5) * spread;
          pos[i * 3 + 2] = (Math.random() - 0.5) * 10;
          vel.push({ x: (Math.random() - 0.5) * 0.007, y: (Math.random() - 0.5) * 0.007 });
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        const mat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.38, transparent: true, opacity: 0.75 });
        scene.add(new THREE.Points(geo, mat));

        const MAX_LINES = 90;
        const lineMat   = new THREE.LineBasicMaterial({ color: 0x99aaff, transparent: true, opacity: 0.18 });
        const lineGeos  = Array.from({ length: MAX_LINES }, () => {
          const lg = new THREE.BufferGeometry();
          lg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
          return lg;
        });
        const lines = lineGeos.map(lg => { const l = new THREE.Line(lg, lineMat); scene.add(l); return l; });

        const ro = new ResizeObserver(() => {
          const pw = parent?.clientWidth  ?? W;
          const ph = parent?.clientHeight ?? H;
          renderer.setSize(pw, ph, false);
          camera.aspect = pw / ph;
          camera.updateProjectionMatrix();
        });
        if (parent) ro.observe(parent);

        const DIST = 13;
        function animate() {
          animId = requestAnimationFrame(animate);
          for (let i = 0; i < N; i++) {
            pos[i * 3]     += vel[i].x;
            pos[i * 3 + 1] += vel[i].y;
            if (Math.abs(pos[i * 3])     > spread)     vel[i].x *= -1;
            if (Math.abs(pos[i * 3 + 1]) > spread / 2) vel[i].y *= -1;
          }
          geo.attributes.position.needsUpdate = true;

          let li = 0;
          outer: for (let a = 0; a < N; a++) {
            for (let b = a + 1; b < N; b++) {
              if (li >= MAX_LINES) break outer;
              const dx = pos[a * 3] - pos[b * 3];
              const dy = pos[a * 3 + 1] - pos[b * 3 + 1];
              if (dx * dx + dy * dy < DIST * DIST) {
                const lp = lineGeos[li].attributes.position.array as Float32Array;
                lp[0] = pos[a*3]; lp[1] = pos[a*3+1]; lp[2] = pos[a*3+2];
                lp[3] = pos[b*3]; lp[4] = pos[b*3+1]; lp[5] = pos[b*3+2];
                lineGeos[li].attributes.position.needsUpdate = true;
                lines[li].visible = true;
                li++;
              }
            }
          }
          for (let i = li; i < MAX_LINES; i++) lines[i].visible = false;
          renderer.render(scene, camera);
        }
        animate();
      } catch { /* WebGL unavailable */ }
    })();

    return () => {
      cancelAnimationFrame(animId);
      renderer?.dispose?.();
    };
  }, [particleCount]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ display: 'block', width: '100%', height: '100%', ...style }}
    />
  );
}
