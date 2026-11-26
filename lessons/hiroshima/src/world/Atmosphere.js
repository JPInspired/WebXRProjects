import * as THREE from 'three';

// The sky, the sun, the haze and the light for each moment. One set of numbers per moment (LOOKS); the 8:15
// sequence blends between them and adds its own (see Blast.js) through `mix` and `apply`.

const sunDir = (azimuthDeg, elevationDeg) => {
  // azimuth from north, clockwise (x is east, −z is north)
  const a = THREE.MathUtils.degToRad(azimuthDeg), e = THREE.MathUtils.degToRad(elevationDeg);
  return new THREE.Vector3(Math.sin(a) * Math.cos(e), Math.sin(e), -Math.cos(a) * Math.cos(e));
};

export const LOOKS = {
  // 8:00 on a clear August morning: the sun low in the east
  before: { top: 0x3f7fc6, horizon: 0xc9dceb, fog: 0xc9d8e2, fogDensity: 0.00045, sun: sunDir(88, 32), sunColor: 0xfff1d8, sunPower: 2.6, hemiSky: 0xcfe4ff, hemiGround: 0x8a7b66, hemiPower: 1.5, ground: 1.05, waterDeep: 0x2c4a52, waterSky: 0x9fbfd6, sunDisc: 1 },
  // the same afternoon: smoke over everything, a dim orange sun
  after: { top: 0x3b302b, horizon: 0x9b6f4d, fog: 0x7c624e, fogDensity: 0.0036, sun: sunDir(250, 38), sunColor: 0xffb26a, sunPower: 1.4, hemiSky: 0xb38a68, hemiGround: 0x3a2f28, hemiPower: 1.15, ground: 0.8, waterDeep: 0x2a2420, waterSky: 0x7a5a44, sunDisc: 0.6 },
  // 1958: a fine day
  rebuilt: { top: 0x4a86c4, horizon: 0xd3e1ea, fog: 0xd0dbe2, fogDensity: 0.0005, sun: sunDir(140, 52), sunColor: 0xfff4e0, sunPower: 2.7, hemiSky: 0xd6e8ff, hemiGround: 0x8f8a78, hemiPower: 1.5, ground: 1.05, waterDeep: 0x2d5560, waterSky: 0xa9c8dc, sunDisc: 1 },
  // today: bright and clear
  today: { top: 0x3c7fd0, horizon: 0xd9e6ef, fog: 0xd4e0e8, fogDensity: 0.00035, sun: sunDir(160, 58), sunColor: 0xffffff, sunPower: 2.8, hemiSky: 0xdcecff, hemiGround: 0x8b8a80, hemiPower: 1.55, ground: 1.08, waterDeep: 0x2b5966, waterSky: 0xb4d0e2, sunDisc: 1 },
};
LOOKS.blast = LOOKS.before;

const KEYS_COLOR = ['top', 'horizon', 'fog', 'sunColor', 'hemiSky', 'hemiGround', 'waterDeep', 'waterSky'];
const KEYS_NUM = ['fogDensity', 'sunPower', 'hemiPower', 'ground', 'sunDisc'];

export class Atmosphere {
  constructor(app) {
    this.app = app;
    const scene = app.scene;
    // the lesson's own lights (the shared ones are dimmed out: see main.js)
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1.5);
    this.sun = new THREE.DirectionalLight(0xffffff, 2.5);
    this.flashLight = new THREE.PointLight(0xfff6e0, 0, 0, 0); // the fireball's light (decay 0: it lights the whole city)
    scene.add(this.hemi, this.sun, this.sun.target, this.flashLight);
    scene.fog = new THREE.FogExp2(0xffffff, 0.0005);
    this.sky = new THREE.Mesh(
      new THREE.SphereGeometry(30000, 32, 16),
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: { top: { value: new THREE.Color() }, horizon: { value: new THREE.Color() }, sunDir: { value: new THREE.Vector3() }, sunColor: { value: new THREE.Color() }, sunDisc: { value: 1 } },
        vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }',
        fragmentShader: `uniform vec3 top; uniform vec3 horizon; uniform vec3 sunDir; uniform vec3 sunColor; uniform float sunDisc; varying vec3 vD;
          void main(){
            vec3 d = normalize(vD);
            float h = clamp(d.y, -0.2, 1.0);
            vec3 col = mix(horizon, top, pow(max(h, 0.0), 0.55));
            col = mix(col, horizon * 0.85, smoothstep(0.0, -0.2, h));
            float s = max(dot(d, normalize(sunDir)), 0.0);
            col += sunColor * (smoothstep(0.99985, 0.99995, s) * 4.0 * sunDisc + pow(s, 600.0) * 0.6 * sunDisc + pow(s, 12.0) * 0.2);
            gl_FragColor = vec4(col, 1.0);
            #include <colorspace_fragment>
          }`,
      }),
    );
    this.sky.renderOrder = -10;
    this.sky.frustumCulled = false;
    scene.add(this.sky);
    this.now = cloneLook(LOOKS.before);
  }

  /** Jump to a moment's look. */
  set(era) {
    this.now = cloneLook(LOOKS[era]);
    this.apply();
  }

  /** Blend from look a to look b (0..1) into the current look. */
  mix(a, b, k) {
    const A = typeof a === 'string' ? LOOKS[a] : a, B = typeof b === 'string' ? LOOKS[b] : b;
    for (const key of KEYS_COLOR) this.now[key].copy(new THREE.Color(A[key])).lerp(new THREE.Color(B[key]), k);
    for (const key of KEYS_NUM) this.now[key] = A[key] + (B[key] - A[key]) * k;
    this.now.sun.copy(A.sun).lerp(B.sun, k).normalize();
  }

  /** Push the current look into the sky, lights, fog, ground and water. */
  apply() {
    const L = this.now;
    const u = this.sky.material.uniforms;
    u.top.value.copy(L.top);
    u.horizon.value.copy(L.horizon);
    u.sunDir.value.copy(L.sun);
    u.sunColor.value.copy(L.sunColor);
    u.sunDisc.value = L.sunDisc;
    this.hemi.color.copy(L.hemiSky);
    this.hemi.groundColor.copy(L.hemiGround);
    this.hemi.intensity = L.hemiPower;
    this.sun.color.copy(L.sunColor);
    this.sun.intensity = L.sunPower;
    this.app.scene.fog.color.copy(L.fog);
    this.app.scene.fog.density = L.fogDensity;
    const city = this.app.city;
    if (city) {
      const w = city.water.uniforms;
      w.deep.value.copy(L.waterDeep);
      w.sky.value.copy(L.waterSky);
      w.fogColor.value.copy(L.fog);
      w.fogDensity.value = L.fogDensity;
      const g = city.current?.ground?.material?.uniforms;
      if (g) {
        // the ground is not lit by three.js: give it the sun and sky's light by hand
        const lit = Math.max(0.15, L.sun.y) * L.sunPower * 0.32 + L.hemiPower * 0.42;
        g.light.value.copy(L.sunColor).multiplyScalar(lit * L.ground * 0.5).add(new THREE.Color(L.hemiSky).multiplyScalar(0.25 * L.ground));
        g.fogColor.value.copy(L.fog);
        g.fogDensity.value = L.fogDensity;
      }
    }
  }

  /** Follow the viewer: the sky is always round you, and the sun lights the area you are in. */
  update(viewer) {
    this.sky.position.copy(viewer);
    this.sun.position.copy(viewer).addScaledVector(this.now.sun, 200);
    this.sun.target.position.copy(viewer);
  }
}

function cloneLook(L) {
  const out = { sun: L.sun.clone() };
  for (const key of KEYS_COLOR) out[key] = new THREE.Color(L[key]);
  for (const key of KEYS_NUM) out[key] = L[key];
  return out;
}
