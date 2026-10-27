// ============================================================
// Lesson 10 Sing it leaving tests — cut short, left, and nothing kept
// ============================================================
//
// WEB-SPEC, Toys 6, Edge cases and Tests 8's storage clause, on the page's
// own markup, each visit loaded afresh and its runs the kit's recorder
// (sing.test-fixtures.ts), on fake timers: a sweep cut short, by a press of
// any of Sing it's controls, another sound on the page, the section off
// screen for 600 ms, a hidden tab or the page going, asks nothing, its
// count-in's note stopped, and the card goes back to what it showed before
// it ran; a moment away under 600 ms stops nothing; whatever plays stops
// when the viewer leaves, the guide and the ring with it; and a whole
// visit stores nothing but the voice and never asks for the microphone.

import { afterEach, describe, expect, it, vi } from 'vitest'
import { scrollIntoViewAgain, scrollOutOfView, } from '@/features/lessons/kit/browser-doubles.test-fixtures'
import { COUNT_IN_SEC } from '@/features/lessons/kit/move-do'
import type * as RunModule from '@/features/lessons/kit/run'
import type * as GuideModule from '@/features/lessons/kit/slide-guide'
import type { Guide } from '@/features/lessons/kit/slide-guide'
import type { Visit } from './sing.test-fixtures'
import { choose, closeSing, hearMerc, hideTab, lastRun, loadSing, onCard, status, } from './sing.test-fixtures'
import { AFTER, STATUS } from './sing-flow'
import { SING_SEC } from './sing-guide'

vi.mock('@/features/lessons/kit/run', async (actual) => {
  const recorder =
    await import('@/features/lessons/kit/run-recorder.test-fixtures')
  return {
    ...(await actual<typeof RunModule>()),
    ...recorder.recordedRuns,
    recorder,
  }
})

// the kit's guide as it is, the one the visit mounted kept for its state
vi.mock('@/features/lessons/kit/slide-guide', async (actual) => {
  const real = await actual<typeof GuideModule>()
  return { ...real, mountGuide: vi.fn(real.mountGuide) }
})

/** The guide this visit mounted. */
async function guideOf(): Promise<Guide> {
  const { mountGuide } = await import('@/features/lessons/kit/slide-guide')
  const guide = vi.mocked(mountGuide).mock.results.at(-1)?.value
  if (guide === undefined) throw new Error('no guide mounted')
  return guide
}

/** The count-in and the sweep, ms. */
const TURN_MS = (COUNT_IN_SEC + SING_SEC) * 1000

/** Sing it ready on fake timers: "I'm comfortable", the lower voice, and Merc's notes heard. */
async function ready(): Promise<Visit> {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  const p = await loadSing()
  choose(p, 'sing', 'lower')
  await hearMerc(p)
  return p
}

/** The count-in's note, which a test can see stopped. */
function countInNote(p: Visit) {
  const stop = vi.fn()
  vi.spyOn(p.Sound, 'voice').mockReturnValue({
    alive: true,
    setFreq: () => undefined,
    setGain: () => undefined,
    stop,
  })
  return stop
}

const lit = (p: Visit, selector: string): boolean =>
  p.el(selector).classList.contains('is-on')

/** Every way a sweep or Merc's notes can be cut short, as the viewer does it. */
const CUTS = [
  ["Play Merc's notes", (p: Visit) => p.el('[data-notes-play]').click()],
  ['Move do', (p: Visit) => p.el('[data-move-do="-1"]').click()],
  ['a change of voice', (p: Visit) => p.el('[data-voice="higher"]').click()],
  [
    'another sound on the page',
    (p: Visit) => p.NowPlaying.claim(() => undefined),
  ],
  [
    'the section off screen for 600 ms',
    (p: Visit) => {
      scrollOutOfView(p.el('#sing'))
      vi.advanceTimersByTime(600)
    },
  ],
  ['a hidden tab', () => hideTab()],
  ['the page going', () => window.dispatchEvent(new Event('pagehide'))],
] as const

/** The leaving routes alone: the viewer gone, not pressing anything. */
const LEAVES = CUTS.slice(4)

afterEach(closeSing)

describe("Lesson 10's Sing it: a sweep cut short", () => {
  it.each(CUTS)(
    'asks nothing when %s cuts the first sweep short, and the card goes back to Ready',
    async (_, cut) => {
      // Arrange: the sweep 3 s in
      const p = await ready()
      const guide = await guideOf()
      p.el('[data-guide-start]').click()
      await vi.advanceTimersByTimeAsync(3000)
      const swept = guide.busy

      // Act: cut short, then the clock past where the sweep would have ended
      cut(p)
      // the guide runs again only for Merc's notes, when a press of theirs cut it
      const guideAfter = [guide.busy, lit(p, '[data-notes-play]')]
      await vi.advanceTimersByTimeAsync(TURN_MS)

      // Assert
      expect(swept).toBe(true)
      expect(guideAfter[0]).toBe(guideAfter[1])
      expect(onCard(p, '[data-panel="feel"]')).toBe(false)
      expect(lit(p, '[data-guide-start]')).toBe(false)
      expect(p.el('[data-guide-start]').getAttribute('aria-disabled')).toBe(
        'false',
      )
      expect(status(p)).toBe(STATUS.ready)
    },
  )

  it('keeps the answer and its line on the card when a later sweep is cut short', async () => {
    // Arrange: a sweep answered "Workable", then a second sweep 3 s in
    const p = await ready()
    p.el('[data-guide-start]').click()
    await vi.advanceTimersByTimeAsync(TURN_MS + 1)
    p.el('[data-feel="workable"]').click()
    p.el('[data-guide-start]').click()
    await vi.advanceTimersByTimeAsync(3000)
    const hidden = onCard(p, '[data-panel="feel"]')

    // Act
    hideTab()
    await vi.advanceTimersByTimeAsync(TURN_MS)

    // Assert
    expect(hidden).toBe(false)
    expect(onCard(p, '[data-panel="feel"]')).toBe(true)
    expect(p.el('[data-feel="workable"]').getAttribute('aria-pressed')).toBe(
      'true',
    )
    expect(onCard(p, '[data-after="moved"]')).toBe(true)
    expect(status(p)).toBe(AFTER.moved)
  })

  it("stops the count-in's note when the sweep is cut short in it", async () => {
    // Arrange: the count-in sounding
    const p = await ready()
    const stop = countInNote(p)
    p.el('[data-guide-start]').click()
    await vi.advanceTimersByTimeAsync(400)

    // Act
    window.dispatchEvent(new Event('pagehide'))

    // Assert
    expect(stop).toHaveBeenCalledTimes(1)
    expect(p.el('.ring-state').textContent).toBe('Rest')
  })

  it('keeps the sweep when the section is back on screen within 600 ms, as a panel that grows can take it away for a moment', async () => {
    // Arrange: the sweep 3 s in
    const p = await ready()
    p.el('[data-guide-start]').click()
    await vi.advanceTimersByTimeAsync(3000)

    // Act
    scrollOutOfView(p.el('#sing'))
    await vi.advanceTimersByTimeAsync(599)
    scrollIntoViewAgain(p.el('#sing'))
    await vi.advanceTimersByTimeAsync(TURN_MS)

    // Assert
    expect(onCard(p, '[data-panel="feel"]')).toBe(true)
    expect(status(p)).toBe(STATUS.feel)
  })
})

describe("Lesson 10's Sing it: leaving", () => {
  it.each(LEAVES)(
    "stops Merc's notes when %s, the guide and the ring resting with them, and they have not been heard",
    async (_, leave) => {
      // Arrange: Merc's notes playing
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
      const p = await loadSing()
      choose(p, 'sing', 'lower')
      const guide = await guideOf()
      p.el('[data-notes-play]').click()
      const run = lastRun(p)
      const singing = [p.el('.ring-state').textContent, guide.busy]

      // Act
      leave(p)
      const resting = !guide.busy
      await vi.advanceTimersByTimeAsync(0)

      // Assert
      expect(singing).toEqual(['Listen', true])
      expect(resting).toBe(true)
      expect(run.stopped).toBe(true)
      expect(lit(p, '[data-notes-play]')).toBe(false)
      expect(p.el('.ring-state').textContent).toBe('Rest')
      expect(p.el('[data-guide-start]').getAttribute('aria-disabled')).toBe(
        'true',
      )
    },
  )

  it("keeps Merc's notes playing for a moment off screen under 600 ms", async () => {
    // Arrange
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const p = await loadSing()
    choose(p, 'sing', 'lower')
    p.el('[data-notes-play]').click()
    const run = lastRun(p)

    // Act
    scrollOutOfView(p.el('#sing'))
    await vi.advanceTimersByTimeAsync(599)
    scrollIntoViewAgain(p.el('#sing'))
    await vi.advanceTimersByTimeAsync(5000)

    // Assert
    expect(run.stopped).toBe(false)
    expect(lit(p, '[data-notes-play]')).toBe(true)
  })
})

describe("Lesson 10's Sing it: nothing listens, nothing is kept", () => {
  /** A whole visit: both chords heard, do moved, two sweeps, and each kind of answer. */
  async function wholeVisit(): Promise<Visit> {
    const p = await ready()
    p.el('[data-move-do="1"]').click()
    p.el('[data-guide-start]').click()
    await vi.advanceTimersByTimeAsync(TURN_MS + 1)
    p.el('[data-feel="easy"]').click()
    p.el('[data-guide-start]').click()
    await vi.advanceTimersByTimeAsync(TURN_MS + 1)
    p.el('[data-feel="uncomfortable"]').click()
    await hearMerc(p)
    return p
  }

  it('stores nothing but the voice through a whole visit', async () => {
    // Arrange, Act
    await wholeVisit()

    // Assert
    expect(
      Array.from({ length: localStorage.length }, (_, i) =>
        localStorage.key(i),
      ),
    ).toEqual(['fyp-voice'])
  })

  it('never asks for the microphone, singing or just listening', async () => {
    // Arrange
    const ask = vi.spyOn(navigator.mediaDevices, 'getUserMedia')

    // Act: a whole visit singing, then a visit just listening
    await wholeVisit()
    const p = await loadSing({ again: true })
    choose(p, 'listen')
    await hearMerc(p)

    // Assert
    expect(ask).not.toHaveBeenCalled()
  })
})
