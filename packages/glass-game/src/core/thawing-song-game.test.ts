// Thawing Song simulation proof — traverse both frost gates and finish the learned contour at common frame rates.

import { describe, expect, it } from 'vitest'
import { CLOUDWAY_THAWING_SONG as LEVEL } from '../content/cloudway-thawing-song'
import type { GlassGame, IntentionalGapDefinition } from '../contracts'
import { createGlassGame } from './game'
import { resolveMelodyAttempt } from './melody-attempt'
import { sampleMelodyAtTime } from './melody-contour'
import { MOVEMENT } from './movement'
import { SHATTER_PLAYBACK_SPEED, shatterLifecycleSeconds, } from './shatter-presentation'

const DEFAULT_SHATTER_SECONDS = shatterLifecycleSeconds(
  SHATTER_PLAYBACK_SPEED.default,
)

const REST = { moveX: 0, moveZ: 0, jumpDown: false }
const STATION_IDS = LEVEL.melodyLesson!.stations.map(
  (station) => station.encounterId,
)
const FINALE_ID = LEVEL.melodyLesson!.finaleEncounterId

function jumpApproach(
  gap: IntentionalGapDefinition,
  position: { x: number; z: number },
  target: { x: number; z: number },
): boolean {
  const crossX = position.z >= gap.minZ - 0.2 && position.z <= gap.maxZ + 0.2
  const crossZ = position.x >= gap.minX - 0.2 && position.x <= gap.maxX + 0.2
  return (
    (crossX &&
      ((target.x > gap.maxX &&
        position.x < gap.minX &&
        position.x >= gap.minX - 0.28) ||
        (target.x < gap.minX &&
          position.x > gap.maxX &&
          position.x <= gap.maxX + 0.28))) ||
    (crossZ &&
      ((target.z > gap.maxZ &&
        position.z < gap.minZ &&
        position.z >= gap.minZ - 0.28) ||
        (target.z < gap.minZ &&
          position.z > gap.maxZ &&
          position.z <= gap.maxZ + 0.28)))
  )
}

function traverse(dt: number) {
  const game = createGlassGame(LEVEL)
  const attempt = resolveMelodyAttempt(LEVEL, {
    attemptId: `route-${Math.round(1 / dt)}hz`,
    comfortableMidi: 57,
  })
  expect(
    game.configureMelodyAttempt({
      attemptId: attempt.identity.attemptId,
      comfortableMidi: 57,
    }),
  ).toMatchObject({ ok: true, changed: true })
  let seconds = 0
  let sequence = 0
  let respawns = 0

  const step = (moveX = 0, moveZ = 0, jumpDown = false): void => {
    seconds += dt
    const events = game.step({ moveX, moveZ, jumpDown }, dt, seconds * 1000)
    respawns += events.filter((event) => event.type === 'respawn').length
  }

  const moveTo = (x: number, z: number): void => {
    const target = { x, z }
    for (let frame = 0; frame < 14 / dt; frame++) {
      const snapshot = game.snapshot()
      if (snapshot.complete) return
      const position = snapshot.player.position
      const dx = x - position.x
      const dz = z - position.z
      const distance = Math.hypot(dx, dz)
      if (distance < 0.07) {
        for (let rest = 0; rest < 0.35 / dt; rest++) step()
        return
      }
      const magnitude = Math.min(1, distance * 2.5)
      const jumpDown =
        snapshot.player.grounded &&
        (LEVEL.intentionalGaps ?? []).some((gap) =>
          jumpApproach(gap, position, target),
        )
      step((dx / distance) * magnitude, (dz / distance) * magnitude, jumpDown)
    }
    throw new Error(
      `Could not reach ${x},${z}: ${JSON.stringify(game.snapshot().player)}`,
    )
  }

  const feed = (midi: number | null): ReturnType<GlassGame['feedPitch']> => {
    seconds += dt
    sequence++
    const events = game.feedPitch(
      {
        sequence,
        captureSeconds: seconds,
        capturedAtMs: seconds * 1000,
        midi,
        confidence: midi === null ? 0 : 0.98,
      },
      seconds * 1000,
    )
    game.step(REST, dt, seconds * 1000)
    return events
  }

  const settleShatter = (): void => {
    for (let frame = 0; frame < (DEFAULT_SHATTER_SECONDS + 0.1) / dt; frame++)
      step()
  }

  const singAnchor = (encounterId: string): void => {
    const challenge = LEVEL.breakables.find(
      (encounter) => encounter.id === encounterId,
    )?.challenge
    if (challenge?.kind !== 'melody-anchor')
      throw new Error(`Missing melody station ${encounterId}.`)
    const target = attempt.melody.anchors.find(
      (anchor) => anchor.id === challenge.anchorId,
    )!
    expect(game.snapshot().nearbyBreakableId).toBe(encounterId)
    expect(game.beginEncounter(encounterId)).toBe(true)
    const events = []
    for (let frame = 0; frame < 2 / dt; frame++) {
      events.push(...feed(target.midi))
      if (events.some((event) => event.type === 'break')) break
    }
    expect(events.some((event) => event.type === 'break')).toBe(true)
    settleShatter()
  }

  moveTo(-6, -10.72)
  singAnchor(STATION_IDS[0]!)
  moveTo(-5.2, -9.6)
  moveTo(-5.2, -8.56)
  moveTo(-6.35, -6.55)
  moveTo(-5.65, -3.7)
  moveTo(-5.4, -1.69)
  expect(game.snapshot().activeSolidIds).toContain(
    'barrier:thaw-gate-rise:pane',
  )
  singAnchor(STATION_IDS[1]!)
  expect(game.snapshot().activeSolidIds).not.toContain(
    'barrier:thaw-gate-rise:pane',
  )
  moveTo(-5.4, 2.63)
  singAnchor(STATION_IDS[2]!)
  moveTo(-5.4, 3.35)
  moveTo(-1.65, 3.35)
  moveTo(1.55, 3.35)
  moveTo(4.06, 3.35)
  expect(game.snapshot().activeSolidIds).toContain(
    'barrier:thaw-gate-return:pane',
  )
  singAnchor(STATION_IDS[3]!)
  expect(game.snapshot().activeSolidIds).not.toContain(
    'barrier:thaw-gate-return:pane',
  )
  moveTo(8.38, 3.35)
  singAnchor(STATION_IDS[4]!)
  moveTo(9.1, 3.35)
  moveTo(9.1, -0.4)
  moveTo(9.1, -4.15)
  moveTo(9.1, -6.66)
  moveTo(9.1, -8.1)

  expect(game.beginEncounter(FINALE_ID)).toBe(true)
  const finalEvents = []
  for (
    let elapsed = 0;
    elapsed <= attempt.melody.durationSeconds + 1;
    elapsed += dt
  ) {
    finalEvents.push(
      ...feed(
        sampleMelodyAtTime(
          attempt.melody,
          Math.min(attempt.melody.durationSeconds - 1e-8, elapsed),
        ).midi,
      ),
    )
    if (finalEvents.some((event) => event.type === 'break')) break
  }
  expect(finalEvents).toContainEqual({
    type: 'break',
    id: FINALE_ID,
    outcome: 'exit-opened',
  })
  settleShatter()

  moveTo(8.3, -8.1)
  moveTo(8.3, -10.6)
  moveTo(9.1, -10.6)
  moveTo(9.1, -9.9)
  return { game, respawns, seconds }
}

describe('The Thawing Song game route', () => {
  it.each([1 / 30, 1 / 60])(
    'opens both gates and completes the learned route at dt=%s',
    (dt) => {
      const result = traverse(dt)
      expect(result.respawns).toBe(0)
      expect(result.game.snapshot().complete).toBe(true)
      expect(result.game.saveProgress()).toMatchObject({
        version: 3,
        finished: true,
        completedBreakableIds: [...STATION_IDS, FINALE_ID],
        melodyAttempt: { rootMidi: 55, pace: 1.25 },
      })
      expect(result.seconds).toBeLessThan(120)
    },
  )

  it('restores the post-gate checkpoint and respawns there after a fall', () => {
    const attempt = resolveMelodyAttempt(LEVEL, {
      attemptId: 'checkpoint-proof',
      comfortableMidi: 57,
    })
    const game = createGlassGame(LEVEL, {
      version: 3,
      levelId: LEVEL.id,
      checkpointId: 'thaw-garden-save',
      completedBreakableIds: STATION_IDS.slice(0, 2),
      finished: false,
      melodyAttempt: attempt.identity,
    })
    expect(game.snapshot()).toMatchObject({
      checkpointId: 'thaw-garden-save',
      player: { position: { x: -5.4, y: 0, z: 2.63 } },
      melodyAttempt: { attemptId: 'checkpoint-proof' },
    })
    expect(game.snapshot().activeSolidIds).not.toContain(
      'barrier:thaw-gate-rise:pane',
    )
    expect(game.snapshot().activeSolidIds).toContain(
      'barrier:thaw-gate-return:pane',
    )

    let respawned = false
    for (let frame = 0; frame < 8 / MOVEMENT.fixedStep; frame++) {
      const events = game.step(
        { moveX: -1, moveZ: 0, jumpDown: false },
        MOVEMENT.fixedStep,
      )
      if (events.some((event) => event.type === 'respawn')) {
        respawned = true
        break
      }
    }
    expect(respawned).toBe(true)
    expect(game.snapshot()).toMatchObject({
      checkpointId: 'thaw-garden-save',
      player: { position: { x: -5.4, y: 0, z: 2.63 } },
      completedBreakableIds: STATION_IDS.slice(0, 2),
    })
  })
})
