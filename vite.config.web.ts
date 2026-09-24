import { resolve } from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

/**
 * Build do site (GitHub Pages). Reaproveita as ferramentas e os tokens do
 * renderer; o que muda é só a casca. Project page mora em /BToolKit/, então o
 * base precisa acompanhar.
 */
export default defineConfig({
  root: resolve(__dirname, 'src/web'),
  base: process.env.BASE_SITE ?? '/BToolKit/',
  plugins: [react(), tailwindcss()],
  build: {
    outDir: resolve(__dirname, 'dist-web'),
    emptyOutDir: true
  }
})
