// ============================================================
// Lesson 1 octave toy tests — the ratio slider on the page's own markup
// ============================================================
//
// An arrow key or a screen reader's swipe moves the ratio one step, and the
// octave's detent belongs to a drag alone, so a step off 2.00 stays off it.
// "Try 1.26", "Back to 2" and "Try 3" move a slider the keyboard is not
// on, so what they set is said on the page's status line.

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import { ANNOUNCE_DELAY_MS } from '@/features/lessons/kit/announce'
import type { StepDeck } from '@/features/lessons/kit/step-deck'
import { initOctaveToy } from './toy-octave'

const PAGE = readFileSync(resolve(process.cwd(), 'learn/01.html'), 'utf8')

/** A deck whose fourth step, the toy's, is never on screen: nothing draws. */
const deck = { toyActive: () => () => false } as unknown as StepDeck

const ratio = (): HTMLInputElement => {
  const input = document.querySelector<HTMLInputElement>('#ratio')
  if (input === null) throw new Error('no #ratio')
  return input
}

/** Moves the slider to `value` (ratio times 100), as a key step or a drag does. */
function slide(value: number): void {
  ratio().value = String(value)
  ratio().dispatchEvent(new Event('input'))
}

const line = (): string =>
  document.querySelector('[data-announcer]')?.textContent ?? ''

beforeEach(() => {
  vi.useFakeTimers()
  const body = /<body[^>]*>([\s\S]*)<\/body>/.exec(PAGE)
  if (body === null) throw new Error('learn/01.html has no body')
  document.body.innerHTML = body[1]
  initOctaveToy(deck)
})

afterEach(() => {
  vi.useRealTimers()
  document.body.textContent = ''
})

describe("Lesson 1's ratio slider", () => {
  it('moves off 2.00 for a key step, and pulls only a drag back to the octave', () => {
    // Act: a step up from 2.00, then a drag to the same place
    slide(201)
    const stepped = ratio().value
    ratio().dispatchEvent(new MouseEvent('pointerdown'))
    slide(201)
    const dragged = ratio().value
    window.dispatchEvent(new MouseEvent('pointerup'))

    // Assert
    expect(stepped).toBe('201')
    expect(dragged).toBe('200')
  })

  it('says what Try 1.26, Back to 2 and Try 3 set, through the status line', () => {
    // Act
    const said = ['1.26', '2', '3'].map((r) => {
      document.querySelector<HTMLButtonElement>(`[data-ratio="${r}"]`)?.click()
      vi.advanceTimersByTime(ANNOUNCE_DELAY_MS)
      return line()
    })

    // Assert
    expect(said).toEqual([
      'ratio 1.26, 277 hertz. 277 Hz, a different note',
      'ratio 2.00, 440 hertz. Octave: 2 to 1',
      'ratio 3.00, 660 hertz. 3 to 1 fits too: a different note (E5)',
    ])
  })
})
