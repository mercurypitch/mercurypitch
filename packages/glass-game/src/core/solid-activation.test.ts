// Solid activation tests — saved completion owns bridge collision and gate visibility together.

import { describe, expect, it } from 'vitest'
import type { LevelDefinition } from '../contracts'
import { createGlassGame } from './game'
import { MOVEMENT } from './movement'
import { getActiveSolidIds } from './solid-activation'

const encounterId = 'activation-proof/room/encounter/note'
const level: LevelDefinition = {
  id: 'activation-proof',
  title: 'Activation proof',
  spawn: {
    position: { x: 0, y: 0, z: 0 },
    facingYaw: 0,
    checkpointId: 'activation-proof/checkpoint/start',
  },
  platforms: [
    {
      id: 'activation-proof/platform/floor',
      kind: 'deck',
      minX: -2,
      maxX: 2,
      minZ: -2,
      maxZ: 2,
      top: 0,
      thickness: 0.25,
      material: 'stone',
    },
    {
      id: 'activation-proof/platform/bridge',
      kind: 'bridge',
      minX: 2,
      maxX: 4,
      minZ: -0.6,
      maxZ: 0.6,
      top: 0,
      thickness: 0.25,
      material: 'brass',
      activation: { allCompleted: [encounterId] },
      presentation: { role: 'bridge', material: 'brass' },
    },
  ],
  solids: [
    {
      id: 'activation-proof/solid/gate',
      kind: 'prop',
      shape: 'box',
      minX: 1.4,
      maxX: 1.52,
      minZ: -0.7,
      maxZ: 0.7,
      top: 1.5,
      thickness: 1.5,
      activation: { noneCompleted: [encounterId] },
      presentation: { role: 'gate', material: 'brass' },
    },
  ],
  checkpoints: [
    {
      id: 'activation-proof/checkpoint/start',
      position: { x: 0, y: 0, z: 0 },
      facingYaw: 0,
      radius: 0.4,
    },
  ],
  breakables: [
    {
      id: encounterId,
      label: 'Activation note',
      position: { x: 0, y: 0.7, z: 0.6 },
      anchor: { x: 0, y: 0, z: 0 },
      variant: 'goblet',
      optional: false,
      challenge: {
        kind: 'hold',
        step: {
          target: 'comfortable',
          hold: {
            requiredSeconds: 0.05,
            toleranceCents: 100,
            confidenceFloor: 0.5,
            dropoutGraceSeconds: 0.1,
            decayPerSecond: 0.2,
            maximumSampleGapSeconds: 0.05,
            maximumSampleAgeMs: 150,
          },
        },
      },
    },
  ],
  exit: {
    minX: 3.4,
    maxX: 3.9,
    minZ: -0.4,
    maxZ: 0.4,
    top: 0,
    requiresCompleted: [encounterId],
  },
  fallBelow: -2,
}

describe('solid activation', () => {
  it('derives a bridge enable and gate removal immediately from completed save state', () => {
    const saved = {
      version: 1 as const,
      levelId: level.id,
      checkpointId: level.checkpoints[0].id,
      completedBreakableIds: [encounterId],
    }

    const fresh = createGlassGame(level).snapshot()
    const restoredGame = createGlassGame(level, saved)
    const restored = restoredGame.snapshot()

    expect(fresh.activeSolidIds).toContain('activation-proof/solid/gate')
    expect(fresh.activeSolidIds).not.toContain(
      'activation-proof/platform/bridge',
    )
    expect(restored.activeSolidIds).toContain(
      'activation-proof/platform/bridge',
    )
    expect(restored.activeSolidIds).not.toContain('activation-proof/solid/gate')
    expect(restored.enabledPlatformIds).toContain(
      'activation-proof/platform/bridge',
    )
    expect(restored.phase).toBe('idle')
    expect(restored.breakables[0]).toMatchObject({
      phase: 'complete',
      brokenAt: null,
    })
    expect(restoredGame.snapshot().activeSolidIds).toEqual(
      restored.activeSolidIds,
    )
  })

  it('changes the authoritative solid snapshot at earned completion before shatter presentation ends', () => {
    const game = createGlassGame(level)
    game.step({ moveX: 0, moveZ: 0, jumpDown: false }, MOVEMENT.fixedStep)
    expect(game.beginEncounter(encounterId, 57)).toBe(true)

    const events = [0, 25, 50].flatMap((capturedAtMs, sequence) =>
      game.feedPitch(
        {
          sequence,
          captureSeconds: capturedAtMs / 1000,
          capturedAtMs,
          midi: 57,
          confidence: 0.9,
        },
        capturedAtMs,
      ),
    )
    const snapshot = game.snapshot()

    expect(events).toContainEqual({
      type: 'break',
      id: encounterId,
      outcome: 'path-opened',
    })
    expect(snapshot.phase).toBe('shattering')
    expect(snapshot.activeSolidIds).toContain(
      'activation-proof/platform/bridge',
    )
    expect(snapshot.activeSolidIds).not.toContain('activation-proof/solid/gate')
    expect(getActiveSolidIds(level, new Set([encounterId]))).toEqual(
      snapshot.activeSolidIds,
    )
  })
})
