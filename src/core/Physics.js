import RAPIER from '@dimforge/rapier3d-compat';

// Collision membership bits
export const G = {
  STATIC: 1 << 0,
  PROP: 1 << 1,
  DEBRIS: 1 << 2,
  CAT: 1 << 3,
  GRANNY: 1 << 4,
  PROJ: 1 << 5,
  SENSOR: 1 << 6,
  FIXTURE: 1 << 7,
  CATONLY: 1 << 8, // blockers that stop Grandma but not the cat (cat-sized gaps)
  RAIL: 1 << 9,    // railings: block bodies and projectiles, but not sight or the camera
};
export const groups = (member, filter) => ((member & 0xffff) << 16) | (filter & 0xffff);

export const GROUPS = {
  static: groups(G.STATIC, G.PROP | G.DEBRIS | G.CAT | G.GRANNY | G.PROJ),
  fixture: groups(G.FIXTURE, G.PROP | G.DEBRIS | G.CAT | G.GRANNY | G.PROJ),
  prop: groups(G.PROP, G.STATIC | G.FIXTURE | G.PROP | G.DEBRIS | G.CAT | G.GRANNY | G.PROJ | G.RAIL),
  debris: groups(G.DEBRIS, G.STATIC | G.FIXTURE | G.PROP | G.DEBRIS | G.RAIL),
  cat: groups(G.CAT, G.STATIC | G.FIXTURE | G.PROP | G.PROJ | G.RAIL),
  granny: groups(G.GRANNY, G.STATIC | G.FIXTURE | G.PROP | G.CATONLY | G.RAIL),
  proj: groups(G.PROJ, G.STATIC | G.FIXTURE | G.PROP | G.CAT),
  grannyBlock: groups(G.CATONLY, G.GRANNY),
  sensor: groups(G.SENSOR, G.CAT | G.GRANNY | G.PROJ | G.PROP),
  rail: groups(G.RAIL, G.PROP | G.DEBRIS | G.CAT | G.GRANNY | G.PROJ),
};
// query masks (filterGroups for ray/shape casts)
export const Q = {
  world: groups(0xffff, G.STATIC | G.FIXTURE),
  solid: groups(0xffff, G.STATIC | G.FIXTURE | G.PROP | G.RAIL),
  camera: groups(0xffff, G.STATIC | G.FIXTURE),
  cameraWalls: groups(0xffff, G.STATIC),          // the follow camera only collides with architecture...
  occluders: groups(0xffff, G.FIXTURE | G.PROP),  // ...and fades furniture that gets between it and the cat
  sight: groups(0xffff, G.STATIC | G.FIXTURE),
  // Grandma's route checks: loose furniture and heavy debris (PROP) block her too (playtest 5: stuck behind a sofa)
  nav: groups(0xffff, G.STATIC | G.FIXTURE | G.PROP | G.RAIL),
  props: groups(0xffff, G.PROP),
  all: groups(0xffff, 0xffff),
};

export class Physics {
  static async initModule() {
    if (Physics.ready) return;
    await RAPIER.init();
    Physics.ready = true;
  }

  async init() { await Physics.initModule(); this.createWorld(); }

  createWorld() {
    this.R = RAPIER;
    this.world = new RAPIER.World({ x: 0, y: -12, z: 0 });
    this.world.timestep = 1 / 60;
    this.queue = new RAPIER.EventQueue(true);
    this.owners = new Map(); // collider handle -> owner object
    this.collisionHandlers = [];
    this.forceHandlers = [];
    this._ray = new RAPIER.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: -1, z: 0 });
  }

  step() {
    this.world.step(this.queue);
    this.queue.drainCollisionEvents((h1, h2, started) => {
      if (!started) return;
      const a = this.owners.get(h1), b = this.owners.get(h2);
      for (const fn of this.collisionHandlers) fn(h1, h2, a, b);
    });
    this.queue.drainContactForceEvents((ev) => {
      const h1 = ev.collider1(), h2 = ev.collider2();
      const a = this.owners.get(h1), b = this.owners.get(h2);
      const f = ev.maxForceMagnitude();
      for (const fn of this.forceHandlers) fn(h1, h2, a, b, f);
    });
  }

  setOwner(collider, owner) { this.owners.set(collider.handle, owner); }
  ownerOf(collider) { return collider ? this.owners.get(collider.handle) : undefined; }

  /** Fixed cuboid; rotY optional (radians). Returns collider. */
  addStaticBox(cx, cy, cz, hx, hy, hz, opts = {}) {
    const R = this.R;
    const bd = R.RigidBodyDesc.fixed().setTranslation(cx, cy, cz);
    if (opts.quat) bd.setRotation(opts.quat);
    else if (opts.rotY) bd.setRotation(quatY(opts.rotY));
    const body = this.world.createRigidBody(bd);
    const cd = R.ColliderDesc.cuboid(hx, hy, hz)
      .setCollisionGroups(opts.groups ?? GROUPS.static)
      .setFriction(opts.friction ?? 0.7);
    if (opts.events) cd.setActiveEvents(R.ActiveEvents.COLLISION_EVENTS);
    const col = this.world.createCollider(cd, body);
    if (opts.owner) this.setOwner(col, opts.owner);
    return col;
  }

  removeCollider(col) {
    if (!col) return;
    this.owners.delete(col.handle);
    const body = col.parent();
    try {
      if (body && body.numColliders() <= 1) this.world.removeRigidBody(body);
      else this.world.removeCollider(col, true);
    } catch (e) { /* already removed */ }
  }

  removeBody(body) {
    if (!body) return;
    for (let i = 0; i < body.numColliders(); i++) this.owners.delete(body.collider(i).handle);
    try { this.world.removeRigidBody(body); } catch (e) { /* already removed */ }
  }

  /** Raycast; returns {point, normal, toi, collider, owner} or null. */
  raycast(ox, oy, oz, dx, dy, dz, maxDist, filterGroups = Q.world, excludeCollider, excludeBody, predicate) {
    const ray = this._ray;
    ray.origin.x = ox; ray.origin.y = oy; ray.origin.z = oz;
    ray.dir.x = dx; ray.dir.y = dy; ray.dir.z = dz;
    const hit = this.world.castRayAndGetNormal(ray, maxDist, true, undefined, filterGroups, excludeCollider, excludeBody, predicate);
    if (!hit) return null;
    const t = hit.timeOfImpact;
    return {
      toi: t,
      point: { x: ox + dx * t, y: oy + dy * t, z: oz + dz * t },
      normal: { x: hit.normal.x, y: hit.normal.y, z: hit.normal.z },
      collider: hit.collider,
      owner: this.owners.get(hit.collider.handle),
    };
  }

  /** Every collider along a ray, nearest first: [{toi, normal, collider, owner}]. */
  raycastAll(ox, oy, oz, dx, dy, dz, maxDist, filterGroups = Q.all, excludeCollider) {
    const ray = this._ray;
    ray.origin.x = ox; ray.origin.y = oy; ray.origin.z = oz;
    ray.dir.x = dx; ray.dir.y = dy; ray.dir.z = dz;
    const out = [];
    this.world.intersectionsWithRay(ray, maxDist, true, (hit) => {
      if (excludeCollider && hit.collider.handle === excludeCollider.handle) return true;
      out.push({ toi: hit.timeOfImpact, normal: hit.normal ? { x: hit.normal.x, y: hit.normal.y, z: hit.normal.z } : null, collider: hit.collider, owner: this.owners.get(hit.collider.handle) });
      return true;
    }, undefined, filterGroups);
    out.sort((a, b) => a.toi - b.toi);
    return out;
  }

  /** Sphere sweep; returns toi distance or null. */
  sphereCast(ox, oy, oz, dx, dy, dz, radius, maxDist, filterGroups = Q.camera) {
    const shape = new this.R.Ball(radius);
    const hit = this.world.castShape({ x: ox, y: oy, z: oz }, { x: 0, y: 0, z: 0, w: 1 }, { x: dx, y: dy, z: dz },
      shape, 0.0, maxDist, true, undefined, filterGroups);
    if (!hit) return null;
    return { toi: hit.time_of_impact ?? hit.timeOfImpact, collider: hit.collider, owner: this.owners.get(hit.collider.handle) };
  }

  /** All colliders overlapping a sphere. */
  overlapSphere(x, y, z, r, filterGroups = Q.all) {
    const out = [];
    const shape = new this.R.Ball(r);
    this.world.intersectionsWithShape({ x, y, z }, { x: 0, y: 0, z: 0, w: 1 }, shape, (c) => { out.push(c); return true; }, undefined, filterGroups);
    return out;
  }
}

export function quatY(a) {
  return { x: 0, y: Math.sin(a / 2), z: 0, w: Math.cos(a / 2) };
}
