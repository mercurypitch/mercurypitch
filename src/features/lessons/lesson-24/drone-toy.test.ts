// ============================================================
// Lesson 24 drone toy tests — its locks, its plays, its drags and its states
// ============================================================
//
// WEB-SPEC, Toys 2 and Audio, and FACTS 40, 44, 46 and 69: every control
// waits for the choices that would answer, under the figure's lock lines;
// a play sets its notes against the drone from one start, Step 1's presets
// moving its slider; opening another state stops what plays and says when
// the colours change; Octave moves the window and the slider up an octave;
// a drag starts the drone and the note in one task and follows the slider,
// snaps to the drone restarted on the drone's next whole period, follows
// at most 6 s from its grab and rings on 4 s after its release; the keys
// move it 0.5 Hz and 2 Hz; Piano · Pure moves the beads; and Step 3's mi
// drags between the band's edges with the ticks named.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as MotionModule from '@/features/lessons/kit/motion-switch'
import { reducedMotion } from '@/features/lessons/kit/motion-switch'
import type * as RunModule from '@/features/lessons/kit/run'
import { resetRuns, runs, } from '@/features/lessons/kit/run-recorder.test-fixtures'
import type { Voice, VoiceOptions } from '@/features/lessons/kit/sound'
import { Sound } from '@/features/lessons/kit/sound'
import { miHz } from './drone-picture'
import { FOLLOW_SEC, RING_SEC } from './drone-toy'
import { el, mountSteps, soundOn, words } from './page-dom.test-fixtures'
import { NOTE_GAIN } from './sounds'

vi.mock('@/features/lessons/kit/run', async (actual) => ({
  ...(await actual<typeof RunModule>()),
  ...(await import('@/features/lessons/kit/run-recorder.test-fixtures'))
    .recordedRuns,
}))

// reduced motion, as the doubles set it; the doubles go in first, since the
// switch reads the setting as it loads
vi.mock('@/features/lessons/kit/motion-switch', async (actual) => {
  await import('@/features/lessons/kit/browser-doubles.test-fixtures')
  return {
    ...(await actual<typeof MotionModule>()),
    reducedMotion: vi.fn(() => true),
  }
})

beforeEach(() => {
  resetRuns()
  soundOn()
  vi.mocked(reducedMotion).mockReturnValue(true)
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  window.location.hash = ''
  document.body.textContent = ''
})

/** The steps, opened by the cold open's choice and Step 2's if asked, on step `n`. */
function opened(n: number, step2 = false) {
  const deck = mountSteps()
  deck.steps.unlock()
  if (step2) deck.steps.toy.unlockStep2()
  deck.show(n)
  return deck
}

const toyEl = <T extends Element = HTMLElement>(sel: string): T =>
  el<T>(`#toyChart ${sel}`)

const click = (sel: string): void => {
  toyEl<HTMLButtonElement>(sel).click()
}

/** Moves a slider, as a pointer does. */
function slide(sel: string, value: number): void {
  const input = toyEl<HTMLInputElement>(sel)
  input.value = String(value)
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

/** The voices the toy makes for a drag, each a double that keeps what it was told. */
function voices(): {
  made: { f: number; o: VoiceOptions; voice: Voice }[]
  ctx: { currentTime: number }
} {
  const made: { f: number; o: VoiceOptions; voice: Voice }[] = []
  vi.spyOn(Sound, 'voice').mockImplementation((f, o = {}) => {
    const voice: Voice = {
      alive: true,
      setFreq: vi.fn(),
      setGain: vi.fn(),
      stop: vi.fn(),
    }
    made.push({ f, o, voice })
    return voice
  })
  const ctx = { currentTime: 5 }
  vi.spyOn(Sound, 'context').mockReturnValue(ctx as unknown as AudioContext)
  return { made, ctx }
}

/** How many times each voice was stopped. */
const stops = (made: readonly { voice: Voice }[]): number[] =>
  made.map((m) => vi.mocked(m.voice.stop).mock.calls.length)

describe('the locks', () => {
  it("holds every control until the cold open's choice, under its lock line, and draws the drone's band alone", () => {
    // Arrange
    const deck = mountSteps()

    // Assert
    const controls = [
      '[data-drone-top]',
      '[data-drone-play="221"]',
      '[data-drone-octave]',
      '[data-drone-bead="mi"]',
      '[data-drone-tuning="pure"]',
      '[data-drone-play="chord"]',
      '[data-drone-mi]',
    ]
    for (const sel of controls)
      expect(toyEl<HTMLButtonElement>(sel).disabled, sel).toBe(true)
    expect(toyEl('[data-drone-lock]').hidden).toBe(false)
    expect(toyEl('[data-drone-lock2]').hidden).toBe(true)
    expect(toyEl('[data-drone-readout]').hidden).toBe(true)
    const scene = deck.steps.toy.chart.scene.drone
    expect(scene?.drone.as).toBe('band')
    expect(scene?.tops).toEqual([])
  })

  it("opens Step 1 on the cold open's choice, Step 2's controls still held for its own", () => {
    // Act
    opened(1)

    // Assert
    for (const sel of [
      '[data-drone-top]',
      '[data-drone-play="220.5"]',
      '[data-drone-octave]',
    ])
      expect(toyEl<HTMLButtonElement>(sel).disabled, sel).toBe(false)
    for (const sel of [
      '[data-drone-bead="so"]',
      '[data-drone-tuning="piano"]',
      '[data-drone-play="chord"]',
      '[data-drone-mi]',
    ])
      expect(toyEl<HTMLButtonElement>(sel).disabled, sel).toBe(true)
    expect(toyEl('[data-drone-lock]').hidden).toBe(true)
    expect(words(toyEl('[data-drone-readout]'))).toBe('4 beats a second')
  })

  it("shows the figure's own line in Steps 3 and 4 until Step 2's choice, and not in Step 2, where its predict sits beside", () => {
    // Arrange
    const deck = opened(2)
    const lock2 = toyEl('[data-drone-lock2]')
    const seen = [lock2.hidden]

    // Act
    deck.show(3)
    seen.push(lock2.hidden)
    deck.show(4)
    seen.push(lock2.hidden)
    deck.steps.toy.unlockStep2()
    seen.push(lock2.hidden)

    // Assert
    expect(seen).toEqual([true, false, false, true])
  })
})

describe('a play', () => {
  it("sets its note against the drone from one start, moves Step 1's slider, and says what it plays and how it beats", () => {
    // Arrange
    opened(1)

    // Act
    click('[data-drone-play="221"]')

    // Assert
    const [run] = runs
    expect(run.kind).toBe('lines')
    expect(run.lines.map((l) => [l.t, l.points[0].hz])).toEqual([
      [0, 220],
      [0, 221],
    ])
    expect(run.o).toMatchObject({ gain: NOTE_GAIN, vibrato: null })
    expect(toyEl<HTMLInputElement>('[data-drone-top]').value).toBe('221')
    expect(words(toyEl('[data-drone-top-out]'))).toBe('221 Hz')
    expect(words(toyEl('[data-drone-readout]'))).toBe('1 beat a second')
    expect(words(toyEl('[data-drone-said]'))).toBe(
      'The drone with the top note at 221 Hz: 1 beat a second.',
    )
  })

  it('stops what plays when another state opens, and says each change of colours', () => {
    // Arrange
    const deck = opened(2, true)
    click('[data-drone-play="chord"]')
    const said = (): string => words(toyEl('[data-drone-said]'))

    // Act and Assert
    deck.show(3)
    expect(runs[0].stopped).toBe(true)
    expect(said()).toBe(
      "The amber band is now mi's; the drone is the chrome line below.",
    )
    deck.show(4)
    expect(said()).toBe(
      'No band now: the top note is the chrome line, the drone pinned below.',
    )
    deck.show(1)
    expect(said()).toBe('The amber band is the drone again.')
  })

  it("moves the window and the slider up an octave with Octave, the band named for the drone's second harmonic", () => {
    // Arrange
    const deck = opened(1)

    // Act
    click('[data-drone-octave]')

    // Assert
    const top = toyEl<HTMLInputElement>('[data-drone-top]')
    expect(toyEl('[data-drone-octave]').getAttribute('aria-pressed')).toBe(
      'true',
    )
    expect([top.min, top.max, top.value]).toEqual(['432', '448', '448'])
    expect(deck.steps.toy.chart.target).toBe(69)
    expect(deck.steps.toy.chart.scene.drone?.drone.label).toBe(
      'drone × 2 · 440 Hz',
    )
  })

  it("moves Step 2's beads with Piano · Pure, and stops a play", () => {
    // Arrange
    const deck = opened(2, true)
    click('[data-drone-bead="mi"]')

    // Act
    click('[data-drone-tuning="pure"]')

    // Assert
    expect(runs[0].stopped).toBe(true)
    expect(
      toyEl('[data-drone-tuning="pure"]').getAttribute('aria-pressed'),
    ).toBe('true')
    const mi = deck.steps.toy.chart.scene.drone?.beads.find(
      (b) => b.name === 'mi',
    )
    expect(mi?.c).toBeCloseTo(386.31, 2)
  })
})

describe('a drag', () => {
  it('starts the drone and the note together in one task, then follows the slider', () => {
    // Arrange
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const { made } = voices()
    opened(1)

    // Act
    slide('[data-drone-top]', 222)
    slide('[data-drone-top]', 221.5)

    // Assert: the drone first, both straight at the note level
    expect(made.map((m) => m.f)).toEqual([220, 222])
    for (const m of made)
      expect(m.o).toMatchObject({
        kind: 'merc',
        vibrato: null,
        gain: NOTE_GAIN,
      })
    expect(made[1].voice.setFreq).toHaveBeenLastCalledWith(221.5)
    expect(words(toyEl('[data-drone-readout]'))).toBe('1.5 beats a second')
  })

  it("snaps within 0.1 Hz of the drone, the note restarted on the drone's next whole period", () => {
    // Arrange: the drone started at 5 s on the audio clock
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const { made, ctx } = voices()
    opened(1)
    slide('[data-drone-top]', 221)

    // Act
    ctx.currentTime = 5.3337
    slide('[data-drone-top]', 220.1)

    // Assert: the dragged voice released over 0.05 s, a new one at 220 Hz
    // starting a whole number of the drone's periods from its start
    expect(toyEl<HTMLInputElement>('[data-drone-top]').value).toBe('220')
    expect(made[1].voice.stop).toHaveBeenCalledWith(0.05)
    const fresh = made[2]
    expect(fresh.f).toBe(220)
    const at = fresh.o.at ?? NaN
    expect(at).toBeGreaterThanOrEqual(0.02)
    const periods = (ctx.currentTime + at - 5) * 220
    expect(periods).toBeCloseTo(Math.round(periods), 6)
    expect(words(toyEl('[data-drone-readout]'))).toBe('still')
  })

  it('follows at most 6 s from its grab, then rings on for 4 s and stops', async () => {
    // Arrange: grabbed and held, never released
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const { made } = voices()
    opened(1)
    slide('[data-drone-top]', 222)

    // Act
    await vi.advanceTimersByTimeAsync((FOLLOW_SEC + RING_SEC) * 1000 - 10)
    const before = stops(made)
    await vi.advanceTimersByTimeAsync(20)

    // Assert
    expect(before).toEqual([0, 0])
    for (const m of made) expect(m.voice.stop).toHaveBeenCalled()
  })

  it('takes the drag on when the slider moves again while it rings', async () => {
    // Arrange: released, ringing
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const { made } = voices()
    opened(1)
    slide('[data-drone-top]', 222)
    toyEl('[data-drone-top]').dispatchEvent(
      new Event('change', { bubbles: true }),
    )
    await vi.advanceTimersByTimeAsync(2000)

    // Act
    slide('[data-drone-top]', 223)
    await vi.advanceTimersByTimeAsync(RING_SEC * 1000)

    // Assert: the same two voices, following, and still sounding
    expect(made).toHaveLength(2)
    expect(made[1].voice.setFreq).toHaveBeenLastCalledWith(223)
    expect(stops(made)).toEqual([0, 0])
  })

  it('rings on 4 s after its release, then stops both voices', async () => {
    // Arrange
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const { made } = voices()
    opened(1)
    slide('[data-drone-top]', 222)

    // Act
    toyEl('[data-drone-top]').dispatchEvent(
      new Event('change', { bubbles: true }),
    )
    await vi.advanceTimersByTimeAsync(RING_SEC * 1000 - 10)
    const before = stops(made)
    await vi.advanceTimersByTimeAsync(20)

    // Assert
    expect(before).toEqual([0, 0])
    for (const m of made) expect(m.voice.stop).toHaveBeenCalled()
    expect(words(toyEl('[data-drone-said]'))).toBe(
      'The top note at 222 Hz with the drone: 2 beats a second.',
    )
  })

  it('moves 0.5 Hz on an arrow key and 2 Hz on Page Up and Page Down', () => {
    // Arrange
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    voices()
    opened(1)
    const top = toyEl<HTMLInputElement>('[data-drone-top]')
    const key = (k: string): void => {
      top.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }))
    }

    // Act and Assert
    key('ArrowDown')
    expect(top.value).toBe('223.5')
    key('PageDown')
    expect(top.value).toBe('221.5')
    key('ArrowUp')
    expect(top.value).toBe('222')
  })

  it("drags Step 3's mi between the band's edges, saying where it sits against the ticks", () => {
    // Arrange
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const { made } = voices()
    opened(3, true)

    // Act
    slide('[data-drone-mi]', -13.5)

    // Assert
    expect(made.map((m) => m.f)).toEqual([220, miHz(-13.5)])
    expect(words(toyEl('[data-drone-mi-out]'))).toBe('at the pure tick')
    expect(toyEl('[data-drone-mi]').getAttribute('aria-valuetext')).toBe(
      'at the pure mi',
    )
  })
})
