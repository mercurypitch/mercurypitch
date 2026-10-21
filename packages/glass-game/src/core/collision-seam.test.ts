// Connected-seam regressions — empty space must not become an automatic step-up.
import { describe, expect, it } from 'vitest'
import type { PlatformDefinition } from '../contracts'
import { FLAT_COURSE_COLLIDER } from './collision'
import { MOVEMENT } from './movement'

const source: PlatformDefinition = {
  id: 'source',
  minX: -1,
  maxX: 0,
  minZ: -1,
  maxZ: 1,
  top: 0,
  thickness: 0.3,
  kind: 'deck',
  material: 'stone',
}

describe('physical connected seams', () => {
  it('does not grant a step-up across a 1cm void', () => {
    const target = { ...source, id: 'target', minX: 0.01, maxX: 1, top: 0.05 }
    const result = FLAT_COURSE_COLLIDER.move(
      { x: -0.2, y: 0, z: 0 },
      { x: 0.3, y: -0.01, z: 0 },
      [source, target],
      MOVEMENT,
    )
    expect(result.position.y).toBe(0)
    expect(result.blockedX).toBe(true)
    expect(result.support?.id).toBe('source')
  })

  it('does not join disjoint convex footprints merely because their AABBs overlap', () => {
    const first = {
      ...source,
      maxX: 1,
      supportPolygon: [
        { x: -1, z: -1 },
        { x: 1, z: -1 },
        { x: -1, z: 1 },
      ],
    }
    const target = {
      ...source,
      id: 'target',
      minX: -0.9,
      maxX: 1,
      minZ: -0.9,
      top: 0.05,
      supportPolygon: [
        { x: -0.9, z: 1 },
        { x: 1, z: -0.9 },
        { x: 1, z: 1 },
      ],
    }
    const result = FLAT_COURSE_COLLIDER.move(
      { x: -0.1, y: 0, z: -0.1 },
      { x: 0.3, y: -0.01, z: 0.3 },
      [first, target],
      MOVEMENT,
    )
    expect(result.position.y).toBeLessThan(target.top)
    expect(result.support?.id).not.toBe('target')
    expect(result.blockedX || result.blockedZ).toBe(true)
  })

  it('retains the visible shallow step where footprints really touch', () => {
    const target = { ...source, id: 'target', minX: 0, maxX: 1, top: 0.05 }
    const result = FLAT_COURSE_COLLIDER.move(
      { x: -0.2, y: 0, z: 0 },
      { x: 0.3, y: -0.01, z: 0 },
      [source, target],
      MOVEMENT,
    )
    expect(result.position.y).toBe(target.top)
    expect(result.support?.id).toBe('target')
    expect(result.blockedX).toBe(false)
  })
})
