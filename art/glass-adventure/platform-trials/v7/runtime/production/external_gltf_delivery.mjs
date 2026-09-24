// Externalize one accepted GLB into byte-identical buffer-view parts below the static-host limit.

import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'

const GLB_MAGIC = 0x46546c67
const GLB_VERSION = 2
const JSON_CHUNK = 0x4e4f534a
const BIN_CHUNK = 0x004e4942

export const EXTERNAL_BUFFER_LIMIT_BYTES = 24 * 1024 * 1024

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex')
}

function align4(value) {
  return (value + 3) & ~3
}

export function parseGlb(bytes) {
  assert(bytes.byteLength >= 20, 'GLB is too short.')
  assert.equal(bytes.readUInt32LE(0), GLB_MAGIC, 'GLB magic is invalid.')
  assert.equal(bytes.readUInt32LE(4), GLB_VERSION, 'GLB must be version 2.')
  assert.equal(
    bytes.readUInt32LE(8),
    bytes.byteLength,
    'GLB declared length does not match its bytes.',
  )

  let offset = 12
  let document = null
  let binary = null
  while (offset < bytes.byteLength) {
    assert(offset + 8 <= bytes.byteLength, 'GLB chunk header is truncated.')
    const length = bytes.readUInt32LE(offset)
    const type = bytes.readUInt32LE(offset + 4)
    const start = offset + 8
    const end = start + length
    assert(end <= bytes.byteLength, 'GLB chunk payload is truncated.')
    const payload = bytes.subarray(start, end)
    if (type === JSON_CHUNK) {
      assert.equal(document, null, 'GLB contains more than one JSON chunk.')
      document = JSON.parse(
        payload.toString('utf8').replace(/[\u0000 ]+$/u, ''),
      )
    } else if (type === BIN_CHUNK) {
      assert.equal(binary, null, 'GLB contains more than one BIN chunk.')
      binary = payload
    }
    offset = end
  }

  assert(document, 'GLB is missing its JSON chunk.')
  assert(binary, 'GLB is missing its BIN chunk.')
  return { document, binary }
}

function bufferViewReferencePaths(value, path = '$', records = []) {
  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      bufferViewReferencePaths(item, `${path}[${index}]`, records),
    )
    return records
  }
  if (value === null || typeof value !== 'object') return records
  for (const [key, item] of Object.entries(value)) {
    const itemPath = `${path}.${key}`
    if (key === 'bufferView') records.push(itemPath)
    bufferViewReferencePaths(item, itemPath, records)
  }
  return records
}

function assertExternalizable(document, binary) {
  assert.equal(
    document.buffers?.length,
    1,
    'Accepted GLB must have one buffer.',
  )
  assert.equal(
    document.buffers[0].uri,
    undefined,
    'Accepted GLB buffer must be embedded.',
  )
  assert.equal(
    document.buffers[0].byteLength,
    binary.byteLength,
    'Accepted GLB buffer length must match its BIN chunk.',
  )
  assert(
    !document.extensionsUsed?.includes('EXT_meshopt_compression'),
    'Meshopt-owned buffer ranges need a decoder-aware packer.',
  )

  const unsupportedReferences = bufferViewReferencePaths(document).filter(
    (path) => !path.startsWith('$.accessors[') && !path.startsWith('$.images['),
  )
  assert.deepEqual(
    unsupportedReferences,
    [],
    'Only accessors and images may reference accepted buffer views.',
  )
}

function metadataWithoutBufferLocations(document) {
  const normalized = structuredClone(document)
  normalized.buffers = []
  for (const view of normalized.bufferViews ?? []) {
    delete view.buffer
    delete view.byteOffset
  }
  return normalized
}

export function createExternalDelivery(
  glbBytes,
  partNames,
  limitBytes = EXTERNAL_BUFFER_LIMIT_BYTES,
) {
  const { document: source, binary } = parseGlb(glbBytes)
  assertExternalizable(source, binary)
  assert(Number.isSafeInteger(limitBytes) && limitBytes > 0)

  const orderedViews = (source.bufferViews ?? [])
    .map((view, index) => ({
      index,
      start: view.byteOffset ?? 0,
      length: view.byteLength,
    }))
    .sort((left, right) => left.start - right.start || left.index - right.index)

  let previousEnd = 0
  for (const view of orderedViews) {
    assert(Number.isSafeInteger(view.start) && view.start >= previousEnd)
    assert(Number.isSafeInteger(view.length) && view.length > 0)
    assert(
      view.start + view.length <= source.buffers[0].byteLength,
      `Buffer view ${view.index} leaves the accepted BIN chunk.`,
    )
    assert(
      view.length <= limitBytes,
      `Buffer view ${view.index} exceeds the external-part limit.`,
    )
    previousEnd = view.start + view.length
  }

  const parts = []
  const viewRecords = []
  for (const view of orderedViews) {
    let part = parts.at(-1)
    let targetOffset = part === undefined ? 0 : align4(part.length)
    if (part !== undefined && targetOffset + view.length > limitBytes) {
      part = undefined
      targetOffset = 0
    }
    if (part === undefined) {
      part = { chunks: [], length: 0 }
      parts.push(part)
    }
    if (targetOffset > part.length)
      part.chunks.push(Buffer.alloc(targetOffset - part.length))
    const payload = binary.subarray(view.start, view.start + view.length)
    part.chunks.push(payload)
    part.length = targetOffset + view.length
    viewRecords.push({
      index: view.index,
      sourceOffset: view.start,
      part: parts.length - 1,
      partOffset: targetOffset,
      bytes: view.length,
      sha256: sha256(payload),
    })
  }

  assert.equal(
    partNames.length,
    parts.length,
    `Expected ${parts.length} external-part names.`,
  )
  const document = structuredClone(source)
  document.buffers = parts.map((part, index) => ({
    uri: partNames[index],
    byteLength: part.length,
  }))
  for (const record of viewRecords) {
    const view = document.bufferViews[record.index]
    view.buffer = record.part
    view.byteOffset = record.partOffset
  }

  const partBuffers = parts.map((part) =>
    Buffer.concat(part.chunks, part.length),
  )
  assert.deepEqual(
    metadataWithoutBufferLocations(document),
    metadataWithoutBufferLocations(source),
    'Externalization changed accepted glTF metadata.',
  )
  return {
    document,
    parts: partBuffers,
    receipt: {
      source: {
        bytes: glbBytes.byteLength,
        sha256: sha256(glbBytes),
        bufferBytes: binary.byteLength,
      },
      limitBytes,
      bufferViews: viewRecords,
      parts: partBuffers.map((part, index) => ({
        file: partNames[index],
        bytes: part.byteLength,
        sha256: sha256(part),
      })),
    },
  }
}

export function verifyExternalDelivery(
  glbBytes,
  externalDocument,
  partBuffers,
) {
  const names = externalDocument.buffers.map((buffer) => buffer.uri)
  assert(names.every((name) => typeof name === 'string'))
  const expected = createExternalDelivery(glbBytes, names)
  assert.deepEqual(
    externalDocument,
    expected.document,
    'Public glTF metadata differs from the accepted master.',
  )
  assert.equal(partBuffers.length, expected.parts.length)
  partBuffers.forEach((part, index) => {
    assert(
      part.equals(expected.parts[index]),
      `External part ${index + 1} changed accepted buffer-view bytes.`,
    )
  })
  return expected.receipt
}
