// ============================================================
// Lesson 9 wrap tests — free play, on the page's markup
// ============================================================
//
// WEB-SPEC, Toys 1's free play and Audio, with the steps, Sing it and the
// recall mounted beside it as main.ts mounts them: a first tap plays its
// rung alone and names it; a tap after another plays the leap between them,
// up or down, in the soft tone, its arc drawn whole as the landing note
// starts under reduced motion, and names it (`freeLine`); Hear it first
// sounds the landing note for 1.0 s and the leap 0.6 s after it, and Slow
// doubles every length and onset, never a pitch; free play opens on the
// steps' voice, and its voice switch moves free play alone, storing nothing
// and leaving the steps' and Sing it's voice; a voice chosen in Sing it
// moves free play, its rungs' names and its switch, and stops a leap on the
// old do; a tap stops the recall's pair, and a newer play stops a leap; and
// at rest, or once a leap has drawn, the page asks the frame loop for
// nothing. The page's modules load afresh for each test over a frame loop
// run by hand (kit/frame-loop.test-fixtures.ts), since the voice choice
// reads storage as it loads; its runs are the kit's recorders, and Merc and
// Tavi's renderer is left out.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import { handLoop } from '@/features/lessons/kit/frame-loop.test-fixtures'
import type * as MercDuo from '@/features/lessons/kit/merc-duo'
import type * as RunModule from '@/features/lessons/kit/run'
import type * as Recorder from '@/features/lessons/kit/run-recorder.test-fixtures'
import type { Voice } from '@/features/lessons/kit/voice-choice'
import type { RungId } from './ladder-data'

const duo = vi.hoisted(() => ({ sing: vi.fn() }))

// the recorder rides on the swapped module, so a test reads the very runs
// the page's modules, loaded afresh, started
vi.mock('@/features/lessons/kit/run', async (actual) => {
  const recorder =
    await import('@/features/lessons/kit/run-recorder.test-fixtures')
  return {
    ...(await actual<typeof RunModule>()),
    ...recorder.recordedRuns,
    recorder,
  }
})

vi.mock('@/features/lessons/kit/merc-duo', async (actual) => ({
  ...(await actual<typeof MercDuo>()),
  mercSing: duo.sing,
}))

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  duo.sing.mockReset()
  document.body.textContent = ''
})

/** The page's modules, loaded afresh over a hand-run frame loop, its body loaded, and the steps, Sing it, the recall and free play mounted. */
async function load(o: { voice?: Voice; reduce?: boolean } = {}) {
  if (o.voice !== undefined)
    localStorage.setItem('fyp-voice', JSON.stringify(o.voice))
  const hand = await handLoop(o.reduce ?? true)
  const dom = await import('./page-dom.test-fixtures')
  const { initSing } = await import('./sing')
  const { initRecall } = await import('./recall')
  const { initWrap } = await import('./wrap')
  const { VoiceChoice } = await import('@/features/lessons/kit/voice-choice')
  const { Sound } = await import('@/features/lessons/kit/sound')
  const { recorder } =
    (await import('@/features/lessons/kit/run')) as unknown as {
      readonly recorder: typeof Recorder
    }
  recorder.resetRuns()
  dom.soundOn()
  const steps = dom.mountSteps()
  const sing = initSing()
  initRecall()
  const wrap = initWrap()
  const canvas = dom.el<HTMLCanvasElement>('#freePlay canvas')
  Object.defineProperties(canvas, {
    clientWidth: { value: 300, configurable: true },
    clientHeight: { value: 190, configurable: true },
  })
  hand.see(canvas)
  hand.settle()
  return {
    ...dom,
    hand,
    steps,
    sing,
    wrap,
    VoiceChoice,
    Sound,
    runs: recorder.runs,
  }
}

type Page = Awaited<ReturnType<typeof load>>

/** Taps free play's rung `id`, and lets the page's promises settle. */
async function tap(p: Page, id: RungId): Promise<Recorder.RecordedRun> {
  p.el(`[data-free-rung="${id}"]`).click()
  await p.settle()
  const run = p.runs[p.runs.length - 1]
  if (run === undefined) throw new Error(`no run for ${id}`)
  return run
}

/** Hears a run to its end, as the kit's timer would end it. */
async function hear(p: Page, run: Recorder.RecordedRun): Promise<void> {
  run.end(true)
  await p.settle()
}

const status = (p: Page): string => p.el('[data-free-status]').textContent ?? ''
const rungNames = (): (string | null)[] =>
  Array.from(document.querySelectorAll('[data-free-rung]'), (b) =>
    b.getAttribute('aria-label'),
  )
const voicePressed = (): string[] =>
  Array.from(
    document.querySelectorAll<HTMLElement>('[data-free-voice]'),
    (b) => `${b.dataset.freeVoice}:${b.getAttribute('aria-pressed')}`,
  )
const arcsDrawn = (p: Page): (number | undefined)[] =>
  (p.wrap.ladder.chart.scene.arcs ?? []).map((a) => a.drawn)

describe("Lesson 9's free play: the rungs and the leaps", () => {
  it('plays a first tap as its rung alone, then each tap after another as the leap between them, up or down, in the soft tone, naming it', async () => {
    // Arrange
    const p = await load()

    // Act
    const first = await tap(p, 'so')
    const alone = status(p)
    await hear(p, first)
    const up = await tap(p, 'top')
    const upSaid = status(p)
    await hear(p, up)
    const down = await tap(p, 'mi')

    // Assert
    expect(first.notes).toEqual([{ t: 0, midi: 57, dur: 1 }])
    expect(alone).toBe('So, A3')
    expect(up.notes).toEqual([
      { t: 0, midi: 57, dur: 1 },
      { t: 1, midi: 62, dur: 1 },
    ])
    expect(upSaid).toBe('So to top do: a perfect fourth, 5 semitones, up')
    expect(down.notes.map((n) => n.midi)).toEqual([62, 54])
    expect(status(p)).toBe('Top do to mi: 8 semitones, down')
    expect([first, up, down].map((r) => [r.o.kind, r.o.audible])).toEqual([
      ['soft', true],
      ['soft', true],
      ['soft', true],
    ])
  })

  it("draws a leap's arc whole as its landing note starts, under reduced motion, and keeps it drawn once heard", async () => {
    // Arrange
    const p = await load()
    await hear(p, await tap(p, 'do'))
    const leap = await tap(p, 'so')

    // Act
    leap.note(0)
    const fromDo = arcsDrawn(p)
    leap.note(1)
    const landed = arcsDrawn(p)
    await hear(p, leap)

    // Assert
    expect(fromDo).toEqual([0])
    expect(landed).toEqual([1])
    expect(p.wrap.ladder.view.leaps).toHaveLength(1)
  })

  it('sounds the landing note 0.6 s before the leap under Hear it first, its arc drawn as the leap lands, and doubles every length and onset under Slow, never a pitch', async () => {
    // Arrange
    const p = await load()
    p.el('[data-free-hear]').click()
    await hear(p, await tap(p, 'do'))

    // Act
    const heard = await tap(p, 'so')
    heard.note(1)
    const asDoSounds = arcsDrawn(p)
    heard.note(2)
    const asSoLands = arcsDrawn(p)
    await hear(p, heard)
    p.el('[data-free-slow]').click()
    const slowed = await tap(p, 'do')

    // Assert
    expect(heard.notes).toEqual([
      { t: 0, midi: 57, dur: 1 },
      { t: 1.6, midi: 50, dur: 1 },
      { t: 2.6, midi: 57, dur: 1 },
    ])
    expect([asDoSounds, asSoLands]).toEqual([[0], [1]])
    expect(slowed.notes).toEqual([
      { t: 0, midi: 50, dur: 2 },
      { t: 3.2, midi: 57, dur: 2 },
      { t: 5.2, midi: 50, dur: 2 },
    ])
    expect(
      ['[data-free-hear]', '[data-free-slow]'].map((s) =>
        p.el(s).getAttribute('aria-pressed'),
      ),
    ).toEqual(['true', 'true'])
  })
})

describe("Lesson 9's free play: its voice", () => {
  it.each([
    [undefined, 'lower', ['do, D3', 'mi, F sharp 3', 'so, A3', 'top do, D4']],
    ['higher', 'higher', ['do, D4', 'mi, F sharp 4', 'so, A4', 'top do, D5']],
  ] as const)(
    "opens on the steps' voice (stored %s), its rungs named with their notes",
    async (stored, voice, names) => {
      // Act
      const p = await load({ voice: stored })

      // Assert
      expect([p.wrap.ladder.voice, p.steps.ladder.voice]).toEqual([
        voice,
        voice,
      ])
      expect(rungNames()).toEqual(names)
      expect(voicePressed()).toEqual([
        `lower:${String(voice === 'lower')}`,
        `higher:${String(voice === 'higher')}`,
      ])
    },
  )

  it("moves free play alone with its voice switch, storing nothing and leaving the steps' and Sing it's voice", async () => {
    // Arrange
    const p = await load({ voice: 'lower' })
    const set = vi.spyOn(p.VoiceChoice, 'set')

    // Act
    p.el('[data-free-voice="higher"]').click()
    const played = await tap(p, 'so')

    // Assert
    expect(set).not.toHaveBeenCalled()
    expect(localStorage.getItem('fyp-voice')).toBe('"lower"')
    expect(p.VoiceChoice.voice).toBe('lower')
    expect([
      p.steps.ladder.voice,
      p.sing.chart.voice,
      p.sing.visit.voice,
    ]).toEqual(['lower', 'lower', 'lower'])
    expect(
      p.el('#singCard [data-voice="lower"]').getAttribute('aria-pressed'),
    ).toBe('true')
    expect(p.wrap.ladder.voice).toBe('higher')
    expect(rungNames()).toEqual([
      'do, D4',
      'mi, F sharp 4',
      'so, A4',
      'top do, D5',
    ])
    expect(voicePressed()).toEqual(['lower:false', 'higher:true'])
    expect(played.notes).toEqual([{ t: 0, midi: 69, dur: 1 }])
    expect(status(p)).toBe('So, A4')
  })

  it('follows a voice chosen in Sing it, its names and its switch, and stops a leap on the old do', async () => {
    // Arrange
    const p = await load({ voice: 'lower' })
    await hear(p, await tap(p, 'so'))
    const leap = await tap(p, 'top')

    // Act
    p.el('#singCard [data-voice="higher"]').click()
    await p.settle()

    // Assert
    expect(leap.stopped).toBe(true)
    expect(p.wrap.ladder.voice).toBe('higher')
    expect(p.wrap.ladder.doMidi).toBe(62)
    expect(rungNames()[0]).toBe('do, D4')
    expect(voicePressed()).toEqual(['lower:false', 'higher:true'])
    expect(status(p)).toBe('')
    expect(p.wrap.ladder.view.leaps).toEqual([])
  })
})

describe("Lesson 9's free play: one sound at a time", () => {
  it("stops the recall's pair when a rung is tapped", async () => {
    // Arrange
    const p = await load()
    const voice = {
      alive: true,
      setFreq: vi.fn(),
      setGain: vi.fn(),
      stop: vi.fn(),
    }
    vi.spyOn(p.Sound, 'voice').mockReturnValue(voice)
    const pair = p.el('#rc-qs [data-quiz-play="fourth"]')
    pair.click()
    vi.advanceTimersByTime(100)
    const playing = pair.classList.contains('is-on')

    // Act
    await tap(p, 'so')

    // Assert
    expect(playing).toBe(true)
    expect(voice.stop).toHaveBeenCalled()
    expect(pair.classList.contains('is-on')).toBe(false)
  })

  it("stops a leap for a newer play, a steps' play or another tap, the chart back at rest", async () => {
    // Arrange
    const p = await load()
    await hear(p, await tap(p, 'do'))
    const leap = await tap(p, 'so')
    leap.note(0)
    leap.note(1)

    // Act
    p.el('[data-ladder-play="step"]').click()
    await p.settle()
    const atRest = p.wrap.ladder.view.leaps
    const again = await tap(p, 'mi')
    const after = await tap(p, 'top')

    // Assert
    expect(leap.stopped).toBe(true)
    expect(atRest).toEqual([])
    expect(p.el('[data-free-rung="so"]').classList.contains('is-on')).toBe(
      false,
    )
    expect(again.stopped).toBe(true)
    expect(after.stopped).toBe(false)
    expect(after.notes.map((n) => n.midi)).toEqual([54, 62])
  })

  it('asks the frame loop for nothing at rest, nor once a leap has drawn', async () => {
    // Arrange
    const p = await load({ reduce: false })
    const rested = p.hand.asked.length
    await hear(p, await tap(p, 'do'))
    const leap = await tap(p, 'so')

    // Act
    leap.note(0)
    leap.note(1)
    const frames = p.hand.settle()
    await hear(p, leap)
    p.hand.settle()

    // Assert
    expect(rested).toBe(0)
    expect(frames).toBeGreaterThan(0)
    expect(frames).toBeLessThan(60)
    expect(p.hand.asked).toHaveLength(0)
  })
})
