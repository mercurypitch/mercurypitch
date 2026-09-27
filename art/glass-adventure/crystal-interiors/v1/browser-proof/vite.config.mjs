import { createReadStream, statSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

const proofRoot = dirname(fileURLToPath(import.meta.url))
const repositoryRoot = resolve(proofRoot, '../../../../..')
const runtimeGlb = resolve(
  repositoryRoot,
  'apps/beside-cue/public/games/cloudway-laboratory-v1/gilt-scroll-bridge/gilt-scroll-bridge-runtime-v1.glb',
)
const cloudscape = resolve(
  repositoryRoot,
  'apps/beside-cue/public/games/journey-map-v3/cloudscape.webp',
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
    ],
  },
  server: {
    host: '127.0.0.1',
    port: 5679,
    strictPort: true,
    hmr: false,
    watch: { ignored: ['**/*'] },
    fs: { allow: [repositoryRoot] },
  },
  build: {
    outDir: '/tmp/crystal-interior-runtime-proof-build',
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
        server.middlewares.use('/cloudscape.webp', (_request, response) => {
          const stat = statSync(cloudscape)
          response.statusCode = 200
          response.setHeader('Content-Type', 'image/webp')
          response.setHeader('Content-Length', String(stat.size))
          response.setHeader('Cache-Control', 'no-store')
          createReadStream(cloudscape).pipe(response)
        })
      },
    },
  ],
})
