// ============================================================
// Lesson 21 wrap tests — the rest line, free play and the tease still
// ============================================================
//
// WEB-SPEC, Toys 3 and 9, and Practice links: the practice card shows
// Lesson 8's rest line after the rest ending and keeps Compose and Ear
// Lab's Home in every version; free play is the circle beside the
// learner's staff, the house anywhere from E flat round to A, each move
// playing the new key's scale at the circle's pace, on the staff, which
// follows the voice choice; its moves are the page's one sound; and the
// tease still holds no button and plays nothing.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import { VisitEnding } from '@/features/lessons/kit/comfort'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import type * as RunModule from '@/features/lessons/kit/run'
import { resetRuns, runs, } from '@/features/lessons/kit/run-recorder.test-fixtures'
import { VoiceChoice } from '@/features/lessons/kit/voice-choice'
import { el, loadPage, soundOn, words } from './page-dom.test-fixtures'
import { initFreePlay, initWrap } from './wrap'

vi.mock('@/features/lessons/kit/run', async (actual) => ({
  ...(await actual<typeof RunModule>()),
  ...(await import('@/features/lessons/kit/run-recorder.test-fixtures'))
    .recordedRuns,
}))

beforeEach(() => {
  VoiceChoice.set('lower')
  loadPage()
  resetRuns()
  soundOn()
  VisitEnding.set('practise')
})

afterEach(() => {
  vi.restoreAllMocks()
  document.body.textContent = ''
})

const free = (sel: string): HTMLElement => el(`#freePlay ${sel}`)
const restLine = (): HTMLElement => el('#practiseCard [data-ending="rest"]')
const last = () => runs[runs.length - 1]

describe('the practice card', () => {
  it('shows the rest line after the rest ending, hides it for the practise one, and keeps both drills in both', () => {
    // Arrange
    initWrap()
    const opened = restLine().hidden

    // Act
    VisitEnding.set('rest')
    const rested = [
      restLine().hidden,
      words(el('#practiseCard h3')),
      el('#practiseCard .second-drill').hidden,
    ]
    VisitEnding.set('practise')

    // Assert: FACTS 58
    expect(opened).toBe(true)
    expect(rested).toEqual([false, 'Compose, in Sheet Music', false])
    expect(restLine().hidden).toBe(true)
    expect(words(restLine())).toBe(
      "Rest today. This page's sung line will be here when your voice feels comfortable.",
    )
  })
})

describe('free play', () => {
  it('lets the house go anywhere from E flat round to A, seven keys, Step back stopping at E flat and Step round at A', () => {
    // Act
    initFreePlay()

    // Assert: WEB-SPEC, Toys 3
    expect(
      Array.from(
        document.querySelectorAll('#freePlay [data-circle-beads] button'),
        (b) => b.getAttribute('aria-label'),
      ),
    ).toEqual([
      'E flat major, three flats',
      'B flat major, two flats',
      'F major, one flat',
      'C major, no sharps or flats',
      'G major, one sharp',
      'D major, two sharps',
      'A major, three sharps',
    ])
  })

  it("plays a move's scale at the circle's pace, a note every 0.3 s, on the learner's staff, and follows a change of voice", () => {
    // Arrange
    const play = initFreePlay()

    // Act: C round to G
    free('[data-circle-step="1"]').click()
    const lower = last().notes.map((n) => n.midi)
    const second = last().notes[1].t
    VoiceChoice.set('higher')

    // Assert: G2 up to G3 on the bass staff, then the treble
    expect(lower).toEqual([43, 45, 47, 48, 50, 52, 54, 55])
    expect(second).toBeCloseTo(0.3, 6)
    expect(play.staff.clef).toBe('treble')
  })

  it("is the page's one sound: a newer sound stops its move", () => {
    // Arrange
    initFreePlay()
    free('[data-circle-step="-1"]').click()

    // Act
    NowPlaying.claim(() => undefined)

    // Assert
    expect(runs[0].stopped).toBe(true)
  })
})

describe('the tease still', () => {
  it('sits in the next-lesson card, hidden from a screen reader: the band and a line waving past both its edges, no centre line, no button', () => {
    // Arrange
    const tease = el('[data-next-card] .l21-tease')

    // Act
    initWrap()

    // Assert: WEB-SPEC, Toys 9
    expect(tease.getAttribute('aria-hidden')).toBe('true')
    expect(tease.querySelectorAll('button, a')).toHaveLength(0)
    const band = tease.querySelector('.l21-tease-band')
    const line = tease.querySelector('.l21-tease-line')
    expect(band).not.toBeNull()
    expect(line).not.toBeNull()
    expect(tease.querySelectorAll('line, .l21-tease-centre')).toHaveLength(0)
    // the line's crests reach past the band's top and bottom edges
    const top = Number(band?.getAttribute('y'))
    const bottom = top + Number(band?.getAttribute('height'))
    const ys = Array.from(
      (line?.getAttribute('d') ?? '').matchAll(/[MQT][\d.]+ ([\d.]+)/g),
      (m) => Number(m[1]),
    )
    const peak = (ys[0] + Math.min(...ys)) / 2
    const trough = 2 * ys[0] - peak
    expect(peak).toBeLessThan(top)
    expect(trough).toBeGreaterThan(bottom)
  })
})
