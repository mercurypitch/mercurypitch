// ============================================================
// Lesson 27 wrap tests — the rest line, free play and the tease still
// ============================================================
//
// WEB-SPEC, Toys 1 (Free play), Toys 5 and Toys 8: the practice card keeps
// Stack in every version and shows Lesson 12's rest line in Chord
// Stacker's place after the rest ending; free play is the steps' toy in
// its free state, holding the V chip, V's seventh, the diagonal and V7's
// plays under the steps' lock line until the cold open's choice, and Turn
// over under its own until Step 4's, on the learner's staff, which follows
// the voice choice; its plays are the page's one sound; and the tease
// still holds no button and plays nothing.

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
  // a newer sound stops what the test started, before its timers are real again
  NowPlaying.claim(() => undefined)
  vi.restoreAllMocks()
  vi.useRealTimers()
  document.body.textContent = ''
})

const free = (sel: string): HTMLButtonElement =>
  el<HTMLButtonElement>(`#freePlay ${sel}`)
const restLine = (): HTMLElement => el('#practiseCard [data-ending="rest"]')
const firstDrill = (): HTMLElement =>
  el('#practiseCard [data-ending="practise"]')

describe('the practice card', () => {
  it('keeps Stack in every version and puts Lesson 12’s rest line in Chord Stacker’s place after the rest ending', () => {
    // Arrange
    initWrap()
    const opened = [restLine().hidden, firstDrill().hidden]

    // Act
    VisitEnding.set('rest')
    const rested = [
      restLine().hidden,
      firstDrill().hidden,
      el('#practiseCard .second-drill').hidden,
    ]
    VisitEnding.set('practise')

    // Assert: FACTS 69, 70
    expect(opened).toEqual([true, false])
    expect(rested).toEqual([false, true, false])
    expect([restLine().hidden, firstDrill().hidden]).toEqual([true, false])
    expect(words(restLine())).toBe(
      'Rest today. Chord Stacker will be here when your voice feels comfortable: mercurypitch.com/pitch-training, then tap Chord Stacker.',
    )
    // after a rest answer nothing may send the learner to sing (REQ-GVC-055)
    expect(restLine().querySelector('a')).toBeNull()
  })
})

describe('free play', () => {
  it('holds V, its seventh’s plays and the diagonal under the lock line until the choice, Turn over until Step 4’s', () => {
    // Act
    const toy = initFreePlay()
    const held = [
      free('[data-chip="V"]').disabled,
      free('[data-ring-play="v-seventh"]').disabled,
      free('[data-ring-play="tritone"]').disabled,
      free('[data-turn]').disabled,
      el('#freePlay [data-lock-line]:not([data-lock-line="4"])').hidden,
    ]
    const open = free('[data-ring-play="i-seventh"]').disabled
    toy.unlock()
    const unlocked = [
      free('[data-chip="V"]').disabled,
      free('[data-ring-play="v-seventh"]').disabled,
      free('[data-ring-play="tritone"]').disabled,
      free('[data-turn]').disabled,
      el('#freePlay [data-lock-line]:not([data-lock-line="4"])').hidden,
    ]
    toy.unlock4()

    // Assert: FACTS 1a, 1b, 39
    expect(held).toEqual([true, true, true, true, false])
    expect(open).toBe(false)
    expect(unlocked).toEqual([false, false, false, true, true])
    expect(free('[data-turn]').disabled).toBe(false)
    expect(el('#freePlay [data-lock-line="4"]').hidden).toBe(true)
  })

  it('follows the voice choice at once, the staff an octave up on the treble for the higher voice', () => {
    // Arrange
    const toy = initFreePlay()
    const before = toy.clef

    // Act
    VoiceChoice.set('higher')

    // Assert
    expect(before).toBe('bass')
    expect(toy.clef).toBe('treble')
    expect(el('#freePlay [data-staff-svg]').getAttribute('aria-label')).toMatch(
      /^Treble staff/,
    )
  })

  it("is the page's one sound: another sound stops its play", async () => {
    // Arrange
    initFreePlay()
    free('[data-ring-play="i-seventh"]').click()
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
  it("draws Lesson 28's opening, two rows of ten bars, hidden from a screen reader, with no button and nothing to play (FACTS 5)", () => {
    // Act
    const still = el('[data-next-card] .l27-tease')

    // Assert: WEB-SPEC, Toys 8
    expect(still.getAttribute('aria-hidden')).toBe('true')
    expect(still.querySelectorAll('button, a, [data-play]')).toHaveLength(0)
    expect(still.querySelectorAll('.l27-tease-row')).toHaveLength(2)
    expect(still.querySelectorAll('.l27-tease-row rect')).toHaveLength(20)
    expect(words(still)).toBe("Tavi's part Merc's part")
  })
})
