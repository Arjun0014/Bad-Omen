// Encode the wood textures to KTX2 (public/assets/textures/ktx2/): albedo (_diff) -> ETC1S sRGB, packed AO/rough/metal
// (_arm) -> ETC1S linear, normals (_nor) -> UASTC + RDO + Zstandard (ETC1S blocks up normal maps).  Rows are flipped
// so the data matches what TextureLoader uploads with flipY = true (compressed textures can't be flipped at upload).
// Setup (not a project dependency):  npm install --no-save ktx2-encoder@0.6.0
// Usage:  python tools/ktx2/decode_rgba.py public/assets/textures <tmp>/raw
//         node tools/ktx2/encode_ktx2.mjs <tmp>/raw public/assets/textures/ktx2 [etc1sQuality=192] [only=diff,arm,nor]
// (~10 min for all 24; the in-game loader is preloadCompressedTextures() in src/world/Materials.js)
import { encodeToKTX2 } from 'ktx2-encoder';
import fs from 'node:fs';
import path from 'node:path';

const [rawDir, outDir, q = '192', only = ''] = process.argv.slice(2);
fs.mkdirSync(outDir, { recursive: true });
const sizes = JSON.parse(fs.readFileSync(path.join(rawDir, 'sizes.json'), 'utf8'));
const t0 = Date.now();
for (const [base, [width, height]] of Object.entries(sizes)) {
  const data = new Uint8Array(fs.readFileSync(path.join(rawDir, base + '.rgba')));
  const kind = base.endsWith('_diff') ? 'diff' : base.endsWith('_nor') ? 'nor' : 'arm';
  if (only && !only.split(',').includes(kind)) continue;
  const opts = {
    imageDecoder: async () => ({ width, height, data }),
    generateMipmap: true,
    isYFlip: true,
    isKTX2File: true,
    ...(kind === 'diff' || kind === 'arm'
      ? { isUASTC: false, qualityLevel: +q, compressionLevel: 2, isPerceptual: kind === 'diff', isSetKTX2SRGBTransferFunc: kind === 'diff' }
      : { isUASTC: true, uastcLDRQualityLevel: 2, needSupercompression: true, enableRDO: true, rdoQualityLevel: 1.5, isPerceptual: false, isSetKTX2SRGBTransferFunc: false, isNormalMap: true }),
  };
  const t = Date.now();
  const ktx = await encodeToKTX2(new Uint8Array(0), opts);
  fs.writeFileSync(path.join(outDir, base + '.ktx2'), ktx);
  console.log(`${base}.ktx2 ${kind} ${(ktx.byteLength / 1024).toFixed(0)} KB ${Date.now() - t} ms`);
}
console.log(`done in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
