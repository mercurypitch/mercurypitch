import ssl from '@vitejs/plugin-basic-ssl'
import { copyFileSync, existsSync, rmSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Plugin } from 'vite'
import { defineConfig } from 'vite'
import solidPlugin from 'vite-plugin-solid'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Only use SSL in dev mode - production builds don't need it
const isDev = process.env.NODE_ENV !== 'production'

let commitSha = 'unknown'
try {
  const { execSync } = await import('node:child_process')
  commitSha = execSync('git rev-parse --short HEAD').toString().trim()
} catch (e) {
  console.warn('Failed to get git commit sha', e)
}

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

/** Remove large UVR model from dist to avoid Cloudflare size limits */
function removeLargeUvrModelPlugin(): Plugin {
  return {
    name: 'remove-large-uvr-model',
    apply: 'build',
    closeBundle() {
      // FIXME: Stop copying the 63mb model to dist until we need it for client-side processing
      const modelPath = resolve(__dirname, 'dist/models/UVR-MDX-NET-Inst_HQ_3.onnx')
      if (existsSync(modelPath)) {
        rmSync(modelPath)
        console.log('Removed large UVR model from dist/')
      }
    },
  }
}

export default defineConfig({
  plugins: [isDev ? ssl() : [], solidPlugin(), copyOrtWorkerPlugin(), removeLargeUvrModelPlugin()],
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
    __COMMIT_SHA__: JSON.stringify(commitSha),
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
