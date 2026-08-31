import * as THREE from 'three';
import { REDUCED_MOTION } from './config.js';

// Custom HDR pipeline: MSAA scene target in half-float, soft-knee bright pass,
// dual-Kawase blur pyramid, then one composite pass doing additive bloom,
// ACES tone map, color grade, vignette, grain, edge chromatic aberration,
// and manual sRGB encode. Renderer tone mapping stays off so the scene
// renders raw linear HDR into the target.

const VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = position.xy * 0.5 + 0.5;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const BRIGHT_FRAG = /* glsl */ `
  uniform sampler2D uTex;
  uniform float uThreshold;
  uniform float uKnee;
  varying vec2 vUv;
  void main() {
    vec3 c = texture2D(uTex, vUv).rgb;
    // NaN/Inf sanitizer: a comparison with NaN is false, so this resets any
    // poisoned channel before it can smear through the blur pyramid.
    if (!(c.r >= 0.0 && c.r <= 65000.0)) c.r = 0.0;
    if (!(c.g >= 0.0 && c.g <= 65000.0)) c.g = 0.0;
    if (!(c.b >= 0.0 && c.b <= 65000.0)) c.b = 0.0;
    float br = max(c.r, max(c.g, c.b));
    float soft = br - uThreshold + uKnee;
    soft = clamp(soft, 0.0, 2.0 * uKnee);
    soft = soft * soft / (4.0 * uKnee + 1e-4);
    float w = max(soft, br - uThreshold) / max(br, 1e-4);
    gl_FragColor = vec4(c * max(w, 0.0), 1.0);
  }
`;

const DOWN_FRAG = /* glsl */ `
  uniform sampler2D uTex;
  uniform vec2 uTexel;
  varying vec2 vUv;
  void main() {
    vec2 o = uTexel;
    vec3 c = texture2D(uTex, vUv).rgb * 4.0;
    c += texture2D(uTex, vUv + vec2(-o.x, -o.y)).rgb;
    c += texture2D(uTex, vUv + vec2( o.x, -o.y)).rgb;
    c += texture2D(uTex, vUv + vec2(-o.x,  o.y)).rgb;
    c += texture2D(uTex, vUv + vec2( o.x,  o.y)).rgb;
    gl_FragColor = vec4(c / 8.0, 1.0);
  }
`;

const UP_FRAG = /* glsl */ `
  uniform sampler2D uTex;
  uniform sampler2D uAdd;
  uniform vec2 uTexel;
  uniform float uHasAdd;
  varying vec2 vUv;
  void main() {
    vec2 o = uTexel;
    vec3 c = vec3(0.0);
    c += texture2D(uTex, vUv + vec2(-o.x * 2.0, 0.0)).rgb;
    c += texture2D(uTex, vUv + vec2(-o.x,  o.y)).rgb * 2.0;
    c += texture2D(uTex, vUv + vec2(0.0,  o.y * 2.0)).rgb;
    c += texture2D(uTex, vUv + vec2( o.x,  o.y)).rgb * 2.0;
    c += texture2D(uTex, vUv + vec2( o.x * 2.0, 0.0)).rgb;
    c += texture2D(uTex, vUv + vec2( o.x, -o.y)).rgb * 2.0;
    c += texture2D(uTex, vUv + vec2(0.0, -o.y * 2.0)).rgb;
    c += texture2D(uTex, vUv + vec2(-o.x, -o.y)).rgb * 2.0;
    c /= 12.0;
    gl_FragColor = vec4(c + texture2D(uAdd, vUv).rgb * uHasAdd * 0.72, 1.0);
  }
`;

const COMPOSITE_FRAG = /* glsl */ `
  uniform sampler2D uScene;
  uniform sampler2D uBloom;
  uniform float uBloomStrength;
  uniform float uTime;
  uniform float uGrain;
  uniform vec2 uRes;
  varying vec2 vUv;

  vec3 aces(vec3 x) {
    return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
  }
  vec3 srgb(vec3 c) {
    return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
  }
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  void main() {
    vec2 uv = vUv;
    vec2 d = uv - 0.5;
    float r2 = dot(d, d);

    // Edge chromatic aberration, radial and subtle.
    vec2 ca = d * r2 * 0.014;
    vec3 scene;
    scene.r = texture2D(uScene, uv - ca).r;
    scene.g = texture2D(uScene, uv).g;
    scene.b = texture2D(uScene, uv + ca).b;

    vec3 bloom = texture2D(uBloom, uv).rgb;
    vec3 c = scene + bloom * uBloomStrength;

    c *= 1.05;
    c = aces(c);

    // Grade: lift shadows toward deep indigo, warm the highlights.
    float luma = dot(c, vec3(0.2126, 0.7152, 0.0722));
    c += vec3(0.020, 0.026, 0.052) * (1.0 - luma) * 0.9;
    c = mix(c, c * vec3(1.045, 1.01, 0.955), smoothstep(0.55, 1.0, luma) * 0.5);

    float vig = 1.0 - smoothstep(0.18, 0.78, r2) * 0.30;
    c *= vig;

    float g = hash(uv * uRes + vec2(uTime * 60.0, uTime * 37.0));
    c += (g - 0.5) * uGrain;

    gl_FragColor = vec4(srgb(max(c, 0.0)), 1.0);
  }
`;

function makeTarget(w, h, opts = {}) {
  return new THREE.WebGLRenderTarget(Math.max(2, w | 0), Math.max(2, h | 0), {
    type: THREE.HalfFloatType,
    format: THREE.RGBAFormat,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    depthBuffer: opts.depth ?? false,
    samples: opts.samples ?? 0,
    generateMipmaps: false,
  });
}

export class PostPipeline {
  constructor(renderer) {
    this.renderer = renderer;
    this.enabled = true;
    this.bloomStrength = 0.62;
    this.renderScale = 1;
    this.levels = 4;
    this.time = 0;

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
    this._quadGeo = geo;
    this._scene = new THREE.Scene();
    this._cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this._mesh = new THREE.Mesh(geo, null);
    this._mesh.frustumCulled = false;
    this._scene.add(this._mesh);

    const mat = (frag, uniforms) => new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: frag, uniforms, depthTest: false, depthWrite: false,
    });

    this.brightMat = mat(BRIGHT_FRAG, {
      uTex: { value: null }, uThreshold: { value: 1.22 }, uKnee: { value: 0.5 },
    });
    this.downMat = mat(DOWN_FRAG, { uTex: { value: null }, uTexel: { value: new THREE.Vector2() } });
    this.upMat = mat(UP_FRAG, {
      uTex: { value: null }, uAdd: { value: null }, uTexel: { value: new THREE.Vector2() }, uHasAdd: { value: 0 },
    });
    this.compositeMat = mat(COMPOSITE_FRAG, {
      uScene: { value: null }, uBloom: { value: null },
      uBloomStrength: { value: this.bloomStrength },
      uTime: { value: 0 }, uGrain: { value: 0.028 },
      uRes: { value: new THREE.Vector2(1, 1) },
    });

    this.rtScene = null;
    this.down = [];
    this.up = [];
    this._w = 2; this._h = 2;
  }

  setSize(w, h, pixelRatio) {
    const pw = Math.round(w * pixelRatio * this.renderScale);
    const ph = Math.round(h * pixelRatio * this.renderScale);
    if (pw === this._w && ph === this._h && this.rtScene) return;
    this._w = pw; this._h = ph;

    this.dispose(false);
    this.rtScene = makeTarget(pw, ph, { depth: true, samples: 4 });
    this.down = [];
    this.up = [];
    let bw = pw >> 1, bh = ph >> 1;
    for (let i = 0; i < this.levels; i++) {
      this.down.push(makeTarget(bw, bh));
      if (i < this.levels - 1) this.up.push(makeTarget(bw, bh));
      bw >>= 1; bh >>= 1;
    }
    this.compositeMat.uniforms.uRes.value.set(pw, ph);
  }

  render(scene, camera, dt) {
    const r = this.renderer;
    this.time += dt;

    if (!this.enabled) {
      r.setRenderTarget(null);
      r.render(scene, camera);
      return;
    }

    r.setRenderTarget(this.rtScene);
    r.render(scene, camera);

    // Bright pass into the first half-res buffer.
    this._mesh.material = this.brightMat;
    this.brightMat.uniforms.uTex.value = this.rtScene.texture;
    r.setRenderTarget(this.down[0]);
    r.render(this._scene, this._cam);

    // Downsample chain.
    this._mesh.material = this.downMat;
    for (let i = 1; i < this.levels; i++) {
      const src = this.down[i - 1];
      this.downMat.uniforms.uTex.value = src.texture;
      this.downMat.uniforms.uTexel.value.set(0.5 / src.width, 0.5 / src.height);
      r.setRenderTarget(this.down[i]);
      r.render(this._scene, this._cam);
    }

    // Upsample chain, accumulating each level for a wide soft falloff.
    this._mesh.material = this.upMat;
    let lower = this.down[this.levels - 1];
    for (let i = this.levels - 2; i >= 0; i--) {
      this.upMat.uniforms.uTex.value = lower.texture;
      this.upMat.uniforms.uAdd.value = this.down[i].texture;
      this.upMat.uniforms.uHasAdd.value = 1;
      this.upMat.uniforms.uTexel.value.set(1 / lower.width, 1 / lower.height);
      r.setRenderTarget(this.up[i]);
      r.render(this._scene, this._cam);
      lower = this.up[i];
    }

    this._mesh.material = this.compositeMat;
    const cu = this.compositeMat.uniforms;
    cu.uScene.value = this.rtScene.texture;
    cu.uBloom.value = lower.texture;
    cu.uBloomStrength.value = this.bloomStrength;
    cu.uTime.value = REDUCED_MOTION ? 0 : this.time;
    r.setRenderTarget(null);
    r.render(this._scene, this._cam);
  }

  setQuality(q) {
    if (q === 'low') {
      this.renderScale = 0.78;
      this.levels = 3;
      this.compositeMat.uniforms.uGrain.value = 0;
    } else {
      this.renderScale = 1;
      this.levels = 4;
      this.compositeMat.uniforms.uGrain.value = 0.028;
    }
    this._w = -1; // force realloc on next setSize
  }

  dispose(full = true) {
    this.rtScene?.dispose();
    for (const t of this.down) t.dispose();
    for (const t of this.up) t.dispose();
    if (full) this._quadGeo.dispose();
  }
}
