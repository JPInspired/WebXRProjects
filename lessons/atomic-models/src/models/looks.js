import * as THREE from 'three';

// How the particles look: glossy balls (like a polished model kit), soft glows, and fading orbit trails.

let dot = null;
/** A soft round glow (white in the middle, fading to nothing), for halos and cloud dots. */
export function softDot() {
  if (dot) return dot;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, 'rgba(255,255,255,1)');
  r.addColorStop(0.3, 'rgba(255,255,255,0.55)');
  r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r;
  g.fillRect(0, 0, 64, 64);
  dot = new THREE.CanvasTexture(c);
  return dot;
}

/** A glossy ball material (atoms, protons, neutrons). */
export const glossy = (color, extra = {}) => new THREE.MeshPhysicalMaterial({
  color, roughness: 0.32, metalness: 0, clearcoat: 0.9, clearcoatRoughness: 0.12, envMapIntensity: 0.8, ...extra,
});

/** A glowing halo sprite (it cannot be picked: picking goes to the particle itself). */
export function halo(color, size, opacity = 0.7) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDot(), color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  s.scale.setScalar(size);
  s.raycast = () => {};
  return s;
}

/**
 * A fading trail behind an electron on a circular orbit of radius r (in the orbit's plane), from angle `a`
 * back through `length` radians: bright at the electron, fading to nothing.
 */
export function trail(r, a, length, color, width = 0.0022) {
  const pts = [];
  const n = 40;
  for (let i = 0; i <= n; i++) {
    const t = a - (i / n) * length;
    pts.push(new THREE.Vector3(Math.cos(t) * r, Math.sin(t) * r, 0));
  }
  const radial = 6;
  const geo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), n, width, radial, false);
  const col = new THREE.Color(color);
  const colors = [];
  for (let i = 0; i <= n; i++) {
    const k = (1 - i / n) ** 1.6; // additive: fading to black = fading away
    for (let j = 0; j <= radial; j++) colors.push(col.r * k, col.g * k, col.b * k);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  m.raycast = () => {};
  return m;
}
