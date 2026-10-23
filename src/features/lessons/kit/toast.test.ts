// ============================================================
// Lesson toast tests — a plain line goes, one with an action waits
// ============================================================

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { hideToast, toast, TOAST_MS } from './toast'

const box = (): HTMLElement => document.getElementById('toast') as HTMLElement
const words = (): string =>
  document.getElementById('toastText')?.textContent ?? ''

beforeEach(() => {
  vi.useFakeTimers()
  document.body.innerHTML =
    '<header><button type="button" id="soundSwitch" aria-pressed="false">Sound</button></header><main><button type="button" id="elsewhere">Play</button></main><div class="toast" id="toast" role="status" aria-live="polite"><p id="toastText">Sound is off.</p><button type="button" id="toastBtn" hidden>Turn on</button></div>'
})

afterEach(() => {
  hideToast()
  vi.runAllTimers()
  vi.useRealTimers()
  document.body.textContent = ''
})

describe('toast', () => {
  it('shows a plain line for about four seconds, then empties it, so an idle page reads no stale words', () => {
    // Act
    toast('Paused by your reduced-motion setting.')
    const shown = [box().classList.contains('on'), words()]
    vi.advanceTimersByTime(TOAST_MS + 500)

    // Assert
    expect(shown).toEqual([true, 'Paused by your reduced-motion setting.'])
    expect(box().classList.contains('on')).toBe(false)
    expect(words()).toBe('')
  })

  it('keeps a line with an action until it is put away, long after four seconds', () => {
    // Act
    toast("Sound is off, so you'll see this one but not hear it.", true)
    vi.advanceTimersByTime(TOAST_MS * 3)
    const waited = box().classList.contains('on')
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab' }))
    const afterTab = box().classList.contains('on')
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))

    // Assert: Tab is how a keyboard reaches it; Escape puts it away
    expect(waited).toBe(true)
    expect(afterTab).toBe(true)
    expect(box().classList.contains('on')).toBe(false)
    expect(document.getElementById('toastBtn')?.hidden).toBe(true)
  })

  it('puts a line with an action away at a tap anywhere else, never at a tap on itself', () => {
    // Arrange
    toast('Sound is off.', true)
    const own = document.getElementById('toastBtn') as HTMLButtonElement

    // Act
    own.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }))
    const afterOwn = box().classList.contains('on')
    document
      .getElementById('elsewhere')
      ?.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }))

    // Assert
    expect(afterOwn).toBe(true)
    expect(box().classList.contains('on')).toBe(false)
  })

  it('hands focus to the sound switch when Escape hides the button that held it', () => {
    // Arrange
    toast('Sound is off.', true)
    document.getElementById('toastBtn')?.focus()

    // Act
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))

    // Assert
    expect(box().classList.contains('on')).toBe(false)
    expect(document.activeElement?.id).toBe('soundSwitch')
  })

  it('leaves focus where it was when Escape puts the toast away from outside it', () => {
    // Arrange
    toast('Sound is off.', true)
    document.getElementById('elsewhere')?.focus()

    // Act
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))

    // Assert
    expect(box().classList.contains('on')).toBe(false)
    expect(document.activeElement?.id).toBe('elsewhere')
  })
})
