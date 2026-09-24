// Prove the host-safe V7 delivery preserves every accepted buffer-view byte and metadata field.

import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { EXTERNAL_BUFFER_LIMIT_BYTES, verifyExternalDelivery, } from './external_gltf_delivery.mjs'

const REPO = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../../../..',
)
const MASTER = join(
  REPO,
  'art/glass-adventure/platform-trials/v7/runtime/master/cloudway-platform-kit-v7.glb',
)
const PUBLIC = join(REPO, 'apps/beside-cue/public/games/cloudway-v7')
const GLTF = join(PUBLIC, 'cloudway-platform-kit-v7.gltf')
const PARTS = ['01', '02', '03', '04'].map((part) =>
  join(PUBLIC, `cloudway-platform-kit-v7-part-${part}.bin`),
)

test('public parts reproduce every accepted master buffer view', async () => {
  const [master, gltfText, ...parts] = await Promise.all([
    readFile(MASTER),
    readFile(GLTF, 'utf8'),
    ...PARTS.map((path) => readFile(path)),
  ])
  const receipt = verifyExternalDelivery(master, JSON.parse(gltfText), parts)

  assert.equal(receipt.bufferViews.length, 49)
  assert.equal(
    receipt.bufferViews.reduce((total, view) => total + view.bytes, 0),
    77_373_828,
  )
  assert.equal(
    receipt.source.sha256,
    '0f7a2129e7cd23b4148605a46d12fe28361d9ba632bea5d81d92142922fffee9',
  )
  assert(parts.every((part) => part.byteLength <= EXTERNAL_BUFFER_LIMIT_BYTES))
})

test('one changed external byte fails accepted-view verification', async () => {
  const [master, gltfText, ...parts] = await Promise.all([
    readFile(MASTER),
    readFile(GLTF, 'utf8'),
    ...PARTS.map((path) => readFile(path)),
  ])
  const changed = [...parts]
  changed[1] = Buffer.from(changed[1])
  changed[1][changed[1].byteLength - 1] ^= 0xff

  assert.throws(
    () => verifyExternalDelivery(master, JSON.parse(gltfText), changed),
    /changed accepted buffer-view bytes/,
  )
  assert.notEqual(
    createHash('sha256').update(changed[1]).digest('hex'),
    createHash('sha256').update(parts[1]).digest('hex'),
  )
})
