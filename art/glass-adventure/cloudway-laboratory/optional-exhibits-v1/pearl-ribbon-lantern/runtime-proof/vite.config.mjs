import { createReadStream, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

const proofRoot = dirname(fileURLToPath(import.meta.url))
const repositoryRoot = resolve(proofRoot, '../../../../../../')
const publicRoot = resolve(
  repositoryRoot,
  'apps/beside-cue/public/games/cloudway-laboratory-v1/optional-exhibits/pearl-ribbon-lantern',
)
const archiveRoot = resolve(
  process.env.GLASS_PEARL_LANTERN_SOURCE_ROOT ??
    resolve(
      homedir(),
      'Documents/root/5-Creative/besidecue/assets/glass-adventure/cloudway-laboratory/optional-exhibits-v1/pearl-ribbon-lantern',
    ),
)
const lodFiles = {
  lod0: resolve(archiveRoot, 'runtime/pearl-ribbon-lantern-lod0.glb'),
  lod1: resolve(publicRoot, 'pearl-ribbon-lantern-lod1.glb'),
}

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
    port: 5681,
    strictPort: true,
    hmr: false,
    watch: { ignored: ['**/*'] },
    fs: { allow: [repositoryRoot, archiveRoot] },
  },
  build: { outDir: '/tmp/pearl-ribbon-lantern-proof-build', emptyOutDir: true },
  plugins: [
    {
      name: 'serve-lantern-lods',
      configureServer(server) {
        for (const [lod, file] of Object.entries(lodFiles)) {
          server.middlewares.use(`/${lod}.glb`, (_request, response) => {
            const stat = statSync(file)
            response.statusCode = 200
            response.setHeader('Content-Type', 'model/gltf-binary')
            response.setHeader('Content-Length', String(stat.size))
            response.setHeader('Cache-Control', 'no-store')
            response.setHeader(
              'X-Proof-Asset-Distribution',
              lod === 'lod0' ? 'creative-archive' : 'shipping-runtime',
            )
            createReadStream(file).pipe(response)
          })
        }
      },
    },
  ],
})
