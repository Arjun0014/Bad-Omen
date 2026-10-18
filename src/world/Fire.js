import * as THREE from 'three';

/** Does the flat segment a→b pass within R of cluster c (and within its height band)?  A segment that starts
 *  inside the circle only counts when it heads deeper in, so the way out of the flames is never "blocked". */
export function segmentCrosses(a, b, c, R) {
  if (Math.abs(a.y - c.pos.y) >= 1.2 && Math.abs(b.y - c.pos.y) >= 1.2) return false;
  const dx = b.x - a.x, dz = b.z - a.z, L2 = dx * dx + dz * dz;
  const t = L2 > 1e-8 ? Math.min(1, Math.max(0, ((c.pos.x - a.x) * dx + (c.pos.z - a.z) * dz) / L2)) : 0;
  const closest = Math.hypot(a.x + dx * t - c.pos.x, a.z + dz * t - c.pos.z);
  const d0 = Math.hypot(a.x - c.pos.x, a.z - c.pos.z);
  return d0 < R ? closest < d0 - 0.05 : closest < R;
}

// Authored, contained fire: a handful of clusters that burn, char nearby flammables and never spread beyond their room.
export class FireSystem {
  constructor(game) {
    this.game = game;
    this.clusters = [];
    this.maxLights = 3;
    this.lightCount = 0;
  }

  ignite(pos, { size = 0.6, life = Infinity, room = 'kitchen', light = true, damageRadius = 0.9 } = {}) {
    if (this.clusters.length >= 10) return null;
    const c = { pos: pos.clone(), size, life, age: 0, room, damageRadius, emitAcc: 0, smokeAcc: 0, light: null, state: 'burning' };
    if (light && this.lightCount < this.maxLights) {
      // virtual light: the LightRig keeps the real light count fixed (adding a light recompiles every shader)
      c.light = this.game.lightRig.add({ color: 0xff7a2a, intensity: 10, distance: 6, decay: 1.6, position: pos.clone().add(new THREE.Vector3(0, 0.5, 0)), priority: 1.5 });
      this.lightCount++;
    }
    this.clusters.push(c);
    this.newFire = true; // checked next step, once a whole batch of clusters has been lit
    this.game.audio?.loop('fireLoop', { volume: 0.35, bus: 'amb' });
    this.game.events.emit('fireStarted', { cluster: c });
    return c;
  }

  get burning() { return this.clusters.some((c) => c.state === 'burning'); }

  isHot(pos, pad = 0) {
    for (const c of this.clusters) if (c.state === 'burning' && Math.hypot(pos.x - c.pos.x, pos.z - c.pos.z) < c.size * 0.9 + pad && Math.abs(pos.y - c.pos.y) < 1.2) return c;
    return null;
  }

  /** Does the flat segment a→b cut through a burning cluster (radius + pad)?  See segmentCrosses(). */
  segmentHot(a, b, pad = 0) {
    for (const c of this.clusters) {
      if (c.state === 'burning' && segmentCrosses(a, b, c, c.size * 0.9 + pad)) return c;
    }
    return null;
  }

  fixedUpdate(dt) {
    const g = this.game;
    // flames flaring up at Grandma's feet (she smashed the stove standing right by it) blow her back out
    if (this.newFire) {
      this.newFire = false;
      const gr = g.granny;
      if (gr && gr.state !== 'off' && this.isHot(gr.position, gr.firePad + 0.2)) gr.escapeFire();
    }
    for (const c of this.clusters) {
      if (c.state !== 'burning') continue;
      c.age += dt;
      if (c.age > c.life) { c.state = 'out'; if (c.light) { g.lightRig.remove(c.light); this.lightCount--; c.light = null; } continue; }
      // char flammable props nearby (slow damage, provenance 'fire')
      c.dmgAcc = (c.dmgAcc ?? 0) + dt;
      if (c.dmgAcc > 0.5) {
        c.dmgAcc = 0;
        for (const rec of g.destruction.items) {
          if (rec.broken || !rec.tags?.has('flammable') && rec.meta.material !== 'wood' && rec.meta.material !== 'fabric' && rec.meta.material !== 'plant' && rec.meta.material !== 'paper') continue;
          const p = rec.body ? rec.body.translation() : rec.group.position;
          const d = Math.hypot(p.x - c.pos.x, p.z - c.pos.z);
          if (d < c.damageRadius && Math.abs(p.y - c.pos.y) < 1.6) {
            const src = g.setPieces?.fireSource ?? 'fire';
            g.destruction.damage(rec, rec.tags?.has('flammable') ? 25 : 6, src, p, { x: 0, y: 1, z: 0 });
          }
        }
      }
      // cat gets singed -> hops away (no injury), Grandma coughs and backs off
      const cat = g.cat;
      if (cat.mode === 'normal' && cat.invuln <= 0 && this.isHot(cat.position, 0.1) === c) {
        const away = cat.position.clone().sub(c.pos).setY(0);
        if (away.lengthSq() < 1e-4) away.set(1, 0, 0);
        cat.stumble(away.normalize(), 4.5);
        g.events.emit('catSinged', {});
      }
      // Grandma flinches and hops back out (a cooldown inside singe(): flinching on the spot every step she
      // stood in the flames kept her there for good — playtest 3)
      const gr = g.granny;
      if (gr && gr.active && this.isHot(gr.position, gr.firePad) === c && gr.singe(c)) g.events.emit('grannySinged', {});
    }
  }

  update(dt, time) {
    const fx = this.game.fx;
    let any = false;
    for (const c of this.clusters) {
      if (c.state !== 'burning') continue;
      any = true;
      c.emitAcc += dt * 26 * c.size;
      while (c.emitAcc > 1) { c.emitAcc -= 1; fx.flame(c.pos, { size: c.size * 0.9 }); }
      c.smokeAcc += dt * 3 * c.size;
      while (c.smokeAcc > 1) { c.smokeAcc -= 1; fx.smoke(c.pos.clone().add(new THREE.Vector3(0, 0.6 * c.size, 0)), 1, { size: 0.5 * c.size + 0.2, life: 3.5 }); }
      if (c.light) c.light.intensity = 8 + Math.sin(time * 17 + c.pos.x) * 2 + Math.sin(time * 31) * 1.5;
    }
    if (!any && this.game.audio?.loops.has('fireLoop')) this.game.audio.stopLoop('fireLoop');
  }

  clear() {
    for (const c of this.clusters) if (c.light) this.game.lightRig?.remove(c.light);
    this.clusters = [];
    this.lightCount = 0;
    this.newFire = false;
  }
}
