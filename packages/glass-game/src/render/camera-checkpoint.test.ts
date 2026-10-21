// Restored route checkpoints start with the supported court in view, without a loading-time turn.
import { describe, expect, it } from 'vitest'
import type { LevelDefinition } from '../contracts'
import { createGlassGame } from '../core/game'
import { createAdventureCamera } from './camera'

const LEVEL: LevelDefinition = {
  id: 'checkpoint-camera',
  title: 'Checkpoint camera',
  spawn: { position: { x: 0, y: 0, z: 0 }, facingYaw: Math.PI },
  platforms: [
    {
      id: 'arrival',
      minX: -2,
      maxX: 2,
      minZ: -2,
      maxZ: 2,
      top: 0,
      thickness: 0.4,
      kind: 'deck',
      material: 'stone',
    },
    {
      id: 'court',
      minX: 18,
      maxX: 22,
      minZ: -2,
      maxZ: 2,
      top: 0,
      thickness: 0.4,
      kind: 'deck',
      material: 'stone',
    },
  ],
  checkpoints: [
    {
      id: 'arrival',
      position: { x: 0, y: 0, z: 0 },
      radius: 1,
      facingYaw: Math.PI,
    },
    {
      id: 'court',
      position: { x: 20, y: 0, z: 0 },
      radius: 1,
      facingYaw: -Math.PI / 2,
    },
  ],
  breakables: [],
  exit: { minX: 21, maxX: 22, minZ: 1, maxZ: 2, top: 0, requiresCompleted: [] },
  fallBelow: -2,
  camera: {
    kind: 'route-sections',
    initialSectionId: 'arrival',
    landingDwellSeconds: 0.6,
    sections: [
      { id: 'arrival', platformIds: ['arrival'], yaw: Math.PI },
      { id: 'court', platformIds: ['court'], yaw: -Math.PI / 2 },
    ],
  },
}

function restoredState() {
  return createGlassGame(LEVEL, {
    version: 1,
    levelId: LEVEL.id,
    checkpointId: 'court',
    completedBreakableIds: [],
  }).snapshot()
}

describe('checkpoint camera startup', () => {
  it.each(['third-person', 'first-person'] as const)(
    'starts %s facing the restored court before the first rendered frame',
    (mode) => {
      const state = restoredState()
      expect(state.player.supportPlatformId).toBe('court')
      const rig = createAdventureCamera(LEVEL, { mode })
      rig.update(state, 0)
      expect(rig.yaw()).toBeCloseTo(-Math.PI / 2)
      expect(rig.movementYaw()).toBeCloseTo(-Math.PI / 2)
      if (mode === 'third-person') {
        expect(rig.camera.position.x).toBeLessThan(state.player.position.x)
        expect(rig.getChallengeMetrics().target.x).toBeCloseTo(20)
      }
    },
  )

  it('sets reduced-motion startup once without later automatic rotation', () => {
    const rig = createAdventureCamera(LEVEL, { reducedMotion: true })
    rig.update(restoredState(), 0)
    expect(rig.yaw()).toBeCloseTo(-Math.PI / 2)
    const arrival = createGlassGame(LEVEL).snapshot()
    for (let frame = 0; frame < 120; frame++) rig.update(arrival, 1 / 60)
    expect(rig.yaw()).toBeCloseTo(-Math.PI / 2)
  })

  it.each(['third-person', 'first-person'] as const)(
    'preserves a deliberate %s orbit made before the first frame',
    (mode) => {
      const rig = createAdventureCamera(LEVEL, { mode })
      rig.orbit(0.4, 0)
      const chosenYaw = rig.yaw()
      rig.update(restoredState(), 0)
      expect(rig.yaw()).toBeCloseTo(chosenYaw)
      rig.recenter()
      expect(
        Math.atan2(
          Math.sin(rig.yaw() + Math.PI / 2),
          Math.cos(rig.yaw() + Math.PI / 2),
        ),
      ).toBeCloseTo(0)
    },
  )
})
