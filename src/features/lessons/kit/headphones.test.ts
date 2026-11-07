// ============================================================
// Headphones tests — two buttons, and the visit's answer in memory
// ============================================================
//
// "I have headphones on" opens the holds' briefing and "No headphones" the
// sing-along; the answer holds for the visit and is never stored (Lesson 24
// WEB-SPEC, Toys 6, state 4; FACTS 51).

import { afterEach, describe, expect, it, vi } from 'vitest'
import { Headphones, mountHeadphones } from './headphones'

/** The check's markup, as Lesson 24's Sing it has it. */
function mount(): HTMLElement {
  document.body.innerHTML = `
    <div id="check">
      <button type="button" data-phones="on">I have headphones on</button>
      <button type="button" data-phones="off">No headphones</button>
    </div>`
  const root = document.getElementById('check')
  if (root === null) throw new Error('no check')
  return root
}

const button = (which: 'on' | 'off'): HTMLButtonElement => {
  const b = document.querySelector<HTMLButtonElement>(
    `[data-phones="${which}"]`,
  )
  if (b === null) throw new Error(`no ${which} button`)
  return b
}

afterEach(() => {
  Headphones.reset()
  localStorage.clear()
  document.body.textContent = ''
})

describe('the headphones check', () => {
  it('asks afresh: no answer before a button is pressed', () => {
    // Arrange
    mount()

    // Assert
    expect(Headphones.answer).toBeNull()
  })

  it('opens the briefing on "I have headphones on", and holds the answer', () => {
    // Arrange
    const onOn = vi.fn()
    const onOff = vi.fn()
    mountHeadphones(mount(), { onOn, onOff })

    // Act
    button('on').click()

    // Assert
    expect([onOn.mock.calls.length, onOff.mock.calls.length]).toEqual([1, 0])
    expect(Headphones.answer).toBe('on')
  })

  it('opens the sing-along on "No headphones", and holds that answer', () => {
    // Arrange
    const onOn = vi.fn()
    const onOff = vi.fn()
    mountHeadphones(mount(), { onOn, onOff })

    // Act
    button('off').click()

    // Assert
    expect([onOn.mock.calls.length, onOff.mock.calls.length]).toEqual([0, 1])
    expect(Headphones.answer).toBe('off')
  })

  it('keeps the answer in memory only: nothing is stored', () => {
    // Arrange
    mountHeadphones(mount(), { onOn: vi.fn(), onOff: vi.fn() })

    // Act
    button('on').click()

    // Assert
    expect(localStorage.length).toBe(0)
    expect(sessionStorage.length).toBe(0)
  })
})
