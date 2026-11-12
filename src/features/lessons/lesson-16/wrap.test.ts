// ============================================================
// Lesson 16 wrap tests — the rest line, free play and the tease still
// ============================================================
//
// On the page's own markup, with the kit's runs a recorder: the practice
// card's rest line follows the visit's ending; free play is the steps'
// staff toy in the learner's clef, following Sing it's voice choice, its
// plays the steps' own; and the tease still draws Lesson 17's stage before
// its first play, four pads numbered 1 to 4 and nothing written (WEB-SPEC,
// Toys 2 and 7; FACTS 5, 52).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import { VisitEnding } from '@/features/lessons/kit/comfort'
import type * as RunModule from '@/features/lessons/kit/run'
import { resetRuns, runs, } from '@/features/lessons/kit/run-recorder.test-fixtures'
import { VoiceChoice } from '@/features/lessons/kit/voice-choice'
import { el, loadPage, soundOn, words } from './page-dom.test-fixtures'
import { drawTease } from './tease'
import { initFreePlay, initWrap } from './wrap'

vi.mock('@/features/lessons/kit/run', async (actual) => ({
  ...(await actual<typeof RunModule>()),
  ...(await import('@/features/lessons/kit/run-recorder.test-fixtures'))
    .recordedRuns,
}))

beforeEach(() => {
  loadPage()
  resetRuns()
  soundOn()
})

afterEach(() => {
  vi.restoreAllMocks()
  VisitEnding.set('practise')
  document.body.textContent = ''
})

describe('the practice card', () => {
  it('shows the rest line only once the visit ends in rest', () => {
    // Arrange
    initWrap()
    const before = el('#practiseCard [data-ending="rest"]').hidden

    // Act
    VisitEnding.set('rest')

    // Assert: FACTS 52
    expect(before).toBe(true)
    expect(el('#practiseCard [data-ending="rest"]').hidden).toBe(false)
  })
})

describe('free play', () => {
  it('plays the steps’ do on the learner’s staff, and follows a voice chosen in Sing it', () => {
    // Arrange
    VoiceChoice.set('lower')
    const toy = initFreePlay()

    // Act
    el<HTMLButtonElement>('#freePlay [data-staff-play="do"]').click()
    VoiceChoice.set('higher')
    el<HTMLButtonElement>('#freePlay [data-staff-play="do"]').click()

    // Assert: WEB-SPEC, Toys 2
    expect(runs.map((r) => r.notes.map((n) => n.midi))).toEqual([[55], [67]])
    expect(toy.clef).toBe('treble')
  })
})

describe('the tease still', () => {
  it('draws four pads numbered 1 to 4 and writes nothing', () => {
    // Arrange
    const svg = el<SVGSVGElement>('.l16-tease svg[data-tease-pads]')

    // Act
    drawTease(svg)

    // Assert: FACTS 5
    expect(
      Array.from(svg.querySelectorAll('.rb-pad-n'), (t) => words(t)),
    ).toEqual(['1', '2', '3', '4'])
    expect(svg.querySelectorAll('.rb-sym:not(.is-hidden)')).toHaveLength(0)
    expect(svg.closest('[aria-hidden="true"]')).not.toBeNull()
  })
})
