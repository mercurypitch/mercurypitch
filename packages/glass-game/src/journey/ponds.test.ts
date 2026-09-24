// Museum pond clearance — compare the authored water garden with the shipped Conservatory plinth.

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { FLOATING_MUSEUM_JOURNEY } from '../content/museum-journey'

function conservatoryPlinthRadius(): number {
  const bytes = readFileSync(
    new URL(
      '../../../../apps/beside-cue/public/games/journey-map-v8/floating-museum-architecture-kit-v8.glb',
      import.meta.url,
    ),
  )
  const jsonEnd = 20 + bytes.readUInt32LE(12)
  const document = JSON.parse(bytes.subarray(20, jsonEnd).toString())
  const node = document.nodes.find(
    (candidate: { name: string }) => candidate.name === 'map_conservatory_geometry',
  )
  const root = document.nodes.find(
    (candidate: { name: string }) => candidate.name === 'map_conservatory',
  )
  // The accepted export bakes transforms into its vertices. A replacement with
  // node transforms needs an updated measurement, not a silently wrong radius.
  for (const candidate of [root, node])
    for (const key of ['matrix', 'translation', 'rotation', 'scale'])
      expect(candidate[key], `Unexpected ${candidate.name} ${key}`).toBeUndefined()
  const primitive = document.meshes[node.mesh].primitives[0]
  const accessor = document.accessors[primitive.attributes.POSITION]
  expect(accessor.componentType).toBe(5126)
  expect(accessor.type).toBe('VEC3')
  const view = document.bufferViews[accessor.bufferView]
  const offset = jsonEnd + 8 + (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0)
  let radius = 0
  for (let index = 0; index < accessor.count; index++) {
    const point = offset + index * (view.byteStride ?? 12)
    if (bytes.readFloatLE(point + 4) > 0.18) continue
    radius = Math.max(radius, Math.hypot(bytes.readFloatLE(point), bytes.readFloatLE(point + 8)))
  }
  expect(radius).toBeGreaterThan(1)
  return radius
}

describe('museum water garden placement', () => {
  it('keeps the complete pond coping clear of the actual Conservatory base', () => {
    const stage = FLOATING_MUSEUM_JOURNEY.stages.find(
      (candidate) => candidate.kind === 'conservatory',
    )!
    const spillway = FLOATING_MUSEUM_JOURNEY.spillways.find(
      (candidate) => candidate.stageId === stage.id,
    )!
    const source = spillway.source!
    const baseRadius = conservatoryPlinthRadius() * stage.scale
    // Includes both the widest coping cross-section and its supporting stone bed.
    const borderRadius = Math.max(0.023, 0.02 * Math.max(source.width, source.length))
    let clearance = Infinity
    for (let index = 0; index < 128; index++) {
      const angle = index * Math.PI * 2 / 128
      const x = Math.cos(angle) * source.width * 0.5
      const z = Math.sin(angle) * source.length * 0.5
      const worldX = source.position[0] + x * Math.cos(spillway.yaw) + z * Math.sin(spillway.yaw)
      const worldZ = source.position[2] - x * Math.sin(spillway.yaw) + z * Math.cos(spillway.yaw)
      clearance = Math.min(clearance, Math.hypot(worldX - stage.architecturePosition[0], worldZ - stage.architecturePosition[2]) - baseRadius - borderRadius)
    }
    expect(clearance, 'Pond border needs visible space beside the imported plinth').toBeGreaterThan(0.08)
  })
})
