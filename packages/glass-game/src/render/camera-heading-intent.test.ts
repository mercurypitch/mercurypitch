// Camera heading intent policy — held and interrupted contacts never leak stale view turns.

import { describe, expect, it } from 'vitest'
import { createCameraHeadingIntent, type CameraHeadingIntentSample, } from './camera-heading-intent'

const SAMPLE: CameraHeadingIntentSample = {
  elapsedSeconds: 0.2,
  facingYaw: Math.PI / 2,
  movementActive: true,
  movementReferenceYaw: 0,
  moving: true,
}

describe('camera heading intent', () => {
  it('does not bank stopped time or commit a brief stick contact', () => {
    const intent = createCameraHeadingIntent()
    intent.rebase('stick')

    expect(intent.target(SAMPLE)).toBeNull()
    expect(
      intent.target({ ...SAMPLE, elapsedSeconds: 1, moving: false }),
    ).toBeNull()
    expect(intent.target({ ...SAMPLE, movementActive: false })).toBeNull()

    // A released stick is settled until the input layer explicitly rebases a
    // new contact; it cannot reuse the old direction on its own.
    expect(intent.target(SAMPLE)).toBeNull()
  })
})
