import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  // the video capture writes thousands of frames under submission/: watching them slowed the dev server to a crawl
  server: { port: 5173, strictPort: true, watch: { ignored: ['**/submission/**', '**/test-results/**', '**/work/**', '**/assets_inbox/**', '**/dist/**'] } },
  build: { target: 'es2022', chunkSizeWarningLimit: 4000, assetsInlineLimit: 0 },
  test: { environment: 'node', include: ['tests/**/*.test.js'] },
});
