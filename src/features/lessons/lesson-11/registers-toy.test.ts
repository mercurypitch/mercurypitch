// ============================================================
// Lesson 11 registers toy tests — the steps' chart, its plays, its words
// ============================================================
//
// On the page's own markup and deck, its runs recorded (kit/run-recorder.
// test-fixtures.ts): each step's buttons sing their lines in Merc's two
// gears (WEB-SPEC, Toys 1 and Audio), the lower gear in Merc's "ooh" and the
// upper with the soft tone's partials, trimmed, both through the "ng"; a
// gear silent all the way is never built. Each line stays drawn in its
// state, each slot's seam with its slide. Slow doubles every length and
// carries a play on from where it stands; the scrub bar draws the slide to
// a moment in silence and names it in words; one sound plays at a time,
// and leaving a step stops it. The chart follows the stored voice. Most
// tests run under reduced motion, where a line is drawn whole at its first
// sound; one runs without it to check where a stopped line stands.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import type * as MotionModule from '@/features/lessons/kit/motion-switch'
import { hz } from '@/features/lessons/kit/notes'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import type * as RunModule from '@/features/lessons/kit/run'
import type { RecordedRun } from '@/features/lessons/kit/run-recorder.test-fixtures'
import { resetRuns, runs, } from '@/features/lessons/kit/run-recorder.test-fixtures'
import { contourLength } from '@/features/lessons/kit/sound'
import { NG } from '@/features/lessons/kit/timbre'
import { VoiceChoice } from '@/features/lessons/kit/voice-choice'
import { LOWER_GAIN } from './gear-sound'
import { N, UPPER_TRIM } from './lines'
import { el, loadPage, mountSteps, settle, soundOn, stepsToy, } from './page-dom.test-fixtures'
import { mountRegistersToy } from './registers-toy'

const motion = vi.hoisted(() => ({ reduced: true }))

vi.mock('@/features/lessons/kit/run', async (actual) => ({
  ...(await actual<typeof RunModule>()),
  ...(await import('@/features/lessons/kit/run-recorder.test-fixtures'))
    .recordedRuns,
}))

vi.mock('@/features/lessons/kit/motion-switch', async (actual) => ({
  ...(await actual<typeof MotionModule>()),
  reducedMotion: () => motion.reduced,
}))

const btn = (selector: string): HTMLButtonElement =>
  el<HTMLButtonElement>(`#toyRange ${selector}`)
const said = (): string => el('#toyRange [data-range-said]').textContent ?? ''
const scrub = (): HTMLElement => el('#toyRange [data-slide-scrub]')
const key = (k: string): void => {
  scrub().dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }))
}
/** The runs a press started: one a gear, the lower first. */
const gearsOf = (from: number): RecordedRun[] => runs.slice(from)
const isUpper = (r: RecordedRun): boolean => r.o.wave === 'soft'
/** Ends every run still going, heard. */
const hearAll = async (): Promise<void> => {
  for (const r of runs) if (!r.over) r.end(true)
  await settle()
}

beforeEach(() => {
  resetRuns()
  soundOn()
  motion.reduced = true
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] })
})

afterEach(() => {
  NowPlaying.claim(() => undefined)
  VoiceChoice.set('lower')
  vi.useRealTimers()
  vi.restoreAllMocks()
  window.location.hash = ''
  document.body.textContent = ''
})

describe("Lesson 11's chart, its gears", () => {
  it("sings the lower gear in Merc's ooh and the upper with the soft tone's partials, trimmed, both through the ng", () => {
    // Arrange
    mountSteps()

    // Act
    btn('[data-gear-play="lower"]').click()
    btn('[data-gear-play="upper"]').click()

    // Assert: one run a press, since the other gear is silent all the way
    expect(runs).toHaveLength(2)
    expect(runs[0].o).toMatchObject({
      audible: true,
      kind: 'merc',
      gain: LOWER_GAIN,
      timbre: NG,
    })
    expect(runs[0].o.wave).toBeUndefined()
    expect(runs[1].o).toMatchObject({
      kind: 'merc',
      wave: 'soft',
      gain: LOWER_GAIN * UPPER_TRIM,
      timbre: NG,
    })
    for (const r of runs) {
      expect(r.points.every((p) => Math.abs(p.hz - hz(N.Gs3)) < 1e-9)).toBe(
        true,
      )
      expect(contourLength(r.points)).toBeCloseTo(2, 9)
    }
  })

  it('draws the two notes side by side at one height, thick then thin, and keeps both', async () => {
    // Arrange
    mountSteps()

    // Act
    btn('[data-gear-play="lower"]').click()
    await hearAll()
    btn('[data-gear-play="upper"]').click()
    await hearAll()

    // Assert
    const lines = stepsToy().scene.lines
    expect(lines).toHaveLength(2)
    const [lower, upper] = lines.map((l) => l.points)
    expect(lower.every((p) => p.midi === N.Gs3 && p.share === 1)).toBe(true)
    expect(upper.every((p) => p.midi === N.Gs3 && p.share === 0)).toBe(true)
    expect(Math.max(...lower.map((p) => p.t))).toBeLessThan(3)
    expect(Math.min(...upper.map((p) => p.t))).toBeGreaterThan(3)
  })

  it('names each note in its live line, and its button by its note', () => {
    // Arrange
    mountSteps()

    // Act
    btn('[data-gear-play="upper"]').click()

    // Assert
    expect(said()).toBe('Upper gear: G sharp 3, the same height, drawn thin.')
    expect(btn('[data-gear-play="lower"]').getAttribute('aria-label')).toBe(
      'Lower gear, G sharp 3',
    )
  })
})

describe("Lesson 11's chart, Step 2's slide", () => {
  it('takes 8.0 s with Slow pressed at first, its jump 0.08 s, in two gears', () => {
    // Arrange
    const deck = mountSteps()
    deck.show(2)

    // Act
    btn('[data-slide-play]').click()

    // Assert
    expect(btn('[data-slow="slide"]').getAttribute('aria-pressed')).toBe('true')
    expect(runs).toHaveLength(2)
    expect(runs.map(isUpper)).toEqual([false, true])
    for (const r of runs) expect(contourLength(r.points)).toBeCloseTo(8, 6)
    // the lower gear's level, from its last full point to its first silent one
    const lower = runs[0].points
    const leaving = lower.findIndex((p) => (p.level ?? 1) < 1)
    const gone = lower.findIndex((p) => p.level === 0)
    expect(lower[gone].t - lower[leaving - 1].t).toBeCloseTo(0.08, 6)
  })

  it('turns Play to Pause while it sounds, and a press of Pause stops it', async () => {
    // Arrange
    const deck = mountSteps()
    deck.show(2)
    const play = btn('[data-slide-play]')

    // Act
    play.click()
    const playing = play.textContent?.trim()
    play.click()
    await settle()

    // Assert
    expect(playing).toBe('Pause')
    expect(play.textContent?.trim()).toBe('Play')
    expect(runs.every((r) => r.stopped)).toBe(true)
  })

  it('heard to its end, says what the gauge and the line did, and leaves the gauge full', async () => {
    // Arrange
    const deck = mountSteps()
    deck.show(2)

    // Act
    btn('[data-slide-play]').click()
    await hearAll()

    // Assert
    expect(said()).toBe(
      "Merc's slide: the stretch rose evenly the whole way, and the line jumped across the seam between G 3 and A 3.",
    )
    expect(el('#toyRange [data-stretch-fill]').style.width).toBe('100%')
    expect(scrub().getAttribute('aria-valuenow')).toBe('4.0')
  })

  it.each([
    [['Home'], '0.0 seconds of 4: lower gear, near E 3', '10%'],
    [
      Array(9).fill('ArrowRight'),
      '0.9 seconds of 4: lower gear, near F sharp 3',
      '30.3%',
    ],
    [
      Array(17).fill('ArrowRight'),
      '1.7 seconds of 4: the switch, from G 3 to A 3',
      '48.3%',
    ],
    [['End'], '4.0 seconds of 4: upper gear, near C sharp 4', '100%'],
  ])(
    'scrubbed by %j, draws the slide and the gauge to there in silence, and names it',
    (keys, words, width) => {
      // Arrange
      const deck = mountSteps()
      deck.show(2)

      // Act
      for (const k of keys) key(k)

      // Assert
      expect(scrub().getAttribute('aria-valuetext')).toBe(words)
      expect(el('#toyRange [data-stretch-fill]').style.width).toBe(width)
      expect(runs).toHaveLength(0)
    },
  )

  it('draws the slide as far as it stands, and nothing of it at the start', () => {
    // Arrange
    const deck = mountSteps()
    deck.show(2)

    // Act
    for (const k of Array<string>(17).fill('ArrowRight')) key(k)
    const scrubbed = stepsToy().scene.lines.map((l) => l.points)
    key('Home')

    // Assert
    expect(scrubbed).toHaveLength(1)
    expect(scrubbed[0][0]).toMatchObject({ t: 0, midi: N.E3 })
    expect(scrubbed[0][scrubbed[0].length - 1].t).toBeCloseTo(1.7, 6)
    expect(stepsToy().scene.lines).toEqual([])
    expect(stepsToy().scene.seams).toHaveLength(1)
  })

  it('draws the seam across the plot, labelled the switch', () => {
    // Arrange
    const deck = mountSteps()

    // Act
    deck.show(2)

    // Assert
    expect(stepsToy().scene.seams).toEqual([
      { lo: N.G3, hi: N.A3, label: 'the switch' },
    ])
    expect(stepsToy().scene.caption).toBe("Merc's model")
  })
})

describe("Lesson 11's chart, Step 3's three slides", () => {
  it('plays each slide up in 4.0 s, 8.0 s with Slow, and Slide 3 in one gear', () => {
    // Arrange
    const deck = mountSteps()
    deck.show(3)

    // Act
    btn('[data-slide-n="0"]').click()
    btn('[data-slow="three"]').click()
    btn('[data-slide-n="1"]').click()
    btn('[data-slide-n="2"]').click()

    // Assert: Slide 1's two gears restarted at the new speed, then the others
    const lengths = runs.map((r) => Number(contourLength(r.points).toFixed(3)))
    expect(lengths.slice(0, 2)).toEqual([4, 4])
    expect(lengths.slice(-3)).toEqual([8, 8, 8])
    expect(isUpper(runs[runs.length - 1])).toBe(false)
  })

  it('draws each slide in its slot, a seam with Slide 1 and Slide 2 and none with Slide 3', async () => {
    // Arrange
    const deck = mountSteps()
    deck.show(3)

    // Act
    for (const k of [0, 1, 2]) {
      btn(`[data-slide-n="${k}"]`).click()
      await hearAll()
    }

    // Assert
    const s = stepsToy().scene
    expect(s.slots).toBe(3)
    expect(s.lines).toHaveLength(3)
    expect(s.seams).toEqual([
      { lo: N.G3, hi: N.A3, t0: 0, t1: 4 },
      { lo: N.A3, hi: N.B3, t0: 4, t1: 8 },
    ])
    expect(said()).toBe('Slide 3: one gear the whole way, with no seam.')
  })
})

describe("Lesson 11's chart, Step 4's five slides", () => {
  it('plays the five in turn, 21.9 s, 43.8 s with Slow, in two gears', () => {
    // Arrange
    const deck = mountSteps()
    deck.show(4)

    // Act
    btn('[data-five-play]').click()
    const plain = runs.map((r) => contourLength(r.points))
    btn('[data-five-play]').click()
    btn('[data-slow="smoother"]').click()
    btn('[data-five-play]').click()

    // Assert
    expect(plain).toHaveLength(2)
    for (const s of plain) expect(s).toBeCloseTo(21.9, 6)
    for (const r of runs.slice(2))
      expect(contourLength(r.points)).toBeCloseTo(43.8, 6)
  })

  it('draws each slide in its slot with its seam, the fifth a quarter of a semitone', async () => {
    // Arrange
    const deck = mountSteps()
    deck.show(4)

    // Act
    btn('[data-five-play]').click()
    await hearAll()

    // Assert
    const s = stepsToy().scene
    expect(s.slots).toBe(5)
    expect(s.lines).toHaveLength(5)
    expect(s.seams.map((x) => x.hi - x.lo)).toEqual([2, 1.5, 1, 0.5, 0.25])
    expect(s.seams.map((x) => (x.lo + x.hi) / 2)).toEqual(Array(5).fill(N.Gs3))
  })

  it('draws the five whole at the press under reduced motion, and afresh at each run', () => {
    // Arrange
    const deck = mountSteps()
    deck.show(4)
    btn('[data-one="0"]').click()

    // Act
    btn('[data-five-play]').click()

    // Assert
    expect(stepsToy().scene.lines).toHaveLength(5)
    expect(stepsToy().scene.seams).toHaveLength(5)
  })

  it('draws each slot afresh as a new run of the five reaches it', () => {
    // Arrange
    motion.reduced = false
    const deck = mountSteps()
    deck.show(4)
    btn('[data-one="1"]').click()
    vi.advanceTimersByTime(4000)
    btn('[data-one="1"]').click()

    // Act
    btn('[data-five-play]').click()

    // Assert
    expect(stepsToy().scene.lines).toHaveLength(0)
  })

  it('names each slide as it sounds, in time', () => {
    // Arrange
    const deck = mountSteps()
    deck.show(4)

    // Act
    btn('[data-five-play]').click()
    vi.advanceTimersByTime(18_001)

    // Assert
    expect(said()).toBe(
      '5 of 5: a jump of a quarter of a semitone; the seam is a hairline',
    )
  })

  it('names each slide at its slowed time with Slow', () => {
    // Arrange
    const deck = mountSteps()
    deck.show(4)
    btn('[data-slow="smoother"]').click()

    // Act
    btn('[data-five-play]').click()
    vi.advanceTimersByTime(18_001)
    const halfway = said()
    vi.advanceTimersByTime(18_000)

    // Assert
    expect(halfway).toBe('3 of 5: a jump of 1 semitone')
    expect(said()).toBe(
      '5 of 5: a jump of a quarter of a semitone; the seam is a hairline',
    )
  })

  it('plays one slide alone from the picker, 3.9 s, drawn in its slot', async () => {
    // Arrange
    const deck = mountSteps()
    deck.show(4)

    // Act
    btn('[data-one="1"]').click()
    const length = contourLength(runs[0].points)
    await hearAll()

    // Assert
    expect(length).toBeCloseTo(3.9, 6)
    expect(said()).toBe('2 of 5: a jump of 1.5 semitones')
    expect(stepsToy().scene.seams).toEqual([
      { lo: N.Gs3 - 0.75, hi: N.Gs3 + 0.75, t0: 4.5, t1: 9 },
    ])
  })
})

describe("Lesson 11's chart, Step 5's figure", () => {
  it('flips on purpose in two gears and hides the switch at half and half', () => {
    // Arrange
    const deck = mountSteps()
    deck.show(5)

    // Act
    btn('[data-style="flip"]').click()
    const flipped = gearsOf(0)
    btn('[data-style="hide"]').click()
    const hidden = gearsOf(2)

    // Assert
    expect(flipped).toHaveLength(2)
    for (const r of flipped) expect(contourLength(r.points)).toBeCloseTo(3.6, 6)
    expect(hidden).toHaveLength(2)
    for (const r of hidden)
      expect(r.points.every((p) => p.level === 0.5)).toBe(true)
    expect(said()).toBe('Hide the switch: the same notes in one even sound.')
  })

  it('draws nothing of the figure until it sounds, with motion on', () => {
    // Arrange
    motion.reduced = false
    const deck = mountSteps()
    deck.show(5)

    // Act
    btn('[data-style="flip"]').click()

    // Assert
    expect(btn('[data-style="flip"]').classList.contains('is-on')).toBe(true)
    expect(stepsToy().scene.lines).toEqual([])
  })

  it('draws the figure as seven short lines, thick below the seam and thin above it', async () => {
    // Arrange
    const deck = mountSteps()
    deck.show(5)

    // Act
    btn('[data-style="flip"]').click()
    await hearAll()

    // Assert
    const points = stepsToy().scene.lines[0].points
    const notes = points.filter((p) => p.midi !== null)
    expect(notes).toHaveLength(14)
    expect(
      notes.filter((p) => p.midi === N.C4).every((p) => p.share === 0),
    ).toBe(true)
    expect(
      notes.filter((p) => p.midi === N.E3).every((p) => p.share === 1),
    ).toBe(true)
    expect(said()).toBe(
      'Flip on purpose: G 3, C 4, B 3, G 3, E 3, G 3, C 4. Each leap across the seam changes gear.',
    )
  })
})

describe("Lesson 11's chart, one sound at a time", () => {
  it('stops the last sound at a new press, and a sound at its own press', async () => {
    // Arrange
    mountSteps()

    // Act
    btn('[data-gear-play="lower"]').click()
    btn('[data-gear-play="upper"]').click()
    btn('[data-gear-play="upper"]').click()
    await settle()

    // Assert
    expect(runs.map((r) => r.stopped)).toEqual([true, true])
  })

  it('stops what sounds when the step is left, and a layout swap stops nothing', async () => {
    // Arrange
    const deck = mountSteps()
    deck.show(2)
    btn('[data-slide-play]').click()

    // Act
    deck.show(2)
    const kept = runs.every((r) => !r.stopped)
    deck.show(3)
    await settle()

    // Assert
    expect(kept).toBe(true)
    expect(runs.every((r) => r.stopped)).toBe(true)
  })

  it('keeps a line drawn whole under reduced motion when a new press stops it', () => {
    // Arrange
    mountSteps()
    btn('[data-gear-play="lower"]').click()

    // Act
    btn('[data-gear-play="upper"]').click()

    // Assert
    const lower = stepsToy().scene.lines[0].points
    expect(lower[lower.length - 1].t).toBeCloseTo(2.5, 9)
  })

  it('carries a play on from where it stands when Slow changes, and stops a line where it stands', () => {
    // Arrange
    motion.reduced = false
    const deck = mountSteps()
    deck.show(2)
    btn('[data-slide-play]').click()
    vi.advanceTimersByTime(2000)

    // Act: a second at half speed is half a second of the slide
    btn('[data-slow="slide"]').click()
    const rest = contourLength(runs[runs.length - 1].points)
    vi.advanceTimersByTime(1000)
    btn('[data-slide-play]').click()

    // Assert
    expect(runs.slice(0, 2).every((r) => r.stopped)).toBe(true)
    expect(rest).toBeCloseTo(3, 6)
    expect(scrub().getAttribute('aria-valuenow')).toBe('2.0')
  })
})

describe("Lesson 11's chart, the scrub bar's words", () => {
  it('names the switch for a slide stopped within a twentieth of a second of its jump', () => {
    // Arrange: Slow, so 3.32 s of playing is 1.66 s of the slide
    motion.reduced = false
    const deck = mountSteps()
    deck.show(2)
    btn('[data-slide-play]').click()
    vi.advanceTimersByTime(3320)

    // Act
    btn('[data-slide-play]').click()

    // Assert
    expect(scrub().getAttribute('aria-valuetext')).toBe(
      '1.7 seconds of 4: the switch, from G 3 to A 3',
    )
  })
})

describe("Lesson 11's chart, its voice", () => {
  it('follows a voice chosen in Sing it: the higher voice sings Tavi’s notes', () => {
    // Arrange
    mountSteps()

    // Act
    VoiceChoice.set('higher')
    btn('[data-gear-play="lower"]').click()

    // Assert
    expect(btn('[data-gear-play="lower"]').getAttribute('aria-label')).toBe(
      'Lower gear, F sharp 4',
    )
    expect(runs[0].points[0].hz).toBeCloseTo(hz(N.Fs4), 9)
  })
})

describe("Lesson 11's free play", () => {
  const free = (selector: string): HTMLButtonElement =>
    el<HTMLButtonElement>(`#freePlay ${selector}`)

  it('shows one state at a time under its switch, Gears first, each keeping what it drew', async () => {
    // Arrange
    loadPage()
    const toy = mountRegistersToy(el('#freePlay'))

    // Act
    free('[data-free-state="three"]').click()
    free('[data-slide-n="0"]').click()
    await hearAll()
    free('[data-free-state="styles"]').click()
    const styles = toy.scene.seams.length
    free('[data-free-state="three"]').click()

    // Assert
    expect(toy.state).toBe('three')
    expect(free('[data-free-state="three"]').getAttribute('aria-pressed')).toBe(
      'true',
    )
    expect(free('[data-free-state="gears"]').getAttribute('aria-pressed')).toBe(
      'false',
    )
    expect(free('[data-slide-n="0"]').hidden).toBe(false)
    expect(
      free('[data-gear-play="lower"]')
        .closest('[data-part]')
        ?.hasAttribute('hidden'),
    ).toBe(true)
    expect(styles).toBe(1)
    expect(toy.scene.lines).toHaveLength(1)
  })

  it('changes the chart voice for the visit and stores nothing', () => {
    // Arrange
    loadPage()
    const toy = mountRegistersToy(el('#freePlay'))
    const set = vi.spyOn(VoiceChoice, 'set')

    // Act
    free('[data-chart-voice="higher"]').click()
    free('[data-gear-play="upper"]').click()

    // Assert
    expect(toy.voice).toBe('higher')
    expect(set).not.toHaveBeenCalled()
    expect(
      free('[data-chart-voice="higher"]').getAttribute('aria-pressed'),
    ).toBe('true')
    expect(runs[0].points[0].hz).toBeCloseTo(hz(N.Fs4), 9)
  })
})
