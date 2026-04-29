import { defineConfig } from 'vite'
import solidPlugin from 'vite-plugin-solid'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import ssl from '@vitejs/plugin-basic-ssl'

const __dirname = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [ssl(), solidPlugin()],
  base: './',
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 3000,
  },
  build: {
    target: 'esnext',
    sourcemap: true,
  },
  define: {
    'process.env': {},
  },
})
