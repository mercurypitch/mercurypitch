// ============================================================
// Lesson 13 wrap tests — free play's controls, and the practise card's two versions
// ============================================================
//
// On the page's own markup, its runs recorded: free play's vowel buttons
// play their vowel in the chosen voice on its A, 2.0 s; All harmonics plays
// the source alone, all of the note's harmonics; the voice switch moves the
// figure to the other voice for the visit and stores nothing; each play is
// the page's one sound, so a step's play stops it; and the practise card
// links Voice Mirror with `?lesson=13`, turning to the rest card, with no
// link, once the visit's ending says rest (WEB-SPEC, Toys 7, Practice
// links).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import { VisitEnding } from '@/features/lessons/kit/comfort'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import type * as RunModule from '@/features/lessons/kit/run'
import { resetRuns, runs, } from '@/features/lessons/kit/run-recorder.test-fixtures'
import { el, loadPage, settle, soundOn } from './page-dom.test-fixtures'
import { initWrap } from './wrap'

vi.mock('@/features/lessons/kit/run', async (actual) => ({
  ...(await actual<typeof RunModule>()),
  ...(await import('@/features/lessons/kit/run-recorder.test-fixtures'))
    .recordedRuns,
}))

const free = (selector: string): HTMLButtonElement =>
  el<HTMLButtonElement>(`#freePlay ${selector}`)
/** The first resonance a recorded line's first point carries: which vowel it sings. */
const firstHz = (i: number): number | undefined =>
  (runs[i]?.points[0] as { res?: { hz: number }[] } | undefined)?.res?.[0]?.hz

beforeEach(() => {
  localStorage.clear()
  VisitEnding.set('practise')
  resetRuns()
  soundOn()
  loadPage()
})

afterEach(async () => {
  NowPlaying.claim(() => undefined)
  await settle()
  vi.restoreAllMocks()
  document.body.textContent = ''
})

describe('free play (WEB-SPEC, Toys 7)', () => {
  it("plays a vowel button's vowel on the voice's A for 2.0 s, and All harmonics the source alone", () => {
    // Arrange
    initWrap()

    // Act
    free('[data-vowel="oo"]').click()
    free('[data-act="all"]').click()

    // Assert
    expect(runs[0].points[0]?.hz).toBe(220)
    expect(runs[0].points.at(-1)?.t).toBe(2)
    expect(firstHz(0)).toBe(315.9)
    expect(runs[0].stopped).toBe(true)
    expect(firstHz(1)).toBeUndefined()
    expect(runs[1].points.at(-1)?.t).toBe(2)
  })

  it('moves the figure to the higher voice with the switch, for the visit, storing nothing', async () => {
    // Arrange
    const { controls } = initWrap()

    // Act
    free('[data-voice-pick="higher"]').click()
    runs[0].end(true)
    await settle()
    free('[data-vowel="ah"]').click()

    // Assert
    expect(controls.state.voice).toBe('higher')
    expect(runs[1].points[0]?.hz).toBe(440)
    expect(localStorage.length).toBe(0)
    expect(el('#freePlay [data-said]').textContent).toBe(
      'Higher voice, ‘ah’ on A 4: 9 bars, 440 hertz apart. The tallest is the 2nd.',
    )
  })

  it("is the page's one sound: another sound stops its play", () => {
    // Arrange
    initWrap()
    free('[data-act="five"]').click()

    // Act
    NowPlaying.claim(() => undefined)

    // Assert
    expect(runs[0].stopped).toBe(true)
  })
})

describe('the practise card', () => {
  it('links Voice Mirror for this lesson, and turns to the rest card, with no link, once the ending says rest', () => {
    // Arrange
    initWrap()
    const card = el<HTMLAnchorElement>('#practiseCard')
    const before = card.getAttribute('href')

    // Act
    VisitEnding.set('rest')

    // Assert
    expect(before).toBe('/mirror?lesson=13')
    expect(card.hasAttribute('href')).toBe(false)
    expect(el('[data-ending="rest"]').hidden).toBe(false)
    expect(el('[data-ending="practise"]').hidden).toBe(true)
    expect(el('#practiseCard .eyebrow').textContent).toBe('Rest today')
  })
})
