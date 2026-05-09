import ssl from '@vitejs/plugin-basic-ssl'
import { copyFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Plugin } from 'vite'
import { defineConfig } from 'vite'
import solidPlugin from 'vite-plugin-solid'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Only use SSL in dev mode - production builds don't need it
const isDev = process.env.NODE_ENV !== 'production'

/** Copy ORT companion files to dist during production build */
function copyOrtWorkerPlugin(): Plugin {
  return {
    name: 'copy-ort-worker',
    apply: 'build',
    writeBundle() {
      const src = resolve(
        __dirname,
        'node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.jsep.mjs',
      )
      const dest = resolve(
        __dirname,
        'dist/assets/ort-wasm-simd-threaded.jsep.mjs',
      )
      copyFileSync(src, dest)
    },
  }
}

export default defineConfig({
  plugins: [isDev ? ssl() : [], solidPlugin(), copyOrtWorkerPlugin()],
  base: './',
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/api/uvr': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/uvr/, ''), // Removes prefix before sending to API
      },
    },
  },
  build: {
    target: 'esnext',
    sourcemap: true,
  },
  define: {
    'process.env': {},
  },
  optimizeDeps: {
    exclude: ['onnxruntime-web'],
  },
  css: {
    transformer: 'lightningcss',
    lightningcss: {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      drafts: { nesting: true } as Record<string, unknown>,
    },
    modules: {
      localsConvention: 'camelCaseOnly',
    },
  },
})
