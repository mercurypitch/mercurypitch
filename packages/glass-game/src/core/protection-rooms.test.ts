// Protection route tests — room ownership, atomic saved groups and separation from ordinary pitch completion.
import { describe, expect, it } from 'vitest'
import { ARCHIVE_HUSH_LEVEL_ID, ARCHIVE_HUSH_ROOMS, GLASS_ARCHIVE_HUSH, } from '../content/archive-hush-room'
import { GLASS_UNBROKEN_ARCHIVE } from '../content/unbroken-archive'
import type { LevelDefinition } from '../contracts'
import { createGlassGame } from './game'
import { MOVEMENT } from './movement'
import { mergeSavedProgress, readProgress } from './progress'
import { protectionRoomDefinitionError } from './protection-rooms'

const first = ARCHIVE_HUSH_ROOMS[0]!
const second = ARCHIVE_HUSH_ROOMS[1]!
const last = ARCHIVE_HUSH_ROOMS[2]!
const idle = { moveX: 0, moveZ: 0, jumpDown: false }
const checkpoint = (roomId: string) =>
  `${ARCHIVE_HUSH_LEVEL_ID}/${roomId}/checkpoint/entry`

function saved(ids: readonly string[], roomId = first.id) {
  return {
    version: 2 as const,
    levelId: ARCHIVE_HUSH_LEVEL_ID,
    checkpointId: checkpoint(roomId),
    completedBreakableIds: [...ids],
    finished: false,
  }
}

function atRoomWithoutProgress(roomIndex: number): LevelDefinition {
  return {
    ...GLASS_ARCHIVE_HUSH,
    checkpoints: [],
    spawn: {
      position: { x: 0, y: 0, z: ARCHIVE_HUSH_ROOMS[roomIndex]!.centerZ - 2.2 },
      facingYaw: Math.PI,
    },
  }
}

describe('protection room completion', () => {
  it('refuses unknown, future and already completed groups without side effects', () => {
    const game = createGlassGame(GLASS_ARCHIVE_HUSH)
    const before = game.saveProgress()
    expect(game.completeProtectionRoom('unknown')).toBe(false)
    expect(game.completeProtectionRoom(second.id)).toBe(false)
    expect(game.completeProtectionRoom(last.id)).toBe(false)
    expect(game.saveProgress()).toEqual(before)
    expect(game.completeProtectionRoom(first.id)).toBe(true)
    const accepted = game.saveProgress()
    expect(game.completeProtectionRoom(first.id)).toBe(false)
    expect(game.saveProgress()).toEqual(accepted)
    expect(game.snapshot().complete).toBe(false)
    expect(
      game.snapshot().breakables.every((target) => target.brokenAt === null),
    ).toBe(true)
  })

  it('requires prior rooms even if a host starts the player inside a future room', () => {
    for (const index of [1, 2]) {
      const game = createGlassGame(atRoomWithoutProgress(index))
      expect(game.snapshot().player.grounded).toBe(true)
      expect(game.completeProtectionRoom(ARCHIVE_HUSH_ROOMS[index]!.id)).toBe(
        false,
      )
      expect(game.saveProgress().completedBreakableIds).toEqual([])
    }
  })

  it('requires physical presence even when previous rooms are complete', () => {
    const game = createGlassGame(GLASS_ARCHIVE_HUSH, saved(first.vesselIds))
    expect(game.completeProtectionRoom(second.id)).toBe(false)
    expect(game.saveProgress().completedBreakableIds.slice().sort()).toEqual(
      first.vesselIds.slice().sort(),
    )
  })

  it('refuses paused and airborne completion, then accepts the grounded room', () => {
    const game = createGlassGame(GLASS_ARCHIVE_HUSH)
    game.setPaused(true)
    expect(game.completeProtectionRoom(first.id)).toBe(false)
    game.setPaused(false)
    game.step(idle, MOVEMENT.fixedStep)
    game.step({ ...idle, jumpDown: true }, MOVEMENT.fixedStep)
    expect(game.snapshot().player.grounded).toBe(false)
    expect(game.completeProtectionRoom(first.id)).toBe(false)
    for (let i = 0; i < 180; i++) game.step(idle, MOVEMENT.fixedStep)
    expect(game.completeProtectionRoom(first.id)).toBe(true)
  })

  it('keeps protection targets unavailable to ordinary pitch judging', () => {
    const game = createGlassGame(GLASS_ARCHIVE_HUSH)
    for (const id of first.vesselIds)
      expect(game.beginEncounter(id, 57)).toBe(false)
    for (let time = 0; time <= 2000; time += 50) {
      expect(
        game.feedPitch(
          {
            sequence: time,
            capturedAtMs: time,
            captureSeconds: time / 1000,
            midi: 57,
            confidence: 1,
          },
          time,
        ),
      ).toEqual([])
    }
    expect(game.saveProgress().completedBreakableIds).toEqual([])
  })

  it('does not expose protection completion on the normal Song route', () => {
    const game = createGlassGame(GLASS_UNBROKEN_ARCHIVE)
    expect(game.completeProtectionRoom(first.id)).toBe(false)
    for (let i = 0; i < 60; i++)
      game.step({ ...idle, moveZ: 1 }, MOVEMENT.fixedStep)
    const target = GLASS_UNBROKEN_ARCHIVE.breakables.find((item) =>
      item.id.endsWith('/sunlit-diadem'),
    )!
    expect(game.beginEncounter(target.id, 57)).toBe(true)
  })
})

describe('protection save restoration', () => {
  it('restores whole prior rooms, their open doors and the reachable next checkpoint', () => {
    for (const count of [1, 2]) {
      const complete = ARCHIVE_HUSH_ROOMS.slice(0, count).flatMap(
        (room) => room.vesselIds,
      )
      const next = ARCHIVE_HUSH_ROOMS[count]!
      const game = createGlassGame(GLASS_ARCHIVE_HUSH, saved(complete, next.id))
      expect(game.saveProgress().completedBreakableIds.slice().sort()).toEqual(
        complete.slice().sort(),
      )
      expect(game.saveProgress().checkpointId).toBe(checkpoint(next.id))
      expect(game.snapshot().player.position.z).toBeCloseTo(next.centerZ - 2.2)
      for (const [index, room] of ARCHIVE_HUSH_ROOMS.entries()) {
        expect(
          game
            .snapshot()
            .activeSolidIds?.includes(
              `${ARCHIVE_HUSH_LEVEL_ID}/${room.id}/solid/north-gate-body`,
            ),
        ).toBe(index >= count)
      }
      expect(game.completeProtectionRoom(next.id)).toBe(true)
      expect(game.snapshot().complete).toBe(false)
    }
  })

  it('discards partial groups and all later requested groups', () => {
    const partial = [
      ...first.vesselIds,
      second.vesselIds[0]!,
      ...last.vesselIds,
    ]
    const result = readProgress(GLASS_ARCHIVE_HUSH, {
      ...saved(partial, last.id),
      finished: true,
    })
    expect(result.completedBreakableIds.slice().sort()).toEqual(
      first.vesselIds.slice().sort(),
    )
    expect(result.checkpointId).toBe(checkpoint(first.id))
    expect(result.finished).toBe(false)
    expect(
      readProgress(
        GLASS_ARCHIVE_HUSH,
        saved([...second.vesselIds, ...last.vesselIds]),
      ).completedBreakableIds,
    ).toEqual([])
  })

  it('does not combine two partial protection attempts into a completed room', () => {
    const result = mergeSavedProgress(
      GLASS_ARCHIVE_HUSH,
      saved(first.vesselIds.slice(0, 2)),
      saved(first.vesselIds.slice(2)),
    )
    expect(result.completedBreakableIds).toEqual([])
  })

  it('preserves a stronger whole-room save when another visit has not completed it', () => {
    const result = mergeSavedProgress(
      GLASS_ARCHIVE_HUSH,
      saved(first.vesselIds, second.id),
      saved([]),
    )
    expect(result.completedBreakableIds.slice().sort()).toEqual(
      first.vesselIds.slice().sort(),
    )
    expect(result.finished).toBe(false)
  })
})

describe('protection content validation', () => {
  it.each([
    [
      'unknown target',
      { ...GLASS_ARCHIVE_HUSH.protectionRooms![0]!, vesselIds: ['missing'] },
    ],
    [
      'duplicate target',
      {
        ...GLASS_ARCHIVE_HUSH.protectionRooms![0]!,
        vesselIds: [first.vesselIds[0]!, first.vesselIds[0]!],
      },
    ],
    [
      'empty group',
      { ...GLASS_ARCHIVE_HUSH.protectionRooms![0]!, vesselIds: [] },
    ],
    [
      'invalid volume',
      {
        ...GLASS_ARCHIVE_HUSH.protectionRooms![0]!,
        bounds: { minX: 1, maxX: -1, minZ: 0, maxZ: 1 },
      },
    ],
  ])('rejects %s before accepting progress', (_name, room) => {
    expect(() =>
      createGlassGame({ ...GLASS_ARCHIVE_HUSH, protectionRooms: [room] }),
    ).toThrow('Invalid protection route')
  })

  it('requires intact mandatory targets and preceding dependency groups', () => {
    const target = GLASS_ARCHIVE_HUSH.breakables.find(
      (item) => item.id === first.vesselIds[0],
    )!
    for (const replacement of [
      { ...target, completion: 'shatter' as const },
      { ...target, optional: true },
    ]) {
      const level = {
        ...GLASS_ARCHIVE_HUSH,
        breakables: GLASS_ARCHIVE_HUSH.breakables.map((item) =>
          item.id === target.id ? replacement : item,
        ),
      }
      expect(protectionRoomDefinitionError(level)).toContain(
        'required awakening exhibit',
      )
    }
    expect(
      protectionRoomDefinitionError({
        ...GLASS_ARCHIVE_HUSH,
        protectionRooms: [...GLASS_ARCHIVE_HUSH.protectionRooms!].reverse(),
      }),
    ).toContain('earlier protection rooms')
  })
})
