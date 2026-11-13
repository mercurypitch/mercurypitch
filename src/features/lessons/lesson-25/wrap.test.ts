// ============================================================
// Lesson 25 wrap tests — the rest line, free play and the tease still
// ============================================================
//
// WEB-SPEC, Toys 1 (Free play), Toys 5 and Toys 8: the practice card keeps
// Gravity in every version and shows Lesson 12's rest line in the second
// drill's place after the rest ending; free play is the steps' toy in its
// free state, holding Raise te, Raise le, its chord column and the chord's
// play under the steps' lock line until the cold open's choice, on the
// learner's staff, which follows the voice choice; its plays are the page's
// one sound; and the tease still holds no button and plays nothing.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import { VisitEnding } from '@/features/lessons/kit/comfort'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import type * as RunModule from '@/features/lessons/kit/run'
import { resetRuns, runs, } from '@/features/lessons/kit/run-recorder.test-fixtures'
import { VoiceChoice } from '@/features/lessons/kit/voice-choice'
import { el, loadPage, settle, soundOn, words } from './page-dom.test-fixtures'
import { initFreePlay, initWrap } from './wrap'

vi.mock('@/features/lessons/kit/run', async (actual) => ({
  ...(await actual<typeof RunModule>()),
  ...(await import('@/features/lessons/kit/run-recorder.test-fixtures'))
    .recordedRuns,
}))

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] })
  localStorage.clear()
  loadPage()
  resetRuns()
  soundOn()
  VisitEnding.set('practise')
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
  document.body.textContent = ''
})

const free = (sel: string): HTMLButtonElement =>
  el<HTMLButtonElement>(`#freePlay ${sel}`)
const restLine = (): HTMLElement => el('#practiseCard [data-ending="rest"]')
const secondDrill = (): HTMLElement =>
  el('#practiseCard [data-ending="practise"]')

describe('the practice card', () => {
  it('keeps Gravity in every version and puts Lesson 12’s rest line in the second drill’s place after the rest ending', () => {
    // Arrange
    initWrap()
    const opened = [restLine().hidden, secondDrill().hidden]

    // Act
    VisitEnding.set('rest')
    const rested = [
      restLine().hidden,
      secondDrill().hidden,
      words(el('#practiseCard h3')),
    ]
    VisitEnding.set('practise')

    // Assert: FACTS 47
    expect(opened).toEqual([true, false])
    expect(rested).toEqual([false, true, "Ear Lab's Gravity"])
    expect([restLine().hidden, secondDrill().hidden]).toEqual([true, false])
    expect(words(restLine())).toBe(
      'Rest today. Sight-Singing will be here when your voice feels comfortable: mercurypitch.com/#/singing, set to A and Harmonic Minor.',
    )
  })
})

describe('free play', () => {
  it('holds Raise te, Raise le, its column and the chord’s play under the lock line until the choice, its other plays open', () => {
    // Act
    const toy = initFreePlay()
    const held = [
      free('[data-raise="te"]').disabled,
      free('[data-raise="le"]').disabled,
      free('[data-minor-play="chord-home"]').disabled,
      toy.column.shown,
      el('#freePlay [data-lock-line]').hidden,
    ]
    const open = free('[data-minor-play="so-ti-do"]').disabled
    toy.unlock()

    // Assert: FACTS 36
    expect(held).toEqual([true, true, true, false, false])
    expect(open).toBe(false)
    expect([
      free('[data-raise="te"]').disabled,
      free('[data-raise="le"]').disabled,
      free('[data-minor-play="chord-home"]').disabled,
      toy.column.shown,
      el('#freePlay [data-lock-line]').hidden,
    ]).toEqual([false, false, false, true, true])
  })

  it('follows the voice choice at once, the staircase and the staff an octave up for the higher voice', () => {
    // Arrange
    const toy = initFreePlay()
    const before = [toy.clef, toy.core.tonic]

    // Act
    VoiceChoice.set('higher')

    // Assert
    expect(before).toEqual(['bass', 45])
    expect([toy.clef, toy.core.tonic]).toEqual(['treble', 57])
  })

  it("is the page's one sound: another sound stops its play", async () => {
    // Arrange
    initFreePlay()
    free('[data-minor-play="so-te-do"]').click()
    await settle()

    // Act
    NowPlaying.claim(() => undefined)
    await settle()

    // Assert
    expect(runs.length).toBeGreaterThan(0)
    expect(runs.every((r) => r.over)).toBe(true)
  })
})

describe('the tease still', () => {
  it("draws Lesson 26's opening, hidden from a screen reader, with no button and nothing to play (FACTS 5)", () => {
    // Act
    const still = el('[data-next-card] .l25-tease')

    // Assert: WEB-SPEC, Toys 8
    expect(still.getAttribute('aria-hidden')).toBe('true')
    expect(still.querySelectorAll('button, a, [data-play]')).toHaveLength(0)
    expect(still.querySelectorAll('.l25-tease-bead')).toHaveLength(14)
    expect(words(still)).toContain('Twinkle')
  })
})
