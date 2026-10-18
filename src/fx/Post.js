import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

// Vignette + subtle grade, applied before tone mapping output.
const GradeShader = {
  uniforms: { tDiffuse: { value: null }, uVignette: { value: 0.32 }, uTint: { value: new THREE.Vector3(1.03, 0.99, 1.04) }, uDamage: { value: 0 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uVignette; uniform vec3 uTint; uniform float uDamage; varying vec2 vUv;
    void main(){ vec4 c = texture2D(tDiffuse, vUv); vec2 d = vUv - 0.5; float v = 1.0 - dot(d, d) * uVignette * 2.4;
      c.rgb *= uTint * clamp(v, 0.0, 1.0);
      c.rgb = mix(c.rgb, c.rgb * vec3(1.4, 0.6, 0.5), uDamage * smoothstep(0.15, 0.6, length(d)));
      gl_FragColor = c; }`,
};

/**
 * Post stack: scene -> (bloom) -> vignette/grade -> output (tone mapping + sRGB).
 * The scene ALWAYS renders into the composer's target, in both quality modes: rendering straight to the
 * canvas instead changes every material's shader variant (tone mapping / output colour space move into
 * the material), and switching recompiles them all — a multi-second freeze.  Low quality just drops the
 * bloom pass and MSAA.
 */
export class Post {
  constructor(renderer, scene, camera, hq = true) {
    this.renderer = renderer;
    this.enabled = true;
    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    const rt = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: hq ? 2 : 0 });
    this.composer = new EffectComposer(renderer, rt);
    this.renderPass = new RenderPass(scene, camera);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(size.x / 4, size.y / 4), 0.55, 0.45, 0.9);
    this.grade = new ShaderPass(GradeShader);
    this.output = new OutputPass();
    this.composer.addPass(this.renderPass);
    this.composer.addPass(this.bloom);
    this.composer.addPass(this.grade);
    this.composer.addPass(this.output);
    this.setHQ(hq);
  }

  /** High quality = bloom + 2x MSAA; low = neither.  No shader recompiles either way. */
  setHQ(hq) {
    this.hq = hq;
    this.bloom.enabled = hq;
    const samples = hq ? 2 : 0;
    for (const t of [this.composer.renderTarget1, this.composer.renderTarget2]) {
      if (t && t.samples !== samples) { t.samples = samples; t.dispose(); }
    }
  }

  /** The render target the scene is drawn into (bind it while pre-compiling shaders). */
  get sceneTarget() { return this.composer.renderTarget1; }

  setScene(scene, camera) { this.renderPass.scene = scene; this.renderPass.camera = camera; }

  setSize(w, h) {
    this.composer.setPixelRatio(this.renderer.getPixelRatio());
    this.composer.setSize(w, h);
  }

  render(scene, camera, dt) {
    this.renderPass.scene = scene;
    this.renderPass.camera = camera;
    this.composer.render(dt);
  }
}
