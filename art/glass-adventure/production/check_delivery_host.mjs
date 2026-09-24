// Verify the complete staged delivery and real web middleware without loading the app.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import { glassGameAssetsPlugin, stageGlassGameAssets, } from '../../../tools/glass-game-assets.ts'
import { GLASS_GAME_REQUIRED_FILES, GLASS_GAME_ON_DEMAND_ASSET_IDS, glassGameAssetPath, } from '../../../packages/glass-game/src/browser/assets.ts'

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const source = join(repo, 'apps/beside-cue/public/games')
const work = mkdtempSync(join(tmpdir(), 'glassworks-delivery-host-'))
const output = join(work, 'staged')
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex')
const server = await createServer({
  root: work,
  configFile: false,
  plugins: [glassGameAssetsPlugin({ sourceDirectory: source })],
  optimizeDeps: { noDiscovery: true, include: [] },
  server: {
    host: '127.0.0.1',
    port: 5959,
    strictPort: true,
    watch: null,
    hmr: false,
  },
  logLevel: 'error',
})
try {
  stageGlassGameAssets(source, output)
  const staged = GLASS_GAME_REQUIRED_FILES.map((file) => {
    const target = join(output, file)
    assert.equal(
      sha256(readFileSync(target)),
      sha256(readFileSync(join(source, file))),
      file,
    )
    return { file, bytes: statSync(target).size }
  })
  await server.listen()
  const gltfPath = glassGameAssetPath('cloudway-platform-kit-v1')
  const document = JSON.parse(readFileSync(join(source, gltfPath), 'utf8'))
  const paths = [
    gltfPath,
    ...document.buffers.map((buffer) => join(dirname(gltfPath), buffer.uri)),
    ...GLASS_GAME_ON_DEMAND_ASSET_IDS.map(glassGameAssetPath),
  ]
  const requests = []
  for (const path of paths) {
    const response = await fetch(
      'http://127.0.0.1:5959/glass-game-assets/' + path,
    )
    assert.equal(response.status, 200, path)
    const data = Buffer.from(await response.arrayBuffer())
    assert.equal(sha256(data), sha256(readFileSync(join(source, path))), path)
    const type = response.headers.get('content-type')
    assert.equal(
      type,
      path.endsWith('.gltf')
        ? 'model/gltf+json'
        : path.endsWith('.mp3')
          ? 'audio/mpeg'
          : 'application/octet-stream',
    )
    requests.push({
      path,
      status: response.status,
      type,
      bytes: data.length,
      sha256: sha256(data),
    })
  }
  console.log(
    JSON.stringify(
      {
        stagedFiles: staged.length,
        allStagedHashesMatch: true,
        largestStagedFile: staged.toSorted((a, b) => b.bytes - a.bytes)[0],
        requests,
      },
      null,
      2,
    ),
  )
} finally {
  await server.close()
  rmSync(work, { recursive: true, force: true })
}
