// Camera heading intent policy — held and interrupted contacts never leak stale view turns.

import { describe, expect, it } from 'vitest'
import type { CameraHeadingIntentSample } from './camera-heading-intent'
import { createCameraHeadingIntent } from './camera-heading-intent'

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

  it('follows only a stable effective stick heading inside an enclosure', () => {
    const open = createCameraHeadingIntent()
    open.rebase('stick')
    for (let index = 0; index < 4; index++)
      expect(
        open.target({
          ...SAMPLE,
          allowForwardDiagonalFollow: false,
          effectiveHeading: Math.PI / 2,
        }),
      ).toBeNull()

    const enclosed = createCameraHeadingIntent()
    enclosed.rebase('stick')
    expect(
      enclosed.target({
        ...SAMPLE,
        allowForwardDiagonalFollow: true,
        effectiveHeading: Math.PI / 2,
      }),
    ).toBeNull()
    expect(
      enclosed.target({
        ...SAMPLE,
        allowForwardDiagonalFollow: true,
        effectiveHeading: 0,
      }),
    ).toBeNull()
    expect(
      enclosed.target({
        ...SAMPLE,
        allowForwardDiagonalFollow: true,
        effectiveHeading: Math.PI / 2,
      }),
    ).toBeNull()
    expect(
      enclosed.target({
        ...SAMPLE,
        allowForwardDiagonalFollow: true,
        effectiveHeading: Math.PI / 2,
      }),
    ).toBeCloseTo(Math.PI / 2)
  })

  it('commits a sustained forward diagonal only in enclosed navigation', () => {
    const open = createCameraHeadingIntent()
    const enclosed = createCameraHeadingIntent()
    const diagonal = {
      ...SAMPLE,
      facingYaw: Math.PI / 4,
      movementReferenceYaw: 0,
    }
    open.rebase('keyboard')
    enclosed.rebase('keyboard')

    for (let index = 0; index < 3; index++)
      expect(
        open.target({ ...diagonal, allowForwardDiagonalFollow: false }),
      ).toBeNull()
    expect(
      enclosed.target({ ...diagonal, allowForwardDiagonalFollow: true }),
    ).toBeNull()
    expect(
      enclosed.target({ ...diagonal, allowForwardDiagonalFollow: true }),
    ).toBeCloseTo(Math.PI / 4)
  })

  it('keeps a committed keyboard target independent of collision-facing changes', () => {
    const intent = createCameraHeadingIntent()
    intent.rebase('keyboard')
    const keyboardHeading = Math.PI / 4

    expect(
      intent.target({
        ...SAMPLE,
        allowForwardDiagonalFollow: true,
        elapsedSeconds: 0.4,
        facingYaw: 0.2,
        keyboardHeading,
      }),
    ).toBeCloseTo(keyboardHeading)
    expect(
      intent.target({
        ...SAMPLE,
        allowForwardDiagonalFollow: true,
        facingYaw: Math.PI / 2,
        keyboardHeading,
      }),
    ).toBeCloseTo(keyboardHeading)
  })

  it('requires the existing stable-heading dwell before adopting a blocked corridor facing', () => {
    const intent = createCameraHeadingIntent()
    intent.rebase('keyboard')
    const requestedHeading = Math.PI / 4
    const confirmed = {
      ...SAMPLE,
      allowForwardDiagonalFollow: true,
      elapsedSeconds: 0.4,
      keyboardHeading: requestedHeading,
    }
    expect(intent.target(confirmed)).toBeCloseTo(requestedHeading)
    const blocked = {
      ...confirmed,
      elapsedSeconds: 0.2,
      moving: false,
      effectiveHeading: null,
      facingYaw: Math.PI / 2,
    }
    expect(intent.target(blocked)).toBeCloseTo(requestedHeading)
    expect(intent.target({ ...blocked, facingYaw: 0 })).toBeCloseTo(
      requestedHeading,
    )
    expect(intent.target(blocked)).toBeCloseTo(requestedHeading)
    expect(intent.target(blocked)).toBeCloseTo(Math.PI / 2)
    expect(intent.target(blocked)).toBeCloseTo(Math.PI / 2)
    expect(
      intent.target({ ...blocked, allowForwardDiagonalFollow: false }),
    ).toBeNull()
    expect(intent.target({ ...blocked, movementActive: false })).toBeNull()
  })

  it('adopts a sustained effective corridor heading without following transient collision noise', () => {
    const intent = createCameraHeadingIntent()
    intent.rebase('keyboard')
    const requestedHeading = Math.PI / 4
    const corridorHeading = Math.PI / 2
    const confirmed = {
      ...SAMPLE,
      allowForwardDiagonalFollow: true,
      elapsedSeconds: 0.4,
      keyboardHeading: requestedHeading,
    }
    expect(intent.target(confirmed)).toBeCloseTo(requestedHeading)

    expect(
      intent.target({
        ...confirmed,
        elapsedSeconds: 0.2,
        effectiveHeading: corridorHeading,
      }),
    ).toBeCloseTo(requestedHeading)
    expect(
      intent.target({
        ...confirmed,
        elapsedSeconds: 0.1,
        effectiveHeading: 0,
      }),
    ).toBeCloseTo(requestedHeading)

    expect(
      intent.target({
        ...confirmed,
        elapsedSeconds: 0.2,
        effectiveHeading: corridorHeading,
      }),
    ).toBeCloseTo(requestedHeading)
    expect(
      intent.target({
        ...confirmed,
        elapsedSeconds: 0.2,
        effectiveHeading: corridorHeading,
      }),
    ).toBeCloseTo(corridorHeading)
  })
})
