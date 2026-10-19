// ============================================================
// Lesson 3 match toy tests — the gap stays hidden until Compare
// ============================================================

import { afterEach, describe, expect, it, vi } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import { mulberry32 } from '@/features/lessons/kit/dom'
import { gapLine, mountMatch, relativeText, startOffset } from './toy-match'

function matchRoot(): HTMLElement {
  const root = document.createElement('div')
  root.innerHTML = `<canvas></canvas><div data-match-handle tabindex="0"></div>
    <span data-match-gap></span><p data-match-live></p>
    <button data-match="merc"></button><button data-match="compare"></button><button data-match="together"></button>`
  document.body.appendChild(root)
  return root
}

const el = (root: HTMLElement, selector: string): HTMLElement => {
  const found = root.querySelector<HTMLElement>(selector)
  if (found === null) throw new Error(`no ${selector}`)
  return found
}

afterEach(() => {
  vi.useRealTimers()
  document.body.textContent = ''
})

describe('startOffset (FACTS 47)', () => {
  it('starts 80 to 200 cents above or below, on both sides', () => {
    // Arrange
    const random = mulberry32(2026)

    // Act
    const starts = Array.from({ length: 400 }, () => startOffset(random))

    // Assert
    for (const s of starts) expect(Math.abs(s)).toBeGreaterThanOrEqual(80)
    for (const s of starts) expect(Math.abs(s)).toBeLessThanOrEqual(200)
    expect(starts.some((s) => s > 0)).toBe(true)
    expect(starts.some((s) => s < 0)).toBe(true)
  })
})

describe("the slider's words", () => {
  it('say only which way the note moved until Compare, and the gap after', () => {
    expect(relativeText(-60, -120)).toBe('Your note, above where it started')
    expect(relativeText(-130, -120)).toBe('Your note, below where it started')
    expect(gapLine(-18)).toBe("Your note sits 18 cents below Merc's note")
  })
})

describe('mountMatch', () => {
  it('plays Merc, then yours, and only then shows the gap; moving hides it again', async () => {
    // Arrange
    vi.useFakeTimers()
    const root = matchRoot()
    mountMatch(root)
    const handle = el(root, '[data-match-handle]')
    const before = handle.getAttribute('aria-valuetext')

    // Act
    el(root, '[data-match="compare"]').click()
    await vi.advanceTimersByTimeAsync(2300)
    const after = handle.getAttribute('aria-valuetext')
    const live = el(root, '[data-match-live]').textContent ?? ''
    handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }))

    // Assert
    expect(before).toMatch(/^Your note, where it started$/)
    expect(after).toMatch(
      /^Your note sits \d+ cents (above|below) Merc's note$/,
    )
    expect(live).toMatch(/: outside the band$/)
    expect(handle.getAttribute('aria-valuetext')).toBe(
      'Your note, above where it started',
    )
  })
})
