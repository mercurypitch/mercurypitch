// Prove the shipped Meshopt V7 delivery decodes to every accepted master accessor, texture and field.

import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { createExternalDelivery, EXTERNAL_BUFFER_LIMIT_BYTES, parseGlb, verifyExternalDelivery, } from './external_gltf_delivery.mjs'
import { loadDecodingGltfTransform, verifyLosslessReencode, } from './meshopt_delivery.mjs'

const REPO = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../../../..',
)
const MASTER = join(
  REPO,
  'art/glass-adventure/platform-trials/v7/runtime/master/cloudway-platform-kit-v7.glb',
)
const PUBLIC = join(REPO, 'apps/beside-cue/public/games/cloudway-v7')
const GLTF = join(PUBLIC, 'cloudway-platform-kit-v7-meshopt.gltf')
const MANIFEST = join(PUBLIC, 'manifest.json')

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex')

let loaded
function load() {
  loaded ??= (async () => {
    const manifest = JSON.parse(await readFile(MANIFEST, 'utf8'))
    const partPaths = manifest.bundle.dependencies.map(({ file }) =>
      join(PUBLIC, file),
    )
    const [masterBytes, gltfBytes, ...parts] = await Promise.all([
      readFile(MASTER),
      readFile(GLTF),
      ...partPaths.map((path) => readFile(path)),
    ])
    const { io } = await loadDecodingGltfTransform(REPO)
    return {
      manifest,
      masterBytes,
      gltfBytes,
      parts,
      io,
      masterJson: parseGlb(masterBytes).document,
      runtimeJson: JSON.parse(gltfBytes.toString('utf8')),
    }
  })()
  return loaded
}

async function decodedDocuments() {
  const { io, masterBytes } = await load()
  const [master, runtime] = await Promise.all([
    io.readBinary(masterBytes),
    io.read(GLTF),
  ])
  return { master, runtime }
}

test('shipped files match the runtime manifest and the accepted master', async () => {
  const { manifest, masterBytes, gltfBytes, parts } = await load()
  assert.equal(manifest.bundle.file, 'cloudway-platform-kit-v7-meshopt.gltf')
  assert.equal(sha256(gltfBytes), manifest.bundle.sha256)
  assert.equal(gltfBytes.byteLength, manifest.bundle.bytes)
  assert.deepEqual(
    parts.map((part, index) => ({
      file: manifest.bundle.dependencies[index].file,
      bytes: part.byteLength,
      sha256: sha256(part),
    })),
    manifest.bundle.dependencies,
  )
  assert.equal(
    sha256(masterBytes),
    '0f7a2129e7cd23b4148605a46d12fe28361d9ba632bea5d81d92142922fffee9',
  )
  assert.equal(manifest.bundle.acceptedMaster.sha256, sha256(masterBytes))
})

test('decoded Meshopt delivery is lossless against the accepted master', async () => {
  const { masterJson, runtimeJson, parts } = await load()
  const { master, runtime } = await decodedDocuments()
  const receipt = verifyLosslessReencode(
    masterJson,
    runtimeJson,
    master,
    runtime,
    parts,
  )
  assert.equal(receipt.accessorCount, 100)
  assert.equal(receipt.decodedAccessorBytes, 51_628_704)
  assert.equal(receipt.textureCount, 15)
  assert.equal(parts.length, 3)
})

test('one changed decoded byte fails the lossless check', async () => {
  const { masterJson, runtimeJson, parts } = await load()
  const { master, runtime } = await decodedDocuments()
  const accessor = runtime.getRoot().listAccessors()[7]
  const changed = accessor.getArray().slice()
  new Uint8Array(changed.buffer)[0] ^= 0xff
  accessor.setArray(changed)

  assert.throws(
    () =>
      verifyLosslessReencode(masterJson, runtimeJson, master, runtime, parts),
    /Decoded runtime accessor 7 differs/,
  )
})

// package_external_delivery.mjs still makes the pre-Meshopt step in memory and in its gitignored
// output folder; keep its byte-preserving packer covered without reading public files.
const PRE_MESHOPT_PARTS = ['01', '02', '03', '04'].map(
  (part) => `cloudway-platform-kit-v7-part-${part}.bin`,
)

test('pre-Meshopt packer keeps every accepted master buffer view', async () => {
  const { masterBytes } = await load()
  const delivery = createExternalDelivery(masterBytes, PRE_MESHOPT_PARTS)
  const receipt = verifyExternalDelivery(
    masterBytes,
    delivery.document,
    delivery.parts,
  )
  assert.equal(receipt.bufferViews.length, 49)
  assert.equal(
    receipt.bufferViews.reduce((total, view) => total + view.bytes, 0),
    77_373_828,
  )
  assert(
    delivery.parts.every(
      (part) => part.byteLength <= EXTERNAL_BUFFER_LIMIT_BYTES,
    ),
  )

  const changed = [...delivery.parts]
  changed[1] = Buffer.from(changed[1])
  changed[1][changed[1].byteLength - 1] ^= 0xff
  assert.throws(
    () => verifyExternalDelivery(masterBytes, delivery.document, changed),
    /changed accepted buffer-view bytes/,
  )
})
