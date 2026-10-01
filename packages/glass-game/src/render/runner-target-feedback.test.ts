// Runner target feedback regressions — semantic edges stay bounded, static when requested, and target-owned.

import type { Material, Mesh } from 'three'
import { describe, expect, it, vi } from 'vitest'
import type { RunnerPitchFeedback } from '../runner/contracts'
import { createRunnerTargetFeedback } from './runner-target-feedback'
import { RUNNER_TARGET_FEEDBACK_PRESENTATION as CONFIG } from './runner-target-feedback-config'

const NEUTRAL: RunnerPitchFeedback = {
  state: 'neutral',
  observedMidi: null,
  comparedTargetMidi: null,
  errorCents: null,
  correction: null,
}
const ACCEPTED: RunnerPitchFeedback = {
  state: 'accepted',
  observedMidi: 60.1,
  comparedTargetMidi: 60,
  // Deliberately inconsistent: the renderer must trust semantic state only.
  errorCents: 640,
  correction: null,
}
const WRONG_HIGH: RunnerPitchFeedback = {
  state: 'wrong',
  observedMidi: 63,
  comparedTargetMidi: 60,
  errorCents: 1,
  correction: 'lower',
}
const WRONG_LOW: RunnerPitchFeedback = {
  state: 'wrong',
  observedMidi: 57,
  comparedTargetMidi: 60,
  errorCents: -1,
  correction: 'higher',
}

function present(
  controller: ReturnType<typeof createRunnerTargetFeedback>,
  feedback: RunnerPitchFeedback,
  deltaSeconds = 1 / 60,
): void {
  controller.update({
    feedback,
    outcome: null,
    resultAgeSeconds: null,
    deltaSeconds,
    visible: true,
  })
}

function parts(controller: ReturnType<typeof createRunnerTargetFeedback>) {
  return {
    accepted: controller.root.getObjectByName(
      'runner-target-feedback-accepted',
    ) as Mesh,
    wrong: controller.root.getObjectByName(
      'runner-target-feedback-wrong',
    ) as Mesh,
    direction: controller.root.getObjectByName(
      'runner-target-feedback-direction',
    ) as Mesh,
  }
}

describe('runner target feedback', () => {
  it('uses inset phone-legible strips without relying on WebGL line width', () => {
    const controller = createRunnerTargetFeedback(false)
    const { accepted, wrong } = parts(controller)
    const acceptedPositions = accepted.geometry.getAttribute('position')
    const firstQuadX = Array.from({ length: 6 }, (_, index) =>
      acceptedPositions.getX(index),
    )
    const allAcceptedX = Array.from(
      { length: acceptedPositions.count },
      (_, index) => acceptedPositions.getX(index),
    )

    expect(accepted.type).toBe('Mesh')
    expect(wrong.type).toBe('Mesh')
    expect(Math.max(...firstQuadX) - Math.min(...firstQuadX)).toBeCloseTo(
      CONFIG.geometry.stripWidth,
    )
    expect(Math.min(...allAcceptedX)).toBeGreaterThan(
      -CONFIG.geometry.width / 2,
    )
    expect(Math.max(...allAcceptedX)).toBeLessThan(CONFIG.geometry.width / 2)
    expect(CONFIG.geometry.wrongInnerInset).toBeGreaterThan(
      CONFIG.geometry.stripWidth,
    )
    expect(CONFIG.palette).toEqual({ accepted: 0x70e8b1, wrong: 0xee8394 })
    controller.dispose()
  })

  it('maps accepted, wrong, and neutral truth without inspecting cents', () => {
    const controller = createRunnerTargetFeedback(false)
    const { accepted, wrong, direction } = parts(controller)

    present(controller, ACCEPTED)
    expect(accepted.visible).toBe(true)
    expect(wrong.visible).toBe(false)
    expect(direction.visible).toBe(false)
    expect(accepted.type).toBe('Mesh')
    expect(
      (
        accepted.material as Material & { color: { getHex(): number } }
      ).color.getHex(),
    ).toBe(CONFIG.palette.accepted)

    present(controller, WRONG_LOW)
    expect(accepted.visible).toBe(false)
    expect(wrong.visible).toBe(true)
    expect(direction.visible).toBe(true)
    expect(wrong.type).toBe('Mesh')
    expect(direction.rotation.z).toBe(0)
    expect(
      (
        wrong.material as Material & { color: { getHex(): number } }
      ).color.getHex(),
    ).toBe(CONFIG.palette.wrong)
    expect(wrong.geometry.getAttribute('position').count).toBeGreaterThan(
      accepted.geometry.getAttribute('position').count * 2,
    )

    present(controller, WRONG_HIGH)
    expect(direction.rotation.z).toBe(Math.PI)

    present(controller, NEUTRAL)
    expect(accepted.visible).toBe(false)
    expect(wrong.visible).toBe(false)
    expect(direction.visible).toBe(false)
    controller.dispose()
  })

  it('pulses only wrong feedback when motion is enabled', () => {
    const moving = createRunnerTargetFeedback(false)
    const still = createRunnerTargetFeedback(true)
    const movingWrong = parts(moving).wrong
    const stillWrong = parts(still).wrong

    present(moving, WRONG_HIGH, 0.05)
    const movingFirst = (movingWrong.material as Material & { opacity: number })
      .opacity
    present(moving, WRONG_HIGH, 0.05)
    const movingSecond = (
      movingWrong.material as Material & { opacity: number }
    ).opacity
    present(still, WRONG_HIGH, 0.05)
    const stillFirst = (stillWrong.material as Material & { opacity: number })
      .opacity
    present(still, WRONG_HIGH, 0.05)
    const stillSecond = (stillWrong.material as Material & { opacity: number })
      .opacity

    expect(movingSecond).not.toBe(movingFirst)
    expect(stillSecond).toBe(stillFirst)
    expect(stillSecond).toBe(CONFIG.opacity.wrong)
    moving.dispose()
    still.dispose()
  })

  it('shows one restrained completion pop and clears misses immediately', () => {
    const controller = createRunnerTargetFeedback(false)
    const reduced = createRunnerTargetFeedback(true)
    const { accepted, wrong } = parts(controller)

    controller.update({
      feedback: NEUTRAL,
      outcome: 'hit',
      resultAgeSeconds: CONFIG.timing.completionPopSeconds / 2,
      deltaSeconds: 1 / 60,
      visible: true,
    })
    expect(accepted.visible).toBe(true)
    expect(accepted.scale.x).toBeCloseTo(1 + CONFIG.timing.completionPopScale)

    reduced.update({
      feedback: NEUTRAL,
      outcome: 'hit',
      resultAgeSeconds: CONFIG.timing.completionPopSeconds / 2,
      deltaSeconds: 1 / 60,
      visible: true,
    })
    expect(parts(reduced).accepted.visible).toBe(true)
    expect(parts(reduced).accepted.scale.x).toBe(1)

    controller.update({
      feedback: ACCEPTED,
      outcome: 'miss',
      resultAgeSeconds: 0,
      deltaSeconds: 1 / 60,
      visible: true,
    })
    expect(accepted.visible).toBe(false)
    expect(wrong.visible).toBe(false)
    controller.dispose()
    reduced.dispose()
  })

  it('keeps resources stable across pitch-rate updates and disposes each once', () => {
    const first = createRunnerTargetFeedback(false)
    const second = createRunnerTargetFeedback(false)
    const originalChildren = [...first.root.children]
    const disposers = originalChildren.flatMap((child) => [
      vi.spyOn((child as Mesh).geometry, 'dispose'),
      vi.spyOn((child as Mesh).material as Material, 'dispose'),
    ])

    for (let index = 0; index < 120; index++)
      present(first, index % 2 === 0 ? WRONG_HIGH : ACCEPTED)
    present(second, NEUTRAL)

    expect(first.root.children).toEqual(originalChildren)
    expect(parts(second).accepted.visible).toBe(false)
    expect(parts(second).wrong.visible).toBe(false)
    first.dispose()
    first.dispose()
    disposers.forEach((dispose) => expect(dispose).toHaveBeenCalledOnce())
    second.dispose()
  })
})
