// Reward game integration — final encounter ownership is durable before the exit.

import { describe, expect, it } from 'vitest'
import type { GameEvent, LevelDefinition } from '../contracts'
import { createGlassGame } from './game'

const FINAL_ID = 'pilot/final'
const LEVEL: LevelDefinition = {
  id: 'portrait-before-exit',
  title: 'Portrait before exit',
  authored: {
    levelId: 'portrait-before-exit',
    layoutId: 'single-room',
    contentRevision: 1,
  },
  spawn: {
    position: { x: 0, y: 0, z: 0 },
    facingYaw: 0,
    checkpointId: 'arrival',
  },
  platforms: [
    {
      id: 'floor',
      minX: -2,
      maxX: 2,
      minZ: -2,
      maxZ: 2,
      top: 0,
      thickness: 0.2,
      kind: 'deck',
      material: 'stone',
    },
  ],
  checkpoints: [
    {
      id: 'arrival',
      position: { x: 0, y: 0, z: 0 },
      facingYaw: 0,
      radius: 0.4,
    },
  ],
  breakables: [
    {
      id: FINAL_ID,
      label: 'Final glass',
      position: { x: 0, y: 0.4, z: -0.4 },
      anchor: { x: 0, y: 0, z: 0 },
      variant: 'glass',
      optional: false,
      challenge: {
        kind: 'hold',
        step: {
          target: 'comfortable',
          hold: {
            requiredSeconds: 0.4,
            toleranceCents: 75,
            confidenceFloor: 0.6,
            dropoutGraceSeconds: 0.1,
            decayPerSecond: 0.5,
            maximumSampleGapSeconds: 0.11,
            maximumSampleAgeMs: 120,
          },
        },
      },
    },
  ],
  exit: {
    minX: 1.2,
    maxX: 1.5,
    minZ: -0.4,
    maxZ: 0.4,
    top: 0,
    requiresCompleted: [FINAL_ID],
  },
  fallBelow: -1,
  rewards: {
    revision: 1,
    discoveries: [],
    grading: [
      {
        kind: 'pitch-accuracy-v1',
        encounterId: FINAL_ID,
        policyRevision: 1,
        challengeRevision: 1,
        minimumReliableSeconds: 0.3,
        threeStarMaxMeanCents: 35,
        twoStarMaxMeanCents: 75,
        maximumErrorCents: 600,
      },
    ],
    portrait: {
      portraitId: 'awakened-muse',
      legendId: 'she-who-woke-glass',
      title: 'She Who Woke the Glass',
      collectionIndex: 1,
      imageAssetId: 'painting-portrait-v5',
      awardAfterEncounterId: FINAL_ID,
      representationStatus: 'approved',
    },
  },
}

describe('reward game integration', () => {
  it('writes the portrait into the break save before route exit completion', () => {
    const game = createGlassGame(LEVEL)
    expect(game.beginEncounter(FINAL_ID, 60)).toBe(true)
    let events: GameEvent[] = []
    for (let index = 0; index <= 4; index++)
      events = game.feedPitch(
        {
          sequence: index,
          captureSeconds: index / 10,
          capturedAtMs: index * 100,
          midi: 60,
          confidence: 0.9,
        },
        index * 100,
      )

    expect(events).toEqual([
      { type: 'break', id: FINAL_ID, outcome: 'exit-opened' },
    ])
    const saveAtBreak = game.saveProgress()
    expect(saveAtBreak.finished).toBe(false)
    expect(saveAtBreak.rewards?.collectedPortraitIds).toEqual(['awakened-muse'])
    expect(saveAtBreak.rewards?.qualityResults).toMatchObject([
      { grade: 3, encounterId: FINAL_ID },
    ])
  })
})
