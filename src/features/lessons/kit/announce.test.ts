// ============================================================
// Lesson announcer tests — one status line, written after a beat
// ============================================================

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { announce, ANNOUNCE_DELAY_MS, announcer, spokenText } from './announce'

const lines = (): HTMLElement[] =>
  Array.from(document.querySelectorAll<HTMLElement>('[data-announcer]'))

beforeEach(() => {
  vi.useFakeTimers()
  document.body.innerHTML = '<main id="main"></main>'
})

afterEach(() => {
  vi.useRealTimers()
  document.body.textContent = ''
})

describe('announcer', () => {
  it('makes one visually hidden status line inside main, however often it is asked for', () => {
    // Act
    const first = announcer()
    const second = announcer()

    // Assert
    expect(second).toBe(first)
    expect(lines()).toHaveLength(1)
    expect(first.getAttribute('role')).toBe('status')
    expect(first.classList.contains('sr')).toBe(true)
    expect(first.parentElement?.id).toBe('main')
  })

  it('makes a new line when the page it was in has gone', () => {
    // Arrange
    const old = announcer()
    document.body.innerHTML = '<main></main>'

    // Act
    const fresh = announcer()

    // Assert
    expect(fresh).not.toBe(old)
    expect(lines()).toEqual([fresh])
  })
})

describe('announce', () => {
  it('writes the words after a beat with the line empty, so a repeat still counts as a change', () => {
    // Arrange
    announce('Your taps: 88 beats per minute')
    vi.advanceTimersByTime(ANNOUNCE_DELAY_MS)
    const line = announcer()

    // Act: the same words again
    announce('Your taps: 88 beats per minute')
    const between = line.textContent
    vi.advanceTimersByTime(ANNOUNCE_DELAY_MS)

    // Assert
    expect(between).toBe('')
    expect(line.textContent).toBe('Your taps: 88 beats per minute')
  })

  it('keeps only the latest words when two come within the beat', () => {
    // Act
    announce('Your taps: 80 beats per minute')
    announce('Your taps: 84 beats per minute')
    vi.advanceTimersByTime(ANNOUNCE_DELAY_MS)

    // Assert
    expect(announcer().textContent).toBe('Your taps: 84 beats per minute')
  })

  it('says nothing for empty words', () => {
    // Act
    announce('')
    vi.advanceTimersByTime(ANNOUNCE_DELAY_MS)

    // Assert
    expect(announcer().textContent).toBe('')
  })
})

describe('spokenText', () => {
  it('turns each drawn line into a sentence', () => {
    // Arrange: a browser's innerText, which jsdom lacks
    const el = document.createElement('p')
    Object.defineProperty(el, 'innerText', {
      value: 'You said: higher\n  One after the other,\n\n440 sounds higher.',
    })

    // Act
    const said = spokenText(el)

    // Assert
    expect(said).toBe(
      'You said: higher. One after the other, 440 sounds higher.',
    )
  })

  it('falls back to the text content where there is no layout', () => {
    // Arrange
    const el = document.createElement('p')
    el.innerHTML = '<span>You said: lower</span>  and   more'

    // Act
    const said = spokenText(el)

    // Assert
    expect(said).toBe('You said: lower and more')
  })
})
