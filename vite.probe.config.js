// A second dev server for automated probes (port 5174): no HMR, so editing src/ never reloads a page under test;
// a fresh page load still gets the latest code.  npx vite --config vite.probe.config.js
import base from './vite.config.js';

export default { ...base, server: { ...base.server, port: 5174, hmr: false } };
