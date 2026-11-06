// ============================================================
// Lesson 23 wrap tests — the rest line, free play and the tease still
// ============================================================
//
// WEB-SPEC, Toys 1 state 5, Toys 5 and Toys 8: the practice card shows
// Lesson 8's rest line after the rest ending and keeps Leap in every
// version; free play is the staff toy in its interval state with every
// control offered and all thirteen lanes drawn from the start, whether or
// not the cold open's choice was made, on the learner's staff, which
// follows the voice choice; its moves are the page's one sound; and the
// tease still holds no button and plays nothing.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import { VisitEnding } from '@/features/lessons/kit/comfort'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import type * as RunModule from '@/features/lessons/kit/run'
import { resetRuns, runs, } from '@/features/lessons/kit/run-recorder.test-fixtures'
import { PitchLine } from '@/features/lessons/kit/staff'
import { VoiceChoice } from '@/features/lessons/kit/voice-choice'
import { el, loadPage, soundOn, words } from './page-dom.test-fixtures'
import { initFreePlay, initWrap } from './wrap'

vi.mock('@/features/lessons/kit/run', async (actual) => ({
  ...(await actual<typeof RunModule>()),
  ...(await import('@/features/lessons/kit/run-recorder.test-fixtures'))
    .recordedRuns,
}))

beforeEach(() => {
  localStorage.clear()
  loadPage()
  resetRuns()
  soundOn()
  // as main.ts turns it on for the page
  PitchLine.set(true)
  VisitEnding.set('practise')
})

afterEach(() => {
  vi.restoreAllMocks()
  document.body.textContent = ''
})

const free = (sel: string): HTMLButtonElement =>
  el<HTMLButtonElement>(`#freePlay ${sel}`)
const restLine = (): HTMLElement => el('#practiseCard [data-ending="rest"]')

describe('the practice card', () => {
  it('shows the rest line after the rest ending, hides it for the practise one, and keeps Leap in both', () => {
    // Arrange
    initWrap()
    const opened = restLine().hidden

    // Act
    VisitEnding.set('rest')
    const rested = [restLine().hidden, words(el('#practiseCard h3'))]
    VisitEnding.set('practise')

    // Assert: FACTS 56
    expect(opened).toBe(true)
    expect(rested).toEqual([false, "Ear Lab's Leap"])
    expect(restLine().hidden).toBe(true)
    expect(words(restLine())).toBe(
      "Rest today. This page's sung line will be here when your voice feels comfortable.",
    )
  })
})

describe('free play', () => {
  it('offers every control under its own rule and draws all thirteen lanes from the start, with no choice made', () => {
    // Act
    initFreePlay()
    const offered = (sel: string): boolean =>
      free(sel).getAttribute('aria-disabled') !== 'true'
    const onE = [
      offered('[data-iv-sign="sharp"]'),
      offered('[data-iv-sign="flat"]'),
    ]
    free('[data-staff-step="1"]').click()

    // Assert: WEB-SPEC, Toys 1, state 5; E takes a flat and no sharp, F a
    // sharp and no flat (FACTS 10)
    for (const sel of [
      '[data-iv-fold]',
      '[data-iv-curl]',
      '[data-staff-step="1"]',
      '[data-staff-step="-1"]',
    ])
      expect(offered(sel), sel).toBe(true)
    expect(onE).toEqual([false, true])
    expect([
      offered('[data-iv-sign="sharp"]'),
      offered('[data-iv-sign="flat"]'),
    ]).toEqual([true, false])
    expect(el('#freePlay').querySelectorAll('.iv-lane')).toHaveLength(13)
  })

  it("plays a move as Lesson 6's pair on the learner's staff, and follows a change of voice", () => {
    // Arrange
    VoiceChoice.set('lower')
    const toy = initFreePlay()

    // Act
    free('[data-staff-step="1"]').click()
    const lower = runs[0].notes.map((n) => n.midi)
    VoiceChoice.set('higher')

    // Assert: C3 up to F3 on the bass staff, then the treble's octave
    expect(lower).toEqual([48, 53])
    expect(toy.clef).toBe('treble')
    expect(runs[0].stopped).toBe(true)
  })

  it("is the page's one sound: a newer sound stops its move", () => {
    // Arrange
    initFreePlay()
    free('[data-staff-step="1"]').click()

    // Act
    NowPlaying.claim(() => undefined)

    // Assert
    expect(runs[0].stopped).toBe(true)
  })
})

describe('the tease still', () => {
  it('sits in the next-lesson card, hidden from a screen reader, with no button and no sound', () => {
    // Arrange
    const tease = el('[data-next-card] .l23-tease')

    // Act
    initWrap()

    // Assert: WEB-SPEC, Toys 8
    expect(tease.getAttribute('aria-hidden')).toBe('true')
    expect(tease.querySelectorAll('button, a')).toHaveLength(0)
    expect(
      tease.querySelectorAll('.l23-tease-band, .l23-tease-line'),
    ).toHaveLength(2)
    expect(runs).toHaveLength(0)
  })
})
