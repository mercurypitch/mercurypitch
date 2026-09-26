import { createReadStream, statSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

const proofRoot = dirname(fileURLToPath(import.meta.url))
const repositoryRoot = resolve(proofRoot, '../../../../../../')
const assetRoot = resolve(proofRoot, '../../source-assets')
const runtimeGlb = resolve(
  assetRoot,
  'runtime/gilt-scroll-bridge/gilt-scroll-bridge-runtime-v1.glb',
)

export default defineConfig({
  root: proofRoot,
  resolve: {
    alias: [
      {
        find: /^three\/addons\/(.*)$/,
        replacement: resolve(
          repositoryRoot,
          'packages/glass-game/node_modules/three/examples/jsm/$1',
        ),
      },
      {
        find: /^three$/,
        replacement: resolve(
          repositoryRoot,
          'packages/glass-game/node_modules/three/build/three.module.js',
        ),
      },
      {
        find: '@scroll-adapter',
        replacement: resolve(
          repositoryRoot,
          'packages/glass-game/src/render/cloudway-scroll-adapter.ts',
        ),
      },
    ],
  },
  server: {
    host: '127.0.0.1',
    port: 5634,
    strictPort: true,
    hmr: false,
    watch: { ignored: ['**/*'] },
    fs: { allow: [repositoryRoot, assetRoot] },
  },
  build: {
    outDir: '/tmp/cloudway-scroll-runtime-proof-build',
    emptyOutDir: true,
  },
  plugins: [
    {
      name: 'serve-certified-scroll-glb',
      configureServer(server) {
        server.middlewares.use('/scroll-runtime.glb', (_request, response) => {
          const stat = statSync(runtimeGlb)
          response.statusCode = 200
          response.setHeader('Content-Type', 'model/gltf-binary')
          response.setHeader('Content-Length', String(stat.size))
          response.setHeader('Cache-Control', 'no-store')
          createReadStream(runtimeGlb).pipe(response)
        })
      },
    },
  ],
})
