// Decode the shipped Meshopt V7 delivery and prove it lossless against the accepted master.
//
// PR #1275 re-encoded the public V7 kit with EXT_meshopt_compression (no quantization or
// filters), so its buffer views no longer match the master byte for byte. What must still
// match is everything a loader sees: each decoded accessor, each texture image and the glTF
// JSON outside storage.

import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { realpath } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { join } from 'node:path'

import { EXTERNAL_BUFFER_LIMIT_BYTES } from './external_gltf_delivery.mjs'

export const MESHOPT = 'EXT_meshopt_compression'

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex')
}

/** glTF Transform from apps/beside-cue, with the MeshoptDecoder it depends on registered. */
export async function loadDecodingGltfTransform(repo) {
  const cliPackage = await realpath(
    join(repo, 'apps/beside-cue/node_modules/@gltf-transform/cli/package.json'),
  )
  const require = createRequire(cliPackage)
  const core = require('@gltf-transform/core')
  const extensions = require('@gltf-transform/extensions')
  const functions = require('@gltf-transform/functions')
  const { MeshoptDecoder } = require('meshoptimizer')
  await MeshoptDecoder.ready
  const io = new core.NodeIO()
    .registerExtensions(extensions.ALL_EXTENSIONS)
    .registerDependencies({ 'meshopt.decoder': MeshoptDecoder })
  return { ...core, ...extensions, ...functions, io }
}

function decodedAccessorRecord(accessor) {
  const array = accessor.getArray()
  assert(array, 'Every accessor must expose an array.')
  return {
    type: accessor.getType(),
    componentType: accessor.getComponentType(),
    normalized: accessor.getNormalized(),
    count: accessor.getCount(),
    payloadBytes: array.byteLength,
    sha256: sha256(
      Buffer.from(array.buffer, array.byteOffset, array.byteLength),
    ),
  }
}

function imageRecord(texture) {
  const image = texture.getImage()
  return {
    name: texture.getName(),
    mimeType: texture.getMimeType(),
    bytes: image?.byteLength ?? 0,
    sha256: image === null ? null : sha256(image),
  }
}

// glTF JSON with storage locations removed: what a lossless re-encode must leave unchanged.
function jsonOutsideStorage(json) {
  const copy = structuredClone(json)
  for (const key of [
    'bufferViews',
    'buffers',
    'extensionsUsed',
    'extensionsRequired',
  ])
    delete copy[key]
  for (const accessor of copy.accessors ?? []) {
    delete accessor.bufferView
    delete accessor.byteOffset
  }
  for (const image of copy.images ?? []) delete image.bufferView
  return copy
}

function assertExtensionListGainsOnlyMeshopt(master = [], runtime = [], label) {
  assert.deepEqual(
    [...runtime].filter((name) => name !== MESHOPT).sort(),
    [...master].sort(),
    `Runtime ${label} may add only ${MESHOPT} to the master's list.`,
  )
}

/**
 * Throws unless the decoded runtime equals the master: JSON outside storage, every accessor
 * and every texture image. masterJson and runtimeJson are the raw glTF JSON; the documents
 * come from a decoding NodeIO; dependencyBytes are the runtime's external parts.
 */
export function verifyLosslessReencode(
  masterJson,
  runtimeJson,
  masterDocument,
  runtimeDocument,
  dependencyBytes,
) {
  assert(
    runtimeJson.extensionsUsed?.includes(MESHOPT),
    `Runtime kit is expected to use ${MESHOPT}.`,
  )
  assertExtensionListGainsOnlyMeshopt(
    masterJson.extensionsUsed,
    runtimeJson.extensionsUsed,
    'extensionsUsed',
  )
  assertExtensionListGainsOnlyMeshopt(
    masterJson.extensionsRequired,
    runtimeJson.extensionsRequired,
    'extensionsRequired',
  )
  assert.deepEqual(
    jsonOutsideStorage(runtimeJson),
    jsonOutsideStorage(masterJson),
    'Runtime glTF JSON differs from the accepted master outside storage.',
  )
  dependencyBytes.forEach((bytes, index) =>
    assert(
      bytes.byteLength <= EXTERNAL_BUFFER_LIMIT_BYTES,
      `Runtime part ${index + 1} exceeds the static-host part limit.`,
    ),
  )

  const masterAccessors = masterDocument.getRoot().listAccessors()
  const runtimeAccessors = runtimeDocument.getRoot().listAccessors()
  assert.equal(runtimeAccessors.length, masterAccessors.length)
  let decodedAccessorBytes = 0
  masterAccessors.forEach((master, index) => {
    const expected = decodedAccessorRecord(master)
    assert.deepEqual(
      decodedAccessorRecord(runtimeAccessors[index]),
      expected,
      `Decoded runtime accessor ${index} differs from the accepted master.`,
    )
    decodedAccessorBytes += expected.payloadBytes
  })

  const masterTextures = masterDocument.getRoot().listTextures()
  const runtimeTextures = runtimeDocument.getRoot().listTextures()
  assert.equal(runtimeTextures.length, masterTextures.length)
  masterTextures.forEach((master, index) =>
    assert.deepEqual(
      imageRecord(runtimeTextures[index]),
      imageRecord(master),
      `Runtime texture ${index} differs from the accepted master.`,
    ),
  )

  return {
    decoder: 'meshoptimizer MeshoptDecoder via glTF Transform',
    decodedAccessorsIdentical: true,
    accessorCount: masterAccessors.length,
    decodedAccessorBytes,
    texturesIdentical: true,
    textureCount: masterTextures.length,
    jsonIdenticalOutsideStorage: true,
    maximumPartBytes: Math.max(
      ...dependencyBytes.map((part) => part.byteLength),
    ),
    limitBytes: EXTERNAL_BUFFER_LIMIT_BYTES,
  }
}
