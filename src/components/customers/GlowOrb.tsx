'use client';
import { useEffect, useRef } from 'react';
import type * as THREE_NS from 'three';

export function GlowOrb({ color, size = 72 }: { color: string; size?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let animId = 0;
    let renderer: THREE_NS.WebGLRenderer | undefined;
    let geo: THREE_NS.BufferGeometry | undefined;
    let mat: THREE_NS.Material | undefined;

    import('three').then((THREE) => {
      renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
      renderer.setSize(size, size);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 10);
      camera.position.z = 2.5;

      geo = new THREE.SphereGeometry(0.85, 32, 32);
      mat = new THREE.MeshPhongMaterial({
        color: new THREE.Color(color),
        emissive: new THREE.Color(color),
        emissiveIntensity: 0.4,
        shininess: 90,
        transparent: true,
        opacity: 0.88,
      });
      const sphere = new THREE.Mesh(geo, mat);
      scene.add(sphere);

      const ambient = new THREE.AmbientLight(0xffffff, 0.5);
      scene.add(ambient);
      const point = new THREE.PointLight(0xffffff, 2.5, 10);
      point.position.set(2, 2, 3);
      scene.add(point);

      function loop() {
        animId = requestAnimationFrame(loop);
        sphere.rotation.y += 0.008;
        sphere.rotation.x += 0.004;
        renderer!.render(scene, camera);
      }
      loop();
    });

    return () => {
      cancelAnimationFrame(animId);
      renderer?.dispose();
      geo?.dispose();
      mat?.dispose();
    };
  }, [color, size]);

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      style={{ display: 'block', width: size, height: size }}
    />
  );
}
