// ============================================================
// Lesson 10 Steps 3 and 4 tests — the slide, the root's ends, and the pattern
// ============================================================
//
// On the page's own markup and deck, its runs recorded (kit/run-recorder.
// test-fixtures.ts) on fake timers: in Step 3, Major · Minor moves the
// middle bead, and Root lower and Root higher move the whole chord,
// silently, to the next white-key root from C4 to B4, every chord spelled
// one letter per tone, so a minor third reads E♭, never D♯ (FACTS 19); at
// each end the root button is `aria-disabled`, keeps the focus, and a
// press moves nothing and stops nothing (WEB-SPEC, Edge cases). In Step 4,
// Play the pattern plays one quaver at a time, each bead lit as it sounds;
// Major · Minor and Slow · Fast act from the next quaver while it plays on,
// and the readout says what is set; another sound, or leaving the step,
// stops it with no quaver after (WEB-SPEC, Toys 1). The pattern's lengths
// are pattern.test.ts's.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import type * as RunModule from '@/features/lessons/kit/run'
import type { RecordedRun } from '@/features/lessons/kit/run-recorder.test-fixtures'
import { resetRuns, runs, } from '@/features/lessons/kit/run-recorder.test-fixtures'
import type { BeadsScene } from './chord-beads-draw'
import { el, mountSteps, settle, soundOn } from './page-dom.test-fixtures'

vi.mock('@/features/lessons/kit/run', async (actual) => ({
  ...(await actual<typeof RunModule>()),
  ...(await import('@/features/lessons/kit/run-recorder.test-fixtures'))
    .recordedRuns,
}))

type Deck = ReturnType<typeof mountSteps>

/** The stage's deck on step `n`, its figure a phone's 356 x 340 (FACTS 82). */
function openStep(n: number): Deck {
  const deck = mountSteps()
  vi.spyOn(
    el<HTMLCanvasElement>('#toyChord [data-chord-viz] canvas'),
    'getBoundingClientRect',
  ).mockReturnValue(new DOMRect(0, 0, 356, 340))
  deck.show(n)
  return deck
}

const stage = (selector: string): HTMLButtonElement =>
  el<HTMLButtonElement>(`#toyChord ${selector}`)
const quality = (qy: 'major' | 'minor'): HTMLButtonElement =>
  stage(`[data-chord-quality] [data-quality="${qy}"]`)
const tempo = (t: 'slow' | 'fast'): HTMLButtonElement =>
  stage(`[data-chord-tempo] [data-tempo="${t}"]`)
const lower = (): HTMLButtonElement => stage('[data-chord-root="-1"]')
const higher = (): HTMLButtonElement => stage('[data-chord-root="1"]')
const ends = (): (string | null)[] =>
  [lower(), higher()].map((b) => b.getAttribute('aria-disabled'))
const last = (): RecordedRun => {
  const r = runs.at(-1)
  if (r === undefined) throw new Error('nothing played')
  return r
}
const sceneOf = (deck: Deck): BeadsScene => {
  const s = deck.beads.scene()
  if (s === null) throw new Error('no scene')
  return s
}
const names = (deck: Deck): string[] => sceneOf(deck).beads.map((b) => b.name)
const lit = (deck: Deck): number[] => sceneOf(deck).beads.map((b) => b.lit)

/** The clock on by `seconds`; a quaver's timer fires on the whole millisecond after its time. */
const later = (seconds: number): void => {
  vi.advanceTimersByTime(seconds * 1000)
}

const SLOW_Q = 30 / 70
const FAST_Q = 30 / 160

beforeEach(() => {
  resetRuns()
  soundOn()
  vi.useFakeTimers({
    toFake: ['setTimeout', 'clearTimeout', 'performance'],
    now: 0,
  })
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  window.location.hash = ''
  document.body.textContent = ''
})

describe("Lesson 10's Step 3, the third moved and the root slid", () => {
  it('moves the middle bead with Major · Minor, to E♭4, the root and fifth where they were', () => {
    // Arrange
    const deck = openStep(3)

    // Act
    quality('minor').click()

    // Assert
    expect(names(deck)).toEqual(['C4', 'E♭4', 'G4'])
    expect(sceneOf(deck).beads.map((b) => b.gold)).toEqual([false, true, false])
    expect(
      [quality('major'), quality('minor')].map((b) =>
        b.getAttribute('aria-pressed'),
      ),
    ).toEqual(['false', 'true'])
  })

  it.each<['major' | 'minor', string[][]]>([
    [
      'major',
      [
        ['C4', 'E4', 'G4'],
        ['D4', 'F♯4', 'A4'],
        ['E4', 'G♯4', 'B4'],
        ['F4', 'A4', 'C5'],
        ['G4', 'B4', 'D5'],
        ['A4', 'C♯5', 'E5'],
        ['B4', 'D♯5', 'F♯5'],
      ],
    ],
    [
      'minor',
      [
        ['C4', 'E♭4', 'G4'],
        ['D4', 'F4', 'A4'],
        ['E4', 'G4', 'B4'],
        ['F4', 'A♭4', 'C5'],
        ['G4', 'B♭4', 'D5'],
        ['A4', 'C5', 'E5'],
        ['B4', 'D5', 'F♯5'],
      ],
    ],
  ])(
    'slides the %s chord up every white-key root from C4 to B4, each spelled one letter per tone (FACTS 19)',
    (qy, want) => {
      // Arrange
      const deck = openStep(3)
      quality(qy).click()

      // Act
      const met = want.map(() => {
        const at = names(deck)
        higher().click()
        return at
      })

      // Assert
      expect(met).toEqual(want)
    },
  )

  it('slides silently: it stops the chord sounding, plays nothing, and says the chord it lands on', () => {
    // Arrange
    const deck = openStep(3)
    stage('[data-chord-play="triad"]').click()
    const triad = last()

    // Act
    higher().click()

    // Assert
    expect(triad.stopped).toBe(true)
    expect(runs).toHaveLength(1)
    expect(deck.beads.settings.root).toBe(62)
    expect(el('#toyChord [data-chord-said]').textContent).toBe(
      'Root higher: D, F sharp, A. D major.',
    )
  })

  it('plays the triad where the chord now stands', () => {
    // Arrange
    openStep(3)
    higher().click()
    quality('minor').click()

    // Act
    stage('[data-chord-play="triad"]').click()

    // Assert: D4, F4 and A4, in turn and together
    expect(last().notes.map((n) => n.midi)).toEqual([62, 65, 69, 62, 65, 69])
  })

  it('opens Root lower aria-disabled at C4; a press there keeps the focus, moves nothing and stops nothing', () => {
    // Arrange
    const deck = openStep(3)
    const atC4 = ends()
    stage('[data-chord-play="triad"]').click()
    lower().focus()

    // Act
    lower().click()

    // Assert
    expect(atC4).toEqual(['true', 'false'])
    expect(deck.beads.settings.root).toBe(60)
    expect(last().stopped).toBe(false)
    expect(runs).toHaveLength(1)
    expect(document.activeElement).toBe(lower())
  })

  it('marks Root higher aria-disabled at B4, never past it; a press there keeps the focus, moves nothing and stops nothing', () => {
    // Arrange: six white keys up, to B4, and the triad sounding there
    const deck = openStep(3)
    for (let i = 0; i < 6; i++) higher().click()
    const atB4 = ends()
    stage('[data-chord-play="triad"]').click()
    higher().focus()

    // Act
    higher().click()

    // Assert
    expect(atB4).toEqual(['false', 'true'])
    expect(deck.beads.settings.root).toBe(71)
    expect(names(deck)).toEqual(['B4', 'D♯5', 'F♯5'])
    expect(last().stopped).toBe(false)
    expect(document.activeElement).toBe(higher())
  })

  it('opens on C4 again, Root lower at its end, once the viewer leaves and comes back', () => {
    // Arrange
    const deck = openStep(3)
    higher().click()

    // Act
    deck.show(2)
    deck.show(3)

    // Assert
    expect(deck.beads.settings.root).toBe(60)
    expect(ends()).toEqual(['true', 'false'])
  })
})

describe("Lesson 10's Step 4, the chord's pattern", () => {
  it('plays the pattern a quaver at a time, root, fifth, third, fifth, each bead lit as it sounds', () => {
    // Arrange
    const deck = openStep(4)

    // Act
    stage('[data-chord-play="pattern"]').click()
    const first = runs.map((r) => r.notes)
    runs[0].note(0)
    const litRoot = lit(deck)
    later(SLOW_Q + 0.005)
    last().note(0)
    const litFifth = lit(deck)
    later(SLOW_Q)

    // Assert
    expect(first).toEqual([[{ t: 0, midi: 60, dur: 0.9 * SLOW_Q }]])
    expect(runs.map((r) => r.notes[0].midi)).toEqual([60, 67, 64])
    expect(runs.map((r) => r.o.kind)).toEqual(['soft', 'soft', 'soft'])
    expect(litRoot).toEqual([1, 0, 0])
    expect(litFifth[2]).toBe(1)
    expect(
      stage('[data-chord-play="pattern"]').classList.contains('is-on'),
    ).toBe(true)
  })

  it('takes Major · Minor and Slow · Fast from the next quaver, playing on through both', () => {
    // Arrange: the first quaver, the root, sounding
    openStep(4)
    stage('[data-chord-play="pattern"]').click()
    later(0.1)

    // Act
    quality('minor').click()
    tempo('fast').click()
    later(SLOW_Q - 0.1 + 0.005)
    const fifth = last().notes
    later(FAST_Q)

    // Assert: the root as it was, then the fifth fast, then the minor third
    expect(runs[0].stopped).toBe(false)
    expect(fifth).toEqual([{ t: 0, midi: 67, dur: 0.9 * FAST_Q }])
    expect(last().notes).toEqual([{ t: 0, midi: 63, dur: 0.9 * FAST_Q }])
  })

  it('shows Slow · Fast pressed, from Slow, and the readout says what is set', () => {
    // Arrange
    const deck = openStep(4)
    const before = [tempo('slow'), tempo('fast')].map((b) =>
      b.getAttribute('aria-pressed'),
    )
    const slowMajor = sceneOf(deck).strip?.readout

    // Act
    quality('minor').click()
    tempo('fast').click()

    // Assert
    expect(before).toEqual(['true', 'false'])
    expect(slowMajor).toBe('C major · slow')
    expect(
      [tempo('slow'), tempo('fast')].map((b) => b.getAttribute('aria-pressed')),
    ).toEqual(['false', 'true'])
    expect(sceneOf(deck).strip?.readout).toBe('C minor · fast')
  })

  it('ends with the chord together for 1.0 s, at a chord voice’s level, and puts its button out once it has sounded', async () => {
    // Arrange
    openStep(4)
    const play = stage('[data-chord-play="pattern"]')
    play.click()
    later(10)

    // Act
    last().end(true)
    await settle()

    // Assert
    expect(runs).toHaveLength(17)
    expect(last().notes).toEqual([
      { t: 0, midi: 60, dur: 1, gain: 0.075 },
      { t: 0, midi: 64, dur: 1, gain: 0.075 },
      { t: 0, midi: 67, dur: 1, gain: 0.075 },
    ])
    expect(play.classList.contains('is-on')).toBe(false)
  })

  it('stops for another sound on the page, with no quaver after, and its lights out', async () => {
    // Arrange
    const deck = openStep(4)
    stage('[data-chord-play="pattern"]').click()
    runs[0].note(0)

    // Act
    NowPlaying.claim(() => undefined)
    later(10)
    await settle()

    // Assert
    expect(runs).toHaveLength(1)
    expect(runs[0].stopped).toBe(true)
    expect(lit(deck)).toEqual([0, 0, 0])
    expect(
      stage('[data-chord-play="pattern"]').classList.contains('is-on'),
    ).toBe(false)
  })

  it('starts again from its first quaver when pressed again', () => {
    // Arrange: the third quaver sounding
    openStep(4)
    const play = stage('[data-chord-play="pattern"]')
    play.click()
    later(2.5 * SLOW_Q)

    // Act
    play.click()

    // Assert
    expect(runs.map((r) => [r.notes[0].midi, r.stopped])).toEqual([
      [60, false],
      [67, false],
      [64, true],
      [60, false],
    ])
  })

  it('stops when the viewer leaves Step 4, with no quaver after', () => {
    // Arrange
    const deck = openStep(4)
    stage('[data-chord-play="pattern"]').click()

    // Act
    deck.show(5)
    later(10)

    // Assert
    expect(runs).toHaveLength(1)
    expect(runs[0].stopped).toBe(true)
  })
})
