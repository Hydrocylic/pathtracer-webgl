
import * as THREE from 'three';
import vertShader from '@core/shaders/fullscreen.vert.glsl?raw';
import fragShader from '@core/shaders/pathtrace.frag.glsl?raw';
import compositeFrag from '@core/shaders/composite.frag.glsl?raw';
import type { UniformsTable } from './uniforms';

export interface Passes {

  quad: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  displayScene: THREE.Scene;
  displayCamera: THREE.OrthographicCamera;
  displayQuad: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
}

export function createPasses(scene: THREE.Scene, uniforms: UniformsTable, initialSrcTex: THREE.Texture): Passes {
  const quad = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.ShaderMaterial({
      vertexShader: vertShader,
      fragmentShader: fragShader,
      uniforms,
      glslVersion: THREE.GLSL3,
    }),
  );
  scene.add(quad);

  const displayScene = new THREE.Scene();
  const displayCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const displayQuad = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.ShaderMaterial({
      vertexShader: vertShader,
      fragmentShader: compositeFrag,
      uniforms: {
        uSrcTex: { value: initialSrcTex },
        uDebugMode: uniforms.uDebugMode,
      },
      glslVersion: THREE.GLSL3,
    }),
  );
  displayScene.add(displayQuad);

  return { quad, displayScene, displayCamera, displayQuad };
}
