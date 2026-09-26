import { createReadStream, statSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

const proofRoot = dirname(fileURLToPath(import.meta.url))
const repositoryRoot = resolve(proofRoot, '../../../../../../')
const assetRoot = resolve(proofRoot, '../../source-assets')
const runtimeRoot = resolve(assetRoot, 'runtime/rose-quartz-crackle-fast')
const bundles = new Map([
  [
    '/rose-full.glb',
    resolve(runtimeRoot, 'rose-quartz-crackle-fast-runtime-v1-full-detail.glb'),
  ],
  [
    '/rose-bounded.glb',
    resolve(runtimeRoot, 'rose-quartz-crackle-fast-runtime-v1.glb'),
  ],
])

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
        find: '@crackle-adapter',
        replacement: resolve(
          repositoryRoot,
          'packages/glass-game/src/render/cloudway-crackle-adapter.ts',
        ),
      },
    ],
  },
  server: {
    host: '127.0.0.1',
    port: 5635,
    strictPort: true,
    hmr: false,
    watch: { ignored: ['**/*'] },
    fs: { allow: [repositoryRoot, assetRoot] },
  },
  build: {
    outDir: '/tmp/cloudway-rose-runtime-proof-build',
    emptyOutDir: true,
  },
  plugins: [
    {
      name: 'serve-rose-runtime-glbs',
      configureServer(server) {
        server.middlewares.use((request, response, next) => {
          const path =
            request.url === undefined ? undefined : bundles.get(request.url)
          if (path === undefined) return next()
          const stat = statSync(path)
          response.statusCode = 200
          response.setHeader('Content-Type', 'model/gltf-binary')
          response.setHeader('Content-Length', String(stat.size))
          response.setHeader('Cache-Control', 'no-store')
          createReadStream(path).pipe(response)
        })
      },
    },
  ],
})
