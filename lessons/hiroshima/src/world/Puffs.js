import * as THREE from 'three';
import { puffTexture } from './textures.js';

// Soft puffs that always face you (smoke, dust, the cloud, flames), drawn as one instanced mesh per set:
// each puff has a position, a size, a colour, an opacity and a turn. Facing you is done in the shader, so it
// stays right for both eyes in the headset.

let texture = null;

export class Puffs {
  /** max: how many puffs; additive: glowing (flames, the fireball's light) rather than smoky. */
  constructor(max, { additive = false, fog = true } = {}) {
    texture ??= puffTexture();
    const geo = new THREE.InstancedBufferGeometry();
    const base = new THREE.PlaneGeometry(1, 1);
    geo.index = base.index;
    geo.setAttribute('position', base.attributes.position);
    geo.setAttribute('uv', base.attributes.uv);
    this.offset = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3);
    this.size = new THREE.InstancedBufferAttribute(new Float32Array(max), 1);
    this.color = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3);
    this.alpha = new THREE.InstancedBufferAttribute(new Float32Array(max), 1);
    this.turn = new THREE.InstancedBufferAttribute(new Float32Array(max), 1);
    for (const a of [this.offset, this.size, this.color, this.alpha, this.turn]) a.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('offset', this.offset);
    geo.setAttribute('size', this.size);
    geo.setAttribute('pcolor', this.color);
    geo.setAttribute('palpha', this.alpha);
    geo.setAttribute('turn', this.turn);
    geo.instanceCount = 0;
    this.max = max;
    this.material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      uniforms: { map: { value: texture }, fogColor: { value: new THREE.Color() }, fogDensity: { value: fog ? 0.0005 : 0 } },
      vertexShader: `attribute vec3 offset; attribute float size; attribute vec3 pcolor; attribute float palpha; attribute float turn;
        varying vec2 vUv; varying vec3 vColor; varying float vAlpha; varying float vD;
        void main(){
          vUv = uv; vColor = pcolor; vAlpha = palpha;
          vec4 mv = modelViewMatrix * vec4(offset, 1.0);
          float c = cos(turn), s = sin(turn);
          mv.xy += mat2(c, s, -s, c) * position.xy * size;
          vD = -mv.z;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `uniform sampler2D map; uniform vec3 fogColor; uniform float fogDensity;
        varying vec2 vUv; varying vec3 vColor; varying float vAlpha; varying float vD;
        void main(){
          vec4 t = texture2D(map, vUv);
          float f = 1.0 - exp(-fogDensity * fogDensity * vD * vD);
          vec3 col = mix(vColor, fogColor, f * 0.85);
          gl_FragColor = vec4(col, t.a * vAlpha * 2.2);
          #include <colorspace_fragment>
        }`,
    });
    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = additive ? 6 : 5;
    this.count = 0;
  }

  clear() {
    this.count = 0;
  }

  /** Add (or, with i, overwrite) a puff. color: a THREE.Color or [r, g, b] in 0..1. */
  set(i, x, y, z, size, color, alpha, turn = 0) {
    this.offset.setXYZ(i, x, y, z);
    this.size.setX(i, size);
    if (color.isColor) this.color.setXYZ(i, color.r, color.g, color.b);
    else this.color.setXYZ(i, color[0], color[1], color[2]);
    this.alpha.setX(i, alpha);
    this.turn.setX(i, turn);
  }

  add(...args) {
    if (this.count >= this.max) return -1;
    this.set(this.count, ...args);
    return this.count++;
  }

  /** Call after changing puffs. */
  commit() {
    this.mesh.geometry.instanceCount = this.count;
    for (const a of [this.offset, this.size, this.color, this.alpha, this.turn]) a.needsUpdate = true;
  }

  fog(color, density) {
    this.material.uniforms.fogColor.value.copy(color);
    this.material.uniforms.fogDensity.value = density;
  }
}
