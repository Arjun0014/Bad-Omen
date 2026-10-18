import * as THREE from 'three';
import { glowSpriteTexture } from '../world/Materials.js';

// Pooled particle effects: soft sprites (dust/smoke/fire/sparks/magic) + instanced chunks (splinters/shards).

const SPRITE_VS = `
attribute float aSize; attribute vec4 aColor; varying vec4 vColor;
void main(){ vColor = aColor; vec4 mv = modelViewMatrix * vec4(position,1.0);
  gl_PointSize = aSize * (300.0 / -mv.z); gl_Position = projectionMatrix * mv; }`;
const SPRITE_FS = `
uniform sampler2D map; varying vec4 vColor;
void main(){ vec4 t = texture2D(map, gl_PointCoord); gl_FragColor = vec4(vColor.rgb, vColor.a * t.a); if(gl_FragColor.a < 0.01) discard; }`;

class SpritePool {
  constructor(scene, max, blending) {
    this.max = max;
    this.geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(max * 3);
    this.col = new Float32Array(max * 4);
    this.size = new Float32Array(max);
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('aColor', new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    this.mat = new THREE.ShaderMaterial({
      uniforms: { map: { value: glowSpriteTexture() } }, vertexShader: SPRITE_VS, fragmentShader: SPRITE_FS,
      transparent: true, depthWrite: false, blending,
    });
    this.points = new THREE.Points(this.geo, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
    scene.add(this.points);
    this.p = [];
    for (let i = 0; i < max; i++) this.p.push({ alive: false });
    this.cursor = 0;
  }
  spawn(o) {
    let p = null;
    for (let k = 0; k < this.max; k++) {
      const i = (this.cursor + k) % this.max;
      if (!this.p[i].alive) { p = this.p[i]; this.cursor = i + 1; break; }
    }
    if (!p) { p = this.p[this.cursor % this.max]; this.cursor++; }
    p.alive = true;
    p.x = o.x; p.y = o.y; p.z = o.z;
    p.vx = o.vx || 0; p.vy = o.vy || 0; p.vz = o.vz || 0;
    p.life = o.life || 1; p.age = 0;
    p.s0 = o.size || 0.3; p.s1 = o.endSize ?? p.s0 * 2;
    p.r = o.r ?? 1; p.g = o.g ?? 1; p.b = o.b ?? 1; p.a = o.a ?? 1;
    p.r1 = o.r1 ?? p.r; p.g1 = o.g1 ?? p.g; p.b1 = o.b1 ?? p.b;
    p.grav = o.grav ?? 0; p.drag = o.drag ?? 1.5; p.fadeIn = o.fadeIn ?? 0.1;
  }
  update(dt) {
    let n = 0;
    for (let i = 0; i < this.max; i++) {
      const p = this.p[i];
      if (!p.alive) { this.size[i] = 0; this.col[i * 4 + 3] = 0; continue; }
      p.age += dt;
      if (p.age >= p.life) { p.alive = false; this.size[i] = 0; this.col[i * 4 + 3] = 0; continue; }
      const k = Math.exp(-p.drag * dt);
      p.vx *= k; p.vy = p.vy * k - p.grav * dt; p.vz *= k;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      const t = p.age / p.life;
      this.pos[i * 3] = p.x; this.pos[i * 3 + 1] = p.y; this.pos[i * 3 + 2] = p.z;
      this.size[i] = p.s0 + (p.s1 - p.s0) * t;
      const fade = Math.min(1, p.age / p.fadeIn) * (1 - t);
      this.col[i * 4] = p.r + (p.r1 - p.r) * t; this.col[i * 4 + 1] = p.g + (p.g1 - p.g) * t; this.col[i * 4 + 2] = p.b + (p.b1 - p.b) * t;
      this.col[i * 4 + 3] = p.a * fade;
      n++;
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.aColor.needsUpdate = true;
    this.geo.attributes.aSize.needsUpdate = true;
    this.active = n;
  }
}

class ChunkPool {
  constructor(scene, max, geo, mat) {
    this.max = max;
    this.mesh = new THREE.InstancedMesh(geo, mat, max);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = false;
    const colors = new Float32Array(max * 3).fill(1);
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(colors, 3);
    scene.add(this.mesh);
    this.c = [];
    for (let i = 0; i < max; i++) this.c.push({ alive: false });
    this.cursor = 0;
    this.m = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.e = new THREE.Euler(); this.s = new THREE.Vector3(); this.v = new THREE.Vector3();
    const zero = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < max; i++) this.mesh.setMatrixAt(i, zero);
  }
  spawn(o) {
    const i = this.cursor % this.max; this.cursor++;
    const c = this.c[i];
    Object.assign(c, { alive: true, x: o.x, y: o.y, z: o.z, vx: o.vx, vy: o.vy, vz: o.vz, rx: Math.random() * 6, ry: Math.random() * 6, rz: 0,
      wx: (Math.random() - 0.5) * 18, wy: (Math.random() - 0.5) * 18, life: o.life ?? 3, age: 0, floor: o.floor ?? 0, sx: o.sx, sy: o.sy, sz: o.sz, rest: false });
    this.mesh.setColorAt(i, new THREE.Color(o.color ?? 0xffffff));
    this.mesh.instanceColor.needsUpdate = true;
  }
  update(dt) {
    this.frame = (this.frame ?? 0) + 1;
    for (let i = 0; i < this.max; i++) {
      const c = this.c[i];
      if (!c.alive) continue;
      c.age += dt;
      if (c.age > c.life) { c.alive = false; this.mesh.setMatrixAt(i, this.m.makeScale(0, 0, 0)); continue; }
      if (!c.rest) {
        c.vy -= 14 * dt;
        c.x += c.vx * dt; c.y += c.vy * dt; c.z += c.vz * dt;
        c.rx += c.wx * dt; c.ry += c.wy * dt;
        if (c.y < c.floor) {
          // the floor was measured under the burst: a chunk that flew off a table top (or out under the vanished
          // conservatory roof) used to settle there in mid-air (playtest 4); where it lands, look again
          const f = this.floorAt ? this.floorAt(c.x, c.floor + 0.25, c.z) : c.floor;
          if (f < c.floor - 0.03) c.floor = f;
          else {
            c.y = c.floor; c.vy *= -0.3; c.vx *= 0.6; c.vz *= 0.6; c.wx *= 0.5; c.wy *= 0.5;
            if (Math.abs(c.vy) < 0.6) { c.rest = true; c.rx = Math.round(c.rx / Math.PI) * Math.PI; }
          }
        }
      } else if (this.floorAt && i % 8 === this.frame % 8) {
        // a few resting chunks a frame: the table they settled on may have broken since
        const f = this.floorAt(c.x, c.y + 0.05, c.z);
        if (f < c.y - 0.05) { c.rest = false; c.floor = f; c.vy = 0; c.vx = 0; c.vz = 0; }
      }
      const shrink = c.age > c.life - 0.6 ? Math.max(0, (c.life - c.age) / 0.6) : 1;
      this.e.set(c.rx, c.ry, c.rz); this.q.setFromEuler(this.e);
      this.s.set(c.sx * shrink, c.sy * shrink, c.sz * shrink);
      this.v.set(c.x, c.y, c.z);
      this.m.compose(this.v, this.q, this.s);
      this.mesh.setMatrixAt(i, this.m);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

export class FX {
  constructor(scene, physics) {
    this.scene = scene;
    this.physics = physics;
    this.soft = new SpritePool(scene, 900, THREE.NormalBlending);
    this.glow = new SpritePool(scene, 700, THREE.AdditiveBlending);
    const woodMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 });
    const shardMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.15, metalness: 0.3, emissive: 0x223344, emissiveIntensity: 0.4 });
    this.splinters = new ChunkPool(scene, 260, new THREE.BoxGeometry(1, 1, 1), woodMat);
    const tri = new THREE.BufferGeometry();
    tri.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0.5, -0.45, 0, -0.4, 0.45, 0, -0.3, 0, 0.12, 0], 3));
    tri.setIndex([0, 1, 2, 0, 3, 1, 1, 3, 2, 2, 3, 0]);
    tri.computeVertexNormals();
    this.shards = new ChunkPool(scene, 260, tri, shardMat);
    this.splinters.floorAt = this.shards.floorAt = (x, y, z) => this.floorBelow(x, y, z);
    this.visibleOnly = (col) => !this.physics.ownerOf(col)?.invisible;
    this.popups = [];
  }

  /** The surface under a point (colliders nobody can see, like the conservatory's ceiling, don't count). */
  floorBelow(x, y, z) {
    const h = this.physics.raycast(x, y + 0.05, z, 0, -1, 0, 8, undefined, undefined, undefined, this.visibleOnly);
    return h ? h.point.y + 0.01 : 0;
  }

  dust(p, n = 10, { color = [0.62, 0.55, 0.47], size = 0.35, spread = 0.6, life = 1.4, up = 0.6 } = {}) {
    for (let i = 0; i < n; i++) {
      this.soft.spawn({ x: p.x + (Math.random() - 0.5) * spread * 0.4, y: p.y + Math.random() * 0.2, z: p.z + (Math.random() - 0.5) * spread * 0.4,
        vx: (Math.random() - 0.5) * spread * 2, vy: Math.random() * up, vz: (Math.random() - 0.5) * spread * 2,
        size: size * (0.6 + Math.random() * 0.8), endSize: size * 2.6, life: life * (0.7 + Math.random() * 0.6),
        r: color[0], g: color[1], b: color[2], a: 0.45, drag: 2.2, fadeIn: 0.05 });
    }
  }

  smoke(p, n = 4, { size = 0.5, life = 3, color = [0.18, 0.17, 0.18], rise = 0.7 } = {}) {
    for (let i = 0; i < n; i++) {
      this.soft.spawn({ x: p.x + (Math.random() - 0.5) * 0.3, y: p.y, z: p.z + (Math.random() - 0.5) * 0.3,
        vx: (Math.random() - 0.5) * 0.3, vy: rise * (0.6 + Math.random() * 0.6), vz: (Math.random() - 0.5) * 0.3,
        size, endSize: size * 3.5, life: life * (0.7 + Math.random() * 0.5), r: color[0], g: color[1], b: color[2], a: 0.5, drag: 0.4, fadeIn: 0.3 });
    }
  }

  sparks(p, n = 14, { color = [1, 0.7, 0.3], speed = 4, life = 0.6, size = 0.08 } = {}) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, u = Math.random();
      this.glow.spawn({ x: p.x, y: p.y, z: p.z, vx: Math.cos(a) * speed * u, vy: Math.random() * speed, vz: Math.sin(a) * speed * u,
        size, endSize: size * 0.3, life: life * (0.5 + Math.random()), r: color[0], g: color[1], b: color[2], a: 1, grav: 9, drag: 0.8, fadeIn: 0.01 });
    }
  }

  flame(p, { size = 0.5, intensity = 1 } = {}) {
    this.glow.spawn({ x: p.x + (Math.random() - 0.5) * 0.25 * size, y: p.y, z: p.z + (Math.random() - 0.5) * 0.25 * size,
      vx: (Math.random() - 0.5) * 0.2, vy: 1.0 + Math.random() * 0.8, vz: (Math.random() - 0.5) * 0.2,
      size: size * (0.7 + Math.random() * 0.6), endSize: size * 0.2, life: 0.55 + Math.random() * 0.3,
      r: 1, g: 0.55 + Math.random() * 0.2, b: 0.15, r1: 0.9, g1: 0.2, b1: 0.05, a: 0.85 * intensity, drag: 0.5, fadeIn: 0.05 });
  }

  magic(p, n = 12, color = [0.6, 1, 0.5]) {
    for (let i = 0; i < n; i++) {
      this.glow.spawn({ x: p.x + (Math.random() - 0.5) * 0.4, y: p.y + (Math.random() - 0.5) * 0.4, z: p.z + (Math.random() - 0.5) * 0.4,
        vx: (Math.random() - 0.5) * 1.2, vy: Math.random() * 1.4, vz: (Math.random() - 0.5) * 1.2,
        size: 0.12, endSize: 0.02, life: 0.9 + Math.random() * 0.6, r: color[0], g: color[1], b: color[2], a: 1, drag: 1.2, fadeIn: 0.05 });
    }
  }

  splinterBurst(p, n = 12, { color = 0x8a6a4a, speed = 3.5, size = 0.06, dir } = {}) {
    const floor = this.floorBelow(p.x, p.y, p.z);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.4 + Math.random() * 0.8);
      this.splinters.spawn({ x: p.x, y: p.y, z: p.z, vx: Math.cos(a) * s + (dir?.x ?? 0) * 2, vy: 1 + Math.random() * speed, vz: Math.sin(a) * s + (dir?.z ?? 0) * 2,
        sx: size * (0.4 + Math.random()), sy: size * 0.35, sz: size * (2 + Math.random() * 3), color, life: 4 + Math.random() * 3, floor });
    }
  }

  shardBurst(p, n = 14, { color = 0xe8f0ff, speed = 3, size = 0.07, dir } = {}) {
    const floor = this.floorBelow(p.x, p.y, p.z);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.3 + Math.random() * 0.9);
      this.shards.spawn({ x: p.x, y: p.y, z: p.z, vx: Math.cos(a) * s + (dir?.x ?? 0) * 1.5, vy: 0.8 + Math.random() * speed, vz: Math.sin(a) * s + (dir?.z ?? 0) * 1.5,
        sx: size * (0.6 + Math.random()), sy: size, sz: size * (0.6 + Math.random()), color, life: 5 + Math.random() * 4, floor });
    }
    // glints
    for (let i = 0; i < Math.ceil(n / 2); i++) this.glow.spawn({ x: p.x, y: p.y, z: p.z, vx: (Math.random() - 0.5) * 3, vy: Math.random() * 3, vz: (Math.random() - 0.5) * 3,
      size: 0.1, endSize: 0.01, life: 0.5, r: 0.9, g: 0.95, b: 1, a: 1, grav: 6, drag: 1 });
  }

  update(dt) {
    this.soft.update(dt);
    this.glow.update(dt);
    this.splinters.update(dt);
    this.shards.update(dt);
  }
}
