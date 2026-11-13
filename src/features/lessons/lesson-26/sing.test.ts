// ============================================================
// Lesson 26 Sing it tests — the checks, the run, the swap and the sing-along
// ============================================================
//
// WEB-SPEC, Toys 5, and Tests 8, 10 and 11, on learn/26.html's own markup,
// with the microphone, the take, the runs and the beat clock as doubles
// timed on the fake clock: the comfort check, the voice choice and the
// headphones check; "No headphones" opens the sing-along and asks for no
// microphone; with sound off Start asks for nothing and says why; Start
// asks once, the quiet check plays the other part's first 2.0 s, then the
// model, the count-in and the take, the other part booked on bar 1 and
// kept through the take's hush, the take given the other part and "your
// part's note"; the lines half a second after it; a quiet check that heard
// a note opens the sing-along with Start under it; a run with no voice,
// three a set; the swap after Easy; Effortful's and Uncomfortable's
// endings; every other play held through a run; the sing-along, its Again
// once a visit; and "Just listen today"'s play, each note lit as long as it
// sounds.

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import type * as BeatClockModule from '@/features/lessons/kit/beat-clock'
import type { RunOptions as ClockOptions } from '@/features/lessons/kit/beat-clock'
import type * as ListenModule from '@/features/lessons/kit/listen'
import type * as MercDuoModule from '@/features/lessons/kit/merc-duo'
import type * as RunModule from '@/features/lessons/kit/run'
import type { RunNote, RunOptions } from '@/features/lessons/kit/run'
import type { TakeContext, TakeEnd } from '@/features/lessons/kit/take-in-time'
import type { Voice } from '@/features/lessons/kit/voice-choice'
import type * as FigureModule from './sing-figure'
import type { SingFigure } from './sing-figure'
import type * as SoundsModule from './sing-sounds'

const PAGE = readFileSync(resolve(process.cwd(), 'learn/26.html'), 'utf8')

const mic = vi.hoisted(() => ({ asked: 0, released: 0, refuse: false }))
vi.mock('@/features/lessons/kit/listen', async (importOriginal) => ({
  ...(await importOriginal<typeof ListenModule>()),
  listen: () => {
    mic.asked += 1
    if (mic.refuse) return Promise.reject(new Error('refused'))
    return Promise.resolve({
      holding: true,
      latest: () => null,
      release: () => {
        mic.released += 1
      },
      releaseNow: () => {
        mic.released += 1
      },
    })
  },
  framesFor: () => Promise.resolve([]),
}))

/** Every run the page started, timed on the fake clock: its notes, options, and whether it was stopped. */
const played = vi.hoisted(() => ({
  runs: [] as {
    notes: readonly RunNote[]
    o: RunOptions
    stopped: boolean
  }[],
}))
vi.mock('@/features/lessons/kit/run', async (actual) => ({
  ...(await actual<typeof RunModule>()),
  playNotes: (
    notes: readonly RunNote[],
    o: RunOptions & { onNote?: (n: RunNote, i: number) => void },
  ) => {
    const run = { notes, o, stopped: false }
    played.runs.push(run)
    const timers = notes.map((n, i) =>
      setTimeout(() => o.onNote?.(n, i), n.t * 1000),
    )
    let settle: (heard: boolean) => void = () => undefined
    const done = new Promise<boolean>((r) => {
      settle = r
    })
    const end = Math.max(...notes.map((n) => n.t + n.dur))
    timers.push(setTimeout(() => settle(true), end * 1000))
    return {
      done,
      stop: () => {
        run.stopped = true
        timers.forEach(clearTimeout)
        settle(false)
      },
    }
  },
}))

/** The count-in, timed on the fake clock: a beat a second from 0.1 s, the take's moment half a beat before bar 1. */
const clock = vi.hoisted(() => ({ runs: 0 }))
vi.mock('@/features/lessons/kit/beat-clock', async (actual) => ({
  ...(await actual<typeof BeatClockModule>()),
  BeatClock: {
    start<T>(o: ClockOptions<T>) {
      clock.runs += 1
      const t0 = performance.now() + 100
      let settle: (heard: boolean) => void = () => undefined
      const done = new Promise<boolean>((r) => {
        settle = r
      })
      const timers = [0, 1, 2, 3].map((b) =>
        setTimeout(
          () => o.onBeat?.({ bar: 0, beat: b, beats: b }),
          100 + b * 1000,
        ),
      )
      timers.push(
        setTimeout(
          () => o.onFrame?.({ bar: 0, beat: 3, beats: 3.5 }),
          100 + 3500,
        ),
        setTimeout(() => settle(true), 100 + 4000),
      )
      return {
        done,
        running: true,
        stop: () => {
          timers.forEach(clearTimeout)
          settle(false)
        },
        pageTimeOfBeat: (n: number) => t0 + n * 1000,
        audioTimeOfBeat: (n: number) => 0.1 + n,
      }
    },
  },
}))
vi.mock('@/features/lessons/kit/merc-duo', async (actual) => ({
  ...(await actual<typeof MercDuoModule>()),
  mercSing: () => undefined,
  mercListen: () => undefined,
}))

/** Every part the page booked: its notes, when, and how long. */
const parts = vi.hoisted(() => ({
  booked: [] as {
    midis: readonly number[]
    at: number
    sec: number | undefined
    stopped: boolean
  }[],
}))
vi.mock('./sing-sounds', async (actual) => ({
  ...(await actual<typeof SoundsModule>()),
  bookPart: (midis: readonly number[], at: number, sec?: number) => {
    const p = { midis: [...midis], at, sec, stopped: false }
    parts.booked.push(p)
    return {
      get alive() {
        return !p.stopped
      },
      stop: () => {
        p.stopped = true
      },
    }
  },
}))

/** The figure the page mounted, real, kept so a test can read what it has lit. */
const figure = vi.hoisted(() => ({ now: null as SingFigure | null }))
vi.mock('./sing-figure', async (actual) => {
  const real = await actual<typeof FigureModule>()
  return {
    ...real,
    mountSingFigure: () => (figure.now = real.mountSingFigure()),
  }
})

/** The take's doubles: each take the page opened, how the test ends it, and what the quiet check hears. */
const take = vi.hoisted(() => ({
  contexts: [] as unknown[],
  ends: [] as ((e: unknown) => void)[],
  heard: false,
}))
const loadKits = () =>
  Promise.resolve({
    take: {
      OPEN_BEATS: 0.5,
      runTake: (c: TakeContext) => {
        take.contexts.push(c)
        return new Promise<TakeEnd>((r) => take.ends.push(r as never))
      },
    },
    quiet: { heardNothing: () => !take.heard },
  }) as never

const PITCH = { seconds: 6.75, rungs: [], line: [], octaves: 0 }
const LINES = [
  "La · In the band: 20 cents below your part's note.",
  "Ti · That was Merc's note: re.",
  "Do · Right in the middle: on your part's note.",
  "Ti · Right in the middle: on your part's note.",
  "La · Right in the middle: on your part's note.",
]
const VOICED: TakeEnd = {
  kind: 'read',
  voiced: true,
  lines: LINES,
  pitch: PITCH,
  inBand: 4,
}
const SILENT: TakeEnd = {
  kind: 'read',
  voiced: false,
  lines: [],
  pitch: null,
  inBand: 0,
}

beforeEach(() => {
  mic.asked = 0
  mic.released = 0
  mic.refuse = false
  played.runs.length = 0
  clock.runs = 0
  parts.booked.length = 0
  take.contexts.length = 0
  take.ends.length = 0
  take.heard = false
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  document.body.textContent = ''
  localStorage.clear()
})

/** The page's card on its own markup, the lower voice stored unless `voice` is null. */
async function loadCard(o: { on?: boolean; voice?: Voice | null } = {}) {
  vi.resetModules()
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] })
  if (o.voice !== null)
    localStorage.setItem('fyp-voice', JSON.stringify(o.voice ?? 'lower'))
  const { Sound } = await import('@/features/lessons/kit/sound')
  const { VisitEnding } = await import('@/features/lessons/kit/comfort')
  const { initSing } = await import('./sing')
  await import('@/features/lessons/kit/listen')
  const body = /<body[^>]*>([\s\S]*)<\/body>/.exec(PAGE)
  if (body === null) throw new Error('learn/26.html has no body')
  document.body.innerHTML = body[1]
  vi.spyOn(Sound, 'context').mockReturnValue({
    currentTime: 0,
  } as AudioContext)
  vi.spyOn(Sound, 'canPlay').mockReturnValue(o.on ?? true)
  const hush = vi.spyOn(Sound, 'hush').mockReturnValue(true)
  initSing({ loadKits })
  return { hush, VisitEnding }
}

function el<T extends HTMLElement = HTMLElement>(selector: string): T {
  const found = document.querySelector<T>(selector)
  if (found === null) throw new Error(`no ${selector}`)
  return found
}

const shown = (panel: string): boolean => !el(`[data-panel="${panel}"]`).hidden

/** The figure's lit notes now: the other part's bead, and your part's band; null where none is lit. */
function lit(): [other: number | null, mine: number | null] {
  const scene = figure.now?.chart.scene
  const over = scene?.over as { other: number | null } | undefined
  const band = (scene?.rungs ?? []).findIndex((r) => r.glow === 1)
  return [over?.other ?? null, band < 0 ? null : band]
}
const status = (): string => el('#singStatus').textContent ?? ''
const offered = (): string[] =>
  [
    ...document.querySelectorAll<HTMLButtonElement>(
      '[data-panel="after"] .sing-btns button',
    ),
  ]
    .filter((b) => !b.hidden)
    .map((b) => b.dataset.sing ?? '')

/** A button pressed and everything it starts run out on the fake clock. */
async function press(selector: string, ms = 0): Promise<void> {
  el(selector).click()
  await vi.dynamicImportSettled()
  await vi.advanceTimersByTimeAsync(ms)
}

/** Past the comfort check, headphones on: the briefing. */
async function toBrief(): Promise<void> {
  await press('[data-comfort="sing"]')
  await press('[data-phones="on"]')
}

/** Start pressed and run out to the open take: the quiet check, the model, the quiet and the count-in. */
async function toTake(selector = '[data-panel="start"] [data-sing="start"]') {
  await press(selector, 11_000)
}

/** The latest take ended with `e`, and the half second after it. */
async function endTake(e: TakeEnd): Promise<void> {
  take.ends.at(-1)?.(e)
  await vi.advanceTimersByTimeAsync(600)
}

describe('before Start', () => {
  it('asks the comfort check, then the voice when none is stored, then the headphones', async () => {
    // Arrange
    await loadCard({ voice: null })

    // Act
    await press('[data-comfort="sing"]')
    const voice = [shown('voice'), shown('phones'), status()]
    await press('[data-voice="higher"]')

    // Assert: states 1, 2 and 4; Tavi for the higher voice
    expect(voice).toEqual([true, false, "Choose the voice you'll sing with."])
    expect([shown('voice'), shown('phones')]).toEqual([true, true])
    expect(el('[data-panel="phones"]').textContent).toContain("Tavi's part")
    expect(el<HTMLImageElement>('.sing-merc').alt).toBe(
      'Tavi, who sings for the higher voice',
    )
  })

  it('opens the sing-along after No headphones and asks for no microphone', async () => {
    // Arrange
    await loadCard()

    // Act
    await press('[data-comfort="sing"]')
    await press('[data-phones="off"]')

    // Assert: state 11
    expect([shown('along'), shown('brief'), el('#singFig').hidden]).toEqual([
      true,
      false,
      false,
    ])
    expect(el('[data-quiet-failed]').hidden).toBe(true)
    expect(mic.asked).toBe(0)
  })

  it('asks for nothing with sound off, and says why', async () => {
    // Arrange
    await loadCard({ on: false })
    await toBrief()

    // Act
    await press('[data-panel="start"] [data-sing="start"]', 1000)

    // Assert: state 5
    expect(el('[data-start-hint]').textContent).toBe(
      "Sound is off, so nothing played. Turn sound on to hear Merc's part, then press Start.",
    )
    expect([mic.asked, played.runs.length]).toEqual([0, 0])
  })

  it('draws the briefing’s figure and its first line for the voice', async () => {
    // Arrange
    await loadCard({ voice: 'higher' })

    // Act
    await toBrief()

    // Assert
    expect(el('[data-turn-first]').textContent).toBe(
      'mi fa so fa mi, a third above the tune.',
    )
    expect(el('#singChart canvas').getAttribute('aria-label')).toBe(
      "Your part as five bands: mi, fa, so, fa and mi, with Tavi's tune beside it",
    )
    expect([shown('brief'), shown('start'), el('#singFig').hidden]).toEqual([
      true,
      true,
      false,
    ])
  })
})

describe('a run', () => {
  it('checks the quiet over the part’s first 2.0 s, sings the model, counts in and opens the take with Merc’s part from bar 1', async () => {
    // Arrange
    const { hush } = await loadCard()
    await toBrief()

    // Act
    await toTake()

    // Assert: states 6 and 7
    expect(mic.asked).toBe(1)
    const [check, run] = parts.booked
    expect([check.midis, check.at, check.sec]).toEqual([
      [55, 57, 59, 57, 55],
      0,
      2,
    ])
    expect(played.runs[0].notes.map((n) => n.midi)).toEqual([
      52, 54, 55, 54, 52,
    ])
    expect(played.runs[0].o.kind).toBe('merc')
    expect(clock.runs).toBe(1)
    // the part booked half a beat ahead, on bar 1's audio time
    expect(run.midis).toEqual([55, 57, 59, 57, 55])
    expect(run.sec).toBeUndefined()
    expect(run.at).toBeCloseTo(4.1, 6)
    const c = take.contexts[0] as TakeContext
    expect(c.notes.map((n) => [n.midi, n.beat, n.beats])).toEqual([
      [52, 0, 1],
      [54, 1, 1],
      [55, 2, 1],
      [54, 3, 1],
      [52, 4, 2],
    ])
    expect(c.labels).toEqual(['La', 'Ti', 'Do', 'Ti', 'La'])
    expect(c.whose).toBe("your part's note")
    expect([c.other?.whose, c.other?.labels]).toEqual([
      "Merc's",
      ['do', 're', 'mi', 're', 'do'],
    ])
    expect(c.bpm).toBe(60)
    // the take keeps the part through its hush
    expect(hush).toHaveBeenLastCalledWith(true, expect.anything())
    expect(status()).toBe("Your turn: sing your part with Merc's.")
  })

  it('draws the lines and the pitch line half a second after the take, then asks how it felt', async () => {
    // Arrange
    await loadCard()
    await toBrief()
    await toTake()

    // Act
    take.ends.at(-1)?.(VOICED)
    await vi.advanceTimersByTimeAsync(100)
    const soon = el('#singLive').hidden
    await vi.advanceTimersByTimeAsync(500)

    // Assert: states 8 and 9
    expect(soon).toBe(true)
    expect(el('#singLive').hidden).toBe(false)
    expect(
      [...document.querySelectorAll('[data-readings] li')].map(
        (li) => li.textContent,
      ),
    ).toEqual(LINES)
    expect([shown('feel'), status()]).toEqual([true, 'How did that feel?'])
    expect(parts.booked[1].stopped).toBe(true)
  })

  it('opens the sing-along with Start under it when the quiet check hears a note, and lets the microphone go', async () => {
    // Arrange
    await loadCard()
    await toBrief()
    take.heard = true

    // Act
    await press('[data-panel="start"] [data-sing="start"]', 3000)

    // Assert: state 6
    expect([shown('along'), el('[data-quiet-failed]').hidden]).toEqual([
      true,
      false,
    ])
    expect(el('[data-start-again]').hidden).toBe(false)
    expect(status()).toBe(
      "The microphone heard a note during Merc's part. Check your headphones, then press Start again and stay quiet.",
    )
    expect(played.runs).toHaveLength(0)
    expect(mic.released).toBeGreaterThan(0)
  })

  it('gives the no-voice line with Start again and no question, three runs a set', async () => {
    // Arrange
    await loadCard()
    await toBrief()

    // Act
    await toTake()
    await endTake(SILENT)
    const first = [shown('feel'), offered()]
    await toTake('[data-sing="restart"]')
    await endTake(SILENT)
    await toTake('[data-sing="restart"]')
    await endTake(SILENT)

    // Assert: FACTS 57
    expect(first).toEqual([false, ['restart', 'today']])
    expect(el('[data-after="silent"]').hidden).toBe(false)
    expect(offered()).toEqual(['today'])
    expect(status()).toBe("That's every run this set has today.")
  })

  it('offers the swap after Easy, and the swap sings the tune against Merc’s part', async () => {
    // Arrange
    await loadCard()
    await toBrief()
    await toTake()
    await endTake(VOICED)

    // Act
    await press('[data-feel="easy"]')
    const after = [offered(), status()]
    await toTake('[data-sing="swap"]')

    // Assert: FACTS 56; state 10
    expect(after).toEqual([
      ['swap', 'again', 'today'],
      'Now swap: sing the tune while Merc sings your part.',
    ])
    expect(el('[data-turn-first]').textContent).toBe(
      'do re mi re do, the tune.',
    )
    const swap = take.contexts.at(-1) as TakeContext
    expect(swap.notes.map((n) => n.midi)).toEqual([55, 57, 59, 57, 55])
    expect(swap.other?.notes.map((n) => n.midi)).toEqual([52, 54, 55, 54, 52])
    expect(swap.other?.labels).toEqual(['la', 'ti', 'do', 'ti', 'la'])
    expect(parts.booked.at(-2)?.midis).toEqual([52, 54, 55, 54, 52])
  })

  it('keeps the lines after Effortful and offers only Done for today, with the rest card', async () => {
    // Arrange
    const { VisitEnding } = await loadCard()
    await toBrief()
    await toTake()
    await endTake(VOICED)

    // Act
    await press('[data-feel="effortful"]')

    // Assert: FACTS 59
    expect(offered()).toEqual(['today'])
    expect(el('#singLive').hidden).toBe(false)
    expect(status()).toBe('Keep it gentle: rest before you sing again.')
    expect(VisitEnding.ending).toBe('rest')
  })

  it('takes the lines away after Uncomfortable, with the doctor lines, and lets the microphone go', async () => {
    // Arrange
    const { VisitEnding } = await loadCard()
    await toBrief()
    await toTake()
    await endTake(VOICED)
    const released = mic.released

    // Act
    await press('[data-feel="uncomfortable"]')

    // Assert: REQ-GVC-021, REQ-GVC-023
    expect(offered()).toEqual([])
    expect(el('#singLive').hidden).toBe(true)
    expect(el('[data-after-doctor]').hidden).toBe(false)
    expect(mic.released).toBeGreaterThanOrEqual(released)
    expect(VisitEnding.ending).toBe('rest')
  })

  it('holds every other play on the page from Start until the run ends', async () => {
    // Arrange
    await loadCard()
    await toBrief()
    const word = document.createElement('button')
    word.dataset.wordPlay = ''
    document.body.append(word)

    // Act
    await toTake()
    const during = word.disabled
    await endTake(VOICED)

    // Assert: WEB-SPEC, Audio, rule 4
    expect([during, word.disabled]).toEqual([true, false])
  })
})

describe('the sing-along and listening', () => {
  it('sings the model, counts in and plays the other part, asking for nothing, then offers the swap and its Again once', async () => {
    // Arrange
    await loadCard()
    await press('[data-comfort="sing"]')
    await press('[data-phones="off"]')

    // Act
    await press('[data-sing="along"]', 17_000)
    const asked = shown('feel')
    await press('[data-feel="easy"]')
    const first = offered()
    await press('[data-sing="along-again"]', 17_000)
    await press('[data-feel="workable"]')

    // Assert: state 11; FACTS 61
    expect(mic.asked).toBe(0)
    expect(asked).toBe(true)
    expect(played.runs[0].notes.map((n) => n.midi)).toEqual([
      52, 54, 55, 54, 52,
    ])
    expect(parts.booked[0].midis).toEqual([55, 57, 59, 57, 55])
    expect(first).toEqual(['swap', 'along-again', 'today'])
    expect(offered()).toEqual(['swap', 'today'])
  })

  it('shows no headphones check, Start or sing-along after Just listen today, and plays the tune, the part and both', async () => {
    // Arrange
    const { VisitEnding } = await loadCard()

    // Act
    await press('[data-comfort="listen"]')
    const panels = ['phones', 'brief', 'start', 'along'].map(shown)
    await press('[data-listen-play]', 100)

    // Assert: state 3; REQ-GVC-055
    expect(shown('listen')).toBe(true)
    expect(panels).toEqual([false, false, false, false])
    expect(played.runs[0].notes).toHaveLength(20)
    expect(Math.max(...played.runs[0].notes.map((n) => n.t + n.dur))).toBe(20)
    expect([mic.asked, VisitEnding.ending]).toEqual([0, 'rest'])
  })

  it('lights each note of the play as long as it sounds: the tune’s beads, then your part’s bands, then both', async () => {
    // Arrange: the middle of each note of the three passes, 7 s apart, and after the play
    await loadCard()
    await press('[data-comfort="listen"]')
    const middles = [0.5, 1.5, 2.5, 3.5, 5]
    const at = [0, 7, 14].flatMap((pass) => middles.map((m) => pass + m))

    // Act
    await press('[data-listen-play]')
    const seen: ReturnType<typeof lit>[] = []
    let now = 0
    for (const t of [...at, 20.5]) {
      await vi.advanceTimersByTimeAsync((t - now) * 1000)
      now = t
      seen.push(lit())
    }

    // Assert: each note stays lit through its own length, though the next starts as it ends
    const notes = [0, 1, 2, 3, 4]
    expect(seen).toEqual([
      ...notes.map((i) => [i, null]),
      ...notes.map((i) => [null, i]),
      ...notes.map((i) => [i, i]),
      [null, null],
    ])
  })
})
