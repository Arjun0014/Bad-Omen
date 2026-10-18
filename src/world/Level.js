import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { boxGeo, woodMat, colorMat, Mats } from './Materials.js';
import { GROUPS } from '../core/Physics.js';
import { FLOOR2 } from './House.js';

const F2 = FLOOR2;
const PI = Math.PI;

/*
  Populates the cottage: props (breakables), wall-hung curios, structural weak points,
  hide spots, scratch targets and Grandma's navigation graph.
*/
export function buildLevel(game) {
  const D = game.destruction;
  const P = (id, kind, x, y, z, rotY = 0, opts = {}, extra = {}) => D.spawn({ id, kind, pos: [x, y, z], rotY, opts, zone: extra.zone, meta: extra.meta, tags: extra.tags, scale: extra.scale });
  const level = { hideSpots: [], scratchTargets: [], weakPoints: [], zones: [], named: {} };

  // ================================================================== FOYER  x[-7,-2] z[0.5,5]
  P('foyer_rug', 'rug', -4.4, 0.0, 2.8, 0, { w: 2.6, d: 1.8 });
  P('tut_table', 'roundtable', -3.2, 0, 4.0, 0, {}, { zone: 'foyer' });
  P('foyer_urn', 'urn', -3.2, 0.62, 4.0, 0, { variant: 0 }, { zone: 'foyer' });
  P('foyer_candle1', 'candle', -3.4, 0.62, 3.8, 0, {}, { zone: 'foyer' });
  P('foyer_umbrella', 'umbrellastand', -2.6, 0, 4.55, 0, {}, { zone: 'foyer' });
  P('foyer_coatstand', 'coatstand', -6.45, 0, 1.0, 0, {}, { zone: 'foyer' });
  P('foyer_sidetable', 'roundtable', -6.05, 0, 1.75, 0, {}, { zone: 'foyer' });
  P('foyer_crystal', 'crystalball', -6.05, 0.62, 1.75, 0, {}, { zone: 'foyer' });
  P('foyer_teapot', 'teapot', -5.85, 0.62, 1.9, 0.6, {}, { zone: 'foyer' });
  P('foyer_sideboard', 'sideboard', -3.35, 0, 0.88, 0, {}, { zone: 'foyer' });
  P('foyer_vase1', 'vase', -3.9, 0.88, 0.85, 0, { variant: 0 }, { zone: 'foyer' });
  P('foyer_vase2', 'vase', -2.8, 0.88, 0.85, 0, { variant: 2 }, { zone: 'foyer' });
  P('foyer_skull', 'skull', -3.35, 0.88, 0.8, 0.3, {}, { zone: 'foyer' });
  P('foyer_mirror', 'mirror', -6.8, 1.05, 3.4, PI / 2, {}, { zone: 'foyer', meta: { label: 'the cursed mirror' } });
  P('foyer_portrait1', 'portrait', -6.2, 1.2, 0.62, 0, { variant: 1 }, { zone: 'foyer' });
  P('foyer_shelf', 'shelf', -2.14, 1.3, 1.9, -PI / 2, { len: 1.2 }, { zone: 'foyer' });
  P('foyer_jar1', 'jar', -2.2, 1.34, 1.5, 0, {}, { zone: 'foyer' });
  P('foyer_bottle1', 'bottle', -2.2, 1.34, 1.85, 0, { variant: 1 }, { zone: 'foyer' });
  P('foyer_potion1', 'potion', -2.2, 1.34, 2.25, 0, { variant: 0 }, { zone: 'foyer' });
  P('foyer_pumpkin', 'pumpkin', -6.4, 0, 4.4, 0.4, {}, { zone: 'foyer' });

  // ================================================================== KITCHEN x[-7,-2] z[-5,0.5]
  level.named.stove = P('kitchen_stove', 'stove', -6.45, 0, -2.6, PI / 2, {}, { zone: 'kitchen' });
  P('kitchen_counter_n', 'counter', -3.0, 0, -4.55, 0, { len: 1.6 }, { zone: 'kitchen' });
  P('kitchen_counter_e', 'counter', -2.42, 0, -3.55, PI / 2, { len: 1.3 }, { zone: 'kitchen' });
  P('kitchen_table', 'table', -4.6, 0, -1.9, 0, { len: 1.4, depth: 0.8 }, { zone: 'kitchen' });
  P('kitchen_chair1', 'chair', -4.6, 0, -0.95, PI, { variant: 1 }, { zone: 'kitchen' });
  P('kitchen_chair2', 'chair', -5.6, 0, -1.9, PI / 2, {}, { zone: 'kitchen' });
  const kt = 0.76;
  P('kitchen_plate1', 'plate', -4.9, kt, -2.0, 0, {}, { zone: 'kitchen' });
  P('kitchen_plate2', 'plate', -4.3, kt, -1.8, 0, {}, { zone: 'kitchen' });
  P('kitchen_cup1', 'cup', -4.6, kt, -1.65, 0, {}, { zone: 'kitchen' });
  P('kitchen_teapot', 'teapot', -4.5, kt, -2.15, 1.2, {}, { zone: 'kitchen' });
  P('kitchen_potion1', 'potion', -5.15, kt, -1.75, 0, { variant: 1 }, { zone: 'kitchen' });
  P('kitchen_pumpkin', 'pumpkin', -4.05, kt, -2.0, 0, {}, { zone: 'kitchen' });
  const ct = 0.925;
  P('kitchen_pot1', 'pot', -3.5, ct, -4.55, 0, {}, { zone: 'kitchen' });
  P('kitchen_bottle1', 'bottle', -2.75, ct, -4.6, 0, { variant: 0 }, { zone: 'kitchen' });
  P('kitchen_bottle2', 'bottle', -2.55, ct, -4.5, 0, { variant: 1 }, { zone: 'kitchen' });
  P('kitchen_jar1', 'jar', -2.42, ct, -3.1, 0, {}, { zone: 'kitchen' });
  P('kitchen_cup2', 'cup', -2.4, ct, -3.6, 0, {}, { zone: 'kitchen' });
  P('kitchen_cup3', 'cup', -2.45, ct, -3.85, 0, {}, { zone: 'kitchen' });
  P('kitchen_pan1', 'pan', -6.4, 0.94, -2.9, 0.3, {}, { zone: 'kitchen' });
  P('kitchen_shelf', 'shelf', -3.0, 1.42, -4.73, 0, { len: 1.5 }, { zone: 'kitchen' });
  level.named.lamp = P('kitchen_oillamp', 'oillamp', -3.45, 1.46, -4.72, 0, {}, { zone: 'kitchen', meta: { label: 'the oil lamp' } });
  P('kitchen_jar2', 'jar', -3.05, 1.46, -4.72, 0, {}, { zone: 'kitchen' });
  P('kitchen_potion2', 'potion', -2.7, 1.46, -4.72, 0, { variant: 2 }, { zone: 'kitchen' });
  P('kitchen_bottle3', 'bottle', -2.4, 1.46, -4.72, 0, {}, { zone: 'kitchen' });
  P('kitchen_pantry', 'bookcase', -2.27, 0, -0.42, -PI / 2, {}, { zone: 'kitchen', meta: { label: 'the pantry' } });
  for (const [i, y] of [[0, 0.065], [1, 0.575], [2, 1.075], [3, 1.575]]) {
    P(`pantry_jar${i}`, i % 2 ? 'jar' : 'bottle', -2.3, y, -0.75, 0, { variant: i }, { zone: 'kitchen' });
    P(`pantry_pot${i}`, i % 2 ? 'potion' : 'cup', -2.3, y, -0.25, 0, { variant: i }, { zone: 'kitchen' });
  }
  // the cauldron sits by the stove, not under the window: in front of the glass it turned every run at the kitchen
  // window into a scramble over its rim (playtest 4: "the kitchen window doesn't break")
  level.named.cauldron = P('kitchen_cauldron', 'cauldron', -6.45, 0, -1.68, 0, {}, { zone: 'kitchen' });
  P('kitchen_kindling', 'crate', -6.45, 0, -0.8, 0.2, {}, { zone: 'kitchen', tags: ['flammable'], meta: { label: 'the kindling crate' } });
  P('kitchen_herbs', 'herbs', -6.3, 2.35, -2.6, PI / 2, {}, { zone: 'kitchen' });
  P('kitchen_herbs2', 'herbs', -4.6, 2.5, -1.9, 0, {}, { zone: 'kitchen' });
  P('kitchen_curtain', 'curtain', -6.0, 2.3, -4.78, 0, { h: 1.5 }, { zone: 'kitchen' });
  P('kitchen_broom', 'broom', -2.6, 0, -0.95, 0, {}, { zone: 'kitchen' });
  P('kitchen_bucket', 'bucket', -5.3, 0, -4.4, 0, {}, { zone: 'kitchen' });

  // ================================================================== HALL x[-2,1.2]
  level.named.clock = P('hall_clock', 'clock', -1.72, 0, -0.6, PI / 2, {}, { zone: 'hall', meta: { label: "Grandfather's clock" } });
  P('hall_portrait1', 'portrait', -1.88, 1.25, 1.4, PI / 2, { variant: 2, w: 0.5, h: 0.65 }, { zone: 'hall' });
  P('hall_portrait2', 'portrait', -1.88, 1.25, -3.4, PI / 2, { variant: 0 }, { zone: 'hall' });
  P('hall_stool', 'stool', -1.62, 0, 2.2, 0, {}, { zone: 'hall' });

  // ================================================================== LIVING x[1.2,7] (double height)
  P('living_rug', 'rug', 4.4, 0, -0.5, 0, { w: 3.0, d: 2.2 });
  level.named.diningTable = P('dining_table', 'table', 4.4, 0, -0.5, 0, {}, { zone: 'living', meta: { label: 'the dining table', hp: 90 } });
  P('dining_chair1', 'chair', 3.7, 0, 0.3, PI, {}, { zone: 'living' });
  P('dining_chair2', 'chair', 5.1, 0, 0.3, PI, { variant: 1 }, { zone: 'living' });
  P('dining_chair3', 'chair', 3.7, 0, -1.3, 0, { variant: 1 }, { zone: 'living' });
  P('dining_chair4', 'chair', 5.1, 0, -1.3, 0, {}, { zone: 'living' });
  const dt = 0.76;
  [[3.75, -0.75], [4.35, -0.8], [4.95, -0.75], [3.75, -0.25], [4.35, -0.2], [4.95, -0.25]].forEach(([x, z], i) => P(`dining_plate${i}`, 'plate', x, dt, z, 0, {}, { zone: 'living' }));
  [[4.05, -0.5], [4.65, -0.5], [5.2, -0.5]].forEach(([x, z], i) => P(`dining_cup${i}`, 'cup', x, dt, z, 0, {}, { zone: 'living' }));
  P('dining_candle1', 'candle', 3.5, dt, -0.5, 0, {}, { zone: 'living' });
  // the middle of the table stays free: the title screen seats Komur there (he sat inside the teapot — playtest 3)
  P('dining_teapot', 'teapot', 4.94, dt, -0.5, 0.5, {}, { zone: 'living' });
  level.named.cabinet = P('glass_cabinet', 'cabinet', 6.62, 0, -1.6, -PI / 2, {}, { zone: 'living', meta: { label: "Mother's cabinet" } });
  for (const [i, y] of [[0, 0.115], [1, 0.565], [2, 1.015], [3, 1.465]]) {
    P(`cab_plate${i}`, i % 2 ? 'cup' : 'teapot', 6.6, y + 0.01, -1.9, 0, {}, { zone: 'living' });
    P(`cab_cup${i}`, i % 2 ? 'vase' : 'cup', 6.6, y + 0.01, -1.35, 0, { variant: i }, { zone: 'living' });
  }
  P('living_bookcase', 'bookcase', 6.66, 0, -3.75, -PI / 2, {}, { zone: 'living' });
  for (let s = 0; s < 4; s++) for (let b = 0; b < 5; b++)
    P(`lbook_${s}_${b}`, 'book', 6.62, [0.065, 0.575, 1.075, 1.575][s], -4.2 + b * 0.19 + (s % 2) * 0.04, PI / 2, { variant: s * 5 + b }, { zone: 'living' });
  P('living_sofa', 'sofa', 4.15, 0, 2.4, PI / 2, {}, { zone: 'living' });
  P('living_sidetable', 'roundtable', 3.3, 0, 3.6, 0, {}, { zone: 'living' });
  P('living_crystal', 'crystalball', 3.3, 0.62, 3.6, 0, {}, { zone: 'living' });
  level.named.piano = P('living_piano', 'piano', 5.0, 0, 4.5, PI, {}, { zone: 'living', meta: { label: 'the piano' } });
  P('piano_candle', 'candle', 4.55, 1.3, 4.5, 0, {}, { zone: 'living' });
  P('piano_skull', 'skull', 5.4, 1.3, 4.55, -0.3, {}, { zone: 'living' });
  P('living_sideboard', 'sideboard', 2.45, 0, -4.6, 0, {}, { zone: 'living' });
  P('sb_candle', 'candle', 1.74, 0.88, -4.62, 0, {}, { zone: 'living' });
  // the tutorial vase: play starts in the dining room after Komur bolts from the foyer (playtest 4); the middle of
  // the sideboard stays clear to land on beside it.  It must shatter on the first swipe or on any fall (it once
  // survived a table-edge + wall bounce)
  level.named.tutVase = P('tut_vase', 'urn', 2.74, 0.88, -4.62, 0, { variant: 1 }, { zone: 'living', meta: { score: 250, label: 'Grandma\'s GOOD vase', breakDv: 2.0, tier: 'fragile' } });
  P('sb_potion', 'potion', 3.12, 0.88, -4.5, 0, { variant: 1 }, { zone: 'living' });
  // mantel (top y=1.31)
  P('mantel_candle1', 'candle', 6.2, 1.31, 1.3, 0, {}, { zone: 'living' });
  P('mantel_candle2', 'candle', 6.2, 1.31, 3.1, 0, {}, { zone: 'living' });
  P('mantel_urn', 'vase', 6.25, 1.31, 2.2, 0, { variant: 2 }, { zone: 'living' });
  P('mantel_skull', 'skull', 6.25, 1.31, 1.75, -PI / 2, {}, { zone: 'living' });
  P('mantel_jar', 'jar', 6.25, 1.31, 2.65, 0, {}, { zone: 'living' });
  P('living_portrait_big', 'portrait', 6.82, 1.75, 2.2, -PI / 2, { variant: 2, w: 0.9, h: 1.1 }, { zone: 'living', meta: { score: 300, label: 'the family portrait' } });
  P('living_portrait2', 'portrait', 1.33, 1.3, 2.4, PI / 2, { variant: 3 }, { zone: 'living' });
  P('living_mirror', 'mirror', 2.6, 1.2, 4.83, PI, {}, { zone: 'living' });
  P('living_shelf', 'shelf', 1.34, 1.45, 0.4, PI / 2, { len: 1.2 }, { zone: 'living' });
  P('lshelf_p1', 'potion', 1.4, 1.49, 0.0, 0, { variant: 0 }, { zone: 'living' });
  P('lshelf_p2', 'potion', 1.4, 1.49, 0.4, 0, { variant: 1 }, { zone: 'living' });
  P('lshelf_p3', 'potion', 1.4, 1.49, 0.8, 0, { variant: 2 }, { zone: 'living' });
  P('living_umbrella', 'urn', 6.4, 0, -4.6, 0, {}, { zone: 'living' }); // moved off the conservatory doorway

  // ================================================================== CONSERVATORY / LIBRARY WING x[7,12.4] z[-5,5]
  // two doorways from the living room (z=0, z=4.1), a back door to the yard (x=9.6); glass lean-to roof
  P('cons_rug', 'rug', 9.8, 0, 0.2, 0, { w: 3.2, d: 2.6 });
  // library corner: two full bookcases flanking the yard door
  for (const [ci, bx] of [[0, 7.95], [1, 11.4]]) {
    P(`cons_bookcase${ci}`, 'bookcase', bx, 0, -4.66, 0, {}, { zone: 'wing', meta: { label: 'the library' } });
    for (let s = 0; s < 4; s++) for (let b = 0; b < 5; b++)
      P(`cbook_${ci}_${s}_${b}`, 'book', bx - 0.42 + b * 0.21 + (s % 2) * 0.03, [0.065, 0.575, 1.075, 1.575][s], -4.66, 0, { variant: ci * 20 + s * 5 + b }, { zone: 'wing' });
  }
  P('cons_armchair', 'armchair', 8.3, 0, -2.9, Math.PI * 0.8, { variant: 1 }, { zone: 'wing' });
  P('cons_sidetable', 'roundtable', 7.6, 0, -2.0, 0, {}, { zone: 'wing' });
  P('cons_candle', 'candle', 7.5, 0.62, -2.1, 0, {}, { zone: 'wing' });
  P('cons_crystal', 'crystalball', 7.68, 0.62, -1.88, 0, {}, { zone: 'wing' });
  P('cons_globe', 'globe', 8.7, 0, -1.9, 0, {}, { zone: 'wing' });
  // the tea table (the good china, again)
  P('cons_teatable', 'table', 9.8, 0, 0.2, 0, { len: 1.3, depth: 1.0 }, { zone: 'wing', meta: { label: 'the tea table' } });
  P('cons_chair1', 'chair', 9.8, 0, 1.0, Math.PI, {}, { zone: 'wing' });
  P('cons_chair2', 'chair', 9.8, 0, -0.6, 0, { variant: 1 }, { zone: 'wing' });
  P('cons_chair3', 'chair', 8.9, 0, 0.2, Math.PI / 2, { variant: 1 }, { zone: 'wing' });
  P('cons_chair4', 'chair', 10.7, 0, 0.2, -Math.PI / 2, {}, { zone: 'wing' });
  const tt = 0.76;
  P('cons_cakestand', 'cakestand', 9.8, tt, 0.22, 0, {}, { zone: 'wing', meta: { label: 'the cake stand' } });
  P('cons_teapot', 'teapot', 10.25, tt, -0.08, 2.2, {}, { zone: 'wing' });
  [[9.38, -0.05], [10.22, 0.5], [9.38, 0.5]].forEach(([x, z], i) => P(`cons_plate${i}`, 'plate', x, tt, z, 0, {}, { zone: 'wing' }));
  [[9.55, -0.18], [10.02, 0.6], [9.25, 0.28], [10.35, 0.24]].forEach(([x, z], i) => P(`cons_cup${i}`, 'cup', x, tt, z, 0, {}, { zone: 'wing' }));
  // potion bench along the east wall
  P('cons_bench', 'table', 11.8, 0, 1.5, Math.PI / 2, { len: 2.4, depth: 0.7 }, { zone: 'wing', meta: { label: 'the potion bench' } });
  [[11.7, 0.45, 'potion', 0], [11.92, 0.75, 'alembic', 0], [11.68, 1.05, 'potion', 1], [11.9, 1.35, 'jar', 0], [11.7, 1.62, 'alembic', 0],
    [11.93, 1.9, 'potion', 2], [11.7, 2.15, 'bottle', 1], [11.92, 2.4, 'skull', 0], [11.68, 2.58, 'potion', 0], [11.95, 0.5, 'bottle', 0]]
    .forEach(([x, z, k, v], i) => P(`cons_bench_${i}`, k, x, tt, z, 0, { variant: v }, { zone: 'wing' }));
  // tiered plant stands under the east windows, every step crowded with pots
  for (const [si, sz] of [[0, -2.8], [1, 3.6]]) {
    P(`cons_plantstand${si}`, 'plantstand', 11.85, 0, sz, -Math.PI / 2, {}, { zone: 'wing' });
    [[0.22, 0.32], [0, 0.64], [-0.22, 0.96]].forEach(([lz, y], k) => [-0.35, 0, 0.35].forEach((lx, j) =>
      P(`cons_pot_${si}_${k}_${j}`, 'flowerpot', 11.85 - lz, y, sz + lx, 0, {}, { zone: 'wing', scale: 0.8 })));
  }
  P('cons_birdcage', 'birdcage', 11.3, 0, -0.6, 0.4, {}, { zone: 'wing', meta: { label: 'the crow cage' } });
  P('cons_telescope', 'telescope', 11.3, 0, 4.25, 0.6, {}, { zone: 'wing' });
  P('cons_gramotable', 'roundtable', 7.55, 0, 1.9, 0, {}, { zone: 'wing' });
  P('cons_gramophone', 'gramophone', 7.55, 0.62, 1.9, 1.2, {}, { zone: 'wing', meta: { label: 'the gramophone' } });
  P('cons_sideboard', 'sideboard', 9.6, 0, 4.6, Math.PI, {}, { zone: 'wing' });
  P('cons_terrarium', 'terrarium', 9.2, 0.88, 4.6, 0.2, {}, { zone: 'wing' });
  P('cons_vase', 'vase', 10.15, 0.88, 4.6, 0, { variant: 3 }, { zone: 'wing' });
  P('cons_candle2', 'candle', 9.85, 0.88, 4.55, 0, {}, { zone: 'wing' });
  P('cons_portrait1', 'portrait', 7.18, 1.55, -2.3, Math.PI / 2, { variant: 8 }, { zone: 'wing' });
  P('cons_portrait2', 'portrait', 7.18, 1.55, 2.3, Math.PI / 2, { variant: 9, w: 0.5, h: 0.7 }, { zone: 'wing' });
  P('cons_mirror', 'mirror', 12.22, 1.25, -1.1, -Math.PI / 2, {}, { zone: 'wing' });
  P('cons_umbrella', 'umbrellastand', 10.6, 0, -4.2, 0, {}, { zone: 'wing' });

  // ================================================================== more breakables in the old rooms
  P('kitchen_cup4', 'cup', -4.85, kt, -1.7, 0, {}, { zone: 'kitchen' });
  P('kitchen_bottle4', 'bottle', -4.25, kt, -2.2, 0, { variant: 1 }, { zone: 'kitchen' });
  P('kitchen_plate3', 'plate', -3.15, ct, -4.5, 0, {}, { zone: 'kitchen' });
  P('foyer_potion2', 'potion', -2.2, 1.34, 1.33, 0, { variant: 2 }, { zone: 'foyer' });
  P('foyer_candle2', 'candle', -3.65, 0.88, 0.9, 0, {}, { zone: 'foyer' });
  P('sb_cup1', 'cup', 3.14, 0.88, -4.74, 0, {}, { zone: 'living' });
  P('dresser_potion', 'potion', -6.62, F2 + 0.88, 3.74, 0, { variant: 0 }, { zone: 'bedroom' });
  P('dresser_candle', 'candle', -6.6, F2 + 0.88, 2.25, 0, {}, { zone: 'bedroom' });
  P('study_globe', 'globe', -2.6, F2, -4.5, 0.4, {}, { zone: 'study' });
  P('gallery_telescope', 'telescope', 1.8, F2, -3.3, -0.9, {}, { zone: 'gallery' });
  P('landing_vase2', 'vase', -1.4, F2, -4.6, 0, { variant: 2 }, { zone: 'landing' });

  // ================================================================== BEDROOM (upper) x[-7,-2] z[0.5,5]
  P('bed_rug', 'rug', -4.4, F2, 3.0, 0, { w: 2.2, d: 1.6 });
  level.named.bed = P('bedroom_bed', 'bed', -4.6, F2, 3.9, PI, {}, { zone: 'bedroom' });
  level.named.wardrobe = P('bedroom_wardrobe', 'wardrobe', -5.1, F2, 1.06, 0, {}, { zone: 'bedroom', meta: { label: 'the wardrobe', hp: 120 } });
  P('bedroom_nightstand', 'roundtable', -3.35, F2, 4.45, 0, {}, { zone: 'bedroom' });
  P('bedroom_lamp', 'candle', -3.35, F2 + 0.62, 4.45, 0, {}, { zone: 'bedroom' });
  P('bedroom_potion', 'potion', -3.2, F2 + 0.62, 4.25, 0, { variant: 2 }, { zone: 'bedroom' });
  P('bedroom_dresser', 'sideboard', -6.6, F2, 3.0, PI / 2, {}, { zone: 'bedroom' });
  P('dresser_vase', 'vase', -6.6, F2 + 0.88, 2.5, 0, { variant: 1 }, { zone: 'bedroom' });
  P('dresser_crystal', 'crystalball', -6.6, F2 + 0.88, 3.1, 0, {}, { zone: 'bedroom' });
  P('dresser_bottle', 'bottle', -6.6, F2 + 0.88, 3.55, 0, { variant: 1 }, { zone: 'bedroom' });
  P('bedroom_mirror', 'mirror', -6.82, F2 + 1.1, 4.4, PI / 2, {}, { zone: 'bedroom' });
  P('bedroom_portrait', 'portrait', -2.13, F2 + 1.2, 4.2, -PI / 2, { variant: 4 }, { zone: 'bedroom' });
  P('bedroom_chair', 'chair', -2.9, F2, 1.6, -PI / 2, {}, { zone: 'bedroom' });

  // ================================================================== STUDY (upper) x[-7,-2] z[-5,0.5]
  P('study_desk', 'desk', -5.4, F2, -4.4, 0, {}, { zone: 'study' });
  const dk = F2 + 0.765;
  P('study_skull', 'skull', -5.9, dk, -4.45, 0.4, {}, { zone: 'study' });
  P('study_crystal', 'crystalball', -5.0, dk, -4.5, 0, {}, { zone: 'study' });
  P('study_ink', 'bottle', -5.4, dk, -4.3, 0, {}, { zone: 'study' });
  P('study_candle', 'candle', -4.8, dk, -4.25, 0, {}, { zone: 'study' });
  P('study_chair', 'chair', -5.4, F2, -3.6, PI, {}, { zone: 'study' });
  P('study_bookcase1', 'bookcase', -6.66, F2, -1.0, PI / 2, {}, { zone: 'study' });
  P('study_bookcase2', 'bookcase', -6.66, F2, -2.4, PI / 2, {}, { zone: 'study' });
  for (let c = 0; c < 2; c++) for (let s = 0; s < 4; s++) for (let b = 0; b < 4; b++)
    P(`sbook_${c}_${s}_${b}`, 'book', -6.62, F2 + [0.065, 0.575, 1.075, 1.575][s], (c ? -2.4 : -1.0) - 0.42 + b * 0.24 + (s % 2) * 0.05, PI / 2, { variant: c * 16 + s * 4 + b }, { zone: 'study' });
  P('study_table', 'table', -3.5, F2, -3.9, 0, { len: 1.3, depth: 0.7 }, { zone: 'study' });
  const st = F2 + 0.76;
  [[-3.9, -3.9, 0], [-3.6, -4.0, 1], [-3.3, -3.8, 2], [-3.0, -3.95, 0]].forEach(([x, z, v], i) => P(`study_potion${i}`, 'potion', x, st, z, 0, { variant: v }, { zone: 'study' }));
  P('study_jar', 'jar', -4.0, st, -3.7, 0, {}, { zone: 'study' });
  P('study_portrait', 'portrait', -2.13, F2 + 1.2, -4.0, -PI / 2, { variant: 5 }, { zone: 'study' });

  // ================================================================== LANDING / GALLERY (upper)
  P('landing_table', 'roundtable', -1.55, F2, 4.45, 0, {}, { zone: 'landing' });
  P('landing_vase', 'vase', -1.55, F2 + 0.62, 4.45, 0, { variant: 0 }, { zone: 'landing' });
  P('landing_portrait1', 'portrait', -1.88, F2 + 1.2, 0.0, PI / 2, { variant: 6 }, { zone: 'landing' });
  P('landing_portrait2', 'portrait', -1.88, F2 + 1.2, -4.2, PI / 2, { variant: 7 }, { zone: 'landing' });
  P('bedroom_stool', 'stool', -6.0, F2, 4.5, 0, {}, { zone: 'bedroom' });
  P('gallery_chair', 'chair', 2.25, F2, -4.55, PI / 4, {}, { zone: 'gallery' });
  P('gallery_candle', 'candle', 2.42, F2, -2.4, 0, {}, { zone: 'gallery' });
  P('gallery_urn', 'urn', 2.36, F2, 1.8, 0, {}, { zone: 'gallery' });
  P('gallery_crate', 'crate', 1.7, F2, 4.4, 0.3, {}, { zone: 'gallery' });

  // ================================================================== YARD z[-17,-5]
  P('yard_wood', 'firewood', -8.9, 0, -9.0, PI / 2, {}, { zone: 'yard' });
  P('yard_barrel1', 'barrel', 7.6, 0, -6.9, 0, {}, { zone: 'yard' });
  P('yard_barrel2', 'barrel', 8.4, 0, -7.7, 0, {}, { zone: 'yard' });
  P('yard_barrel3', 'barrel', 7.5, 0, -8.6, 0, {}, { zone: 'yard' });
  P('yard_wheelbarrow', 'wheelbarrow', -2.0, 0, -7.0, 0.5, {}, { zone: 'yard' });
  [[-2.5, -5.6], [-1.6, -5.65], [0.8, -5.6], [6.3, -5.6], [-8.8, -15.8], [8.6, -15.6]].forEach(([x, z], i) => P(`yard_pot${i}`, 'flowerpot', x, 0, z, 0, {}, { zone: 'yard' }));
  [[3.5, -13.2], [4.4, -12.6], [5.2, -13.5], [4.0, -14.2], [5.9, -12.8]].forEach(([x, z], i) => P(`yard_pumpkin${i}`, 'pumpkin', x, 0, z, i, {}, { zone: 'yard' }));
  P('yard_crate1', 'crate', -4.4, 0, -12.6, 0.2, {}, { zone: 'yard' });
  P('yard_crate2', 'crate', -4.3, 0, -13.2, -0.3, {}, { zone: 'yard' });
  P('yard_crate3', 'crate', -4.35, 0.5, -12.9, 0.7, {}, { zone: 'yard' });
  P('yard_bucket', 'bucket', 0.9, 0, -11.2, 0, {}, { zone: 'yard' });
  // the wider east yard behind the conservatory
  P('yard_birdbath', 'birdbath', -2.6, 0, -9.2, 0, {}, { zone: 'yard' });
  P('yard_scarecrow', 'scarecrow', 6.7, 0, -14.6, -0.5, {}, { zone: 'yard', meta: { label: 'the scarecrow' } });
  P('yard_bench', 'bench', 2.9, 0, -16.2, 0, {}, { zone: 'yard' });
  [[10.6, -6.0], [11.6, -6.1], [12.3, -9.2], [12.3, -12.4], [11.0, -16.0]].forEach(([x, z], i) => P(`yard_epot${i}`, 'flowerpot', x, 0, z, 0, {}, { zone: 'yard' }));
  P('yard_crate4', 'crate', 11.9, 0, -14.6, 0.3, {}, { zone: 'yard' });
  P('yard_crate5', 'crate', 11.6, 0, -15.3, -0.2, {}, { zone: 'yard' });
  P('yard_barrel4', 'barrel', 12.2, 0, -7.6, 0, {}, { zone: 'yard' });
  buildYardDecor(game, level);
  buildShed(game, level);

  // ================================================================== structural / custom
  buildGalleryRailing(game, level);
  buildWeakFloor(game, level);
  // every window in the house is real glass now: swat it, throw things through it, or bait Grandma into it
  (game.house.windows ?? []).forEach((w, i) => P(`window_${i}`, 'window', w.cx, w.cy, w.cz, w.alongX ? 0 : PI / 2,
    { w: Math.max(0.3, w.w - 0.04), h: Math.max(0.3, w.h - 0.04) }, { zone: 'windows', meta: { label: 'a window' } }));

  // ================================================================== hide spots
  level.hideSpots.push(
    { id: 'hide_dining', pos: new THREE.Vector3(4.4, 0, -0.5), radius: 0.95, label: 'under the dining table' },
    { id: 'hide_kitchen', pos: new THREE.Vector3(-4.6, 0, -1.9), radius: 0.75, label: 'under the kitchen table' },
    { id: 'hide_bed', pos: new THREE.Vector3(-4.6, F2, 3.9), radius: 1.0, label: 'under the bed' },
    { id: 'hide_stairs', pos: new THREE.Vector3(0.5, 0, 0.4), radius: 0.9, label: 'under the stairs' },
    { id: 'hide_barrels', pos: new THREE.Vector3(8.9, 0, -8.6), radius: 0.8, label: 'behind the barrels' },
    { id: 'hide_teatable', pos: new THREE.Vector3(9.8, 0, 0.2), radius: 0.8, label: 'under the tea table' },
  );

  // ================================================================== Grandma navigation graph
  level.nav = buildNav();
  level.grannySpawn = new THREE.Vector3(-5.2, 0, -3.3);
  // where Grandma tosses a caught cat (soft landings, every room)
  level.safeSpots = [
    new THREE.Vector3(-5.5, 0, 3.6), new THREE.Vector3(-3.0, 0, -0.2), new THREE.Vector3(-1.1, 0, 2.0),
    new THREE.Vector3(2.6, 0, 1.6), new THREE.Vector3(5.8, 0, -3.0), new THREE.Vector3(-3.0, F2, 2.0),
    new THREE.Vector3(-4.5, F2, -1.2), new THREE.Vector3(1.9, F2, -1.0), new THREE.Vector3(0.0, 0, -9.0),
    new THREE.Vector3(5.0, 0, -11.0), new THREE.Vector3(9.6, 0, -2.0), new THREE.Vector3(10.4, 0, -9.0),
  ];
  return level;
}

// ---------------------------------------------------------------------------- custom builders
function makeMesh(geo, mat, x, y, z, parent) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true; m.receiveShadow = true;
  parent.add(m);
  return m;
}

function buildGalleryRailing(game, level) {
  const D = game.destruction, P = game.physics;
  const beam = woodMat('rough_wood', { tint: 0x9a8070 });
  const x = 2.62, y = F2;
  for (let i = 0; i < 5; i++) {
    const z0 = -5 + i * 2, z1 = z0 + 2, cz = (z0 + z1) / 2;
    const g = new THREE.Group();
    g.position.set(x, y, cz);
    game.scene.add(g);
    const parts = [];
    parts.push({ mesh: makeMesh(boxGeo(0.1, 0.08, 2.0), beam, 0, 0.95, 0, g), type: 'box', w: 0.1, h: 0.08, d: 2.0, frag: 'wood' });
    parts.push({ mesh: makeMesh(boxGeo(0.08, 0.06, 2.0), beam, 0, 0.12, 0, g), type: 'box', w: 0.08, h: 0.06, d: 2.0, frag: 'wood' });
    for (let k = 0; k <= 6; k++) {
      const post = k === 0 || k === 6;
      const mesh = makeMesh(boxGeo(post ? 0.1 : 0.04, 0.95, post ? 0.1 : 0.04), beam, 0, 0.475, -1 + k / 3, g);
      parts.push({ mesh, type: 'box', w: post ? 0.1 : 0.04, h: 0.95, d: post ? 0.1 : 0.04, frag: 'wood' });
    }
    const top = P.addStaticBox(x, y + 0.95, cz, 0.05, 0.04, 1.0, { groups: GROUPS.rail });
    const block = P.addStaticBox(x, y + 0.45, cz, 0.04, 0.45, 1.0, { groups: GROUPS.rail });
    const rec = D.registerCustom({
      id: `gallery_rail_${i}`, kind: 'railing', group: g, parts, colliders: [top, block], zone: 'gallery',
      meta: { tier: 'structural', family: 'railings', material: 'wood', score: 900, ruin: 3, hp: 60, requiresGranny: true, noise: 14, label: 'the balcony rail' },
    });
    level.named[`rail${i}`] = rec;
  }
}

function buildWeakFloor(game, level) {
  const D = game.destruction, P = game.physics;
  const wf = game.house.weakFloor;
  const w = wf.x1 - wf.x0, d = wf.z1 - wf.z0;
  const g = new THREE.Group();
  g.position.set((wf.x0 + wf.x1) / 2, wf.y, (wf.z0 + wf.z1) / 2);
  game.scene.add(g);
  const floorMat = woodMat('wooden_floor_02', { tint: 0xb09a82, key: 'weakFloor' });
  const parts = [];
  // three boards so the fracture reads as planks
  for (let i = 0; i < 3; i++) {
    const bw = w / 3;
    const m = makeMesh(boxGeo(bw - 0.01, 0.2, d, 1.5), floorMat, -w / 2 + bw * (i + 0.5), -0.1, 0, g);
    parts.push({ mesh: m, type: 'box', w: bw - 0.01, h: 0.2, d, frag: 'wood' });
  }
  // glowing stress cracks (hidden until primed)
  const crackMat = colorMat(0xff6a20, { emissive: 0xff4a10, emissiveIntensity: 0, transparent: true, opacity: 0.0, key: 'crackGlow' }).clone();
  const cracks = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.9, d * 0.9), crackMat);
  cracks.rotation.x = -Math.PI / 2; cracks.position.y = 0.006;
  g.add(cracks);
  const col = P.addStaticBox(g.position.x, wf.y - 0.1, g.position.z, w / 2, 0.1, d / 2, { groups: GROUPS.fixture });
  const rec = D.registerCustom({
    id: 'sp03_floor', kind: 'weakfloor', group: g, parts, colliders: [col], zone: 'bedroom',
    meta: { tier: 'structural', family: 'floors', material: 'wood', score: 0, ruin: 0, hp: 9999, requiresGranny: true, noise: 18 },
  });
  rec.cracks = cracks;
  rec.rim = buildHoleRim(game, wf, floorMat);
  level.named.weakFloor = rec;
}

/** What SP03 leaves around the hole in the bedroom floor (playtest 4: "no hole after the wardrobe falls"): broken
 *  board ends hanging into it and dark cracks splitting the boards around it.  Built with the world and shown by
 *  `SetPieces._openFloorHole` (the crack decal is drawn from the start at opacity 0, so nothing compiles then). */
function buildHoleRim(game, wf, floorMat) {
  const cx = (wf.x0 + wf.x1) / 2, cz = (wf.z0 + wf.z1) / 2, w = wf.x1 - wf.x0, d = wf.z1 - wf.z0;
  const rnd = mulberry(303);
  // splintered board ends: thin planks hinged at the rim, sticking 8-34 cm into the hole and hanging down
  const geos = [];
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3();
  const edges = [
    { len: w, n: 7, at: (u) => [wf.x0 + u, wf.z0], inward: [0, 1] }, { len: w, n: 7, at: (u) => [wf.x0 + u, wf.z1], inward: [0, -1] },
    { len: d, n: 5, at: (u) => [wf.x0, wf.z0 + u], inward: [1, 0] }, { len: d, n: 5, at: (u) => [wf.x1, wf.z0 + u], inward: [-1, 0] },
  ];
  for (const ed of edges) {
    for (let i = 0; i < ed.n; i++) {
      const u = (i + 0.2 + rnd() * 0.6) * ed.len / ed.n;
      const [x, z] = ed.at(u);
      const stick = 0.08 + rnd() * 0.26, wide = 0.1 + rnd() * 0.12, droop = 0.25 + rnd() * 0.7;
      const geo = boxGeo(ed.inward[0] ? stick : wide, 0.05, ed.inward[0] ? wide : stick, 1.5);
      // hinge at the rim: shift the box so one end sits on the edge, tip it down into the hole
      geo.translate(ed.inward[0] * stick / 2, -0.03, ed.inward[1] * stick / 2);
      e.set(ed.inward[1] * droop, (rnd() - 0.5) * 0.4, -ed.inward[0] * droop);
      q.setFromEuler(e);
      p.set(x, wf.y - 0.02, z);
      geo.applyMatrix4(m4.compose(p, q, s));
      geos.push(geo);
    }
  }
  const stubs = new THREE.Mesh(mergeGeometries(geos), floorMat);
  for (const gg of geos) gg.dispose();
  stubs.castShadow = true; stubs.receiveShadow = true;
  stubs.visible = false;
  game.scene.add(stubs);
  // cracks radiating from the hole across the boards around it, the rim itself dark and splintered
  const M = 0.7, PW = w + 2 * M, PD = d + 2 * M, S = 512;
  const c = document.createElement('canvas'); c.width = c.height = S;
  const ctx = c.getContext('2d');
  const toPx = (x, z) => [((x - (cx - PW / 2)) / PW) * S, ((z - (cz - PD / 2)) / PD) * S];
  const [hx0, hz0] = toPx(wf.x0, wf.z0), [hx1, hz1] = toPx(wf.x1, wf.z1);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  // a jagged dark band hugging the rim
  ctx.fillStyle = 'rgba(22, 12, 6, 0.9)';
  ctx.beginPath();
  const per = [];
  const jag = (ax, az, bx, bz, n, ox, oz) => { for (let i = 0; i < n; i++) { const t = i / n, j = 3 + rnd() * 14; per.push([ax + (bx - ax) * t + ox * j, az + (bz - az) * t + oz * j]); } };
  jag(hx0, hz0, hx1, hz0, 18, 0, -1); jag(hx1, hz0, hx1, hz1, 16, 1, 0); jag(hx1, hz1, hx0, hz1, 18, 0, 1); jag(hx0, hz1, hx0, hz0, 16, -1, 0);
  per.forEach(([x, z], i) => (i ? ctx.lineTo(x, z) : ctx.moveTo(x, z)));
  ctx.closePath();
  ctx.rect(hx1, hz0, hx0 - hx1, hz1 - hz0); // the hole itself stays clear (even-odd)
  ctx.fill('evenodd');
  // cracks: wandering lines from the rim outward, thinning as they go
  for (let k = 0; k < 26; k++) {
    let [x, z] = per[Math.floor(rnd() * per.length)];
    const mx = x < hx0 ? -1 : x > hx1 ? 1 : 0, mz = z < hz0 ? -1 : z > hz1 ? 1 : 0;
    let ang = Math.atan2(mz || (rnd() - 0.5), mx || (rnd() - 0.5));
    let lw = 3.5 + rnd() * 2.5;
    const steps = 4 + Math.floor(rnd() * 6);
    for (let s2 = 0; s2 < steps; s2++) {
      ang += (rnd() - 0.5) * 0.9;
      const nx = x + Math.cos(ang) * (8 + rnd() * 14), nz = z + Math.sin(ang) * (8 + rnd() * 14);
      ctx.strokeStyle = `rgba(18, 10, 5, ${0.85 - s2 * 0.06})`; ctx.lineWidth = lw;
      ctx.beginPath(); ctx.moveTo(x, z); ctx.lineTo(nx, nz); ctx.stroke();
      x = nx; z = nz; lw = Math.max(0.8, lw * 0.78);
      if (rnd() < 0.2) { // a branch
        const ba = ang + (rnd() < 0.5 ? -1 : 1) * (0.5 + rnd() * 0.5);
        ctx.lineWidth = lw * 0.7; ctx.beginPath(); ctx.moveTo(x, z); ctx.lineTo(x + Math.cos(ba) * 14, z + Math.sin(ba) * 14); ctx.stroke();
      }
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const decalMat = new THREE.MeshStandardMaterial({ map: tex, transparent: true, opacity: 0, depthWrite: false, roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -2 });
  const decal = new THREE.Mesh(new THREE.PlaneGeometry(PW, PD), decalMat);
  decal.rotation.x = -Math.PI / 2;
  decal.position.set(cx, wf.y + 0.004, cz);
  decal.receiveShadow = true;
  game.scene.add(decal);
  return { stubs, decal };
}

/** Small seeded PRNG: the same rim every run. */
function mulberry(a) {
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

function buildShed(game, level) {
  const house = game.house;
  const M = house.mat;
  // small garden shed (static) with a breakable door and a roof the cat can climb via crates
  const cx = -6.8, cz = -14.2;
  house.box(M.moss, cx, 1.1, cz - 1.2, 3.0, 2.2, 0.12, {});
  house.box(M.moss, cx - 1.45, 1.1, cz, 0.12, 2.2, 2.5, {});
  house.box(M.moss, cx + 1.45, 1.1, cz + 0.25, 0.12, 2.2, 2.0, {});
  house.box(M.planks, cx, 2.3, cz, 3.3, 0.12, 2.9, { tile: 1.5 });
  house.box(M.moss, cx + 0.6, 1.1, cz + 1.2, 1.6, 2.2, 0.12, {});
  house.finalize();
  level.shed = { pos: new THREE.Vector3(cx, 0, cz) };
}

function buildYardDecor(game, level) {
  const house = game.house;
  const M = house.mat;
  // twisted trees (static trunks + foliage blobs)
  const leaf = colorMat(0x1f2a1a, { rough: 1, key: 'leaf', flat: true });
  for (const [x, z, h] of [[-8.6, -16.0, 5.5], [8.5, -12.0, 6], [-1.5, -16.2, 4.8], [9.0, -16.2, 5]]) {
    house.box(M.bark, x, h / 2, z, 0.45, h, 0.45, { tile: 1 });
    house.box(M.bark, x + 0.5, h * 0.75, z, 1.2, 0.2, 0.2, { tile: 1, collider: false, rotY: 0.3 });
    for (let i = 0; i < 4; i++) {
      const s = new THREE.Mesh(new THREE.IcosahedronGeometry(1.0 + Math.random() * 0.6, 0), leaf);
      s.position.set(x + (Math.random() - 0.5) * 1.8, h + (Math.random() - 0.2) * 1.0, z + (Math.random() - 0.5) * 1.8);
      s.castShadow = true;
      game.scene.add(s);
    }
  }
  // stone well
  house.box(M.stone, 0, 0.45, -12.5, 1.4, 0.9, 1.4, { tile: 1 });
  house.box(M.dark, 0, 0.91, -12.5, 1.0, 0.02, 1.0, { collider: false });
  house.box(M.beam, -0.6, 1.4, -12.5, 0.1, 1.0, 0.1, { collider: false });
  house.box(M.beam, 0.6, 1.4, -12.5, 0.1, 1.0, 0.1, { collider: false });
  house.box(M.beam, 0, 1.9, -12.5, 1.4, 0.1, 0.1, { collider: false });
  // pet tombstones (a witch's cats... ominous)
  const signs = ['MR.\nWHISKERS', 'SIR\nPOUNCE', 'NO. 9'];
  [[-2.8, -15.6], [-1.6, -15.9], [-0.4, -15.5]].forEach(([x, z], i) => {
    house.box(M.stone, x, 0.4, z, 0.55, 0.8, 0.14, { tile: 1 });
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.25), Mats.sign(signs[i], 'tomb' + i));
    sign.position.set(x, 0.55, z + 0.075);
    game.scene.add(sign);
  });
  house.finalize();
}

// ---------------------------------------------------------------------------- navigation
function buildNav() {
  const N = {};
  const node = (id, x, y, z, room) => { N[id] = { id, pos: new THREE.Vector3(x, y, z), room, links: new Set() }; };
  const link = (a, b) => { N[a].links.add(b); N[b].links.add(a); };
  // ground floor
  node('foyer_c', -4.4, 0, 2.7, 'foyer'); node('foyer_door', -4.5, 0, 4.3, 'foyer'); node('foyer_w', -6.0, 0, 3.2, 'foyer');
  node('foyer_kdoor', -5.0, 0, 0.5, 'foyer'); node('foyer_hdoor', -2.0, 0, 3.0, 'foyer');
  node('kitchen_c', -3.5, 0, -3.0, 'kitchen'); node('kitchen_w', -5.4, 0, -3.2, 'kitchen'); node('kitchen_n', -3.3, 0, -0.4, 'kitchen');
  node('kitchen_hdoor', -2.0, 0, -2.0, 'kitchen'); node('kitchen_back', -4.5, 0, -5.0, 'kitchen'); node('kitchen_fd', -5.0, 0, -0.3, 'kitchen');
  node('hall_front', -1.1, 0, 4.2, 'hall'); node('hall_mid', -1.1, 0, 1.0, 'hall'); node('hall_back', -1.1, 0, -4.0, 'hall');
  node('stair_bottom', 0.5, 0, 4.25, 'hall'); node('stair_top', 0.5, F2, -3.6, 'landing');
  node('living_fdoor', 1.2, 0, 4.3, 'living'); node('living_bdoor', 1.2, 0, -4.1, 'living');
  node('living_n', 2.4, 0, 3.0, 'living'); node('living_w2', 3.1, 0, 0.95, 'living'); node('living_mid', 4.4, 0, 0.95, 'living');
  node('living_e', 6.0, 0, 0.9, 'living'); node('living_fire', 5.3, 0, 2.2, 'living'); node('living_c', 2.6, 0, -0.5, 'living');
  node('living_s', 4.4, 0, -2.4, 'living'); node('living_sw', 2.8, 0, -3.3, 'living'); node('living_se', 5.8, 0, -2.8, 'living');
  node('living_french', 4.2, 0, -4.6, 'living');
  // upper floor
  node('landing_back', -1.1, F2, -4.0, 'landing'); node('landing_mid', -1.1, F2, 0.0, 'landing'); node('landing_front', -1.1, F2, 4.3, 'landing');
  node('bed_door', -2.0, F2, 2.8, 'bedroom'); node('bed_c', -3.4, F2, 2.2, 'bedroom'); node('bed_w', -5.84, F2, 3.0, 'bedroom');
  node('study_door', -2.0, F2, -2.2, 'study'); node('study_c', -4.2, F2, -2.4, 'study'); node('study_bdoor', -3.2, F2, 0.5, 'study');
  node('gallery_back', 1.9, F2, -4.0, 'gallery'); node('gallery_mid', 1.9, F2, 0.0, 'gallery'); node('gallery_front', 1.9, F2, 4.3, 'gallery');
  // yard
  node('yard_back', -4.5, 0, -6.4, 'yard'); node('yard_w', -5.5, 0, -10.5, 'yard'); node('yard_c', 0.0, 0, -9.5, 'yard');
  node('yard_e', 5.5, 0, -9.0, 'yard'); node('yard_french', 4.2, 0, -6.4, 'yard'); node('yard_s', 2.5, 0, -14.8, 'yard');
  node('yard_cons', 9.6, 0, -6.0, 'yard'); node('yard_ne', 10.4, 0, -10.6, 'yard');
  // conservatory wing
  node('living_cdoor', 6.25, 0, 0.0, 'living'); node('living_cdoor2', 6.25, 0, 4.1, 'living');
  node('cons_a', 7.9, 0, 0.0, 'wing'); node('cons_b', 7.9, 0, 4.1, 'wing'); node('cons_n', 8.4, 0, 2.2, 'wing');
  node('cons_c', 9.8, 0, 1.9, 'wing'); node('cons_s', 9.6, 0, -2.2, 'wing'); node('cons_e', 10.9, 0, -1.9, 'wing');
  node('cons_yard', 9.6, 0, -4.3, 'wing');
  // links
  link('foyer_door', 'foyer_c'); link('foyer_c', 'foyer_w'); link('foyer_c', 'foyer_kdoor'); link('foyer_c', 'foyer_hdoor');
  link('foyer_kdoor', 'kitchen_fd'); link('kitchen_fd', 'kitchen_n'); link('kitchen_n', 'kitchen_c'); link('kitchen_c', 'kitchen_w');
  link('kitchen_c', 'kitchen_hdoor'); link('kitchen_c', 'kitchen_back'); link('kitchen_n', 'kitchen_hdoor'); link('kitchen_w', 'kitchen_back');
  link('foyer_hdoor', 'hall_mid'); link('foyer_hdoor', 'hall_front'); link('kitchen_hdoor', 'hall_mid'); link('kitchen_hdoor', 'hall_back');
  link('hall_front', 'hall_mid'); link('hall_mid', 'hall_back'); link('hall_front', 'stair_bottom'); link('stair_bottom', 'living_fdoor');
  link('stair_bottom', 'stair_top'); link('hall_back', 'living_bdoor');
  link('living_fdoor', 'living_n'); link('living_n', 'living_w2'); link('living_w2', 'living_c'); link('living_w2', 'living_mid');
  link('living_mid', 'living_e'); link('living_e', 'living_fire'); link('living_e', 'living_se'); link('living_se', 'living_s');
  link('living_s', 'living_sw'); link('living_c', 'living_sw'); link('living_sw', 'living_bdoor'); link('living_sw', 'living_french'); link('living_s', 'living_french');
  link('stair_top', 'landing_back'); link('stair_top', 'gallery_back'); link('landing_back', 'landing_mid'); link('landing_mid', 'landing_front');
  link('landing_front', 'gallery_front'); link('gallery_back', 'gallery_mid'); link('gallery_mid', 'gallery_front');
  link('landing_front', 'bed_door'); link('landing_mid', 'bed_door'); link('bed_door', 'bed_c'); link('bed_c', 'bed_w');
  link('landing_back', 'study_door'); link('landing_mid', 'study_door'); link('study_door', 'study_c'); link('study_c', 'study_bdoor'); link('study_bdoor', 'bed_c');
  link('kitchen_back', 'yard_back'); link('yard_back', 'yard_w'); link('yard_back', 'yard_c'); link('yard_c', 'yard_w'); link('yard_c', 'yard_e');
  link('yard_c', 'yard_s'); link('yard_w', 'yard_s'); link('yard_e', 'yard_french'); link('yard_french', 'living_french'); link('yard_c', 'yard_french'); link('yard_e', 'yard_s');
  link('living_e', 'living_cdoor'); link('living_cdoor', 'cons_a'); link('living_fire', 'living_cdoor2'); link('living_cdoor2', 'cons_b');
  link('cons_a', 'cons_n'); link('cons_b', 'cons_n'); link('cons_n', 'cons_c'); link('cons_a', 'cons_s'); link('cons_s', 'cons_e');
  link('cons_s', 'cons_yard'); link('cons_yard', 'yard_cons'); link('yard_cons', 'yard_e'); link('yard_cons', 'yard_ne');
  link('yard_ne', 'yard_e'); link('yard_ne', 'yard_s');
  return N;
}
