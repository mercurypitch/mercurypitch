// ============================================================
// Space-bar transport toggle tests — capture ownership + typing guard
// ============================================================

import { afterEach, describe, expect, it, vi } from 'vitest'
import { installSpacePlaybackToggle, isTypingTarget, } from '@/lib/space-playback'

function pressSpace(
  target: HTMLElement,
  init: KeyboardEventInit = {},
): KeyboardEvent {
  const event = new KeyboardEvent('keydown', {
    code: 'Space',
    key: ' ',
    bubbles: true,
    cancelable: true,
    ...init,
  })
  target.dispatchEvent(event)
  return event
}

describe('isTypingTarget', () => {
  it('keeps Space for text-entry surfaces', () => {
    const text = document.createElement('input')
    text.type = 'text'
    const search = document.createElement('input')
    search.type = 'search'
    const area = document.createElement('textarea')
    const select = document.createElement('select')
    const editable = document.createElement('div')
    Object.defineProperty(editable, 'isContentEditable', { value: true })
    for (const el of [text, search, area, select, editable]) {
      expect(isTypingTarget(el)).toBe(true)
    }
  })

  it('gives Space to the transport for non-text controls', () => {
    const button = document.createElement('button')
    const range = document.createElement('input')
    range.type = 'range'
    const checkbox = document.createElement('input')
    checkbox.type = 'checkbox'
    const div = document.createElement('div')
    for (const el of [button, range, checkbox, div]) {
      expect(isTypingTarget(el)).toBe(false)
    }
    expect(isTypingTarget(null)).toBe(false)
  })
})

describe('installSpacePlaybackToggle', () => {
  let uninstall: (() => void) | null = null

  afterEach(() => {
    uninstall?.()
    uninstall = null
    document.body.innerHTML = ''
  })

  it('toggles on Space from a focused button and suppresses its activation', () => {
    const toggle = vi.fn()
    uninstall = installSpacePlaybackToggle({ toggle })
    const button = document.createElement('button')
    document.body.append(button)
    const event = pressSpace(button)
    expect(toggle).toHaveBeenCalledTimes(1)
    expect(event.defaultPrevented).toBe(true)
  })

  it('ignores typing targets, repeats and modifier chords', () => {
    const toggle = vi.fn()
    uninstall = installSpacePlaybackToggle({ toggle })
    const input = document.createElement('input')
    input.type = 'text'
    document.body.append(input)
    expect(pressSpace(input).defaultPrevented).toBe(false)
    pressSpace(document.body, { repeat: true })
    pressSpace(document.body, { ctrlKey: true })
    pressSpace(document.body, { metaKey: true })
    expect(toggle).not.toHaveBeenCalled()
  })

  it('swallows Space without toggling while the gate is closed', () => {
    const toggle = vi.fn()
    uninstall = installSpacePlaybackToggle({ toggle, enabled: () => false })
    const event = pressSpace(document.body)
    expect(event.defaultPrevented).toBe(true)
    expect(toggle).not.toHaveBeenCalled()
  })

  it('yields Space untouched while another surface owns the key', () => {
    const toggle = vi.fn()
    uninstall = installSpacePlaybackToggle({
      toggle,
      ownsSpace: () => false,
    })
    const button = document.createElement('button')
    document.body.append(button)
    const event = pressSpace(button)

    expect(event.defaultPrevented).toBe(false)
    expect(toggle).not.toHaveBeenCalled()
  })

  it('runs in the capture phase so bubble-phase widgets cannot steal the key', () => {
    const toggle = vi.fn()
    uninstall = installSpacePlaybackToggle({ toggle })
    const widget = document.createElement('div')
    document.body.append(widget)
    widget.addEventListener('keydown', (event) => event.stopPropagation())
    pressSpace(widget)
    expect(toggle).toHaveBeenCalledTimes(1)
  })

  it('stops listening after uninstall', () => {
    const toggle = vi.fn()
    const remove = installSpacePlaybackToggle({ toggle })
    remove()
    pressSpace(document.body)
    expect(toggle).not.toHaveBeenCalled()
  })
})
