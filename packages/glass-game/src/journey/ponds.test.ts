// Museum pond clearance — compare the authored water garden with the shipped Conservatory plinth.

import { readFileSync } from 'node:fs'
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js'
import { describe, expect, it } from 'vitest'
import { GLASS_GAME_ASSET_FILES } from '../browser/assets'
import { FLOATING_MUSEUM_JOURNEY } from '../content/museum-journey'

interface MeshoptView {
  readonly byteOffset?: number
  readonly byteLength: number
  readonly byteStride: number
  readonly count: number
  readonly mode: string
  readonly filter?: string
}

async function conservatoryPlinthRadius(): Promise<number> {
  const bytes = readFileSync(
    new URL(
      `../../../../apps/beside-cue/public/games/${GLASS_GAME_ASSET_FILES['floating-museum-architecture-kit-v6']}`,
      import.meta.url,
    ),
  )
  const jsonEnd = 20 + bytes.readUInt32LE(12)
  const binStart = jsonEnd + 8
  const document = JSON.parse(bytes.subarray(20, jsonEnd).toString())
  const node = document.nodes.find(
    (candidate: { name: string }) =>
      candidate.name === 'map_conservatory_geometry',
  )
  const root = document.nodes.find(
    (candidate: { name: string }) => candidate.name === 'map_conservatory',
  )
  // The accepted export bakes transforms into its vertices. A replacement with
  // node transforms needs an updated measurement, not a silently wrong radius.
  for (const candidate of [root, node])
    for (const key of ['matrix', 'translation', 'rotation', 'scale'])
      expect(
        candidate[key],
        `Unexpected ${candidate.name} ${key}`,
      ).toBeUndefined()
  const primitive = document.meshes[node.mesh].primitives[0]
  const accessor = document.accessors[primitive.attributes.POSITION]
  expect(accessor.componentType).toBe(5126)
  expect(accessor.type).toBe('VEC3')
  const view = document.bufferViews[accessor.bufferView]
  // The delivery stores vertex views as lossless Meshopt streams.
  const meshopt = view.extensions?.EXT_meshopt_compression as
    | MeshoptView
    | undefined
  let data: Buffer
  if (meshopt) {
    await MeshoptDecoder.ready
    const start = binStart + (meshopt.byteOffset ?? 0)
    const decoded = await MeshoptDecoder.decodeGltfBufferAsync(
      meshopt.count,
      meshopt.byteStride,
      bytes.subarray(start, start + meshopt.byteLength),
      meshopt.mode,
      meshopt.filter,
    )
    data = Buffer.from(decoded.buffer, decoded.byteOffset, decoded.byteLength)
  } else {
    const start = binStart + (view.byteOffset ?? 0)
    data = bytes.subarray(start, start + view.byteLength)
  }
  let radius = 0
  for (let index = 0; index < accessor.count; index++) {
    const point = (accessor.byteOffset ?? 0) + index * (view.byteStride ?? 12)
    if (data.readFloatLE(point + 4) > 0.18) continue
    radius = Math.max(
      radius,
      Math.hypot(data.readFloatLE(point), data.readFloatLE(point + 8)),
    )
  }
  expect(radius).toBeGreaterThan(1)
  return radius
}

describe('museum water garden placement', () => {
  it('keeps the complete pond coping clear of the actual Conservatory base', async () => {
    const stage = FLOATING_MUSEUM_JOURNEY.stages.find(
      (candidate) => candidate.kind === 'conservatory',
    )!
    const spillway = FLOATING_MUSEUM_JOURNEY.spillways.find(
      (candidate) => candidate.stageId === stage.id,
    )!
    const source = spillway.source!
    const baseRadius = (await conservatoryPlinthRadius()) * stage.scale
    // Includes both the widest coping cross-section and its supporting stone bed.
    const borderRadius = Math.max(
      0.023,
      0.02 * Math.max(source.width, source.length),
    )
    let clearance = Infinity
    for (let index = 0; index < 128; index++) {
      const angle = (index * Math.PI * 2) / 128
      const x = Math.cos(angle) * source.width * 0.5
      const z = Math.sin(angle) * source.length * 0.5
      const worldX =
        source.position[0] +
        x * Math.cos(spillway.yaw) +
        z * Math.sin(spillway.yaw)
      const worldZ =
        source.position[2] -
        x * Math.sin(spillway.yaw) +
        z * Math.cos(spillway.yaw)
      clearance = Math.min(
        clearance,
        Math.hypot(
          worldX - stage.architecturePosition[0],
          worldZ - stage.architecturePosition[2],
        ) -
          baseRadius -
          borderRadius,
      )
    }
    expect(
      clearance,
      'Pond border needs visible space beside the imported plinth',
    ).toBeGreaterThan(0.08)
  })
})
