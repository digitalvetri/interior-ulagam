'use client';

import { useEffect, useRef } from 'react';

export function LoginScene3D() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let destroyed = false;
    let cleanupFn: (() => void) | undefined;

    import('three').then((THREE) => {
      if (destroyed) return;

      const width = container.clientWidth || 400;
      const height = container.clientHeight || 320;

      const scene = new THREE.Scene();

      const camera = new THREE.PerspectiveCamera(30, width / height, 0.1, 100);
      camera.position.set(7.2, 5.0, 8.2);
      camera.lookAt(0, 1.0, 0);

      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(width, height);
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFShadowMap;
      container.appendChild(renderer.domElement);

      scene.add(new THREE.AmbientLight(0x4a4238, 1.1));

      const key = new THREE.DirectionalLight(0xffd9a0, 2.3);
      key.position.set(5, 8, 5);
      key.castShadow = true;
      key.shadow.mapSize.set(1024, 1024);
      key.shadow.camera.left = -6;
      key.shadow.camera.right = 6;
      key.shadow.camera.top = 6;
      key.shadow.camera.bottom = -6;
      scene.add(key);

      const rim = new THREE.DirectionalLight(0x8a7050, 1.2);
      rim.position.set(-6, 3.5, -4);
      scene.add(rim);

      const porchGlow = new THREE.PointLight(0xffb870, 1.4, 4.5, 2);
      porchGlow.position.set(0, 1.1, 1.6);
      scene.add(porchGlow);

      const wallMat    = new THREE.MeshStandardMaterial({ color: 0xede7dc, roughness: 0.85, flatShading: true });
      const roofMat    = new THREE.MeshStandardMaterial({ color: 0x6b4a3a, roughness: 0.7, flatShading: true, side: THREE.DoubleSide });
      const doorMat    = new THREE.MeshStandardMaterial({ color: 0x3b2a1c, roughness: 0.55 });
      const windowMat  = new THREE.MeshStandardMaterial({ color: 0xffd9a0, emissive: 0xffb870, emissiveIntensity: 0.9, roughness: 0.3 });
      const brassMat   = new THREE.MeshStandardMaterial({ color: 0xd4af6a, roughness: 0.35, metalness: 0.55 });
      const chimneyMat = new THREE.MeshStandardMaterial({ color: 0x5b4632, roughness: 0.8 });
      const trunkMat   = new THREE.MeshStandardMaterial({ color: 0x4a3324, roughness: 0.9 });
      const foliageMat = new THREE.MeshStandardMaterial({ color: 0x445c48, roughness: 0.85, flatShading: true });
      const groundMat  = new THREE.MeshStandardMaterial({ color: 0x0F1720, roughness: 1 });

      const W = 2.4, D = 2.0, H = 1.3;
      const rise = 0.85;
      const run = D / 2;
      const ridgeY = H + rise;
      const tanTheta = rise / run;
      const ridgeOverhang = 0.15;
      const eaveOverhang = 0.3;
      const halfLenX = W / 2 + ridgeOverhang;
      const eaveZ = run + eaveOverhang;
      const eaveY = ridgeY - tanTheta * eaveZ;

      const group = new THREE.Group();

      const ground = new THREE.Mesh(new THREE.CircleGeometry(3.0, 48), groundMat);
      ground.rotation.x = -Math.PI / 2;
      ground.position.y = -0.02;
      ground.receiveShadow = true;
      group.add(ground);

      const walls = new THREE.Mesh(new THREE.BoxGeometry(W, H, D), wallMat);
      walls.position.set(0, H / 2, 0);
      walls.castShadow = true;
      walls.receiveShadow = true;
      group.add(walls);

      function gableTriangle(x: number) {
        const geo = new THREE.BufferGeometry();
        const pts = new Float32Array([x, H, -run, x, H, run, x, ridgeY, 0]);
        geo.setAttribute('position', new THREE.BufferAttribute(pts, 3));
        geo.computeVertexNormals();
        const mesh = new THREE.Mesh(geo, wallMat);
        mesh.castShadow = true;
        return mesh;
      }
      group.add(gableTriangle(W / 2));
      group.add(gableTriangle(-W / 2));

      const slabWidth = Math.hypot(eaveZ, ridgeY - eaveY);
      const roofThickness = 0.06;
      const slopeAngle = Math.atan2(ridgeY - eaveY, eaveZ);
      const slabMidY = (ridgeY + eaveY) / 2;
      const slabMidZ = eaveZ / 2;
      function roofSlab(zSign: 1 | -1) {
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(halfLenX * 2, roofThickness, slabWidth), roofMat);
        mesh.rotation.x = zSign === 1 ? slopeAngle : Math.PI - slopeAngle;
        mesh.position.set(0, slabMidY, slabMidZ * zSign);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        return mesh;
      }
      group.add(roofSlab(1));
      group.add(roofSlab(-1));

      const chimney = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.85, 0.22), chimneyMat);
      chimney.position.set(0.75, 1.92, 0);
      chimney.castShadow = true;
      group.add(chimney);

      const door = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.85, 0.04), doorMat);
      door.position.set(0, 0.425, run + 0.02);
      group.add(door);
      const handle = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 8), brassMat);
      handle.position.set(0.15, 0.43, run + 0.05);
      group.add(handle);

      function windowPane(x: number, y: number, z: number, w: number, h: number, d: number) {
        const win = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), windowMat);
        win.position.set(x, y, z);
        group.add(win);
      }
      windowPane(-0.8, 0.62, run + 0.02, 0.34, 0.4, 0.03);
      windowPane(0.8, 0.62, run + 0.02, 0.34, 0.4, 0.03);
      windowPane(W / 2 + 0.02, 0.7, 0.45, 0.03, 0.36, 0.32);
      windowPane(W / 2 + 0.02, 0.7, -0.45, 0.03, 0.36, 0.32);

      const canopy = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.06, 0.5), wallMat);
      canopy.position.set(0, 0.98, eaveZ - 0.05);
      canopy.castShadow = true;
      group.add(canopy);
      [-0.38, 0.38].forEach(x => {
        const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.95, 8), brassMat);
        pillar.position.set(x, 0.475, eaveZ + 0.15);
        pillar.castShadow = true;
        group.add(pillar);
      });

      const step1 = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.07, 0.28), wallMat);
      step1.position.set(0, 0.035, run + 0.5);
      step1.receiveShadow = true;
      group.add(step1);
      const step2 = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.07, 0.22), wallMat);
      step2.position.set(0, 0.105, run + 0.32);
      step2.receiveShadow = true;
      group.add(step2);

      function tree(x: number, z: number, scale: number) {
        const t = new THREE.Group();
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.06, 0.32, 6), trunkMat);
        trunk.position.y = 0.16;
        trunk.castShadow = true;
        t.add(trunk);
        const foliageLower = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.5, 7), foliageMat);
        foliageLower.position.y = 0.55;
        foliageLower.castShadow = true;
        t.add(foliageLower);
        const foliageUpper = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.4, 7), foliageMat);
        foliageUpper.position.y = 0.85;
        foliageUpper.castShadow = true;
        t.add(foliageUpper);
        t.position.set(x, 0, z);
        t.scale.setScalar(scale);
        return t;
      }
      group.add(tree(-2.1, 1.1, 1.1));
      group.add(tree(1.95, -1.35, 0.9));
      group.add(tree(-1.6, -1.5, 0.75));

      group.position.y = -0.85;
      scene.add(group);

      const startTime = performance.now();
      let rafId = 0;
      function animate() {
        rafId = requestAnimationFrame(animate);
        const t = (performance.now() - startTime) / 1000;
        group.rotation.y = t * 0.25;
        group.position.y = -0.85 + Math.sin(t * 0.6) * 0.05;
        renderer.render(scene, camera);
      }
      animate();

      const resizeObserver = new ResizeObserver(entries => {
        const entry = entries[0];
        if (!entry) return;
        const { width: w, height: h } = entry.contentRect;
        if (w === 0 || h === 0) return;
        renderer.setSize(w, h);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      });
      resizeObserver.observe(container);

      cleanupFn = () => {
        cancelAnimationFrame(rafId);
        resizeObserver.disconnect();
        if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
        scene.traverse(obj => {
          if (obj instanceof THREE.Mesh || obj instanceof THREE.Line || obj instanceof THREE.LineSegments) {
            obj.geometry.dispose();
            const mat = obj.material;
            if (Array.isArray(mat)) mat.forEach(m => m.dispose());
            else mat.dispose();
          }
        });
        renderer.dispose();
      };
    });

    return () => {
      destroyed = true;
      cleanupFn?.();
    };
  }, []);

  return <div ref={containerRef} className="login-scene3d" aria-hidden="true" />;
}
