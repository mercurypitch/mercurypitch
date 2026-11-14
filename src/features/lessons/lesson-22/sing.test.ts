// ============================================================
// Lesson 22 Sing it tests — the plan, and what the page adds to the kit's checkpoint
// ============================================================
//
// WEB-SPEC, Toys 6 and Audio: Lesson 22's plan for the kit's held-note
// checkpoint (two ten-second holds, Hold 2 after an easy first, the rest
// card after "Effortful", no live band state, the centre-line reader and
// the summary's subject); the note's reach against every preset of its
// voice (Tests 3); and on learn/22.html's own markup, with the listener a
// double: with sound off Start asks for nothing and says why under itself;
// from Start until the take ends every other play on the page waits, the
// sound before it stopped, and a play enabled meanwhile still waits; no
// Now readout, with no band state to name; after a hold with a vibrato the
// vibrato line joins the reading, and after a straight one it does not.
// The middle line itself, on a view double: violet, on the line's own
// clock, whole at once under reduced motion and drawn over 0.6 s with
// motion on, and never over a take that came after it.

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import type * as BandChartModule from '@/features/lessons/kit/band-chart'
import type { BandChartOptions, BandScene, } from '@/features/lessons/kit/band-chart'
import type { CentredReading } from '@/features/lessons/kit/hold-centre'
import { readCentredHold, vibratoLine, } from '@/features/lessons/kit/hold-centre'
import { holdNote, MAX_MOVE } from '@/features/lessons/kit/hold-sing'
import type { HoldSingView } from '@/features/lessons/kit/hold-sing-view'
import * as holdTake from '@/features/lessons/kit/hold-take'
import type * as ListenModule from '@/features/lessons/kit/listen'
import type * as MotionModule from '@/features/lessons/kit/motion-switch'
import { reducedMotion } from '@/features/lessons/kit/motion-switch'
import type * as SoundModule from '@/features/lessons/kit/sound'
import type { Voice } from '@/features/lessons/kit/voice-choice'
import type * as WordsStripModule from '@/features/lessons/kit/words-strip'
import type { F0Frame } from '@/lib/mirror/metrics'
import type { VocalRangePreset } from '@/stores/settings-store'
import { VOCAL_RANGES } from '@/stores/settings-store'
import { HOLD_HEAD, middlePoints, singPlan, START_SOUND_OFF } from './sing'
import { MIDDLE_SEC } from './vib-picture'

const PAGE = readFileSync(resolve(process.cwd(), 'learn/22.html'), 'utf8')

const mic = vi.hoisted(() => ({
  /** Times the page asked for the microphone. */
  asked: 0,
  /** Runs as the page asks for the microphone, before it is given. */
  asking: null as (() => void) | null,
  /** The microphone refused. */
  refuse: false,
  /** Runs as a take opens, before its frames come. */
  opening: null as (() => void) | null,
  /** The frames the next take hears; null, a take that heard nothing. */
  frames: null as readonly unknown[] | null,
}))

vi.mock('@/features/lessons/kit/listen', async (importOriginal) => {
  const real = await importOriginal<typeof ListenModule>()
  return {
    ...real,
    listen: () => {
      mic.asked += 1
      mic.asking?.()
      if (mic.refuse) return Promise.reject(new Error('refused'))
      return Promise.resolve({
        holding: true,
        latest: () => null,
        release: () => undefined,
        releaseNow: () => undefined,
      })
    },
    takeFrames: () => {
      mic.opening?.()
      return Promise.resolve(mic.frames)
    },
  }
})
// Merc's model note, timed and silent: the test has no Web Audio
vi.mock('@/features/lessons/kit/sound', async (actual) => ({
  ...(await actual<typeof SoundModule>()),
  playTone: (_freq: number, dur: number) =>
    new Promise((r) => setTimeout(() => r(null), dur * 1000)),
}))
// reduced motion, as the doubles set it, unless a test draws the middle over 0.6 s
vi.mock('@/features/lessons/kit/motion-switch', async (actual) => {
  await import('@/features/lessons/kit/browser-doubles.test-fixtures')
  return {
    ...(await actual<typeof MotionModule>()),
    reducedMotion: vi.fn(() => true),
  }
})
// each band chart mounted, and the painter it was given over its plot
const charts = vi.hoisted(() => ({
  mounted: [] as { id: string; paintOver: unknown }[],
}))
vi.mock('@/features/lessons/kit/band-chart', async (actual) => {
  const real = await actual<typeof BandChartModule>()
  return {
    ...real,
    mountBandChart: (root: HTMLElement, o: BandChartOptions) => {
      charts.mounted.push({ id: root.id, paintOver: o.paintOver })
      return real.mountBandChart(root, o)
    },
  }
})
// the middle's 0.6 s, stepped by hand
const steps = vi.hoisted(() => ({
  runs: [] as { dur: number; fn: (u: number) => void }[],
}))
vi.mock('@/features/lessons/kit/words-strip', async (actual) => ({
  ...(await actual<typeof WordsStripModule>()),
  animate: (dur: number, fn: (u: number) => void) => {
    steps.runs.push({ dur, fn })
    return Promise.resolve()
  },
}))

/** A take on A3: half a second of quiet, `voice` seconds of `cents`, then quiet, 16 ms a frame. */
function take(cents: (s: number) => number, voice = 10): F0Frame[] {
  const frames: (F0Frame & { rms: number })[] = []
  for (let k = 0; k * 0.016 < voice + 1.1; k++) {
    const t = k * 0.016
    const s = t - 0.5
    const on = s >= 0 && s < voice
    frames.push({
      t,
      f0: on ? 220 * 2 ** (cents(s) / 1200) : 0,
      conf: on ? 0.95 : 0,
      rms: on ? 0.1 : 0,
    })
  }
  return frames
}

/** ±50 cents at six swings a second round A3; and a straight A3. */
const WAVE = (s: number): number => 50 * Math.sin(2 * Math.PI * 6 * s)
const STRAIGHT = (): number => 0

beforeEach(() => {
  mic.asked = 0
  mic.asking = null
  mic.refuse = false
  mic.opening = null
  mic.frames = null
  steps.runs.length = 0
  vi.mocked(reducedMotion).mockReturnValue(true)
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  document.body.textContent = ''
  localStorage.clear()
})

describe("Lesson 22's plan", () => {
  it('holds ten seconds twice, straight then floating, Hold 2 after an easy first, the rest card after Effortful', () => {
    // Act
    const plan = singPlan()

    // Assert: WEB-SPEC, Toys 6
    expect(plan.consumer).toBe('lesson-22')
    expect(plan.warmupKey).toBe('fyp-l22-warmup')
    expect(plan.holds).toEqual({ lengths: [10, 10], restAfterEffort: true })
    expect(plan.heads).toEqual(HOLD_HEAD)
    expect(HOLD_HEAD).toEqual({ 1: 'Hold 1, straight', 2: 'Hold 2, floating' })
    expect(plan.nextHold).toBe('hold2')
    expect(plan.liveBand).toBe(false)
    expect(plan.subject).toBe('the middle of your line')
  })

  it("reads each hold with the centre-line reader, beside the kit's hold reader's words", async () => {
    // Act
    const reader = await singPlan().reader?.()

    // Assert
    expect(reader?.readHold).toBe(readCentredHold)
    expect(reader?.holdChartWords).toBe(holdTake.holdChartWords)
    expect(reader?.holdSummary).toBe(holdTake.holdSummary)
  })
})

describe('the note (FACTS 55)', () => {
  /** Each voice's presets, as the table names them. */
  const PRESETS: Readonly<Record<Voice, readonly VocalRangePreset[]>> = {
    lower: ['bass', 'baritone', 'tenor'],
    higher: ['alto', 'mezzo-soprano', 'soprano'],
  }

  it("keeps every preset of its voice at least two semitones inside, Merc's A moved four either way, with the table's numbers", () => {
    // Act: semitones to spare under the lowest note and over the highest, for each preset
    const spare = (voice: Voice): number[][] =>
      PRESETS[voice].map((preset) => {
        const range = VOCAL_RANGES[preset]
        return [
          holdNote(voice, -MAX_MOVE) - range.lowMidi,
          range.highMidi - holdNote(voice, MAX_MOVE),
        ]
      })

    // Assert: F3 to C sharp 4, and F4 to C sharp 5
    expect(MAX_MOVE).toBe(4)
    expect([holdNote('lower', -4), holdNote('lower', 4)]).toEqual([53, 61])
    expect([holdNote('higher', -4), holdNote('higher', 4)]).toEqual([65, 73])
    expect(spare('lower')).toEqual([
      [13, 3],
      [10, 6],
      [5, 11],
    ])
    expect(spare('higher')).toEqual([
      [12, 4],
      [8, 8],
      [5, 11],
    ])
    for (const voice of ['lower', 'higher'] as const)
      for (const room of spare(voice).flat())
        expect(room, voice).toBeGreaterThanOrEqual(2)
  })
})

/** The page's card on its own markup, the lower voice stored, past the comfort check, sound `on`. */
async function loadCard(on: boolean) {
  vi.resetModules()
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  localStorage.setItem('fyp-voice', JSON.stringify('lower'))
  const { Sound } = await import('@/features/lessons/kit/sound')
  const { NowPlaying } = await import('@/features/lessons/kit/now-playing')
  const { initSing } = await import('./sing')
  // the take's chunks, loaded now so its own imports of them resolve at once
  await import('@/features/lessons/kit/listen')
  await import('@/features/lessons/kit/hold-take')
  await import('@/features/lessons/kit/hold-centre')
  const body = /<body[^>]*>([\s\S]*)<\/body>/.exec(PAGE)
  if (body === null) throw new Error('learn/22.html has no body')
  document.body.innerHTML = body[1]
  initSing({ blue: 'blue.png', orange: 'orange.png' })
  vi.spyOn(Sound, 'context').mockReturnValue({} as AudioContext)
  const canPlay = vi.spyOn(Sound, 'canPlay').mockReturnValue(on)
  el('[data-comfort="sing"]').click()
  return { canPlay, NowPlaying }
}

function el<T extends HTMLElement = HTMLElement>(selector: string): T {
  const found = document.querySelector<T>(selector)
  if (found === null) throw new Error(`no ${selector}`)
  return found
}

/** A button pressed, its take run out on the fake clock: Merc's note, the gap, the take. */
async function press(selector: string): Promise<void> {
  el(selector).click()
  await vi.dynamicImportSettled()
  await vi.advanceTimersByTimeAsync(3000)
}

const hint = () => el('#singCard [data-start-hint]')
const vibrato = () => el('#singLive [data-vibrato-line]')

describe('Start', { timeout: 15_000 }, () => {
  it('asks for nothing with sound off, and says why under itself; with sound on it asks', async () => {
    // Arrange
    const { canPlay } = await loadCard(false)
    canPlay.mockClear()

    // Act
    await press('[data-sing="start"]')
    const off = { asked: mic.asked, hint: hint().textContent }
    const asked = canPlay.mock.calls[0]
    canPlay.mockReturnValue(true)
    await press('[data-sing="start"]')

    // Assert: WEB-SPEC, Toys 6; the toast says the take can't play, as
    // Lesson 17's Start says it, not that it will be seen but not heard
    expect(asked).toEqual([{ needsSound: true }])
    expect(off).toEqual({ asked: 0, hint: START_SOUND_OFF })
    expect(mic.asked).toBe(1)
    expect(hint().textContent).toBe('')
    expect(el('[data-sing="start"]').getAttribute('aria-describedby')).toBe(
      hint().id,
    )
  })
})

describe('a take', { timeout: 15_000 }, () => {
  it('holds every other play on the page until it ends, the sound before it stopped, and gives back only what it held', async () => {
    // Arrange: a word's play and the cold open's Merc's note open, its straight notes held
    const { NowPlaying } = await loadCard(true)
    const stopped = vi.fn()
    NowPlaying.claim(stopped)
    const word = el<HTMLButtonElement>('[data-word-play="vibrato"]')
    const wave = el<HTMLButtonElement>('.hero-plays [data-play="wave"]')
    const top = el<HTMLButtonElement>('.hero-plays [data-play="top"]')
    let asking: boolean[] = []
    let during: boolean[] = []
    mic.asking = () => {
      asking = [word.disabled, wave.disabled]
    }
    mic.opening = () => {
      during = [word.disabled, wave.disabled, top.disabled]
    }

    // Act
    await press('[data-sing="start"]')

    // Assert: WEB-SPEC, Audio, rule 4, from Start on, while the microphone is asked
    expect(stopped).toHaveBeenCalledTimes(1)
    expect(asking).toEqual([true, true])
    expect(during).toEqual([true, true, true])
    expect([word.disabled, wave.disabled, top.disabled]).toEqual([
      false,
      false,
      true,
    ])
  })

  it('gives the plays back when the microphone is refused, the card listening instead', async () => {
    // Arrange
    await loadCard(true)
    mic.refuse = true
    const word = el<HTMLButtonElement>('[data-word-play="vibrato"]')

    // Act
    await press('[data-sing="start"]')

    // Assert
    expect(word.disabled).toBe(false)
    expect(el('[data-panel="listen"]').hidden).toBe(false)
  })

  it('keeps a play enabled during it from playing until it ends', async () => {
    // Arrange: the straight note, enabled while the take is open
    await loadCard(true)
    const top = el<HTMLButtonElement>('.hero-plays [data-play="top"]')
    const heard = vi.fn()
    top.addEventListener('click', heard)
    let tried = false
    mic.opening = () => {
      top.disabled = false
      top.click()
      tried = true
    }

    // Act
    await press('[data-sing="start"]')
    top.click()

    // Assert: refused while the take was open, heard once it had ended
    expect(tried).toBe(true)
    expect(heard).toHaveBeenCalledTimes(1)
  })
})

describe('no live band state', { timeout: 15_000 }, () => {
  it('shows no Now readout beside the ring, before, during or after a take: there is no state to name (FACTS 57)', async () => {
    // Arrange
    await loadCard(true)
    mic.frames = take(WAVE)
    const readout = el('[data-sing-now]').closest<HTMLElement>('.sing-readout')
    let during: boolean | undefined
    mic.opening = () => {
      during = readout?.hidden
    }

    // Act
    const before = readout?.hidden
    await press('[data-sing="start"]')

    // Assert
    expect([before, during, readout?.hidden]).toEqual([true, true, true])
    expect(el('[data-sing-now]').textContent).toBe('\u2013')
  })
})

describe("after a hold, the reading's lines", { timeout: 15_000 }, () => {
  it("draws on a chart that paints the line's middle", async () => {
    // Arrange
    charts.mounted.length = 0

    // Act
    await loadCard(true)

    // Assert: the hold chart, given the wave painter, which draws the scene's middle
    const { paintWave } = await import('@/features/lessons/kit/band-chart-wave')
    const sing = charts.mounted.find((c) => c.id === 'singChart')
    expect(sing?.paintOver).toBe(paintWave)
  })

  it('add the vibrato line after a hold with a wave, as the reader measured it', async () => {
    // Arrange
    await loadCard(true)
    mic.frames = take(WAVE)
    const expected = readCentredHold(take(WAVE), 57, 10)

    // Act
    await press('[data-sing="start"]')

    // Assert: FACTS 45, 46
    expect(expected.vibrato).not.toBeNull()
    expect(vibrato().hidden).toBe(false)
    expect(vibrato().textContent).toBe(
      vibratoLine(expected.vibrato ?? { rate: 0, extent: 0 }),
    )
    expect(vibrato().textContent).toMatch(
      /^The note had a wave: about 6 swings a second/,
    )
  })

  it('say nothing of a wave after a straight hold', async () => {
    // Arrange
    await loadCard(true)
    mic.frames = take(STRAIGHT)

    // Act
    await press('[data-sing="start"]')

    // Assert
    expect(el('#singLive [data-reading]').hidden).toBe(false)
    expect(vibrato().hidden).toBe(true)
    expect(vibrato().textContent).toBe('')
  })
})

describe("the visit's ending", { timeout: 15_000 }, () => {
  it('keeps the rest card when Done for today follows "Effortful"', async () => {
    // Arrange: a hold read, then "Effortful", which picks the rest card here
    await loadCard(true)
    const { VisitEnding } = await import('@/features/lessons/kit/comfort')
    mic.frames = take(STRAIGHT)
    await press('[data-sing="start"]')
    el('[data-feel="effortful"]').click()
    const afterEffort = VisitEnding.ending

    // Act
    el('[data-panel="after"] [data-sing="today"]').click()

    // Assert: the checkpoint is over, and the visit still ends on rest
    expect(el('#singStatus').textContent).toBe('Done for today.')
    expect([afterEffort, VisitEnding.ending]).toEqual(['rest', 'rest'])
  })

  it('leaves the practice card when Done for today follows "Easy"', async () => {
    // Arrange
    await loadCard(true)
    const { VisitEnding } = await import('@/features/lessons/kit/comfort')
    mic.frames = take(STRAIGHT)
    await press('[data-sing="start"]')
    el('[data-feel="easy"]').click()

    // Act
    el('[data-panel="after"] [data-sing="today"]').click()

    // Assert
    expect(el('#singStatus').textContent).toBe('Done for today.')
    expect(VisitEnding.ending).toBe('practise')
  })
})

describe('the middle line', () => {
  /** The reading's part of the card, and a chart's scene, on their own. */
  function viewDouble(): { view: HoldSingView; scene: Partial<BandScene> } {
    document.body.innerHTML =
      '<div id="singCard"><p data-start-hint></p></div><div data-reading><p data-vibrato-line hidden></p></div>'
    const scene: Partial<BandScene> = {}
    const view = {
      chart: { scene },
      readingEl: el('[data-reading]'),
    } as unknown as HoldSingView
    return { view, scene }
  }

  /** A reading with a vibrato found, its middle 5 cents up from 0.5 s on the take's clock. */
  const found = (): CentredReading => ({
    ...readCentredHold(take(WAVE), 57, 10),
    middle: [
      { t: 0.5, cents: 5 },
      { t: 0.516, cents: 5 },
      { t: 10.5, cents: 5 },
    ],
  })

  it("draws itself in the learner's violet on the line's own clock, at once under reduced motion", async () => {
    // Arrange
    const plan = singPlan()
    await plan.reader?.()
    const { view, scene } = viewDouble()

    // Act
    plan.onReading?.(found(), view)

    // Assert
    expect(scene.middle).toEqual({
      points: [
        { t: 0, c: 5 },
        { t: expect.closeTo(0.016, 9) as number, c: 5 },
        { t: 10, c: 5 },
      ],
      tone: 'singer',
      share: 1,
    })
  })

  it('draws itself over 0.6 s with motion on, and never over a take that came after it', async () => {
    // Arrange
    vi.mocked(reducedMotion).mockReturnValue(false)
    const plan = singPlan()
    await plan.reader?.()
    const { view, scene } = viewDouble()

    // Act: half way, then a new take opens before the end
    plan.onReading?.(found(), view)
    const [run] = steps.runs
    run.fn(0.5)
    const half = scene.middle?.share
    plan.onTake?.(true)
    scene.middle = null
    run.fn(1)
    plan.onTake?.(false)

    // Assert
    expect(run.dur).toBe(MIDDLE_SEC)
    expect(half).toBe(0.5)
    expect(scene.middle).toBeNull()
  })

  it('is not drawn for a reading with no vibrato found', async () => {
    // Arrange
    const plan = singPlan()
    await plan.reader?.()
    const { view, scene } = viewDouble()

    // Act
    plan.onReading?.(readCentredHold(take(STRAIGHT), 57, 10), view)

    // Assert
    expect(scene.middle).toBeUndefined()
    expect(el('[data-vibrato-line]').hidden).toBe(true)
  })

  it("puts the middle's points on the line's clock, from the hold's first voiced frame", () => {
    // Assert
    expect(
      middlePoints([
        { t: 1.2, cents: 3 },
        { t: 1.7, cents: -2 },
      ]),
    ).toEqual([
      { t: 0, c: 3 },
      { t: expect.closeTo(0.5, 9) as number, c: -2 },
    ])
  })
})
