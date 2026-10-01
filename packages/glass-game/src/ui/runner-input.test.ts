// ============================================================
// Runner UI input tests — keyboard and pointer edges never repeat while held.
// ============================================================

import { describe, expect, it, vi } from 'vitest'
import type { RunnerKeyboardEdgeEvent } from './runner-input'
import { createRunnerInputEdges } from './runner-input'

function keyEvent(
  code: string,
  options: Partial<RunnerKeyboardEdgeEvent> = {},
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
    ...options,
  }
}

function interactiveTarget(selector: string): EventTarget {
  const target = {
    isContentEditable: false,
    closest: vi.fn((query: string) =>
      query.includes(selector) ? target : null,
    ),
  }
  return target as unknown as EventTarget
}

describe('runner keyboard edges', () => {
  it('submits one edge for a held key and rearms after keyup', () => {
    const submit = vi.fn(() => true)
    const input = createRunnerInputEdges(submit)
    input.setEnabled(true)

    input.key(keyEvent('ArrowLeft'), true)
    input.key(keyEvent('ArrowLeft', { repeat: true }), true)
    input.key(keyEvent('ArrowLeft'), true)
    expect(submit).toHaveBeenCalledTimes(1)
    expect(submit).toHaveBeenLastCalledWith('lane-left')

    input.key(keyEvent('ArrowLeft'), false)
    input.key(keyEvent('ArrowLeft'), true)
    expect(submit).toHaveBeenCalledTimes(2)
  })

  it('treats keyboard aliases as one held action', () => {
    const submit = vi.fn(() => true)
    const input = createRunnerInputEdges(submit)
    input.setEnabled(true)

    input.key(keyEvent('KeyA'), true)
    input.key(keyEvent('ArrowLeft'), true)
    expect(submit).toHaveBeenCalledTimes(1)

    input.key(keyEvent('KeyA'), false)
    input.key(keyEvent('KeyA'), true)
    expect(submit).toHaveBeenCalledTimes(1)
    input.key(keyEvent('KeyA'), false)
    input.key(keyEvent('ArrowLeft'), false)
    input.key(keyEvent('ArrowLeft'), true)
    expect(submit).toHaveBeenCalledTimes(2)
  })

  it('ignores disabled phases, shortcuts, and interactive targets', () => {
    const submit = vi.fn(() => true)
    const input = createRunnerInputEdges(submit)

    expect(input.key(keyEvent('Space'), true)).toBe(false)
    input.setEnabled(true)
    expect(
      input.key(
        keyEvent('Space', { target: interactiveTarget('button') }),
        true,
      ),
    ).toBe(false)
    expect(input.key(keyEvent('KeyD', { ctrlKey: true }), true)).toBe(false)
    expect(submit).not.toHaveBeenCalled()
  })

  it('clears held keys when input leaves the running phase', () => {
    const submit = vi.fn(() => true)
    const input = createRunnerInputEdges(submit)
    input.setEnabled(true)
    input.key(keyEvent('KeyD'), true)
    input.setEnabled(false)
    input.setEnabled(true)
    input.key(keyEvent('KeyD'), true)

    expect(submit).toHaveBeenCalledTimes(2)
  })
})

describe('runner pointer edges', () => {
  it('keeps simultaneous lane and jump contacts independent', () => {
    const submit = vi.fn(() => true)
    const input = createRunnerInputEdges(submit)
    input.setEnabled(true)

    expect(input.pointerDown('lane-left', 10)).toBe(true)
    expect(input.pointerDown('jump', 11)).toBe(true)
    expect(input.pointerDown('lane-left', 12)).toBe(false)
    expect(submit.mock.calls).toEqual([['lane-left'], ['jump']])

    expect(input.pointerEnd('lane-left', 10)).toBe(true)
    expect(input.pointerDown('lane-left', 12)).toBe(true)
  })

  it('rearms a contact after cancellation and clears all contacts on blur', () => {
    const submit = vi.fn(() => true)
    const input = createRunnerInputEdges(submit)
    input.setEnabled(true)

    input.pointerDown('lane-right', 20)
    expect(input.pointerEnd('lane-right', 20)).toBe(true)
    expect(input.pointerDown('lane-right', 20)).toBe(true)
    input.clear()
    expect(input.pointerDown('lane-right', 20)).toBe(true)
    expect(submit).toHaveBeenCalledTimes(3)
  })
})
