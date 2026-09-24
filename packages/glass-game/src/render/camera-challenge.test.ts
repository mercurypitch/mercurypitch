// Adventure challenge camera — integration with exploration input and game phases.

import { Box3, Vector3 } from 'three'
import { expect, it } from 'vitest'
import { GLASSWORKS } from '../content/glassworks'
import type { GameSnapshot } from '../contracts'
import { createGlassGame } from '../core/game'
import { MOVEMENT } from '../core/movement'
import { SHATTER_LIFECYCLE_SECONDS } from '../core/shatter-presentation'
import { createAdventureCamera } from './camera'

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

it('holds through the real 2.3-second shatter lifecycle and freezes a paused transition', () => {
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
  game.step(
    { moveX: 0, moveZ: 0, jumpDown: false },
    SHATTER_LIFECYCLE_SECONDS - MOVEMENT.fixedStep / 2,
  )
  adventureCamera.update(game.snapshot(), 0.05)
  expect(adventureCamera.getChallengeMetrics().mode).toBe('holding')

  game.step({ moveX: 0, moveZ: 0, jumpDown: false }, MOVEMENT.fixedStep)
  adventureCamera.update(game.snapshot(), 0.05)
  expect(adventureCamera.getChallengeMetrics().mode).toBe('restoring')
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
