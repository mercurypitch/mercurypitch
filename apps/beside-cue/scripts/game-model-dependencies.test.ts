// Game model dependency tests — binary JSON extraction and local resource boundaries.

import { describe, expect, it } from 'vitest'
import { gameModelDependencies } from './game-model-dependencies.ts'

function glb(document: object): Buffer {
  const text = JSON.stringify(document)
  const json = Buffer.from(
    text.padEnd(Math.ceil(Buffer.byteLength(text) / 4) * 4, ' '),
  )
  const header = Buffer.alloc(20)
  header.writeUInt32LE(0x46546c67, 0)
  header.writeUInt32LE(2, 4)
  header.writeUInt32LE(20 + json.length, 8)
  header.writeUInt32LE(json.length, 12)
  header.writeUInt32LE(0x4e4f534a, 16)
  return Buffer.concat([header, json])
}

describe('offline model dependencies', () => {
  it.each(['gltf', 'glb'])(
    'resolves %s relative images and buffers, ignoring embedded resources',
    (format) => {
      const document = {
        buffers: [{ uri: '../shared/geometry.bin' }, { byteLength: 12 }],
        images: [
          { uri: 'museum-jasmine-full-v11.webp' },
          { uri: 'data:image/png;base64,eA==' },
          { bufferView: 0 },
        ],
      }
      const bytes =
        format === 'glb' ? glb(document) : Buffer.from(JSON.stringify(document))
      expect(
        gameModelDependencies(`games/journey-map-v11/model.${format}`, bytes),
      ).toEqual([
        'games/shared/geometry.bin',
        'games/journey-map-v11/museum-jasmine-full-v11.webp',
      ])
    },
  )

  it('accepts the self-contained mobile GLB without an external inventory dependency', () => {
    expect(
      gameModelDependencies(
        'games/journey-map-v11/mobile.glb',
        glb({ buffers: [{ byteLength: 4 }], images: [{ bufferView: 0 }] }),
      ),
    ).toEqual([])
  })

  it.each([
    'https://cdn.invalid/a.webp',
    '//cdn.invalid/a.webp',
    '/a.webp',
    '../../a.webp',
    '%2e%2e/%2e%2e/a.webp',
    '..%5ca.webp',
    'a.webp?cache=1',
    'a.webp#image',
  ])('rejects nonlocal or ambiguous URI %s', (uri) => {
    expect(() =>
      gameModelDependencies(
        'games/museum/model.glb',
        glb({ images: [{ uri }] }),
      ),
    ).toThrow()
  })

  it.each([
    'header',
    'version',
    'length',
    'json-type',
    'json-length',
    'truncated-chunk',
  ])('rejects malformed GLB %s', (kind) => {
    let bytes = glb({ images: [] })
    if (kind === 'header') bytes.writeUInt32LE(0, 0)
    if (kind === 'version') bytes.writeUInt32LE(1, 4)
    if (kind === 'length') bytes.writeUInt32LE(bytes.length + 4, 8)
    if (kind === 'json-type') bytes.writeUInt32LE(0, 16)
    if (kind === 'json-length') bytes.writeUInt32LE(bytes.length, 12)
    if (kind === 'truncated-chunk') {
      bytes = Buffer.concat([bytes, Buffer.alloc(4)])
      bytes.writeUInt32LE(bytes.length, 8)
    }
    expect(() =>
      gameModelDependencies('games/museum/model.glb', bytes),
    ).toThrow(/GLB/u)
  })
})
