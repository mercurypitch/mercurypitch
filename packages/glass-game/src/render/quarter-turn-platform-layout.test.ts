// Quarter-turn layout tests — multiple translated/cardinal modules keep independent two-box contracts.

import { describe, expect, it } from 'vitest'
import { PEARL_QUARTER_TURN_RENDER_ID, PEARL_QUARTER_TURN_SUPPORT, } from '../content/pearl-quarter-turn-profile'
import type { PlatformDefinition, PlatformRenderQuarterTurns, } from '../contracts'
import { resolvePearlQuarterTurnPlacements } from './quarter-turn-platform-layout'

function rotate(
  x: number,
  z: number,
  turns: PlatformRenderQuarterTurns,
): readonly [number, number] {
  if (turns === 0) return [x, z]
  if (turns === 1) return [z, -x]
  if (turns === 2) return [-x, -z]
  return [-z, x]
}

function part(
  id: string,
  index: 0 | 1,
  turns: PlatformRenderQuarterTurns,
  offset: { x: number; y: number; z: number },
  parentPlatformId?: string,
): PlatformDefinition {
  const source = PEARL_QUARTER_TURN_SUPPORT.boxes[index]
  const [x, z] = rotate(source.centre[0], source.centre[2], turns)
  const width = turns % 2 === 0 ? source.size[0] : source.size[2]
  const depth = turns % 2 === 0 ? source.size[2] : source.size[0]
  return {
    id,
    ...(parentPlatformId === undefined ? {} : { parentPlatformId }),
    minX: x + offset.x - width / 2,
    maxX: x + offset.x + width / 2,
    minZ: z + offset.z - depth / 2,
    maxZ: z + offset.z + depth / 2,
    top: offset.y,
    thickness: PEARL_QUARTER_TURN_SUPPORT.thickness,
    kind: 'deck',
    material: 'stone',
    renderId: PEARL_QUARTER_TURN_RENDER_ID,
    renderQuarterTurns: turns,
  }
}

function compound(
  id: string,
  turns: PlatformRenderQuarterTurns,
  offset: { x: number; y: number; z: number },
): readonly PlatformDefinition[] {
  return [part(id, 0, turns, offset), part(`${id}/z-arm`, 1, turns, offset, id)]
}

describe('pearl quarter-turn placement collection', () => {
  it('resolves multiple modules without merging their logical identities', () => {
    const platforms = [
      ...compound('turn-one', 0, { x: 0, y: 0, z: 0 }),
      ...compound('turn-two', 1, { x: 6.25, y: 0.4, z: -3.5 }),
    ]
    const placements = resolvePearlQuarterTurnPlacements(platforms)
    expect(placements).toHaveLength(2)
    expect(placements[0]).toMatchObject({
      publicPlatformId: 'turn-one',
      platformIds: ['turn-one', 'turn-one/z-arm'],
      position: { x: 0, y: -0.085, z: 0 },
      rotationY: 0,
    })
    expect(placements[1]).toMatchObject({
      publicPlatformId: 'turn-two',
      platformIds: ['turn-two', 'turn-two/z-arm'],
      rotationY: Math.PI / 2,
    })
    expect(placements[1]!.position.x).toBeCloseTo(6.25, 8)
    expect(placements[1]!.position.y).toBeCloseTo(0.315, 8)
    expect(placements[1]!.position.z).toBeCloseTo(-3.5, 8)
  })

  it('rejects an orphan or resized component rather than inventing support', () => {
    const valid = compound('turn', 0, { x: 0, y: 0, z: 0 })
    expect(() => resolvePearlQuarterTurnPlacements([valid[1]!])).toThrow(
      /orphan compound parts/,
    )
    expect(() =>
      resolvePearlQuarterTurnPlacements([
        valid[0]!,
        { ...valid[1]!, maxX: valid[1]!.maxX + 0.01 },
      ]),
    ).toThrow(/does not match its measured union box/)
  })

  it('rejects behavioral or independently activated compound parts', () => {
    const valid = compound('turn', 0, { x: 0, y: 0, z: 0 })
    expect(() =>
      resolvePearlQuarterTurnPlacements([
        { ...valid[0]!, activation: { allCompleted: ['rose-gate'] } },
        valid[1]!,
      ]),
    ).toThrow(/must be an always-active static deck/)
    expect(() =>
      resolvePearlQuarterTurnPlacements([
        valid[0]!,
        {
          ...valid[1]!,
          behavior: {
            kind: 'glide',
            translation: { x: 1, y: 0, z: 0 },
            travelSeconds: 2,
            dwellSeconds: 0.25,
          },
        },
      ]),
    ).toThrow(/must be an always-active static deck/)
  })
})
