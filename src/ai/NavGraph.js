import * as THREE from 'three';
import { Q } from '../core/Physics.js';

// Coarse waypoint graph (rooms, doors, stairs) with A* and line-of-sight shortcuts.
export class NavGraph {
  constructor(nodes, physics) {
    this.nodes = nodes; // id -> {id,pos,room,links:Set}
    this.list = Object.values(nodes);
    this.physics = physics;
    this.disabled = new Set();
    // optional (a, b) => truthy when walking straight from a to b crosses a hazard (burning fire); set by Grandma
    this.hazard = null;
  }

  floorOf(y) { return y > 1.6 ? 1 : 0; }

  clearLine(a, b, _height = 0.9, radius = 0) {
    const dx = b.x - a.x, dz = b.z - a.z, dy = b.y - a.y;
    const len = Math.hypot(dx, dy, dz);
    if (len < 1e-3) return true;
    const ux = dx / len, uy = dy / len, uz = dz / len;
    // beds/sofas (~0.45), round-table tops (0.58-0.62), table tops (0.70-0.76) and tall stuff.  With only 0.55 and
    // 1.15 a shortcut ran under a table top between its legs: Grandma walked into the dining table and stalled.
    for (const h of [0.45, 0.6, 0.73, 1.15]) if (this.physics.raycast(a.x, a.y + h, a.z, ux, uy, uz, len, Q.nav)) return false;
    if (radius > 0) {
      const nx = -dz / len * radius, nz = dx / len * radius;
      for (const h of [0.45, 0.73]) {
        if (this.physics.raycast(a.x + nx, a.y + h, a.z + nz, ux, uy, uz, len, Q.nav)) return false;
        if (this.physics.raycast(a.x - nx, a.y + h, a.z - nz, ux, uy, uz, len, Q.nav)) return false;
      }
    }
    return true;
  }

  nearest(pos, { requireLos = true } = {}) {
    const fl = this.floorOf(pos.y);
    let best = null, bestD = Infinity;
    for (const n of this.list) {
      if (this.disabled.has(n.id)) continue;
      if (this.floorOf(n.pos.y) !== fl) continue;
      const d = n.pos.distanceToSquared(pos);
      if (d < bestD) {
        if (requireLos && !this.clearLine(pos, n.pos, 0.9)) continue;
        bestD = d; best = n;
      }
    }
    if (!best && requireLos) return this.nearest(pos, { requireLos: false });
    return best;
  }

  /** A* between nodes; returns array of node objects. */
  astar(start, goal) {
    if (!start || !goal) return null;
    if (start === goal) return [start];
    const open = new Map([[start.id, { n: start, g: 0, f: start.pos.distanceTo(goal.pos), parent: null }]]);
    const closed = new Map();
    while (open.size) {
      let cur = null;
      for (const v of open.values()) if (!cur || v.f < cur.f) cur = v;
      open.delete(cur.n.id);
      closed.set(cur.n.id, cur);
      if (cur.n === goal) {
        const path = [];
        for (let c = cur; c; c = c.parent) path.unshift(c.n);
        return path;
      }
      for (const lid of cur.n.links) {
        if (closed.has(lid) || this.disabled.has(lid)) continue;
        const nb = this.nodes[lid];
        // a link through flames costs a long detour: any other way round wins, but it never blocks the graph
        const g = cur.g + cur.n.pos.distanceTo(nb.pos) + (this.hazard?.(cur.n.pos, nb.pos) ? 40 : 0);
        const ex = open.get(lid);
        if (!ex || g < ex.g) open.set(lid, { n: nb, g, f: g + nb.pos.distanceTo(goal.pos), parent: cur });
      }
    }
    return null;
  }

  /** Full path of points from a position to a target position. */
  path(from, to) {
    const sameFloor = this.floorOf(from.y) === this.floorOf(to.y);
    if (sameFloor && Math.abs(from.y - to.y) < 0.6 && !this.hazard?.(from, to) && this.clearLine(from, to, 0.9, 0.28)) return [to.clone()];
    const b = this.nearest(to);
    let a;
    // mid-stairs: start from the stair end that leads toward the goal's floor (prevents turning back)
    if (from.y > 0.15 && from.y < 3.05 && this.nodes.stair_top && this.nodes.stair_bottom) {
      a = this.floorOf(to.y) === 1 ? this.nodes.stair_top : this.nodes.stair_bottom;
    } else a = this.nearest(from);
    const nodes = this.astar(a, b);
    if (!nodes) return [to.clone()];
    const pts = nodes.map((n) => n.pos.clone());
    pts.push(to.clone());
    // string-pull: drop the first node if we can already see the second
    const onStairs = from.y > 0.15 && from.y < 3.05;
    while (!onStairs && pts.length > 2 && this.floorOf(pts[1].y) === this.floorOf(from.y) && Math.abs(pts[1].y - from.y) < 0.6 && !this.hazard?.(from, pts[1]) && this.clearLine(from, pts[1], 0.9, 0.28)) pts.shift();
    return pts;
  }

  randomNode(room) {
    const cands = this.list.filter((n) => (!room || n.room === room) && !this.disabled.has(n.id));
    return cands[Math.floor(Math.random() * cands.length)];
  }
}
