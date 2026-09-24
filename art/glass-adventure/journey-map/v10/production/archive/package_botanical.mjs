// Preserve the existing museum kit and replace only its flower-cluster prototype.
import fs from 'node:fs/promises'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const repo = path.resolve(root, '../../../..')
const require = createRequire(await fs.realpath(path.join(repo, 'apps/beside-cue/node_modules/@gltf-transform/cli/package.json')))
const { NodeIO } = require('@gltf-transform/core')
const { ALL_EXTENSIONS } = require('@gltf-transform/extensions')
const { mergeDocuments, prune, unpartition } = require('@gltf-transform/functions')
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
const output = path.join(root, 'delivery')
const resolution = Number(process.argv[2] ?? 1024)
if (![1024, 2048].includes(resolution)) throw new Error('Choose reviewed 1K or 2K texture delivery')
const suffix = resolution === 1024 ? '1k' : '2k'
await fs.mkdir(output, { recursive: true })
execFileSync('python3', [path.join(root, 'production/repair_bake_tangents.py')], { timeout: 30_000, stdio: 'inherit' })
const source = path.join(root, 'baked/camellia-crescent-rebaked-valid.glb')
const flora = await io.read(source)
const floraScene = flora.getRoot().getDefaultScene()
const children = floraScene.listChildren()
const unit = flora.createNode('map_flower_cluster')
for (const node of children) unit.addChild(node)
floraScene.addChild(unit)
await io.write(path.join(output, 'camellia-wrapped.glb'), flora)
const cli = path.join(repo, 'apps/beside-cue/node_modules/.bin/gltf-transform')
execFileSync(cli, ['resize', path.join(output, 'camellia-wrapped.glb'), path.join(output, `camellia-resized-${suffix}.glb`), '--width', String(resolution), '--height', String(resolution)], { timeout: 120_000, stdio: 'inherit' })
execFileSync(cli, ['webp', path.join(output, `camellia-resized-${suffix}.glb`), path.join(output, `camellia-webp-${suffix}.glb`), '--quality', '94', '--near-lossless', 'true', '--effort', '90'], { timeout: 180_000, stdio: 'inherit' })
execFileSync(cli, ['quantize', path.join(output, `camellia-webp-${suffix}.glb`), path.join(output, `camellia-crescent-${suffix}.glb`), '--quantization-volume', 'mesh', '--quantize-position', '16', '--quantize-normal', '16', '--quantize-texcoord', '16'], { timeout: 120_000, stdio: 'inherit' })

const priorPath = path.join(root, 'sources/floating-museum-twin-finish-kit-v9.glb')
const prior = await fs.readFile(priorPath)
const museum = await io.read(priorPath)
const old = museum.getRoot().listNodes().find(node => node.getName() === 'map_flower_cluster')
if (!old) throw new Error('Existing flower root not found')
const kept = museum.getRoot().getDefaultScene().listChildren().filter(node => node !== old).map(node => node.getName())
old.dispose()
const addition = await io.read(path.join(output, `camellia-crescent-${suffix}.glb`))
const addedUnit = addition.getRoot().listNodes().find(node => node.getName() === 'map_flower_cluster')
const mapping = mergeDocuments(museum, addition)
const cloned = mapping.get(addedUnit)
museum.getRoot().getDefaultScene().addChild(cloned)
for (const scene of museum.getRoot().listScenes())
  if (scene !== museum.getRoot().getDefaultScene()) scene.dispose()
await museum.transform(prune({ keepLeaves: true, keepAttributes: true, keepIndices: true }), unpartition())
const bundle = path.join(output, `floating-museum-botanical-kit-v10-${suffix}.glb`)
await io.write(bundle, museum)
const bytes = await fs.readFile(bundle)
const report = {
  sourceBundleSha256: createHash('sha256').update(prior).digest('hex'),
  outputSha256: createHash('sha256').update(bytes).digest('hex'),
  bytes: bytes.length,
  unchangedRoots: kept,
  replacedRoot: 'map_flower_cluster',
  botanicalResolution: resolution,
  method: 'Replace one instanced flower prototype, preserving every existing destination, arch, cliff, cypress, UV and material.',
}
await fs.writeFile(path.join(output, `manifest-${suffix}.json`), JSON.stringify(report, null, 2) + '\n')
console.log(report)

// Discard reproducible packaging intermediates; retain the source, master and deliveries.
for (const file of ['camellia-wrapped.glb', `camellia-resized-${suffix}.glb`, `camellia-webp-${suffix}.glb`]) await fs.rm(path.join(output, file), { force: true })
