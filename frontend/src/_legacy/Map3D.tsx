import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { hazardColor } from "./Map2D";
import { CityWeather, StormCell } from "../lib/weatherEngine";

interface Props {
  cities: CityWeather[];
  cells: StormCell[];
  selectedCellId: string | null;
  onPickCell: (c: StormCell) => void;
  focusLonLat?: [number, number] | null;
}

/**
 * 3D atmospheric volume view.
 *
 * A local ENU (east / north / up) scene rather than a whole globe — India spans
 * only ~8% of a sphere, so a global globe crams every city into a few pixels.
 * Here latitude/longitude map 1:1 to scene units, which makes storm structure
 * genuinely readable:
 *
 *   • extruded convective towers — height ∝ reflectivity, colour ∝ severity
 *   • lightning filaments inside cores above 48 dBZ
 *   • ground footprint discs + steering arrows
 *   • city pins — height ∝ hazard score, halos on high-risk cities
 *   • lat/lon graticule plate with a horizon glow
 */

const DEG = Math.PI / 180;
const LIFT = 1.9; // scene units per dBZ block, tuned for legibility

export function Map3D({ cities, cells, selectedCellId, onPickCell, focusLonLat }: Props) {
  const mount = useRef<HTMLDivElement | null>(null);
  const scene3d = useRef<{
    rot: THREE.Group;
    cityGrp: THREE.Group;
    cellGrp: THREE.Group;
    gridGrp: THREE.Group;
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    controls: OrbitControls;
    raf: number;
    resize: () => void;
    down: (e: PointerEvent) => void;
    up: (e: PointerEvent) => void;
  } | null>(null);

  const cellData = useRef(cells);
  const cb = useRef(onPickCell);
  cellData.current = cells;
  cb.current = onPickCell;

  // ── local projection domain ────────────────────────────────────────────
  const domain = useMemo(() => {
    const pts = cities.length ? cities : [{ lat: 22, lon: 79 }];
    const lats = pts.map((p) => p.lat);
    const lons = pts.map((p) => p.lon);
    const cy = (Math.min(...lats) + Math.max(...lats)) / 2;
    const cx = (Math.min(...lons) + Math.max(...lons)) / 2;
    const spanLat = Math.max(4, Math.max(...lats) - Math.min(...lats));
    const spanLon = Math.max(4, Math.max(...lons) - Math.min(...lons));
    const kx = Math.cos(cy * DEG);
    return {
      cy,
      cx,
      halfY: spanLat / 2 + 1.5,
      halfX: (spanLon / 2 + 1.5) / Math.max(kx, 0.25),
      kx,
    };
  }, [cities]);

  /** lat/lon → local scene coordinates (1° ≈ 1 unit) */
  const toLocal = (lat: number, lon: number): [number, number] => [
    (lon - domain.cx) * domain.kx,
    -(lat - domain.cy),
  ];

  // ── bootstrap scene once ───────────────────────────────────────────────
  useEffect(() => {
    const host = mount.current;
    if (!host) return;

    const w = host.clientWidth || 800;
    const h = host.clientHeight || 600;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.setSize(w, h);
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x06080d, 0.006);

    const camera = new THREE.PerspectiveCamera(42, w / h, 0.1, 900);
    const R = Math.max(domain.halfX, domain.halfY);
    const fit = () => {
      camera.position.set(0, R * 2.7, R * 3.9);
      camera.lookAt(0, R * 0.38, 0);
    };
    fit();

    const rot = new THREE.Group();
    scene.add(rot);

    // ── ground plate ──────────────────────────────────────────────────────
    const plate = new THREE.Mesh(
      new THREE.PlaneGeometry(domain.halfX * 2, domain.halfY * 2),
      new THREE.MeshBasicMaterial({ color: 0x0a1626, transparent: true, opacity: 0.55 })
    );
    plate.rotation.x = -Math.PI / 2;
    plate.position.y = -0.02;
    rot.add(plate);

    // graticule
    const gridGrp = new THREE.Group();
    const gridMat = new THREE.LineBasicMaterial({ color: 0x4cc9f0, transparent: true, opacity: 0.16 });
    const gridMatMajor = new THREE.LineBasicMaterial({ color: 0x4cc9f0, transparent: true, opacity: 0.3 });
    for (let x = -Math.ceil(domain.halfX); x <= Math.ceil(domain.halfX); x++) {
      const major = x % 5 === 0;
      const g = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(x, 0, -domain.halfY),
        new THREE.Vector3(x, 0, domain.halfY),
      ]);
      gridGrp.add(new THREE.Line(g, major ? gridMatMajor : gridMat));
    }
    for (let y = -Math.ceil(domain.halfY); y <= Math.ceil(domain.halfY); y++) {
      const major = y % 5 === 0;
      const g = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-domain.halfX, 0, y),
        new THREE.Vector3(domain.halfX, 0, y),
      ]);
      gridGrp.add(new THREE.Line(g, major ? gridMatMajor : gridMat));
    }
    rot.add(gridGrp);

    // domain border
    const border = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-domain.halfX, 0.05, -domain.halfY),
        new THREE.Vector3(domain.halfX, 0.05, -domain.halfY),
        new THREE.Vector3(domain.halfX, 0.05, domain.halfY),
        new THREE.Vector3(-domain.halfX, 0.05, domain.halfY),
        new THREE.Vector3(-domain.halfX, 0.05, -domain.halfY),
      ]),
      new THREE.LineBasicMaterial({ color: 0x4cc9f0, transparent: true, opacity: 0.45 })
    );
    rot.add(border);

    const cityGrp = new THREE.Group();
    const cellGrp = new THREE.Group();
    rot.add(cityGrp, cellGrp);

    // ── lighting ──────────────────────────────────────────────────────────
    scene.add(new THREE.AmbientLight(0x35506e, 2.0));
    const key = new THREE.DirectionalLight(0xbfe6ff, 1.5);
    key.position.set(18, 26, 14);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0x4cc9f0, 0.7);
    fill.position.set(-16, 10, -12);
    scene.add(fill);

    // ── skybox stars ──────────────────────────────────────────────────────
    const starCount = 700;
    const stars = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const r = 200 + Math.random() * 120;
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(2 * Math.random() - 1);
      stars[i * 3] = r * Math.sin(ph) * Math.cos(th);
      stars[i * 3 + 1] = r * Math.cos(ph);
      stars[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th);
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute("position", new THREE.BufferAttribute(stars, 3));
    scene.add(
      new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xa8d8ff, size: 1.1, transparent: true, opacity: 0.55 }))
    );

    // horizon glow ring
    const glowPts: THREE.Vector3[] = [];
    const gr = Math.max(domain.halfX, domain.halfY) * 1.55;
    for (let a = 0; a <= 360; a += 3) {
      const t = a * DEG;
      glowPts.push(new THREE.Vector3(Math.sin(t) * gr, 0, Math.cos(t) * gr));
    }
    scene.add(
      new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(glowPts),
        new THREE.LineBasicMaterial({ color: 0x4cc9f0, transparent: true, opacity: 0.22 })
      )
    );

    // ── controls ──────────────────────────────────────────────────────────
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.07;
    controls.target.set(0, R * 0.38, 0);
    controls.minDistance = 8;
    controls.maxDistance = R * 14;
    controls.maxPolarAngle = Math.PI * 0.495; // never dive under the plate

    // ── raycast picking ───────────────────────────────────────────────────
    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    let downX = 0;
    let downY = 0;

    const down = (e: PointerEvent) => {
      downX = e.clientX;
      downY = e.clientY;
    };
    const up = (e: PointerEvent) => {
      if (Math.hypot(e.clientX - downX, e.clientY - downY) > 5) return; // was orbiting
      const r = renderer.domElement.getBoundingClientRect();
      ndc.x = ((e.clientX - r.left) / r.width) * 2 - 1;
      ndc.y = -((e.clientY - r.top) / r.height) * 2 + 1;
      ray.setFromCamera(ndc, camera);
      const hits = ray.intersectObjects(cellGrp.children, true);
      for (const hit of hits) {
        let p: THREE.Object3D | null = hit.object;
        while (p) {
          const fn = (p.userData as Record<string, unknown>).onPick;
          if (typeof fn === "function") {
            (fn as () => void)();
            return;
          }
          p = p.parent;
        }
      }
    };
    renderer.domElement.addEventListener("pointerdown", down);
    renderer.domElement.addEventListener("pointerup", up);

    // ── loop ──────────────────────────────────────────────────────────────
    const clock = new THREE.Clock();
    let raf = 0;
    const loop = () => {
      const dt = clock.getDelta();
      for (const child of cellGrp.children) {
        const cd = child.userData as { spin?: boolean; cap?: THREE.Mesh };
        if (cd.spin) child.rotation.y += dt * 0.9;
        if (cd.cap) cd.cap.rotation.y += dt * 1.7;
      }
      controls.update();
      renderer.render(scene, camera);
      raf = requestAnimationFrame(loop);
    };
    loop();

    const resize = () => {
      const nw = host.clientWidth || w;
      const nh = host.clientHeight || h;
      camera.aspect = nw / nh;
      camera.updateProjectionMatrix();
      renderer.setSize(nw, nh);
    };
    window.addEventListener("resize", resize);

    scene3d.current = { rot, cityGrp, cellGrp, gridGrp, renderer, scene, camera, controls, raf, resize, down, up };

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      renderer.domElement.removeEventListener("pointerdown", down);
      renderer.domElement.removeEventListener("pointerup", up);
      controls.dispose();
      disposeTree(scene);
      renderer.dispose();
      renderer.domElement.remove();
      scene3d.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── storm towers ───────────────────────────────────────────────────────
  useEffect(() => {
    const g = scene3d.current?.cellGrp;
    if (!g) return;
    disposeTree(g);
    g.clear();

    const R = Math.max(domain.halfX, domain.halfY);

    cells.forEach((c) => {
      const sevLabel =
        c.severity === "CRITICAL" ? "EXTREME" : c.severity === "HIGH" ? "SEVERE" : c.severity === "MODERATE" ? "WARNING" : "WATCH";
      const col = new THREE.Color(hazardColor(sevLabel as "EXTREME" | "SEVERE" | "WARNING" | "WATCH"));
      const [x, z] = toLocal(c.lat, c.lon);
      // tower height scaled to the domain so the scene stays readable at any zoom
      const hMax = Math.max(9, Math.min(20, R * 0.85));
      const h = 1.6 + (c.maxDbz / 70) * hMax;
      const radius = Math.max(0.5, Math.sqrt(c.areaKm2) / 55);

      const tower = new THREE.Group();
      tower.position.set(x, 0, z);
      tower.userData.spin = true;

      // stacked translucent discs → reads as a volumetric convective tower
      const discGeo = new THREE.CircleGeometry(radius, 30);
      const steps = 20;
      for (let i = 0; i < steps; i++) {
        const t = i / (steps - 1);
        const taper = Math.sin(t * Math.PI * 0.78 + 0.22);
        const d = new THREE.Mesh(
          discGeo,
          new THREE.MeshBasicMaterial({
            color: col,
            transparent: true,
            opacity: 0.2 * taper + 0.03,
            side: THREE.DoubleSide,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
          })
        );
        d.rotation.x = -Math.PI / 2;
        d.position.y = 0.25 + t * h;
        d.scale.setScalar(0.4 + taper * 0.62);
        tower.add(d);
      }

      // core shaft
      const shaft = new THREE.Mesh(
        new THREE.CylinderGeometry(radius * 0.16, radius * 0.34, h, 12, 1, true),
        new THREE.MeshBasicMaterial({
          color: col, transparent: true, opacity: 0.5, side: THREE.DoubleSide,
          depthWrite: false, blending: THREE.AdditiveBlending,
        })
      );
      shaft.position.y = h / 2;
      tower.add(shaft);

      // overshooting cloud-top cap
      const cap = new THREE.Mesh(
        new THREE.SphereGeometry(radius * 0.95, 22, 16),
        new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false })
      );
      cap.position.y = h + radius * 0.3;
      cap.scale.y = 0.55;
      tower.add(cap);
      tower.userData.cap = cap;

      // lightning filaments
      if (c.maxDbz >= 48) {
        const nFil = c.maxDbz >= 56 ? 4 : 2;
        for (let b = 0; b < nFil; b++) {
          const bx = (Math.random() - 0.5) * radius;
          const bz = (Math.random() - 0.5) * radius;
          const pts: THREE.Vector3[] = [];
          const jag = 7;
          for (let s = 0; s <= jag; s++) {
            pts.push(
              new THREE.Vector3(
                bx + (Math.random() - 0.5) * radius * 0.7,
                0.2 + (s / jag) * h * 0.94,
                bz + (Math.random() - 0.5) * radius * 0.7
              )
            );
          }
          tower.add(
            new THREE.Line(
              new THREE.BufferGeometry().setFromPoints(pts),
              new THREE.LineBasicMaterial({ color: 0xe8f6ff, transparent: true, opacity: 0.8 })
            )
          );
        }
      }

      // ground footprint
      const ringPts: THREE.Vector3[] = [];
      for (let a = 0; a <= 360; a += 6) {
        const t = a * DEG;
        ringPts.push(new THREE.Vector3(Math.sin(t) * radius, 0.08, Math.cos(t) * radius));
      }
      const sel = c.cellId === selectedCellId;
      tower.add(
        new THREE.Line(
          new THREE.BufferGeometry().setFromPoints(ringPts),
          new THREE.LineBasicMaterial({ color: col, transparent: true, opacity: sel ? 1 : 0.62 })
        )
      );

      // steering arrow along the storm's motion vector
      const arrowLen = 1.4 + (c.speedKmph / 80) * 3.4;
      const hd = c.headingDeg * DEG;
      const dir = new THREE.Vector3(Math.sin(hd), 0, -Math.cos(hd));
      const tip = dir.clone().multiplyScalar(arrowLen);
      const side = new THREE.Vector3(-dir.z, 0, dir.x).multiplyScalar(arrowLen * 0.22);
      tower.add(
        new THREE.Line(
          new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(0, 0.12, 0),
            tip,
            tip.clone().add(side.clone().add(dir.clone().multiplyScalar(-arrowLen * 0.3))),
            tip,
            tip.clone().sub(side).add(dir.clone().multiplyScalar(-arrowLen * 0.3)),
          ]),
          new THREE.LineBasicMaterial({ color: col, transparent: true, opacity: 0.85 })
        )
      );

      // fat invisible pick volume
      const hit = new THREE.Mesh(
        new THREE.CylinderGeometry(radius * 1.5, radius * 1.5, h, 8),
        new THREE.MeshBasicMaterial({ visible: false })
      );
      hit.position.y = h / 2;
      tower.add(hit);
      (tower.userData as Record<string, unknown>).onPick = () => {
        const found = cellData.current.find((x) => x.cellId === c.cellId);
        if (found) cb.current(found);
      };

      g.add(tower);
    });
  }, [cells, selectedCellId, domain]);

  // ── city pins ──────────────────────────────────────────────────────────
  useEffect(() => {
    const g = scene3d.current?.cityGrp;
    if (!g) return;
    disposeTree(g);
    g.clear();

    cities.forEach((w) => {
      const col = new THREE.Color(hazardColor(w.hazard));
      const [x, z] = toLocal(w.lat, w.lon);
      const active = w.hazard !== "NONE";
      const h = active ? 0.9 + (w.hazardScore / 100) * 7 : 0.45;

      const pin = new THREE.Group();
      pin.position.set(x, 0, z);

      // stem
      const stem = new THREE.Mesh(
        new THREE.CylinderGeometry(active ? 0.045 : 0.025, active ? 0.06 : 0.03, h, 6),
        new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: active ? 0.95 : 0.5 })
      );
      stem.position.y = h / 2;
      pin.add(stem);

      // head
      const head = new THREE.Mesh(
        new THREE.SphereGeometry(active ? 0.16 : 0.09, 10, 8),
        new THREE.MeshBasicMaterial({ color: col })
      );
      head.position.y = h;
      pin.add(head);

      if (w.hazard === "SEVERE" || w.hazard === "EXTREME") {
        const halo = new THREE.Mesh(
          new THREE.RingGeometry(0.34, 0.46, 26),
          new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false })
        );
        halo.rotation.x = -Math.PI / 2;
        halo.position.y = 0.06;
        pin.add(halo);
      }
      g.add(pin);
    });
  }, [cities, domain]);

  // ── focus camera on a city ─────────────────────────────────────────────
  useEffect(() => {
    const s = scene3d.current;
    if (!s || !focusLonLat) return;
    const [x, z] = toLocal(focusLonLat[1], focusLonLat[0]);
    s.controls.target.set(x, 3, z);
    s.camera.position.set(x + 2, 12, z + 16);
    s.controls.update();
  }, [focusLonLat, domain]);

  return <div ref={mount} style={{ position: "absolute", inset: 0 }} />;
}

function disposeTree(root: THREE.Object3D) {
  root.traverse((o) => {
    const m = o as unknown as THREE.Mesh;
    if (m.geometry) m.geometry.dispose();
    const mat = m.material as THREE.Material | THREE.Material[] | undefined;
    if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
    else if (mat) mat.dispose();
  });
}
