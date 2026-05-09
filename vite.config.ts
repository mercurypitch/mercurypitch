import ssl from '@vitejs/plugin-basic-ssl'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import solidPlugin from 'vite-plugin-solid'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Only use SSL in dev mode - production builds don't need it
const isDev = process.env.NODE_ENV !== 'production'

export default defineConfig({
  plugins: [isDev ? ssl() : [], solidPlugin()],
  base: './',
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 3000,
    headers: {
      // Cross-origin isolation for multi-threaded WASM (ONNX Runtime)
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'credentialless',
    },
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
  worker: {
    format: 'es',
  },
  define: {
    'process.env': {},
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
