// ============================================================
// Lesson 9 four words tests — what each plays, and the zone plays nothing
// ============================================================
//
// On the page's own markup, its runs recorded (kit/run-recorder.test-
// fixtures.ts): Leap, Third and Arpeggio each play their notes (FACTS 91)
// for the stored voice, each the page's one sound, so a word stops the
// sound before it and a newer sound stops the word (WEB-SPEC, Tests 14:
// here over the cold open's path; over Step 3's climb, with the kit's own
// runs on fake timers, in steps-leaps.test.ts); Leap's arc waits for so
// and draws as it starts; Landing zone lights so's band for a second,
// plays nothing and stops nothing, and a second press waits for the
// first. Each button's name says what it does.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import type * as MercDuo from '@/features/lessons/kit/merc-duo'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import type * as RunModule from '@/features/lessons/kit/run'
import { live, resetRuns, runs, } from '@/features/lessons/kit/run-recorder.test-fixtures'
import { VoiceChoice } from '@/features/lessons/kit/voice-choice'
import { initColdOpen } from './cold-open'
import { el, loadPage, settle, soundOn } from './page-dom.test-fixtures'
import { wordNotes } from './sounds'
import { initWords } from './words'

const duo = vi.hoisted(() => ({ sing: vi.fn() }))

vi.mock('@/features/lessons/kit/run', async (actual) => ({
  ...(await actual<typeof RunModule>()),
  ...(await import('@/features/lessons/kit/run-recorder.test-fixtures'))
    .recordedRuns,
}))

vi.mock('@/features/lessons/kit/merc-duo', async (actual) => ({
  ...(await actual<typeof MercDuo>()),
  mercsReady: Promise.resolve(),
  mercSing: duo.sing,
}))

const button = (word: string): HTMLButtonElement =>
  el<HTMLButtonElement>(`[data-word-play="${word}"]`)
const zoneBand = (): Element | null =>
  document.querySelector('[data-word="zone"] .stub rect')
const leapArc = (): Element | null =>
  document.querySelector('[data-word="leap"] .stub path[fill="none"]')

beforeEach(() => {
  localStorage.clear()
  VoiceChoice.set('lower')
  resetRuns()
  soundOn()
  loadPage()
  initWords()
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  duo.sing.mockReset()
  document.body.textContent = ''
})

describe("Lesson 9's four words", () => {
  it('names each button for what it does', () => {
    // Act
    const names = ['leap', 'third', 'arpeggio', 'zone'].map((w) =>
      (button(w).textContent ?? '').replace(/\s+/g, ' ').trim(),
    )

    // Assert
    expect(names).toEqual([
      'Play: do up to so',
      'Play: do up to mi, then mi up to so',
      'Play: do-mi-so-do',
      "Show: so's band lights",
    ])
  })

  it.each(['leap', 'third', 'arpeggio'] as const)(
    'plays %s as its notes, for the stored voice',
    async (word) => {
      // Arrange
      VoiceChoice.set('higher')

      // Act
      button(word).click()
      await settle()

      // Assert
      expect(runs.map((r) => r.notes)).toEqual([wordNotes(62)[word]])
    },
  )

  it("draws Leap's arc as so starts, and leaves it whole once heard", async () => {
    // Arrange
    button('leap').click()
    const waiting = leapArc()?.getAttribute('opacity')

    // Act
    runs[0].note(0)
    const onDo = leapArc()?.getAttribute('opacity')
    runs[0].note(1)
    const onSo = leapArc()?.getAttribute('opacity')
    runs[0].end(true)
    await settle()

    // Assert
    expect([waiting, onDo, onSo]).toEqual(['0', '0', '1'])
    expect(leapArc()?.getAttribute('opacity')).toBe('1')
    expect(duo.sing.mock.calls.map((c) => c.slice(0, 2))).toEqual([
      ['blue', 50],
      ['blue', 57],
      ['blue', 57],
    ])
  })

  it('rests its figure and quiets Merc when its run ends unheard, as the Sound switch ends it', async () => {
    // Arrange
    button('arpeggio').click()
    runs[0].note(0)
    runs[0].note(1)

    // Act
    runs[0].end(false)
    await settle()

    // Assert
    const bands = Array.from(
      document.querySelectorAll('[data-word="arpeggio"] .stub rect'),
    ).map((r) => r.getAttribute('fill-opacity'))
    expect(bands).toEqual(['.14', '.14', '.14', '.14'])
    expect(duo.sing.mock.calls.at(-1)).toEqual(['blue', 54, false])
    expect(button('arpeggio').classList.contains('is-on')).toBe(false)
  })

  it('stops the sound before it, and a newer sound stops it', async () => {
    // Arrange: the cold open's path sounding
    initColdOpen()
    el('#predict [data-choice="mi"]').click()
    el('#predict [data-play="mi"]').click()

    // Act
    button('arpeggio').click()
    await settle()
    const afterWord = live().map((r) => r.notes)
    button('third').click()
    await settle()

    // Assert
    expect(runs[0].stopped).toBe(true)
    expect(afterWord).toEqual([wordNotes(50).arpeggio])
    expect(runs[1].stopped).toBe(true)
    expect(live().map((r) => r.notes)).toEqual([wordNotes(50).third])
  })

  it("lights so's band for a second with the landing zone, plays nothing, stops nothing, and lets a second press wait", async () => {
    // Arrange
    vi.useFakeTimers()
    button('leap').click()
    const claim = vi.spyOn(NowPlaying, 'claim')

    // Act: a press, another while it shows, then one after it ends
    button('zone').click()
    const lit = zoneBand()?.getAttribute('fill-opacity')
    vi.advanceTimersByTime(500)
    button('zone').click()
    vi.advanceTimersByTime(500)
    const after = zoneBand()?.getAttribute('fill-opacity')
    vi.advanceTimersByTime(200)
    button('zone').click()
    vi.advanceTimersByTime(600)
    const again = zoneBand()?.getAttribute('fill-opacity')

    // Assert: the press while it showed left nothing behind to cut the next short
    expect(runs).toHaveLength(1)
    expect(runs[0].stopped).toBe(false)
    expect(claim).not.toHaveBeenCalled()
    expect([lit, after, again]).toEqual(['.5', '.16', '.5'])
  })
})
