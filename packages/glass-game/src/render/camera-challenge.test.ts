// Adventure challenge camera — integration with exploration input and game phases.

import { Box3, Vector3 } from 'three'
import { expect, it } from 'vitest'
import { CLOUDWAY_THAWING_SONG } from '../content/cloudway-thawing-song'
import { GLASS_ENCLOSED_CHAMBER } from '../content/enclosed-chamber'
import { GLASSWORKS } from '../content/glassworks'
import type { GameSnapshot, GlassGame } from '../contracts'
import { createGlassGame } from '../core/game'
import { MOVEMENT } from '../core/movement'
import { MAXIMUM_SHATTER_FRAME_SECONDS, SHATTER_PLAYBACK_SPEED, shatterLifecycleSeconds, } from '../core/shatter-presentation'
import { createAdventureCamera } from './camera'
import { createEnclosureFraming } from './enclosure-framing'

const DEFAULT_SHATTER_SECONDS = shatterLifecycleSeconds(
  SHATTER_PLAYBACK_SPEED.default,
)

it.each([
  { orientation: 'portrait', aspect: 390 / 844, safeBottomFraction: 0.314 },
  { orientation: 'landscape', aspect: 844 / 390, safeBottomFraction: 0.61 },
])(
  'fits the First Light decanter from oblique approaches in $orientation',
  ({ aspect, safeBottomFraction }) => {
    const level = GLASS_ENCLOSED_CHAMBER
    const exhibit = level.breakables.find((item) =>
      item.id.endsWith('/passage-decanter'),
    )!
    const initial = createGlassGame(level, {
      version: 1,
      levelId: level.id,
      checkpointId: `${level.id}/reveal/checkpoint/entry`,
      completedBreakableIds: [`${level.id}/chamber/encounter/threshold-goblet`],
    }).snapshot()
    for (const offsetX of [-0.35, 0, 0.35]) {
      const player = new Vector3(
        exhibit.anchor.x + offsetX,
        0,
        exhibit.anchor.z - 0.2,
      )
      const snapshot: GameSnapshot = {
        ...initial,
        player: {
          ...initial.player,
          position: player,
          facingYaw: Math.PI + offsetX,
        },
      }
      const camera = createAdventureCamera(level)
      const enclosure = createEnclosureFraming(level)
      if (enclosure === null)
        throw new Error('First Light requires its authored camera enclosure.')
      camera.camera.aspect = aspect
      camera.camera.updateProjectionMatrix()
      camera.update(snapshot, 0.05)
      camera.orbit(offsetX, 0)
      camera.update(snapshot, 0.05)
      camera.setChallengeEncounter(exhibit.id)
      camera.setChallengeSafeBottomFraction(safeBottomFraction)
      camera.setChallengeSubjects({
        encounterId: exhibit.id,
        merc: new Box3(
          player.clone().add(new Vector3(-0.27, 0.015, -0.19)),
          player.clone().add(new Vector3(0.27, 0.565, 0.19)),
        ),
        target: new Box3(
          new Vector3(
            exhibit.position.x - 0.25,
            0.24,
            exhibit.position.z - 0.25,
          ),
          new Vector3(
            exhibit.position.x + 0.25,
            0.875,
            exhibit.position.z + 0.25,
          ),
        ),
      })
      for (let frame = 0; frame < 60; frame++) {
        camera.update(snapshot, 0.05)
        expect(
          enclosure.cameraPositionSafe(
            player.clone().add(new Vector3(0, 0.42, 0)),
            camera.camera.position,
            snapshot.activeSolidIds ?? snapshot.enabledPlatformIds,
          ),
          `approach ${offsetX}, transition frame ${frame}`,
        ).toBe(true)
      }
      const metrics = camera.getChallengeMetrics()
      expect(metrics, `approach ${offsetX}`).toMatchObject({
        mode: 'holding',
        settled: true,
        occluded: false,
      })
      expect(
        metrics.combinedFrame!.minX,
        `approach ${offsetX}`,
      ).toBeGreaterThanOrEqual(-0.881)
      expect(
        metrics.combinedFrame!.maxX,
        `approach ${offsetX}`,
      ).toBeLessThanOrEqual(0.881)
      expect(
        metrics.combinedFrame!.minY,
        `approach ${offsetX}`,
      ).toBeGreaterThanOrEqual(metrics.safeBottomNdc! - 0.001)
      expect(
        metrics.combinedFrame!.maxY,
        `approach ${offsetX}`,
      ).toBeLessThanOrEqual(0.861)
    }
  },
)

function challengeSubjects(snapshot: GameSnapshot) {
  const exhibit = GLASSWORKS.breakables[0]!
  const player = new Vector3().copy(snapshot.player.position)
  const target = new Vector3().copy(exhibit.position)
  return {
    encounterId: exhibit.id,
    merc: new Box3(
      player.clone().add(new Vector3(-0.34, 0, -0.26)),
      player.clone().add(new Vector3(0.34, 1.35, 0.26)),
    ),
    target: new Box3(
      target.clone().add(new Vector3(-0.35, 0.1, -0.35)),
      target.clone().add(new Vector3(0.35, 1.15, 0.35)),
    ),
  }
}

function enterChallenge(
  adventureCamera: ReturnType<typeof createAdventureCamera>,
  snapshot: GameSnapshot,
): void {
  const subjects = challengeSubjects(snapshot)
  adventureCamera.setChallengeEncounter(subjects.encounterId)
  adventureCamera.setChallengeSafeBottomFraction(0.34)
  adventureCamera.setChallengeSubjects(subjects)
  for (let frame = 0; frame < 20; frame++)
    adventureCamera.update(snapshot, 0.05)
  expect(adventureCamera.getChallengeMetrics()).toMatchObject({
    mode: 'holding',
    settled: true,
  })
}

function advanceShatter(game: GlassGame, seconds: number): void {
  let remaining = seconds
  while (remaining > 1e-9) {
    const delta = Math.min(remaining, MAXIMUM_SHATTER_FRAME_SECONDS)
    game.step({ moveX: 0, moveZ: 0, jumpDown: false }, delta)
    remaining -= delta
  }
}

it('ignores orbit and zoom during the shot, then restores the exact prior view', () => {
  const snapshot = createGlassGame(GLASSWORKS).snapshot()
  const adventureCamera = createAdventureCamera(GLASSWORKS)
  adventureCamera.camera.aspect = 16 / 9
  adventureCamera.camera.updateProjectionMatrix()
  adventureCamera.update(snapshot, 0.05)
  adventureCamera.orbit(0.42, 0.13)
  adventureCamera.zoom(-0.6)
  adventureCamera.update(snapshot, 0.05)
  const priorPosition = adventureCamera.camera.position.clone()
  const priorQuaternion = adventureCamera.camera.quaternion.clone()
  const priorYaw = adventureCamera.yaw()
  const priorFov = adventureCamera.camera.fov

  enterChallenge(adventureCamera, snapshot)
  const heldPosition = adventureCamera.camera.position.clone()
  expect(heldPosition.distanceTo(priorPosition)).toBeGreaterThan(0.2)
  expect(adventureCamera.getChallengeMetrics()).toMatchObject({
    encounterId: GLASSWORKS.breakables[0]!.id,
    progress: 1,
    occluded: false,
  })

  adventureCamera.setOrbitActive(true)
  adventureCamera.orbit(1.2, 0.6)
  adventureCamera.zoom(4)
  adventureCamera.recenter()
  adventureCamera.setOrbitActive(false)
  adventureCamera.setChallengeEncounter(null)
  for (let frame = 0; frame < 16; frame++)
    adventureCamera.update(snapshot, 0.05)

  expect(adventureCamera.getChallengeMetrics().mode).toBe('exploration')
  expect(
    adventureCamera.camera.position.distanceTo(priorPosition),
  ).toBeLessThan(1e-10)
  expect(
    adventureCamera.camera.quaternion.angleTo(priorQuaternion),
  ).toBeLessThan(1e-10)
  expect(adventureCamera.yaw()).toBe(priorYaw)
  expect(adventureCamera.camera.fov).toBe(priorFov)
  adventureCamera.update(snapshot, 0.05)
  expect(
    adventureCamera.camera.position.distanceTo(priorPosition),
  ).toBeLessThan(1e-10)
})

it('uses bounded presentation time for sparse challenge frames and freezes while paused', () => {
  const snapshot = createGlassGame(GLASSWORKS).snapshot()
  const adventureCamera = createAdventureCamera(GLASSWORKS)
  adventureCamera.update(snapshot, 0.05)
  const priorPosition = adventureCamera.camera.position.clone()
  const subjects = challengeSubjects(snapshot)
  adventureCamera.setChallengeEncounter(subjects.encounterId)
  adventureCamera.setChallengeSubjects(subjects)

  adventureCamera.update(snapshot, 0.25)
  const beforePause = adventureCamera.camera.position.clone()
  const beforePauseProgress = adventureCamera.getChallengeMetrics().progress
  adventureCamera.update(snapshot, 0.25, true)
  expect(adventureCamera.camera.position.toArray()).toEqual(
    beforePause.toArray(),
  )
  expect(adventureCamera.getChallengeMetrics().progress).toBe(
    beforePauseProgress,
  )

  for (let frame = 0; frame < 3; frame++) adventureCamera.update(snapshot, 0.25)
  expect(adventureCamera.getChallengeMetrics().mode).toBe('holding')

  adventureCamera.setChallengeEncounter(null)
  adventureCamera.update(snapshot, 0.25)
  adventureCamera.update(snapshot, 0.25)
  expect(adventureCamera.getChallengeMetrics().mode).toBe('restoring')
  adventureCamera.update(snapshot, 0.25)
  expect(adventureCamera.getChallengeMetrics().mode).toBe('exploration')
  expect(
    adventureCamera.camera.position.distanceTo(priorPosition),
  ).toBeLessThan(1e-10)
})

it('holds through the default half-speed shatter lifecycle and freezes a paused transition', () => {
  const game = createGlassGame(GLASSWORKS)
  for (
    let frame = 0;
    frame < 500 && game.snapshot().nearbyBreakableId === null;
    frame++
  )
    game.step({ moveX: 0, moveZ: 1, jumpDown: false }, MOVEMENT.fixedStep)
  expect(game.snapshot().nearbyBreakableId).toBe(GLASSWORKS.breakables[0]!.id)
  expect(game.beginEncounter(GLASSWORKS.breakables[0]!.id, 57)).toBe(true)
  const snapshot = game.snapshot()
  const adventureCamera = createAdventureCamera(GLASSWORKS)
  adventureCamera.update(snapshot, 0.05)
  const subjects = challengeSubjects(snapshot)
  adventureCamera.setChallengeEncounter(subjects.encounterId)
  adventureCamera.setChallengeSubjects(subjects)
  adventureCamera.update(snapshot, 0.05)
  const entering = adventureCamera.camera.position.clone()
  for (let frame = 0; frame < 10; frame++)
    adventureCamera.update(snapshot, 0.05, true)
  expect(adventureCamera.camera.position.toArray()).toEqual(entering.toArray())

  for (let frame = 0; frame < 20; frame++)
    adventureCamera.update(snapshot, 0.05)
  for (let sequence = 0; sequence <= 48; sequence++)
    game.feedPitch(
      {
        sequence,
        captureSeconds: sequence * 0.025,
        capturedAtMs: sequence * 25,
        confidence: 0.9,
        midi: 57,
      },
      sequence * 25,
    )
  expect(game.snapshot().phase).toBe('shattering')
  adventureCamera.setChallengeEncounter(null)
  advanceShatter(game, DEFAULT_SHATTER_SECONDS - MOVEMENT.fixedStep / 2)
  adventureCamera.update(game.snapshot(), 0.05)
  expect(adventureCamera.getChallengeMetrics().mode).toBe('holding')

  game.step({ moveX: 0, moveZ: 0, jumpDown: false }, MOVEMENT.fixedStep)
  adventureCamera.update(game.snapshot(), 0.05)
  expect(adventureCamera.getChallengeMetrics().mode).toBe('restoring')
})

it('keeps first-person look input owned by the shatter framing', () => {
  const game = createGlassGame(GLASSWORKS)
  for (
    let frame = 0;
    frame < 500 && game.snapshot().nearbyBreakableId === null;
    frame++
  )
    game.step({ moveX: 0, moveZ: 1, jumpDown: false }, MOVEMENT.fixedStep)
  expect(game.beginEncounter(GLASSWORKS.breakables[0]!.id, 57)).toBe(true)
  for (let sequence = 0; sequence <= 48; sequence++)
    game.feedPitch(
      {
        sequence,
        captureSeconds: sequence * 0.025,
        capturedAtMs: sequence * 25,
        confidence: 0.9,
        midi: 57,
      },
      sequence * 25,
    )
  const shattering = game.snapshot()
  expect(shattering.phase).toBe('shattering')

  const adventureCamera = createAdventureCamera(GLASSWORKS, {
    mode: 'first-person',
  })
  adventureCamera.setChallengeSubjects(challengeSubjects(shattering))
  for (let frame = 0; frame < 30; frame++)
    adventureCamera.update(shattering, 0.05)
  const heldYaw = adventureCamera.yaw()
  const heldQuaternion = adventureCamera.camera.quaternion.clone()

  adventureCamera.setOrbitActive(true)
  adventureCamera.orbit(0.8, 0.35)
  adventureCamera.setOrbitActive(false)

  expect(adventureCamera.yaw()).toBeCloseTo(heldYaw, 10)
  adventureCamera.update(shattering, 0.05)
  expect(
    adventureCamera.camera.quaternion.angleTo(heldQuaternion),
  ).toBeLessThan(1e-7)

  advanceShatter(game, DEFAULT_SHATTER_SECONDS + MOVEMENT.fixedStep)
  expect(game.snapshot().phase).toBe('idle')
  adventureCamera.update(game.snapshot(), 0.05)
  const releasedYaw = adventureCamera.yaw()
  adventureCamera.orbit(0.2, 0)
  expect(adventureCamera.yaw()).toBeCloseTo(releasedYaw + 0.2, 10)
})

it('preserves the saved orbit around a player who moves during restoration', () => {
  const snapshot = createGlassGame(GLASSWORKS).snapshot()
  const adventureCamera = createAdventureCamera(GLASSWORKS)
  adventureCamera.update(snapshot, 0.05)
  const priorPosition = adventureCamera.camera.position.clone()
  const priorTarget = adventureCamera.getChallengeMetrics().target
  enterChallenge(adventureCamera, snapshot)

  adventureCamera.setChallengeEncounter(null)
  const moved = {
    ...snapshot,
    player: {
      ...snapshot.player,
      position: {
        ...snapshot.player.position,
        x: snapshot.player.position.x + 0.8,
      },
    },
  }
  for (let frame = 0; frame < 16; frame++) adventureCamera.update(moved, 0.05)

  expect(adventureCamera.getChallengeMetrics().mode).toBe('exploration')
  expect(adventureCamera.camera.position.x).toBeCloseTo(priorPosition.x + 0.8)
  expect(adventureCamera.getChallengeMetrics().target.x).toBeCloseTo(
    priorTarget.x + 0.8,
  )
  const restored = adventureCamera.camera.position.clone()
  adventureCamera.update(moved, 0.05)
  expect(adventureCamera.camera.position.distanceTo(restored)).toBeLessThan(
    0.05,
  )
})

it('keeps portrait FOV bounded when the live panel triggers repeated replans', () => {
  const snapshot = createGlassGame(GLASSWORKS).snapshot()
  const adventureCamera = createAdventureCamera(GLASSWORKS)
  adventureCamera.camera.aspect = 390 / 844
  adventureCamera.camera.updateProjectionMatrix()
  adventureCamera.update(snapshot, 0.05)
  const subjects = challengeSubjects(snapshot)
  adventureCamera.setChallengeEncounter(subjects.encounterId)
  adventureCamera.setChallengeSubjects(subjects)
  adventureCamera.setChallengeSafeBottomFraction(0.34)
  for (let frame = 0; frame < 30; frame++)
    adventureCamera.update(snapshot, 0.05)
  const firstFov = adventureCamera.camera.fov
  expect(firstFov).toBeGreaterThan(48)
  expect(firstFov).toBeLessThanOrEqual(58)

  for (const safeBottom of [0.46, 0.38, 0.52]) {
    adventureCamera.setChallengeSafeBottomFraction(safeBottom)
    adventureCamera.update(snapshot, 0.05)
    expect(adventureCamera.getChallengeMetrics()).toMatchObject({
      mode: 'holding',
      settled: false,
    })
    for (let frame = 1; frame < 30; frame++)
      adventureCamera.update(snapshot, 0.05)
    expect(adventureCamera.camera.fov).toBeCloseTo(firstFov, 5)
    expect(adventureCamera.camera.fov).toBeLessThanOrEqual(58)
    expect(adventureCamera.getChallengeMetrics().settled).toBe(true)
  }
})

it('fits the Thawing Song finale above the live panel on a portrait phone', () => {
  const initial = createGlassGame(CLOUDWAY_THAWING_SONG).snapshot()
  const snapshot: GameSnapshot = {
    ...initial,
    player: {
      ...initial.player,
      position: { x: 9.1, y: 0, z: -7.38 },
      grounded: true,
      supportPlatformId: 'thaw-pavilion-2',
      facingYaw: Math.PI,
    },
  }
  const adventureCamera = createAdventureCamera(CLOUDWAY_THAWING_SONG)
  adventureCamera.camera.aspect = 390 / 844
  adventureCamera.camera.updateProjectionMatrix()
  adventureCamera.update(snapshot, 0.05)
  adventureCamera.setChallengeEncounter('thaw-portrait-finale')
  adventureCamera.setChallengeSafeBottomFraction(0.361)
  adventureCamera.setChallengeSubjects({
    encounterId: 'thaw-portrait-finale',
    merc: new Box3(
      new Vector3(8.83, 0.015, -7.57),
      new Vector3(9.37, 0.565, -7.19),
    ),
    target: new Box3(
      new Vector3(8.8088, 0.255, -9.2004),
      new Vector3(9.3912, 1.095, -9.0996),
    ),
    targetFacing: new Vector3(0, 0, 1),
  })
  for (let frame = 0; frame < 120; frame++)
    adventureCamera.update(snapshot, 0.05)

  const metrics = adventureCamera.getChallengeMetrics()
  expect(metrics).toMatchObject({ mode: 'holding', settled: true })
  expect(metrics.combinedFrame!.minX).toBeGreaterThanOrEqual(-0.881)
  expect(metrics.combinedFrame!.maxX).toBeLessThanOrEqual(0.881)
  expect(metrics.combinedFrame!.minY).toBeGreaterThanOrEqual(
    metrics.safeBottomNdc! - 0.001,
  )
  expect(metrics.combinedFrame!.maxY).toBeLessThanOrEqual(0.861)
})
