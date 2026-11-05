// ============================================================
// Lesson 15 recall and quick check tests — on the page's markup and the kit's quiz
// ============================================================
//
// The recall asks Lesson 2's two questions and sends a wrong answer to
// Lesson 2's own step; its question 2 plays Lesson 2's pair, which is the
// page's one sound (WEB-SPEC, Tests 6 and 15). The quick check asks four,
// and its question 2 plays E4, F4 and G4 on its own small staff, lit as
// each sounds (FACTS 65).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import type * as RunModule from '@/features/lessons/kit/run'
import { resetRuns, runs, } from '@/features/lessons/kit/run-recorder.test-fixtures'
import { Sound } from '@/features/lessons/kit/sound'
import { el, mountSteps, settle, soundOn, words, } from './page-dom.test-fixtures'
import { initQuizzes } from './recall'

vi.mock('@/features/lessons/kit/run', async (actual) => ({
  ...(await actual<typeof RunModule>()),
  ...(await import('@/features/lessons/kit/run-recorder.test-fixtures'))
    .recordedRuns,
}))

beforeEach(() => {
  localStorage.clear()
  resetRuns()
  soundOn()
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  document.body.textContent = ''
})

/** The option of question `q` whose words are `text`, in quiz `prefix`'s list. */
function option(prefix: string, q: number, text: string): HTMLButtonElement {
  const box = el(`#${prefix}q${q}`).closest('.q')
  const found = Array.from(
    box?.querySelectorAll<HTMLButtonElement>('button.opt') ?? [],
  ).find((b) => words(b.querySelector('.opt-t')) === text)
  if (found === undefined) throw new Error(`no "${text}" in ${prefix}q${q}`)
  return found
}

describe('the recall', () => {
  it("asks Lesson 2's two questions and sends a wrong answer to Lesson 2's own step, in a new tab", () => {
    // Arrange
    initQuizzes(mountSteps())

    // Act
    option('recall-', 0, 'The first').click()

    // Assert: WEB-SPEC, Tests 6
    expect(document.querySelectorAll('#recall-qs .q')).toHaveLength(2)
    const link = el('#recall-qs').querySelector<HTMLAnchorElement>('.fb a')
    expect(link?.getAttribute('href')).toBe('/learn/02#step-3')
    expect(link?.getAttribute('target')).toBe('_blank')
    expect(words(link)).toBe('Try Lesson 2, Step 3 again')
  })

  it("plays Lesson 2's pair as the page's one sound: a newer sound stops it, its chips put out", async () => {
    // Arrange
    vi.useFakeTimers()
    const voice = {
      alive: true,
      setFreq: vi.fn(),
      setGain: vi.fn(),
      stop: vi.fn(),
    }
    vi.spyOn(Sound, 'voice').mockReturnValue(voice)
    initQuizzes(mountSteps())
    const play = el<HTMLButtonElement>('#recall-qs [data-quiz-pair]')
    play.click()
    vi.advanceTimersByTime(50)
    const lit = el('#recall-qs [data-pair-chip="1"]').classList.contains('on')

    // Act: another sound on the page
    NowPlaying.claim(() => undefined)
    vi.advanceTimersByTime(4000)
    await settle()

    // Assert: FACTS 61; WEB-SPEC, Tests 15
    expect(lit).toBe(true)
    expect(voice.stop).toHaveBeenCalled()
    // the pair's later notes never sounded: A4 alone, of four
    expect(vi.mocked(Sound.voice)).toHaveBeenCalledTimes(1)
    expect(el('#recall-qs [data-pair-chip="1"]').classList.contains('on')).toBe(
      false,
    )
    expect(play.classList.contains('is-on')).toBe(false)
  })

  it('frees a cut pair at once: a press plays it again, and the cut play ending leaves the new one sounding', async () => {
    // Arrange: the pair sounding, then cut by another sound on the page
    vi.useFakeTimers()
    const voice = {
      alive: true,
      setFreq: vi.fn(),
      setGain: vi.fn(),
      stop: vi.fn(),
    }
    vi.spyOn(Sound, 'voice').mockReturnValue(voice)
    initQuizzes(mountSteps())
    const play = el<HTMLButtonElement>('#recall-qs [data-quiz-pair]')
    play.click()
    vi.advanceTimersByTime(50)
    NowPlaying.claim(() => undefined)

    // Act: a press straight after the cut, then on to just past the end the
    // cut play had, 3.25 s after it began
    play.click()
    vi.advanceTimersByTime(50)
    const notes = vi.mocked(Sound.voice).mock.calls.length
    vi.advanceTimersByTime(3160)
    await settle()
    const onAfterCutEnd = play.classList.contains('is-on')
    vi.advanceTimersByTime(100)
    await settle()

    // Assert: A4 twice, once a play; the new play holds its button to its own end
    expect(notes).toBe(2)
    expect(onAfterCutEnd).toBe(true)
    expect(play.classList.contains('is-on')).toBe(false)
  })

  it('stops a play the page started before it', () => {
    // Arrange
    const deck = mountSteps()
    initQuizzes(deck)
    deck.staff.tapPlace(2)

    // Act
    el<HTMLButtonElement>('#recall-qs [data-quiz-pair]').click()

    // Assert
    expect(runs[0].stopped).toBe(true)
  })
})

describe('the quick check', () => {
  it('asks its four questions under their own ids and marks nothing done until each has an answer', () => {
    // Act
    initQuizzes(mountSteps())

    // Assert
    expect(document.querySelectorAll('#qs .q')).toHaveLength(4)
    expect(words(el('#q0'))).toBe(
      'In the treble clef, which line does the clef curl round?',
    )
  })

  it("plays question 2's three notes, lighting each on the question's small staff as it sounds", async () => {
    // Arrange
    initQuizzes(mountSteps())
    const play = el<HTMLButtonElement>('#qs [data-quiz-three]')
    const staff = el('#qs [data-quiz-staff]')
    const before = staff.querySelectorAll('.st-head').length

    // Act
    play.click()
    runs[0].note(0)
    runs[0].note(1)
    const two = staff.querySelectorAll('.st-head.is-lit').length
    const lit = play.classList.contains('is-on')
    runs[0].note(2)
    runs[0].end(true)
    await settle()

    // Assert: FACTS 65
    expect(runs[0].notes.map((n) => n.midi)).toEqual([64, 65, 67])
    expect(before).toBe(0)
    expect(staff.querySelectorAll('.st-line')).toHaveLength(5)
    expect(staff.querySelectorAll('.st-lane')).toHaveLength(0)
    expect([two, lit]).toEqual([2, true])
    // the three stay at rest once heard
    expect(staff.querySelectorAll('.st-head')).toHaveLength(3)
    expect(staff.querySelectorAll('.st-head.is-lit')).toHaveLength(0)
    expect(play.classList.contains('is-on')).toBe(false)
  })

  it('keeps its small staff and play across answers, and a newer sound stops the play', () => {
    // Arrange
    initQuizzes(mountSteps())
    el<HTMLButtonElement>('#qs [data-quiz-three]').click()

    // Act
    option('', 1, 'It depends on the clef').click()
    NowPlaying.claim(() => undefined)

    // Assert
    expect(document.querySelectorAll('#qs [data-quiz-three]')).toHaveLength(1)
    expect(runs[0].stopped).toBe(true)
  })
})
