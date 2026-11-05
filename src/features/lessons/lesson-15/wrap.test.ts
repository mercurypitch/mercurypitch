// ============================================================
// Lesson 15 wrap — free play and the tease still
// ============================================================
//
// WEB-SPEC, Toys 1 state 7 and Toys 8: free play's seg picks the treble
// staff, the bass staff or the grand staff, and only the grand staff shows
// the key strip's Lower keys and Higher keys; the page going stops what it
// plays; the tease still is five plain noteheads, G4, A4, B4, A4 and G4,
// nothing lit, with no names and no house, and it plays nothing.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import { Sound } from '@/features/lessons/kit/sound'
import { noteAt } from '@/features/lessons/kit/staff-places'
import { el, loadPage, soundOn } from './page-dom.test-fixtures'
import { initFreePlay, initWrap, TEASE_PLACES } from './wrap'

beforeEach(() => {
  localStorage.clear()
  soundOn()
  loadPage()
})

afterEach(() => {
  vi.restoreAllMocks()
  document.body.textContent = ''
})

const kind = (k: string): HTMLButtonElement =>
  el(`#freePlay [data-free-kind] [data-kind="${k}"]`)
const keysHidden = (): boolean[] =>
  Array.from(
    document.querySelectorAll<HTMLElement>('#freePlay [data-free-keys]'),
  ).map((k) => k.hidden)

describe('free play', () => {
  it('picks the staff by its seg, and shows Lower keys and Higher keys only under the grand staff', () => {
    // Arrange
    initFreePlay()
    const staff = el('#freePlay [data-staff-svg]')
    const opened = staff.getAttribute('aria-label')

    // Act
    kind('bass').click()
    const bass = {
      label: staff.getAttribute('aria-label'),
      pressed: ['treble', 'bass', 'grand'].map((k) =>
        kind(k).getAttribute('aria-pressed'),
      ),
      keys: keysHidden(),
    }
    kind('grand').click()
    const grand = {
      label: staff.getAttribute('aria-label'),
      keys: keysHidden(),
    }
    kind('treble').click()

    // Assert
    expect(opened).toBe('Treble staff, five lines and four spaces')
    expect(bass).toEqual({
      label: 'Bass staff, five lines and four spaces',
      pressed: ['false', 'true', 'false'],
      keys: [true, true],
    })
    expect(grand.label).toMatch(/^Grand staff: /)
    expect(grand.keys).toEqual([false, false])
    expect(keysHidden()).toEqual([true, true])
    expect(staff.getAttribute('aria-label')).toBe(opened)
  })

  it('stops what it plays when the page goes', () => {
    // Arrange
    const toy = initFreePlay()
    const stop = vi.spyOn(toy, 'stop')

    // Act
    window.dispatchEvent(new Event('pagehide'))

    // Assert
    expect(stop).toHaveBeenCalled()
  })
})

describe('the tease still', () => {
  it('draws five plain noteheads stepping up two places and back down, nothing lit, no names, no house, and plays nothing', () => {
    // Arrange
    const voice = vi.spyOn(Sound, 'voice')

    // Act
    initWrap()

    // Assert: WEB-SPEC, Toys 8
    const still = el('.l15-tease svg[data-tease-staff]')
    expect(
      TEASE_PLACES.map((p) => {
        const n = noteAt(p, 'treble')
        return `${n.letter}${String(n.octave)}`
      }),
    ).toEqual(['G4', 'A4', 'B4', 'A4', 'G4'])
    expect(still.querySelectorAll('.st-mark')).toHaveLength(5)
    expect(still.querySelectorAll('.st-halo:not(.is-rest)')).toHaveLength(0)
    expect(
      still.querySelectorAll('.st-home, .st-name, .st-letter'),
    ).toHaveLength(0)
    expect(still.getAttribute('viewBox')).toBe('0 0 288.00 120.00')
    expect(voice).not.toHaveBeenCalled()
  })
})
