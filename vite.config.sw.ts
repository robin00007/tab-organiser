import { defineConfig } from 'vite'
import { resolve } from 'node:path'

// The MV3 service worker is bundled on its own as a single self-contained
// classic script, so it never depends on chunk resolution at runtime.
export default defineConfig({
  build: {
    outDir: resolve(import.meta.dirname, 'dist'),
    emptyOutDir: false,
    target: 'chrome120',
    lib: {
      entry: resolve(import.meta.dirname, 'src/background/service-worker.ts'),
      formats: ['iife'],
      name: 'TabOrganiserWorker',
      fileName: () => 'service-worker.js',
    },
  },
})
