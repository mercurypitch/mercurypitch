// Cloudway layout tests — fixed-step traversal, save isolation and authored sightline invariants.

import { describe, expect, it } from 'vitest'
import type { GlassGame, LevelDefinition } from '../contracts'
import { createGlassGame } from '../core/game'
import { CLOUDWAY_FOG_FAR, CLOUDWAY_FOG_NEAR } from '../render/cloudway-scene'
import type { CloudwayLayoutAudition } from './cloudway-layouts'
import { CLOUDWAY_CURRENT_LAYOUT_ID, CLOUDWAY_CURRENT_TRIAL, CLOUDWAY_LAYOUT_AUDITIONS, CLOUDWAY_LAYOUT_SAVE_IDS, selectCloudwayLayout, } from './cloudway-layouts'
import { CLOUDWAY_ENCOUNTER_IDS, CLOUDWAY_GLASS_RIBBON, CLOUDWAY_PLATFORM_IDS, } from './cloudway-trial'

const REST = { moveX: 0, moveZ: 0, jumpDown: false }
const CAMERA_PITCH = 0.36

interface Driver {
  readonly game: GlassGame
  readonly visited: Set<string>
  readonly respawns: () => number
  readonly respawnLog: readonly string[]
  step(moveX?: number, moveZ?: number, jumpDown?: boolean): void
  moveTo(
    target: { readonly x: number; readonly z: number },
    platformId?: string,
  ): void
  sing(encounterId: string): void
}

function driver(level: LevelDefinition, dt: number): Driver {
  const game = createGlassGame(level)
  const visited = new Set<string>()
  let elapsed = 0
  let sequence = 0
  let respawnCount = 0
  const respawnLog: string[] = []
  let jumpReleased = true

  const step = (moveX = 0, moveZ = 0, jumpDown = false) => {
    const before = game.snapshot().player.position
    elapsed += dt
    const events = game.step({ moveX, moveZ, jumpDown }, dt, elapsed * 1000)
    const respawns = events.filter((event) => event.type === 'respawn')
    respawnCount += respawns.length
    respawnLog.push(
      ...respawns.map(
        (event) =>
          `${before.x.toFixed(2)},${before.z.toFixed(2)} -> ${event.type === 'respawn' ? event.checkpointId : ''}`,
      ),
    )
    const support = game.snapshot().player.supportPlatformId
    if (support != null) visited.add(support)
    jumpReleased = !jumpDown
  }

  const moveTo = (
    target: { readonly x: number; readonly z: number },
    platformId?: string,
  ) => {
    for (let frame = 0; frame < 40 / dt; frame++) {
      const snapshot = game.snapshot()
      if (snapshot.complete) return
      const player = snapshot.player
      const raft = snapshot.platformStates?.find(
        (item) => item.id === CLOUDWAY_PLATFORM_IDS.glideRaft,
      )
      if (
        platformId === CLOUDWAY_PLATFORM_IDS.glideRaft &&
        player.supportPlatformId !== platformId &&
        player.position.z < 12.62
      ) {
        const dx = target.x - player.position.x
        const dz = 12.64 - player.position.z
        const distance = Math.hypot(dx, dz)
        const magnitude = Math.min(0.72, Math.max(0.3, distance * 2))
        step(
          (dx / Math.max(distance, 0.001)) * magnitude,
          (dz / Math.max(distance, 0.001)) * magnitude,
        )
        continue
      }
      if (
        platformId === CLOUDWAY_PLATFORM_IDS.glideRaft &&
        player.supportPlatformId !== platformId &&
        (raft?.offset.z ?? 0) > 0.04
      ) {
        step()
        continue
      }
      if (
        platformId === CLOUDWAY_PLATFORM_IDS.glideDockEast &&
        player.supportPlatformId === CLOUDWAY_PLATFORM_IDS.glideRaft &&
        (raft?.offset.z ?? 0) < 1.86
      ) {
        step()
        continue
      }
      const dynamicTarget =
        platformId === CLOUDWAY_PLATFORM_IDS.glideRaft
          ? {
              x: target.x + (raft?.offset.x ?? 0),
              z: target.z + (raft?.offset.z ?? 0),
            }
          : target
      const dx = dynamicTarget.x - player.position.x
      const dz = dynamicTarget.z - player.position.z
      const distance = Math.hypot(dx, dz)
      if (
        distance < 0.14 &&
        (platformId === undefined || player.supportPlatformId === platformId)
      ) {
        for (let rest = 0; rest < 0.2 / dt; rest++) step()
        return
      }
      const forwardGap = level.intentionalGaps?.find(
        (gap) =>
          player.position.z >= gap.minZ - 0.34 &&
          player.position.z < gap.maxZ &&
          player.position.x >= gap.minX - 0.16 &&
          player.position.x <= gap.maxX + 0.16,
      )
      const shouldJump =
        jumpReleased && player.grounded && forwardGap !== undefined
      const magnitude = Math.min(1, Math.max(0.32, distance * 2.2))
      step(
        (dx / Math.max(distance, 0.001)) * magnitude,
        (dz / Math.max(distance, 0.001)) * magnitude,
        shouldJump,
      )
    }
    throw new Error(
      `Could not reach ${platformId ?? 'point'} ${target.x},${target.z}: ${JSON.stringify(game.snapshot().player)}; respawns=${respawnCount}`,
    )
  }

  const sing = (encounterId: string) => {
    const encounter = level.breakables.find((item) => item.id === encounterId)!
    moveTo(encounter.anchor)
    expect(game.beginEncounter(encounterId, 60)).toBe(true)
    for (let frame = 0; frame < 3 / dt; frame++) {
      elapsed += dt
      game.feedPitch(
        {
          sequence: ++sequence,
          captureSeconds: elapsed,
          capturedAtMs: elapsed * 1000,
          midi: 60,
          confidence: 0.98,
        },
        elapsed * 1000,
      )
      game.step(REST, dt, elapsed * 1000)
      if (game.snapshot().phase === 'shattering') break
    }
    expect(game.snapshot().completedBreakableIds).toContain(encounterId)
    for (let frame = 0; frame < 2.5 / dt; frame++) step()
  }

  return {
    game,
    visited,
    respawns: () => respawnCount,
    respawnLog,
    step,
    moveTo,
    sing,
  }
}

function visit(audition: CloudwayLayoutAudition, dt: number): Driver {
  const run = driver(audition.level, dt)
  run.sing(CLOUDWAY_ENCOUNTER_IDS.arrival)
  for (const waypoint of audition.route.waypoints.slice(1, 7))
    run.moveTo(waypoint, waypoint.platformId)
  run.sing(CLOUDWAY_ENCOUNTER_IDS.crossing)
  for (const waypoint of audition.route.waypoints.slice(7))
    run.moveTo(waypoint, waypoint.platformId)
  run.sing(CLOUDWAY_ENCOUNTER_IDS.finale)
  const exit = audition.level.exit
  run.moveTo({
    x: (exit.minX + exit.maxX) / 2,
    z: exit.maxZ + 0.2,
  })
  return run
}

function fogFactor(
  player: { readonly x: number; readonly y: number; readonly z: number },
  waypoint: { readonly x: number; readonly z: number },
  boomDistance: number,
  yaw: number,
): number {
  const camera = {
    x: player.x + Math.sin(yaw) * Math.cos(CAMERA_PITCH) * boomDistance,
    y: player.y + 0.42 + Math.sin(CAMERA_PITCH) * boomDistance,
    z: player.z + Math.cos(yaw) * Math.cos(CAMERA_PITCH) * boomDistance,
  }
  const distance = Math.hypot(
    waypoint.x - camera.x,
    -camera.y,
    waypoint.z - camera.z,
  )
  const progress = Math.max(
    0,
    Math.min(
      1,
      (distance - CLOUDWAY_FOG_NEAR) / (CLOUDWAY_FOG_FAR - CLOUDWAY_FOG_NEAR),
    ),
  )
  return progress * progress * (3 - 2 * progress)
}

describe('Cloudway route-shape auditions', () => {
  it('keeps every candidate in a distinct development save namespace', () => {
    const auditions = Object.values(CLOUDWAY_LAYOUT_AUDITIONS)
    expect(new Set(auditions.map((item) => item.saveId)).size).toBe(3)
    expect(auditions.map((item) => item.saveId).sort()).toEqual(
      Object.values(CLOUDWAY_LAYOUT_SAVE_IDS).sort(),
    )
    for (const audition of auditions) {
      expect(audition.level.id).toBe(audition.saveId)
      expect(audition.level.authored).toMatchObject({
        levelId: audition.saveId,
        layoutId: `cloudway-${audition.id}`,
      })
      expect(audition.saveId).not.toBe(CLOUDWAY_GLASS_RIBBON.id)
    }

    const crescent = selectCloudwayLayout('crescent')
    const explored = createGlassGame(crescent.level, {
      version: 2,
      levelId: crescent.level.id,
      checkpointId: 'cloudway-checkpoint-frost-catch',
      completedBreakableIds: [],
      finished: false,
    }).saveProgress()
    const ribbon = createGlassGame(
      selectCloudwayLayout('ribbon').level,
      explored,
    )
    expect(ribbon.snapshot()).toMatchObject({
      checkpointId: 'cloudway-checkpoint-arrival',
      completedBreakableIds: [],
    })
  })

  it('preserves the trial movement, vertical profile and bounded jump gaps', () => {
    for (const { level } of Object.values(CLOUDWAY_LAYOUT_AUDITIONS)) {
      expect(level.movement).toEqual(CLOUDWAY_GLASS_RIBBON.movement)
      expect(level.platforms.map((item) => item.top)).toEqual(
        CLOUDWAY_GLASS_RIBBON.platforms.map((item) => item.top),
      )
      expect(level.intentionalGaps).toHaveLength(
        CLOUDWAY_GLASS_RIBBON.intentionalGaps?.length ?? 0,
      )
      for (const gap of level.intentionalGaps ?? []) {
        expect(gap.maxZ - gap.minZ).toBeLessThanOrEqual(0.6)
        expect(gap.maxX - gap.minX).toBeGreaterThanOrEqual(0.64)
      }
    }
  })

  it('keeps every voice encounter on a marked static rest island', () => {
    for (const audition of Object.values(CLOUDWAY_LAYOUT_AUDITIONS)) {
      const safe = new Set(audition.route.safeRestPlatformIds)
      for (const encounter of audition.level.breakables) {
        const support = audition.level.platforms.find(
          (platform) =>
            encounter.anchor.x >= platform.minX &&
            encounter.anchor.x <= platform.maxX &&
            encounter.anchor.z >= platform.minZ &&
            encounter.anchor.z <= platform.maxZ,
        )
        expect(support, encounter.id).toBeDefined()
        expect(safe.has(support!.id), encounter.id).toBe(true)
        expect(support!.behavior, encounter.id).toBeUndefined()
      }
    }
  })

  it('keeps accepted planting and floor landmarks outside the movement lane', () => {
    for (const audition of Object.values(CLOUDWAY_LAYOUT_AUDITIONS)) {
      const presentation = audition.level.presentation!
      expect(presentation.decorations).toHaveLength(6)
      expect(
        presentation.decorations?.every(
          (item) => item.recipeId === 'crystal-planter-v5',
        ),
      ).toBe(true)
      expect(presentation.floorArt?.map((item) => item.platformId)).toEqual([
        CLOUDWAY_PLATFORM_IDS.arrival,
        CLOUDWAY_PLATFORM_IDS.frostCatch,
        CLOUDWAY_PLATFORM_IDS.glideDockEast,
        CLOUDWAY_PLATFORM_IDS.crackleRecovery,
        CLOUDWAY_PLATFORM_IDS.finale,
      ])
      for (const solid of audition.level.solids ?? []) {
        if (
          solid.kind !== 'prop' ||
          solid.shape !== 'cylinder' ||
          !solid.id.endsWith('-bowl')
        )
          continue
        if (solid.platformId === undefined) continue
        const platform = audition.level.platforms.find(
          (item) => item.id === solid.platformId,
        )!
        const center = {
          x: (platform.minX + platform.maxX) / 2,
          z: (platform.minZ + platform.maxZ) / 2,
        }
        expect(
          Math.hypot(solid.x - center.x, solid.z - center.z),
        ).toBeGreaterThan(0.9)
      }
      expect(
        Math.min(
          ...audition.route.waypoints.map((waypoint) =>
            Math.hypot(
              waypoint.x - audition.route.landmark.x,
              waypoint.z - audition.route.landmark.z,
            ),
          ),
        ),
      ).toBeGreaterThan(2.4)
    }
  })

  it('uses the accepted 9–14m fog to reveal nearby cues and conceal the finale', () => {
    expect(CLOUDWAY_FOG_NEAR).toBe(9)
    expect(CLOUDWAY_FOG_FAR).toBe(14)
    for (const audition of Object.values(CLOUDWAY_LAYOUT_AUDITIONS)) {
      const spawn = audition.level.spawn.position
      const yaw = audition.level.spawn.facingYaw
      expect(fogFactor(spawn, audition.route.waypoints[1]!, 4, yaw)).toBe(0)
      expect(
        fogFactor(spawn, audition.route.waypoints[2]!, 4, yaw),
      ).toBeLessThan(0.25)
      expect(fogFactor(spawn, audition.route.waypoints.at(-1)!, 4, yaw)).toBe(1)
    }
  })

  it.each([1 / 60, 1 / 120])(
    'crosses every required surface without a fall at dt=%s',
    (dt) => {
      for (const audition of Object.values(CLOUDWAY_LAYOUT_AUDITIONS)) {
        const run = visit(audition, dt)
        expect(
          run.respawns(),
          `${audition.id}: ${run.respawnLog.join('; ')}`,
        ).toBe(0)
        expect(run.game.snapshot().complete, audition.id).toBe(true)
        expect(run.visited, audition.id).toEqual(
          new Set(audition.level.platforms.map((item) => item.id)),
        )
      }
    },
  )

  it('reloads the crescent recovery checkpoint before any glass is broken', () => {
    const crescent = selectCloudwayLayout('crescent')
    const run = driver(crescent.level, 1 / 120)
    for (const waypoint of crescent.route.waypoints.slice(1, 4))
      run.moveTo(waypoint, waypoint.platformId)
    expect(run.game.snapshot()).toMatchObject({
      checkpointId: 'cloudway-checkpoint-frost-catch',
      completedBreakableIds: [],
    })
    const restored = createGlassGame(crescent.level, run.game.saveProgress())
    expect(restored.snapshot()).toMatchObject({
      checkpointId: 'cloudway-checkpoint-frost-catch',
      completedBreakableIds: [],
      player: {
        position: {
          x: crescent.route.waypoints[3]!.x,
          y: 0,
          z: crescent.route.waypoints[3]!.z,
        },
      },
    })
  })

  it('publishes the proven crescent under a fresh current-trial identity', () => {
    expect(CLOUDWAY_CURRENT_LAYOUT_ID).toBe('crescent')
    expect(CLOUDWAY_CURRENT_TRIAL.id).not.toBe(
      CLOUDWAY_LAYOUT_AUDITIONS.crescent.level.id,
    )
    expect(CLOUDWAY_CURRENT_TRIAL.id).not.toBe(CLOUDWAY_GLASS_RIBBON.id)
    expect(CLOUDWAY_CURRENT_TRIAL.authored?.layoutId).toBe('cloudway-crescent')
  })
})
