import * as THREE from 'three';

// How the bones and organs look: a wet, glossy surface on the organs (a clear coat, as on a real specimen),
// a little natural colour variation, and soft shadows in the folds (ambient occlusion, baked into the model as
// _AO by tools/organs-model/shade.mjs) so the grooves of the brain, the coils of the intestines and the gaps between
// the bones read clearly. A few organs get their own surface: the lungs' fine mottling, the liver's lobules.

const LOOKS = {
  //        roughness, clear coat, colour variation, fold shadows
  bone: { roughness: 0.62, clearcoat: 0.12, vary: 0.06, ao: 0.85, freq: 22 },
  tissue: { roughness: 0.46, clearcoat: 0.55, vary: 0.08, ao: 0.7, freq: 30 },
  brain: { roughness: 0.5, clearcoat: 0.4, vary: 0.05, ao: 1.0, freq: 40 },
  lung: { roughness: 0.58, clearcoat: 0.35, vary: 0.035, ao: 0.6, freq: 26 },
  liver: { roughness: 0.38, clearcoat: 0.7, vary: 0.07, ao: 0.6, freq: 34 },
};
const KIND = {
  bones: 'bone', ribcage: 'bone', skullcap: 'bone',
  brain: 'brain', lungRight: 'lung', lungLeft: 'lung', liver: 'liver', spleen: 'liver',
};
export const kindOf = (id) => KIND[id] ?? 'tissue';

const NOISE = /* glsl */ `
  float tHash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
  float tNoise(vec3 x) {
    vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(tHash(i), tHash(i + vec3(1, 0, 0)), f.x), mix(tHash(i + vec3(0, 1, 0)), tHash(i + vec3(1, 1, 0)), f.x), f.y),
               mix(mix(tHash(i + vec3(0, 0, 1)), tHash(i + vec3(1, 0, 1)), f.x), mix(tHash(i + vec3(0, 1, 1)), tHash(i + vec3(1, 1, 1)), f.x), f.y), f.z);
  }`;

/** A material for a bone or organ (kind: see kindOf). The geometry may carry _ao (0–1 per vertex). */
export function tissueMaterial(color, kind, hasAO) {
  const L = LOOKS[kind];
  const m = new THREE.MeshPhysicalMaterial({
    color, roughness: L.roughness, metalness: 0, clearcoat: L.clearcoat, clearcoatRoughness: 0.3,
  });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uVary = { value: L.vary };
    sh.uniforms.uAo = { value: L.ao };
    sh.uniforms.uFreq = { value: L.freq };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
        ${hasAO ? 'attribute float _ao;' : ''}
        varying vec3 vObj; varying float vAo;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vObj = position;
        vAo = ${hasAO ? '_ao' : '1.0'};`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform float uVary, uAo, uFreq;
        varying vec3 vObj; varying float vAo;
        float tOcc = 1.0;
        ${NOISE}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        float n = tNoise(vObj * uFreq) * 0.65 + tNoise(vObj * uFreq * 3.1) * 0.35;
        diffuseColor.rgb *= 1.0 + uVary * (n - 0.5) * 2.0;
        ${kind === 'lung' ? `
        // the lungs: a fine net of lobules with darker specks between them
        float ridge = 1.0 - abs(tNoise(vObj * 170.0) * 2.0 - 1.0);
        diffuseColor.rgb *= 1.0 - 0.1 * smoothstep(0.9, 0.98, ridge);
        float speck = smoothstep(0.74, 0.8, tNoise(vObj * 300.0 + 7.0)) * smoothstep(0.25, 0.6, tNoise(vObj * 18.0 + 3.0));
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.3, 0.24, 0.28), 0.55 * speck);` : ''}
        ${kind === 'liver' ? `
        // the liver: tiny lobules
        diffuseColor.rgb *= 1.0 - 0.1 * smoothstep(0.55, 0.75, tNoise(vObj * 180.0));` : ''}
        ${kind === 'bone' ? `
        // bone: warmer and darker in places, like a real (dry) specimen
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.92, 0.84, 0.68), 0.5 * smoothstep(0.45, 0.8, n));` : ''}
        // soft shadows in the folds
        tOcc = mix(1.0, smoothstep(0.0, 0.85, vAo), uAo);
        diffuseColor.rgb *= tOcc;`)
      .replace('#include <lights_physical_fragment>', `#include <lights_physical_fragment>
        // less shine deep in the folds
        material.clearcoat *= tOcc * tOcc;
        material.specularColor *= mix(0.4, 1.0, tOcc);`);
  };
  m.customProgramCacheKey = () => `tissue-${kind}-${hasAO ? 'ao' : ''}`;
  return m;
}
