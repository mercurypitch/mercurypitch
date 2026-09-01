// ============================================================
// V2OnboardingPlatterPreview tests — one clock, one correlated stop
// ============================================================

import { render } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { V2OnboardingStillResource } from './v2-onboarding-media-presenter'
import type { V2OnboardingPlatterPhase } from './V2OnboardingPlatterPreview'
import { V2OnboardingPlatterPreview } from './V2OnboardingPlatterPreview'

const BASE: V2OnboardingStillResource = {
  kind: 'still',
  src: '/p02-v0_16.webp',
  alt: 'Corky beside the record player',
}

type FrameCallback = (timestamp: number) => void

let nextFrameHandle = 0
let frameCallbacks = new Map<number, FrameCallback>()
const cancelledFrames = vi.fn<(handle: number) => void>()

function paintNextFrame(timestamp: number): void {
  const pending = [...frameCallbacks.entries()]
  frameCallbacks = new Map()
  if (pending.length !== 1) {
    throw new RangeError(
      `Expected one animation frame, received ${String(pending.length)}.`,
    )
  }
  pending[0]?.[1](timestamp)
}

function platter(): HTMLElement {
  // The preview is intentionally decorative; the data contract exposes its
  // phase without inventing an interactive or duplicate image role.
  const element = document.querySelector<HTMLElement>(
    '[data-v2-platter-preview]',
  )
  if (element === null) throw new TypeError('Expected the platter preview.')
  return element
}

beforeEach(() => {
  nextFrameHandle = 0
  frameCallbacks = new Map()
  cancelledFrames.mockClear()

  vi.stubGlobal(
    'requestAnimationFrame',
    vi.fn((callback: FrameCallback) => {
      nextFrameHandle += 1
      frameCallbacks.set(nextFrameHandle, callback)
      return nextFrameHandle
    }),
  )
  vi.stubGlobal(
    'cancelAnimationFrame',
    vi.fn((handle: number) => {
      cancelledFrames(handle)
      frameCallbacks.delete(handle)
    }),
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('V2OnboardingPlatterPreview', () => {
  it('carries the current rigid-spin angle into one correlated deceleration', () => {
    // Arrange
    const [phase, setPhase] = createSignal<V2OnboardingPlatterPhase>('spinning')
    const onStopped = vi.fn<(token: string) => void>()
    render(() => (
      <V2OnboardingPlatterPreview
        base={BASE}
        phase={phase()}
        token="stop-7"
        foreground={true}
        reducedMotion={false}
        onStopped={onStopped}
      />
    ))
    paintNextFrame(0)
    paintNextFrame(1_000)
    const spinningAngle = Number(platter().dataset.platterAngleRad)

    // Act
    setPhase('stopping')
    paintNextFrame(2_000)
    const deceleratingAngle = Number(platter().dataset.platterAngleRad)
    paintNextFrame(3_000)

    // Assert
    expect(spinningAngle).toBeCloseTo(Math.PI, 12)
    expect(deceleratingAngle).toBeGreaterThan(spinningAngle)
    expect(deceleratingAngle).toBeLessThan(2 * Math.PI)
    expect(Number(platter().dataset.platterAngleRad)).toBeCloseTo(
      2 * Math.PI,
      12,
    )
    expect(platter()).toHaveAttribute('data-platter-overlay', 'hidden')
    expect(onStopped).toHaveBeenCalledTimes(1)
    expect(onStopped).toHaveBeenCalledWith('stop-7')
    expect(frameCallbacks.size).toBe(0)
  })

  it('excludes background time from the mounted spin clock', () => {
    // Arrange
    const [foreground, setForeground] = createSignal(true)
    render(() => (
      <V2OnboardingPlatterPreview
        base={BASE}
        phase="spinning"
        token="spin"
        foreground={foreground()}
        reducedMotion={false}
        onStopped={() => undefined}
      />
    ))
    paintNextFrame(0)
    paintNextFrame(1_000)
    const beforeBackground = Number(platter().dataset.platterAngleRad)

    // Act
    setForeground(false)
    setForeground(true)
    paintNextFrame(8_000)
    const resumedBaseline = Number(platter().dataset.platterAngleRad)
    paintNextFrame(9_000)

    // Assert
    expect(cancelledFrames).toHaveBeenCalledTimes(1)
    expect(beforeBackground).toBeCloseTo(Math.PI, 12)
    expect(resumedBaseline).toBeCloseTo(beforeBackground, 12)
    expect(Number(platter().dataset.platterAngleRad)).toBeCloseTo(
      2 * Math.PI,
      12,
    )
  })

  it('completes reduced-motion stops immediately once per token without media', () => {
    // Arrange
    const [token, setToken] = createSignal('reduced-1')
    const [foreground, setForeground] = createSignal(false)
    const onStopped = vi.fn<(token: string) => void>()
    render(() => (
      <V2OnboardingPlatterPreview
        phase="stopping"
        token={token()}
        foreground={foreground()}
        reducedMotion={true}
        onStopped={onStopped}
      />
    ))

    // Act
    setForeground(true)
    setForeground(false)
    setToken('reduced-2')

    // Assert
    expect(onStopped.mock.calls).toEqual([['reduced-1'], ['reduced-2']])
    expect(platter()).toHaveAttribute('data-platter-source', 'native')
    expect(platter()).toHaveAttribute('data-platter-overlay', 'hidden')
    expect(platter()).toHaveAttribute('data-platter-angle-rad', '0')
    expect(frameCallbacks.size).toBe(0)
    expect(document.querySelector('img')).not.toBeInTheDocument()
  })

  it('reacts to a replacement stopped authority without introducing another asset', () => {
    // Arrange
    const [base, setBase] = createSignal<V2OnboardingStillResource>(BASE)
    render(() => (
      <V2OnboardingPlatterPreview
        base={base()}
        phase="stopped"
        token="still"
        foreground={true}
        reducedMotion={false}
        onStopped={() => undefined}
      />
    ))
    const replacement: V2OnboardingStillResource = {
      kind: 'still',
      src: '/p02-promoted.webp',
      alt: 'Promoted stopped authority',
    }

    // Act
    setBase(replacement)

    // Assert
    expect(document.querySelector('img')).toHaveAttribute(
      'src',
      '/p02-promoted.webp',
    )
    expect(document.querySelector('img')).toHaveAttribute(
      'alt',
      'Promoted stopped authority',
    )
    expect(
      document.querySelectorAll('svg image[href="/p02-promoted.webp"]'),
    ).toHaveLength(3)
    expect(platter()).toHaveAttribute('data-platter-source', 'authored')
  })

  it('cancels its pending frame when the mounted preview leaves the tree', () => {
    // Arrange
    const result = render(() => (
      <V2OnboardingPlatterPreview
        base={BASE}
        phase="spinning"
        token="unmount"
        foreground={true}
        reducedMotion={false}
        onStopped={() => undefined}
      />
    ))

    // Act
    result.unmount()

    // Assert
    expect(cancelledFrames).toHaveBeenCalledTimes(1)
    expect(frameCallbacks.size).toBe(0)
  })
})
