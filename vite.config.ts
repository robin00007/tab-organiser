import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwind from '@tailwindcss/vite'
import { resolve } from 'node:path'

// Builds the three extension pages (popup, options and the new tab page).
// The service worker is built separately — see vite.config.sw.ts.
export default defineConfig({
  root: 'src',
  publicDir: resolve(import.meta.dirname, 'public'),
  plugins: [react(), tailwind()],
  build: {
    outDir: resolve(import.meta.dirname, 'dist'),
    emptyOutDir: true,
    target: 'chrome120',
    rollupOptions: {
      input: {
        popup: resolve(import.meta.dirname, 'src/popup/index.html'),
        options: resolve(import.meta.dirname, 'src/options/index.html'),
        newtab: resolve(import.meta.dirname, 'src/newtab/index.html'),
      },
    },
  },
})
