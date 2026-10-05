// Continuous steering input tests — one axis owner, independent jump and explicit lifecycle neutralisation.

import { describe, expect, it, vi } from 'vitest'
import { createRunnerContinuousInput } from './runner-continuous-input'
import type { RunnerKeyboardEdgeEvent } from './runner-input'

function key(
  code: string,
  patch: Partial<RunnerKeyboardEdgeEvent> = {},
): RunnerKeyboardEdgeEvent {
  return {
    code,
    repeat: false,
    defaultPrevented: false,
    metaKey: false,
    ctrlKey: false,
    altKey: false,
    target: null,
    preventDefault: vi.fn(),
    ...patch,
  }
}

function harness() {
  const jump = vi.fn(() => true)
  const steer = vi.fn(() => true)
  const input = createRunnerContinuousInput(jump, steer)
  input.setEnabled(true)
  return { input, steer, jump }
}

describe('continuous runner keyboard', () => {
  it('holds an axis, cancels opposites, and does not duplicate alias or repeated submissions', () => {
    const { input, steer } = harness()
    input.key(key('KeyD'), true)
    input.key(key('KeyD', { repeat: true }), true)
    input.key(key('ArrowRight'), true)
    input.key(key('KeyA'), true)
    input.key(key('KeyD'), false)
    input.key(key('ArrowRight'), false)
    input.key(key('KeyA'), false)
    expect(steer.mock.calls).toEqual([[1], [0], [-1], [0]])
  })

  it('keeps jump an edge while steering remains held', () => {
    const { input, steer, jump } = harness()
    input.key(key('KeyA'), true)
    input.key(key('Space'), true)
    input.key(key('Space', { repeat: true }), true)
    input.key(key('ArrowUp'), true)
    expect(jump).toHaveBeenCalledTimes(1)
    expect(steer.mock.calls).toEqual([[-1]])
    input.key(key('Space'), false)
    input.key(key('ArrowUp'), false)
    input.key(key('KeyW'), true)
    expect(jump).toHaveBeenCalledTimes(2)
  })

  it.each(['clear', 'disable'] as const)(
    'requires fresh input after %s and rejects a key still repeating',
    (mode) => {
      const { input, steer } = harness()
      input.key(key('KeyD'), true)
      if (mode === 'clear') input.clear()
      else input.setEnabled(false)
      input.setEnabled(true)
      input.key(key('KeyD', { repeat: true }), true)
      expect(steer.mock.calls).toEqual([[1], [0]])
      input.key(key('KeyD'), false)
      input.key(key('KeyD'), true)
      expect(steer.mock.calls).toEqual([[1], [0], [1]])
    },
  )

  it('ignores editing targets, modifiers, disabled input and already handled events', () => {
    const { input, steer } = harness()
    const target = {
      isContentEditable: true,
      closest: () => null,
    } as unknown as EventTarget
    expect(input.key(key('KeyD', { target }), true)).toBe(false)
    for (const patch of [
      { metaKey: true },
      { ctrlKey: true },
      { altKey: true },
      { defaultPrevented: true },
    ])
      expect(input.key(key('KeyD', patch), true)).toBe(false)
    input.setEnabled(false)
    expect(input.key(key('KeyD'), true)).toBe(false)
    expect(steer).not.toHaveBeenCalled()
  })

  it('keeps controls neutral when a steering submission synchronously enters recovery', () => {
    const input = createRunnerContinuousInput(
      () => true,
      (axis) => {
        if (axis !== 0) input.setEnabled(false)
        return false
      },
    )
    input.setEnabled(true)
    input.key(key('KeyD'), true)
    expect(input.steeringState()).toEqual({
      axis: 0,
      pointerId: null,
      displacementPx: 0,
    })
  })
})

describe('continuous runner thumb capture', () => {
  it('starts at the contact, applies a deadzone and saturates at 40 px without repeated axis writes', () => {
    const { input, steer } = harness()
    expect(input.steeringDown(4, 160, 40)).toBe(true)
    input.steeringMove(4, 162)
    expect(input.steeringState().axis).toBe(0)
    input.steeringMove(4, 180)
    expect(input.steeringState().axis).toBeCloseTo((0.5 - 0.08) / 0.92)
    input.steeringMove(4, 200)
    input.steeringMove(4, 230)
    expect(input.steeringState()).toMatchObject({
      axis: 1,
      displacementPx: 40,
      pointerId: 4,
    })
    input.steeringMove(4, 120)
    input.steeringEnd(4)
    expect(steer.mock.calls).toEqual([[(0.5 - 0.08) / 0.92], [1], [-1], [0]])
  })

  it('gives the pointer priority and restores currently held keyboard input on release', () => {
    const { input, steer } = harness()
    input.key(key('KeyA'), true)
    input.steeringDown(2, 100, 40)
    input.steeringMove(2, 140)
    input.key(key('KeyD'), true)
    input.key(key('KeyA'), false)
    expect(steer.mock.calls).toEqual([[-1], [0], [1]])
    input.steeringEnd(2)
    expect(input.steeringState()).toMatchObject({ axis: 1, pointerId: null })
    input.key(key('KeyD'), false)
    expect(steer.mock.calls).toEqual([[-1], [0], [1], [0]])
  })

  it('keeps jump separate, rejects a second steering contact and ignores another pointer ending', () => {
    const { input, steer, jump } = harness()
    expect(input.steeringDown(2, 100, 40)).toBe(true)
    input.steeringMove(2, 140)
    expect(input.pointerDown('jump', 3)).toBe(true)
    expect(input.steeringDown(3, 100, 40)).toBe(false)
    expect(input.steeringMove(3, 0)).toBe(false)
    expect(input.steeringEnd(3)).toBe(false)
    expect(input.pointerEnd('jump', 3)).toBe(true)
    expect(input.steeringState().axis).toBe(1)
    expect(input.pointerDown('jump', 2)).toBe(false)
    input.steeringEnd(2)
    expect(jump).toHaveBeenCalledOnce()
    expect(steer.mock.calls).toEqual([[1], [0]])
  })

  it('does not let an existing jump contact also acquire steering', () => {
    const { input } = harness()
    input.pointerDown('jump', 3)
    expect(input.pointerDown('jump', 3)).toBe(false)
    expect(input.steeringDown(3, 100, 40)).toBe(false)
    input.pointerEnd('jump', 3)
    expect(input.steeringDown(3, 100, 40)).toBe(true)
  })

  it('clears active capture, keyboard and jump together on lifecycle interruption', () => {
    const { input, steer } = harness()
    const listener = vi.fn()
    const unsubscribe = input.subscribeSteering(listener)
    input.key(key('KeyD'), true)
    input.steeringDown(2, 100, 40)
    input.steeringMove(2, 60)
    input.pointerDown('jump', 3)
    input.setEnabled(false)
    expect(listener).toHaveBeenLastCalledWith({
      axis: 0,
      pointerId: null,
      displacementPx: 0,
    })
    expect(input.steeringMove(2, 140)).toBe(false)
    expect(input.steeringEnd(2)).toBe(false)
    input.setEnabled(true)
    expect(input.pointerDown('jump', 3)).toBe(true)
    expect(steer).toHaveBeenLastCalledWith(0)
    const count = listener.mock.calls.length
    unsubscribe()
    input.key(key('KeyD'), true)
    expect(listener).toHaveBeenCalledTimes(count)
  })

  it('rejects invalid contact coordinates and leaves lane commands to comparison A', () => {
    const { input, steer, jump } = harness()
    expect(input.steeringDown(1, NaN, 40)).toBe(false)
    expect(input.steeringDown(1, 100, 0)).toBe(false)
    input.steeringDown(1, 100, 40)
    expect(input.steeringMove(1, Infinity)).toBe(false)
    expect(input.activate('lane-left')).toBe(false)
    expect(input.pointerDown('lane-right', 2)).toBe(false)
    expect(steer).not.toHaveBeenCalled()
    expect(jump).not.toHaveBeenCalled()
  })
})
