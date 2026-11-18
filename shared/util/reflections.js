import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

/**
 * Soft studio reflections for a lesson's scene, so metal, glass and glossy surfaces look real (a bright room
 * reflected in them). Made once in code, nothing downloaded. Materials can tone it down with envMapIntensity.
 */
export function studioReflections(app) {
  const pmrem = new THREE.PMREMGenerator(app.renderer);
  app.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
}
