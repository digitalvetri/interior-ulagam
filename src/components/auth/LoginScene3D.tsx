'use client';

import { useEffect, useRef } from 'react';

/**
 * Login hero: a cut-away living room on a floating plinth — the studio's work,
 * in its colours (forest-green feature wall, cream, brass). Built procedurally
 * from three.js primitives so there are no model files to download.
 *
 * Behaviour: furniture settles in on load, the diorama sways gently and leans
 * toward the pointer, dust drifts through the window light. Respects
 * prefers-reduced-motion (renders one still frame) and pauses while the tab is
 * hidden. Nothing initialises until the container is actually visible (the
 * hero panel is display:none on small screens).
 */
export function LoginScene3D() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let destroyed = false;
    let cleanup: (() => void) | undefined;

    const start = async () => {
      const THREE = await import('three');
      const { RoundedBoxGeometry } = await import('three/examples/jsm/geometries/RoundedBoxGeometry.js');
      if (destroyed) return;

      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      let width = container.clientWidth;
      let height = container.clientHeight;

      // ── Renderer / scene / camera ─────────────────────────────────────────
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(width, height);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.05;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFShadowMap;
      container.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(30, width / height, 0.1, 100);
      const camBase = new THREE.Vector3(9.0, 7.0, 9.0);
      const lookAt = new THREE.Vector3(0, 0.7, 0);
      camera.position.copy(camBase);
      camera.lookAt(lookAt);

      const disposables: { dispose: () => void }[] = [];
      const track = <T extends { dispose: () => void }>(x: T): T => { disposables.push(x); return x; };

      // ── Procedural textures ───────────────────────────────────────────────
      function canvasTexture(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void) {
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        draw(c.getContext('2d')!);
        const t = track(new THREE.CanvasTexture(c));
        t.colorSpace = THREE.SRGBColorSpace;
        t.anisotropy = 4;
        return t;
      }

      // Oak plank floor
      const floorTex = canvasTexture(512, 512, (g) => {
        g.fillStyle = '#c99a6b'; g.fillRect(0, 0, 512, 512);
        const plankH = 64;
        for (let row = 0; row < 8; row++) {
          const offset = (row % 2) * 160;
          for (let x = -offset; x < 512; x += 320) {
            const shade = 0.9 + Math.random() * 0.2;
            g.fillStyle = `rgb(${Math.round(201 * shade)},${Math.round(154 * shade)},${Math.round(107 * shade)})`;
            g.fillRect(x + 1, row * plankH + 1, 318, plankH - 2);
            g.strokeStyle = 'rgba(90,55,30,0.12)';
            for (let k = 0; k < 6; k++) {
              g.beginPath();
              const y = row * plankH + 8 + Math.random() * (plankH - 16);
              g.moveTo(x + 4, y);
              g.bezierCurveTo(x + 100, y + 4, x + 200, y - 4, x + 314, y + 2);
              g.stroke();
            }
          }
          g.fillStyle = 'rgba(70,40,20,0.35)';
          g.fillRect(0, row * plankH, 512, 1.5);
        }
      });
      floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping;
      floorTex.repeat.set(2, 2);

      // Round rug with concentric bands
      const rugTex = canvasTexture(512, 512, (g) => {
        const cx = 256, cy = 256;
        const bands = ['#efe6d6', '#e3d5bd', '#efe6d6', '#c9a24a', '#efe6d6', '#2f5a46', '#efe6d6'];
        for (let i = 0; i < bands.length; i++) {
          g.beginPath();
          g.arc(cx, cy, 256 - i * 30, 0, Math.PI * 2);
          g.fillStyle = bands[i];
          g.fill();
        }
        g.globalAlpha = 0.08;
        for (let i = 0; i < 4000; i++) {
          g.fillStyle = Math.random() > 0.5 ? '#000' : '#fff';
          g.fillRect(Math.random() * 512, Math.random() * 512, 1, 1);
        }
      });

      // Abstract artwork for the frame
      const artTex = canvasTexture(256, 320, (g) => {
        const grd = g.createLinearGradient(0, 0, 0, 320);
        grd.addColorStop(0, '#f3ece0'); grd.addColorStop(1, '#e6d9c3');
        g.fillStyle = grd; g.fillRect(0, 0, 256, 320);
        g.fillStyle = '#c9a24a'; g.beginPath(); g.arc(170, 110, 58, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#2f5a46'; g.beginPath(); g.ellipse(100, 230, 110, 48, -0.3, 0, Math.PI * 2); g.fill();
        g.strokeStyle = '#1a1d1a'; g.lineWidth = 3; g.beginPath();
        g.moveTo(30, 170); g.bezierCurveTo(90, 120, 150, 210, 230, 150); g.stroke();
      });

      // ── Materials ─────────────────────────────────────────────────────────
      const M = (p: ConstructorParameters<typeof THREE.MeshStandardMaterial>[0]) => track(new THREE.MeshStandardMaterial(p));
      const mat = {
        floor:   M({ map: floorTex, roughness: 0.62 }),
        green:   M({ color: 0x2c5543, roughness: 0.92 }),
        cream:   M({ color: 0xefe8dc, roughness: 0.95 }),
        plinth:  M({ color: 0x163a2a, roughness: 0.7 }),
        gold:    M({ color: 0xc9a24a, roughness: 0.32, metalness: 0.85 }),
        boucle:  M({ color: 0xece3d4, roughness: 1 }),
        velvet:  M({ color: 0x2f5a46, roughness: 0.75 }),
        mustard: M({ color: 0xb98b45, roughness: 0.8 }),
        marble:  M({ color: 0xf4f1ec, roughness: 0.18 }),
        walnut:  M({ color: 0x6b4a33, roughness: 0.55 }),
        terracotta: M({ color: 0xb8714d, roughness: 0.85 }),
        leaf:    M({ color: 0x3f7a4f, roughness: 0.6, side: THREE.DoubleSide }),
        leafDark:M({ color: 0x2c5e3c, roughness: 0.6, side: THREE.DoubleSide }),
        rug:     M({ map: rugTex, roughness: 1 }),
        art:     M({ map: artTex, roughness: 0.9 }),
        glass:   M({ color: 0xfff1d6, emissive: 0xffd9a0, emissiveIntensity: 1.6, roughness: 0.2 }),
        bulb:    M({ color: 0xfff4e0, emissive: 0xffd08a, emissiveIntensity: 3 }),
        ceramic: M({ color: 0xf6f2ea, roughness: 0.3 }),
        charcoal:M({ color: 0x2b2b29, roughness: 0.6 }),
      };

      const box = (w: number, h: number, d: number, r = 0.02) => track(new RoundedBoxGeometry(w, h, d, 3, r));
      const mesh = (geo: ConstructorParameters<typeof THREE.Mesh>[0], m: InstanceType<typeof THREE.Material>, cast = true, receive = true) => {
        const o = new THREE.Mesh(geo, m);
        o.castShadow = cast; o.receiveShadow = receive;
        return o;
      };

      // ── Diorama ───────────────────────────────────────────────────────────
      const diorama = new THREE.Group();
      scene.add(diorama);

      const S = 6;      // room footprint
      const WALL_H = 3.4;
      const T = 0.18;   // wall thickness

      // Plinth with a brass edge
      const plinth = mesh(box(S + 0.7, 0.45, S + 0.7, 0.08), mat.plinth);
      plinth.position.y = -0.3;
      diorama.add(plinth);
      const trim = mesh(box(S + 0.74, 0.05, S + 0.74, 0.02), M({ color: 0xb8913f, roughness: 0.55, metalness: 0.6 }), false);
      trim.position.y = -0.06;
      diorama.add(trim);

      const floor = mesh(box(S, 0.1, S, 0.02), mat.floor, false);
      floor.position.y = 0;
      diorama.add(floor);

      // Back wall (cream) and left feature wall (forest green) — the room is cut
      // away on the two sides facing the camera.
      const backWall = mesh(box(S, WALL_H, T, 0.02), mat.cream);
      backWall.position.set(0, WALL_H / 2, -S / 2 + T / 2);
      diorama.add(backWall);

      // Left wall with an arched window opening, built from pieces.
      const leftWall = new THREE.Group();
      const winZ = 0.6, winW = 1.5, sill = 0.9, winTop = 2.55;
      const lwX = -S / 2 + T / 2;
      const partA = mesh(box(T, WALL_H, S / 2 + winZ - winW / 2, 0.02), mat.green);
      partA.position.set(lwX, WALL_H / 2, (-S / 2 + (winZ - winW / 2)) / 2);
      const partBLen = S / 2 - (winZ + winW / 2);
      const partB = mesh(box(T, WALL_H, partBLen, 0.02), mat.green);
      partB.position.set(lwX, WALL_H / 2, winZ + winW / 2 + partBLen / 2);
      const below = mesh(box(T, sill, winW, 0.02), mat.green);
      below.position.set(lwX, sill / 2, winZ);
      const above = mesh(box(T, WALL_H - winTop - 0.05, winW, 0.02), mat.green);
      above.position.set(lwX, winTop + (WALL_H - winTop) / 2 + 0.02, winZ);
      leftWall.add(partA, partB, below, above);
      // Arch: a half-disc above the rectangular opening, framed in brass
      const archR = winW / 2;
      const rectTop = winTop - archR;
      const archShape = new THREE.Shape();
      archShape.moveTo(-archR, 0); archShape.lineTo(-archR, archR); archShape.lineTo(archR, archR); archShape.lineTo(archR, 0);
      archShape.absarc(0, 0, archR, 0, Math.PI, false);
      const archGeo = track(new THREE.ExtrudeGeometry(archShape, { depth: T, bevelEnabled: false, curveSegments: 32 }));
      const archCap = mesh(archGeo, mat.green);
      archCap.rotation.y = Math.PI / 2;
      archCap.position.set(lwX + T / 2, rectTop, winZ);
      leftWall.add(archCap);
      // Glass (glowing, warm daylight) + brass frame
      const glassShape = new THREE.Shape();
      glassShape.moveTo(-archR, -(rectTop - sill)); glassShape.lineTo(archR, -(rectTop - sill)); glassShape.lineTo(archR, 0);
      glassShape.absarc(0, 0, archR, 0, Math.PI, false); glassShape.lineTo(-archR, -(rectTop - sill));
      const glass = mesh(track(new THREE.ShapeGeometry(glassShape, 32)), mat.glass, false, false);
      glass.rotation.y = Math.PI / 2;
      glass.position.set(lwX - 0.02, rectTop, winZ);
      leftWall.add(glass);
      const frameCurve = new THREE.EllipseCurve(0, 0, archR, archR, 0, Math.PI, false);
      const framePts = [new THREE.Vector2(archR, -(rectTop - sill)), ...frameCurve.getPoints(40), new THREE.Vector2(-archR, -(rectTop - sill))];
      const frameGeo = track(new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3(framePts.map((p) => new THREE.Vector3(0, p.y, p.x))), 80, 0.035, 8, false));
      const winFrame = mesh(frameGeo, mat.gold, false);
      winFrame.position.set(lwX + T / 2 + 0.01, rectTop, winZ);
      leftWall.add(winFrame);
      const mullion = mesh(box(0.03, rectTop - sill + archR, 0.03, 0.01), mat.gold, false);
      mullion.position.set(lwX + T / 2 + 0.01, sill + (rectTop - sill + archR) / 2, winZ);
      leftWall.add(mullion);
      diorama.add(leftWall);

      // Baseboards
      const bbBack = mesh(box(S, 0.12, 0.04, 0.01), mat.cream);
      bbBack.position.set(0, 0.11, -S / 2 + T + 0.02);
      diorama.add(bbBack);

      // ── Furniture (each piece is a group so it can animate in) ────────────
      const pieces: { obj: InstanceType<typeof THREE.Object3D>; delay: number; restY: number }[] = [];
      const place = (obj: InstanceType<typeof THREE.Object3D>, delay: number) => {
        pieces.push({ obj, delay, restY: obj.position.y });
        diorama.add(obj);
      };

      // Rug
      const rug = mesh(track(new THREE.CircleGeometry(1.75, 64)), mat.rug, false);
      rug.rotation.x = -Math.PI / 2;
      rug.position.set(0.35, 0.056, 0.35);
      place(rug, 0.0);

      // Sofa (boucle) against the back wall
      const sofa = new THREE.Group();
      const sofaBase = mesh(box(2.7, 0.42, 1.0, 0.12), mat.boucle);
      sofaBase.position.y = 0.36;
      const sofaBack = mesh(box(2.7, 0.62, 0.28, 0.13), mat.boucle);
      sofaBack.position.set(0, 0.78, -0.36);
      const armL = mesh(box(0.26, 0.55, 1.0, 0.12), mat.boucle);
      armL.position.set(-1.22, 0.55, 0);
      const armR = armL.clone(); armR.position.x = 1.22;
      sofa.add(sofaBase, sofaBack, armL, armR);
      [-0.55, 0.55].forEach((x) => {
        const cushion = mesh(box(1.05, 0.16, 0.74, 0.07), mat.boucle);
        cushion.position.set(x, 0.64, 0.08);
        sofa.add(cushion);
      });
      const pillow = mesh(box(0.42, 0.42, 0.14, 0.06), mat.velvet);
      pillow.position.set(-0.85, 0.86, -0.12); pillow.rotation.z = 0.12;
      const pillow2 = mesh(box(0.38, 0.38, 0.13, 0.06), mat.gold);
      pillow2.position.set(0.9, 0.84, -0.12); pillow2.rotation.z = -0.1;
      sofa.add(pillow, pillow2);
      [[-1.2, -0.38], [1.2, -0.38], [-1.2, 0.38], [1.2, 0.38]].forEach(([x, z]) => {
        const leg = mesh(track(new THREE.CylinderGeometry(0.03, 0.03, 0.16, 10)), mat.gold, false);
        leg.position.set(x, 0.1, z);
        sofa.add(leg);
      });
      sofa.position.set(0.5, 0.05, -S / 2 + T + 0.62);
      place(sofa, 0.25);

      // Lounge chair (green velvet) near the window
      const chair = new THREE.Group();
      const seat = mesh(box(0.95, 0.36, 0.9, 0.14), mat.mustard);
      seat.position.y = 0.42;
      const back = mesh(box(0.95, 0.72, 0.22, 0.11), mat.mustard);
      back.position.set(0, 0.86, -0.36); back.rotation.x = -0.12;
      chair.add(seat, back);
      const ring = mesh(track(new THREE.TorusGeometry(0.38, 0.02, 8, 40)), mat.gold, false);
      ring.rotation.x = Math.PI / 2; ring.position.y = 0.2;
      const stem = mesh(track(new THREE.CylinderGeometry(0.025, 0.025, 0.2, 8)), mat.gold, false);
      stem.position.y = 0.12;
      chair.add(ring, stem);
      chair.position.set(-1.6, 0.05, 1.45);
      chair.rotation.y = 0.85;
      place(chair, 0.45);

      // Marble coffee table on a brass pedestal
      const table = new THREE.Group();
      const top = mesh(track(new THREE.CylinderGeometry(0.62, 0.62, 0.06, 48)), mat.marble);
      top.position.y = 0.48;
      const ped = mesh(track(new THREE.CylinderGeometry(0.16, 0.26, 0.42, 32)), mat.gold);
      ped.position.y = 0.24;
      const book = mesh(box(0.42, 0.06, 0.3, 0.01), mat.velvet);
      book.position.set(-0.12, 0.54, 0.05); book.rotation.y = 0.3;
      const bowl = mesh(track(new THREE.SphereGeometry(0.14, 24, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2)), mat.ceramic);
      bowl.rotation.x = Math.PI; bowl.position.set(0.22, 0.66, -0.08);
      table.add(top, ped, book, bowl);
      table.position.set(0.45, 0.05, 0.55);
      place(table, 0.6);

      // Sideboard + vase on the back wall's right side
      const sideboard = new THREE.Group();
      const sbBody = mesh(box(1.3, 0.55, 0.42, 0.04), mat.walnut);
      sbBody.position.y = 0.37;
      [-0.6, 0.6].forEach((x) => [-0.16, 0.16].forEach((z) => {
        const l = mesh(track(new THREE.CylinderGeometry(0.02, 0.02, 0.1, 8)), mat.gold, false);
        l.position.set(x, 0.05, z); sideboard.add(l);
      }));
      const vase = mesh(track(new THREE.LatheGeometry(
        [0.0, 0.1, 0.14, 0.12, 0.06, 0.07].map((r, i) => new THREE.Vector2(r, i * 0.09)), 32)), mat.ceramic);
      vase.position.set(0.35, 0.65, 0);
      sideboard.add(sbBody, vase);
      sideboard.position.set(2.2, 0.05, -S / 2 + T + 0.26);
      place(sideboard, 0.7);

      // Framed artwork above the sofa
      const art = new THREE.Group();
      const artFrame = mesh(box(1.1, 1.36, 0.05, 0.01), mat.gold);
      const canvas = mesh(track(new THREE.PlaneGeometry(0.98, 1.24)), mat.art, false);
      canvas.position.z = 0.03;
      art.add(artFrame, canvas);
      art.position.set(0.5, 2.25, -S / 2 + T + 0.03);
      place(art, 0.85);

      // Plants: a potted fiddle-leaf by the window, a small one on the sideboard
      function plant(scale: number) {
        const g = new THREE.Group();
        const pot = mesh(track(new THREE.CylinderGeometry(0.22, 0.17, 0.42, 32)), mat.terracotta);
        pot.position.y = 0.21;
        g.add(pot);
        const leafGeo = track(new THREE.SphereGeometry(0.26, 14, 10));
        for (let i = 0; i < 18; i++) {
          const leaf = mesh(leafGeo, i % 2 ? mat.leaf : mat.leafDark);
          const a = (i / 18) * Math.PI * 5 + Math.random() * 0.4;
          const h = 0.6 + (i / 18) * 1.0;
          leaf.scale.set(0.55, 0.12, 1.15);
          leaf.position.set(Math.cos(a) * 0.3, h, Math.sin(a) * 0.3);
          leaf.rotation.set(-0.5 + Math.random() * 0.3, -a + Math.PI / 2, 0.4);
          g.add(leaf);
        }
        const trunk = mesh(track(new THREE.CylinderGeometry(0.02, 0.03, 1.3, 6)), mat.walnut);
        trunk.position.y = 0.95;
        g.add(trunk);
        g.scale.setScalar(scale);
        return g;
      }
      const tallPlant = plant(1.1);
      tallPlant.position.set(-2.35, 0.05, 2.4);
      place(tallPlant, 0.95);
      const smallPlant = plant(0.42);
      smallPlant.position.set(1.85, 0.6, -S / 2 + T + 0.26);
      place(smallPlant, 1.05);

      // Pendant lamp over the coffee table
      const pendant = new THREE.Group();
      const cord = mesh(track(new THREE.CylinderGeometry(0.008, 0.008, 1.1, 6)), mat.charcoal, false);
      cord.position.y = 0.55;
      const shade = mesh(track(new THREE.SphereGeometry(0.34, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2)), mat.gold, true, false);
      const shadeInner = mesh(track(new THREE.SphereGeometry(0.33, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2)),
        M({ color: 0xfff3dd, emissive: 0xffd9a0, emissiveIntensity: 0.6, side: THREE.BackSide }), false, false);
      const bulb = mesh(track(new THREE.SphereGeometry(0.09, 20, 12)), mat.bulb, false, false);
      bulb.position.y = 0.02;
      pendant.add(cord, shade, shadeInner, bulb);
      pendant.position.set(0.45, 2.45, 0.55);
      place(pendant, 1.15);

      // ── Lighting ──────────────────────────────────────────────────────────
      scene.add(new THREE.HemisphereLight(0xfff4e6, 0x20352a, 0.75));

      // Sunlight pouring through the arched window
      const sun = new THREE.DirectionalLight(0xffd7a3, 3.2);
      sun.position.set(-9, 6.5, 2.5);
      sun.target.position.set(0.5, 0, 0.2);
      sun.castShadow = true;
      sun.shadow.mapSize.set(2048, 2048);
      sun.shadow.camera.left = -6; sun.shadow.camera.right = 6;
      sun.shadow.camera.top = 6; sun.shadow.camera.bottom = -6;
      sun.shadow.bias = -0.0004;
      sun.shadow.normalBias = 0.02;
      sun.shadow.radius = 6;
      diorama.add(sun, sun.target);

      // Soft fill from the open side so the room isn't murky
      const fillLight = new THREE.DirectionalLight(0xdfe9e2, 0.9);
      fillLight.position.set(8, 6, 9);
      scene.add(fillLight);

      // Warm pendant glow
      const lamp = new THREE.PointLight(0xffc27a, 6, 5.5, 2);
      lamp.position.set(0.45, 2.35, 0.55);
      lamp.castShadow = true;
      lamp.shadow.mapSize.set(512, 512);
      lamp.shadow.bias = -0.002;
      diorama.add(lamp);

      // Dust motes drifting through the light
      const DUST = 140;
      const dustPos = new Float32Array(DUST * 3);
      const dustSeed = new Float32Array(DUST);
      for (let i = 0; i < DUST; i++) {
        dustPos[i * 3] = -2.6 + Math.random() * 3.4;
        dustPos[i * 3 + 1] = 0.2 + Math.random() * 2.8;
        dustPos[i * 3 + 2] = -1.0 + Math.random() * 2.6;
        dustSeed[i] = Math.random() * 100;
      }
      const dustGeo = track(new THREE.BufferGeometry());
      dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
      const dustSprite = canvasTexture(32, 32, (g) => {
        const r = g.createRadialGradient(16, 16, 0, 16, 16, 16);
        r.addColorStop(0, 'rgba(255,240,210,1)'); r.addColorStop(1, 'rgba(255,240,210,0)');
        g.fillStyle = r; g.fillRect(0, 0, 32, 32);
      });
      const dustMat = track(new THREE.PointsMaterial({
        size: 0.06, map: dustSprite, transparent: true, opacity: 0.75,
        depthWrite: false, blending: THREE.AdditiveBlending,
      }));
      const dust = new THREE.Points(dustGeo, dustMat);
      diorama.add(dust);

      // Contact shadow under the floating plinth
      const shadowTex = canvasTexture(256, 256, (g) => {
        const r = g.createRadialGradient(128, 128, 10, 128, 128, 128);
        r.addColorStop(0, 'rgba(0,0,0,0.55)'); r.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = r; g.fillRect(0, 0, 256, 256);
      });
      const groundShadow = new THREE.Mesh(
        track(new THREE.PlaneGeometry(11, 11)),
        track(new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false })),
      );
      groundShadow.rotation.x = -Math.PI / 2;
      groundShadow.position.y = -1.35;
      scene.add(groundShadow);

      diorama.rotation.y = -0.12;

      // ── Interaction & animation ───────────────────────────────────────────
      const pointer = { x: 0, y: 0 };
      const eased = { x: 0, y: 0 };
      const onPointer = (e: PointerEvent) => {
        const r = container.getBoundingClientRect();
        pointer.x = ((e.clientX - r.left) / r.width) * 2 - 1;
        pointer.y = ((e.clientY - r.top) / r.height) * 2 - 1;
      };
      window.addEventListener('pointermove', onPointer, { passive: true });

      const easeOutBack = (t: number) => {
        const c1 = 1.5, c3 = c1 + 1;
        return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
      };
      const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

      // Elapsed time excluding time spent in a hidden tab, so the intro doesn't skip.
      let elapsed = 0;
      let last = performance.now();
      let rafId = 0;
      let running = true;

      const frame = () => {
        const now = performance.now();
        elapsed += Math.min(now - last, 100) / 1000;
        last = now;
        const t = elapsed;

        // Intro: room rises, then each piece drops into place.
        const introT = reduceMotion ? 1 : Math.min(t / 1.1, 1);
        diorama.position.y = -0.4 * (1 - easeOutCubic(introT)) + (reduceMotion ? 0 : Math.sin(t * 0.8) * 0.06);
        for (const p of pieces) {
          const k = reduceMotion ? 1 : Math.min(Math.max((t - 0.5 - p.delay) / 0.7, 0), 1);
          const e = easeOutBack(k);
          p.obj.position.y = p.restY + (1 - k) * 1.6;
          p.obj.scale.setScalar(p.obj === tallPlant ? 1.1 * Math.max(e, 0.001)
            : p.obj === smallPlant ? 0.42 * Math.max(e, 0.001) : Math.max(e, 0.001));
        }

        // Idle sway + lean toward the pointer
        eased.x += (pointer.x - eased.x) * 0.04;
        eased.y += (pointer.y - eased.y) * 0.04;
        const sway = reduceMotion ? 0 : Math.sin(t * 0.25) * 0.12;
        diorama.rotation.y = -0.12 + sway + eased.x * 0.18;
        camera.position.set(camBase.x, camBase.y - eased.y * 0.8, camBase.z);
        camera.lookAt(lookAt);

        // Living light: lamp breathes, dust drifts
        lamp.intensity = 6 + Math.sin(t * 2.1) * 0.25;
        if (!reduceMotion) {
          const pos = dustGeo.attributes.position.array as Float32Array;
          for (let i = 0; i < DUST; i++) {
            pos[i * 3 + 1] += 0.0016 + Math.sin(t + dustSeed[i]) * 0.0008;
            pos[i * 3] += Math.cos(t * 0.5 + dustSeed[i]) * 0.0009;
            if (pos[i * 3 + 1] > 3.1) pos[i * 3 + 1] = 0.2;
          }
          dustGeo.attributes.position.needsUpdate = true;
          dustMat.opacity = 0.55 + Math.sin(t * 0.7) * 0.2;
        }

        renderer.render(scene, camera);
      };

      const loop = () => {
        if (!running) return;
        frame();
        rafId = requestAnimationFrame(loop);
      };
      if (reduceMotion) frame(); else loop();

      const onVisibility = () => {
        if (reduceMotion) return;
        if (document.hidden) { running = false; cancelAnimationFrame(rafId); }
        else if (!running) { running = true; last = performance.now(); loop(); }
      };
      document.addEventListener('visibilitychange', onVisibility);

      const resizeObserver = new ResizeObserver((entries) => {
        const r = entries[0]?.contentRect;
        if (!r || r.width === 0 || r.height === 0) return;
        width = r.width; height = r.height;
        renderer.setSize(width, height);
        camera.aspect = width / height;
        // Keep the whole diorama in frame on narrow panels.
        camera.zoom = (width / height < 1 ? 0.72 + 0.28 * (width / height) : 1) * 0.88;
        camera.updateProjectionMatrix();
        if (reduceMotion) frame();
      });
      resizeObserver.observe(container);

      cleanup = () => {
        running = false;
        cancelAnimationFrame(rafId);
        resizeObserver.disconnect();
        window.removeEventListener('pointermove', onPointer);
        document.removeEventListener('visibilitychange', onVisibility);
        if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
        scene.traverse((obj) => {
          if (obj instanceof THREE.Mesh) {
            obj.geometry.dispose();
            const m = obj.material;
            if (Array.isArray(m)) m.forEach((x) => x.dispose()); else m.dispose();
          }
        });
        disposables.forEach((d) => d.dispose());
        renderer.dispose();
      };
    };

    // Only start once the panel is actually visible (it's hidden on mobile).
    // Checked directly as well as via ResizeObserver: a re-observed element
    // doesn't always get an initial callback (React dev double-mount).
    let started = false;
    const tryStart = () => {
      if (started || destroyed) return;
      if (container.clientWidth > 0 && container.clientHeight > 0) {
        started = true;
        gate.disconnect();
        void start();
      }
    };
    const gate = new ResizeObserver(tryStart);
    gate.observe(container);
    const firstCheck = requestAnimationFrame(tryStart);

    return () => {
      destroyed = true;
      cancelAnimationFrame(firstCheck);
      gate.disconnect();
      cleanup?.();
    };
  }, []);

  return <div ref={containerRef} className="login-scene3d" aria-hidden="true" />;
}
