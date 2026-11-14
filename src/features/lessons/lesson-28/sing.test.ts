// ============================================================
// Lesson 28 Sing it tests — the checks, the run, the playback and the paths
// ============================================================
//
// WEB-SPEC, Toys 6, and Tests 5, 8, 10, 11 and 12, on learn/28.html's own
// markup, with the microphone, the take, the recorder, the runs and the
// beat clock as doubles timed on the fake clock, and the kit's score a
// double: the staffs and the four plays wait for the cold open's choice;
// the comfort check, the voice choice and the headphones check; the alone
// briefing after No headphones; with sound off Start asks for nothing and
// says why; Start asks once, the quiet check plays the other part's first
// 2.0 s, then do, the count-in and the take, recorded from its open, the
// other part booked on bar 1 and kept through the take's hush; the lines
// half a second after it, and the take kept for its playback, which
// carries when the singer came in; Delete drops it and keeps the lines; a
// quiet check that heard a note stops the run over Start; a run with no
// voice, three takes a visit, Again's quiet check first; Effortful's and
// Uncomfortable's endings with the take kept; every other play held
// through a run; the alone path's take with nothing under it, and its
// first turn; the sing-along for a refused microphone, its Again once; and
// "Just listen today"'s Play the song.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import type * as BeatClockModule from '@/features/lessons/kit/beat-clock'
import type { RunOptions as ClockOptions } from '@/features/lessons/kit/beat-clock'
import type * as ListenModule from '@/features/lessons/kit/listen'
import type * as MercDuoModule from '@/features/lessons/kit/merc-duo'
import type * as RecordModule from '@/features/lessons/kit/record'
import type { KeptTake, PartUnder } from '@/features/lessons/kit/record'
import type * as RunModule from '@/features/lessons/kit/run'
import type { RunNote, RunOptions } from '@/features/lessons/kit/run'
import type { TakeContext, TakeEnd } from '@/features/lessons/kit/take-in-time'
import type { Voice } from '@/features/lessons/kit/voice-choice'
import { PAGE } from './page-dom.test-fixtures'
import type * as ScoreDoubles from './score-double.test-fixtures'
import type { Part } from './sing-plan'
import type * as SoundsModule from './sing-sounds'

/** A beat at 72 BPM, ms. */
const BEAT_MS = 60000 / 72

const mic = vi.hoisted(() => ({ asked: 0, released: 0, refuse: false }))
vi.mock('@/features/lessons/kit/listen', async (importOriginal) => ({
  ...(await importOriginal<typeof ListenModule>()),
  listen: () => {
    mic.asked += 1
    if (mic.refuse) return Promise.reject(new Error('refused'))
    return Promise.resolve({
      holding: true,
      media: { id: 'the listener’s stream' },
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
  runs: [] as { notes: readonly RunNote[]; o: RunOptions; stopped: boolean }[],
}))
vi.mock('@/features/lessons/kit/run', async (actual) => ({
  ...(await actual<typeof RunModule>()),
  playNotes: (notes: readonly RunNote[], o: RunOptions) => {
    const run = { notes, o, stopped: false }
    played.runs.push(run)
    let settle: (heard: boolean) => void = () => undefined
    const done = new Promise<boolean>((r) => {
      settle = r
    })
    const end = Math.max(...notes.map((n) => n.t + n.dur))
    const timer = setTimeout(() => settle(true), end * 1000)
    return {
      done,
      stop: () => {
        run.stopped = true
        clearTimeout(timer)
        settle(false)
      },
    }
  },
}))

/** The count-in at 72 BPM on the fake clock, from 0.1 s: the take's moment half a beat before bar 1. */
const clock = vi.hoisted(() => ({ runs: 0 }))
vi.mock('@/features/lessons/kit/beat-clock', async (actual) => ({
  ...(await actual<typeof BeatClockModule>()),
  BeatClock: {
    start<T>(o: ClockOptions<T>) {
      const beat = 60000 / 72
      clock.runs += 1
      const t0 = performance.now() + 100
      let settle: (heard: boolean) => void = () => undefined
      const done = new Promise<boolean>((r) => {
        settle = r
      })
      const timers = [0, 1, 2, 3].map((b) =>
        setTimeout(
          () => o.onBeat?.({ bar: 0, beat: b, beats: b }),
          100 + b * beat,
        ),
      )
      timers.push(
        setTimeout(
          () => o.onFrame?.({ bar: 0, beat: 3, beats: 3.5 }),
          100 + 3.5 * beat,
        ),
        setTimeout(() => settle(true), 100 + 4 * beat),
      )
      return {
        done,
        running: true,
        stop: () => {
          timers.forEach(clearTimeout)
          settle(false)
        },
        pageTimeOfBeat: (n: number) => t0 + n * beat,
        audioTimeOfBeat: (n: number) => 0.1 + (n * beat) / 1000,
      }
    },
  },
}))

/** Each time Merc or Tavi was told to sing or to stop: who, and which. */
const merc = vi.hoisted(() => ({ sang: [] as [string, boolean][] }))
vi.mock('@/features/lessons/kit/merc-duo', async (actual) => ({
  ...(await actual<typeof MercDuoModule>()),
  mercSing: (which: string, _midi: number, on: boolean) => {
    merc.sang.push([which, on])
  },
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
  bookPart: (p: Part, at: number, sec?: number) => {
    const b = { midis: [...p.midis], at, sec, stopped: false }
    parts.booked.push(b)
    return {
      get alive() {
        return !b.stopped
      },
      stop: () => {
        b.stopped = true
      },
    }
  },
}))

/** The score doubles the page mounts: the mock's own, which outlives the tests' module resets. */
const staffsHub = vi.hoisted(() => ({
  doubles: null as typeof ScoreDoubles | null,
}))
vi.mock('@/features/lessons/kit/score', async () => {
  const doubles = await import('./score-double.test-fixtures')
  staffsHub.doubles = doubles
  return doubles.scoreDouble
})

/** The recorder and the playback: each recording's start and end, each take kept, and each playback with its part. */
const rec = vi.hoisted(() => ({
  started: 0,
  stopped: 0,
  discarded: 0,
  keep: true,
  plays: [] as {
    take: KeptTake
    part: PartUnder
    stopped: boolean
    end: (heard: boolean) => void
  }[],
}))
vi.mock('@/features/lessons/kit/record', async (actual) => ({
  ...(await actual<typeof RecordModule>()),
  canRecord: () => true,
  recorderFor: () => ({
    start: () => {
      rec.started += 1
      return true
    },
    stop: () => {
      rec.stopped += 1
      return Promise.resolve(new Blob(['take']))
    },
    discard: () => {
      rec.discarded += 1
    },
    dispose: () => undefined,
    pause: () => Promise.resolve(true),
    resume: () => Promise.resolve(true),
  }),
  keepTake: (_blob: Blob | null, _c: AudioContext, voicedAt: number) =>
    Promise.resolve(
      rec.keep
        ? {
            buffer: { duration: 30 } as AudioBuffer,
            gain: 2,
            voicedAt,
            length: 30,
          }
        : null,
    ),
  playWithPart: (
    take: KeptTake,
    _c: AudioContext,
    _o: unknown,
    part: PartUnder,
  ) => {
    let settle: (heard: boolean) => void = () => undefined
    const done = new Promise<boolean>((r) => {
      settle = r
    })
    const p = {
      take,
      part,
      stopped: false,
      end: (heard: boolean) => {
        settle(heard)
      },
    }
    rec.plays.push(p)
    return {
      done,
      bar1: performance.now() + 100,
      stop: () => {
        p.stopped = true
        settle(false)
      },
    }
  },
}))

/** The take's doubles: each take opened, how the test ends it, what the quiet check hears, and where the recording's voice starts. */
const take = vi.hoisted(() => ({
  contexts: [] as TakeContext[],
  ends: [] as ((e: TakeEnd) => void)[],
  heard: false,
  spans: [] as unknown[],
  drawn: 0,
}))
const loadKits = () =>
  Promise.resolve({
    take: {
      OPEN_BEATS: 0.5,
      runTake: (c: TakeContext) => {
        take.contexts.push(c)
        return new Promise<TakeEnd>((r) => take.ends.push(r))
      },
      drawPitchLine: () => {
        take.drawn += 1
      },
    },
    quiet: { heardNothing: () => !take.heard },
    onset: {
      voiceOnsetOf: (_b: AudioBuffer, span: unknown) => {
        take.spans.push(span)
        return Promise.resolve(0.6)
      },
    },
  }) as never

const PITCH = { seconds: 27.3, rungs: [], line: [], octaves: 0 }
const LINES = Array.from(
  { length: 14 },
  () => "Do · Right in the middle: on your part's note.",
)
const VOICED: TakeEnd = {
  kind: 'read',
  voiced: true,
  lines: LINES,
  pitch: PITCH,
  inBand: 12,
  onset: 0.25,
}
const SILENT: TakeEnd = {
  kind: 'read',
  voiced: false,
  lines: [],
  pitch: null,
  inBand: 0,
  onset: null,
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
  take.spans.length = 0
  take.drawn = 0
  merc.sang.length = 0
  rec.started = 0
  rec.stopped = 0
  rec.discarded = 0
  rec.keep = true
  rec.plays.length = 0
  staffsHub.doubles?.resetScores()
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  document.body.textContent = ''
  localStorage.clear()
})

/** The page's card on its own markup, the lower voice stored unless `voice` is null, the choice made unless `chosen` is given. */
async function loadCard(
  o: { on?: boolean; voice?: Voice | null; chosen?: Promise<unknown> } = {},
) {
  vi.resetModules()
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] })
  if (o.voice !== null)
    localStorage.setItem('fyp-voice', JSON.stringify(o.voice ?? 'lower'))
  const { Sound } = await import('@/features/lessons/kit/sound')
  const { VisitEnding } = await import('@/features/lessons/kit/comfort')
  const { initSing } = await import('./sing')
  await import('@/features/lessons/kit/listen')
  const body = /<body[^>]*>([\s\S]*)<\/body>/.exec(PAGE)
  if (body === null) throw new Error('learn/28.html has no body')
  document.body.innerHTML = body[1]
  vi.spyOn(Sound, 'context').mockReturnValue({
    currentTime: 0,
  } as AudioContext)
  vi.spyOn(Sound, 'canPlay').mockReturnValue(o.on ?? true)
  const hush = vi.spyOn(Sound, 'hush').mockReturnValue(true)
  initSing({ loadKits, chosen: o.chosen ?? Promise.resolve() })
  await vi.advanceTimersByTimeAsync(0)
  return { hush, VisitEnding }
}

function el<T extends HTMLElement = HTMLElement>(selector: string): T {
  const found = document.querySelector<T>(selector)
  if (found === null) throw new Error(`no ${selector}`)
  return found
}

const shown = (panel: string): boolean => !el(`[data-panel="${panel}"]`).hidden
const status = (): string => el('#singStatus').textContent ?? ''
const offered = (): string[] =>
  [
    ...document.querySelectorAll<HTMLButtonElement>(
      '[data-panel="after"] .sing-btns button',
    ),
  ]
    .filter((b) => !b.hidden)
    .map((b) => b.dataset.sing ?? '')
/** The staffs' score: the figure the page mounted. */
const staffs = () => {
  const score = staffsHub.doubles?.scores.at(-1)
  if (score === undefined) throw new Error('no score mounted')
  return score
}

/** A button pressed and everything it starts run out on the fake clock. */
async function press(selector: string, ms = 0): Promise<void> {
  el(selector).click()
  await vi.dynamicImportSettled()
  await vi.advanceTimersByTimeAsync(ms)
}

/** Past the comfort check: headphones on, the briefing; or off, the alone briefing. */
async function toBrief(on = true): Promise<void> {
  await press('[data-comfort="sing"]')
  await press(`[data-phones="${on ? 'on' : 'off'}"]`)
}

/** Start pressed and run out to the open take: the quiet check, do, the quiet and the count-in. */
async function toTake(selector = '[data-panel="start"] [data-sing="start"]') {
  await press(selector, 5_000)
}

/** The latest take ended with `e`, and the half second after it. */
async function endTake(e: TakeEnd): Promise<void> {
  take.ends.at(-1)?.(e)
  await vi.advanceTimersByTimeAsync(600)
}

describe('before the choice and before Start', () => {
  it('waits for the cold open’s choice: the hero’s ten empty bars, and the four plays held under the lock line (FACTS 46)', async () => {
    // Arrange
    let choose: () => void = () => undefined
    await loadCard({
      chosen: new Promise<void>((r) => {
        choose = r
      }),
    })
    const plays = () =>
      [
        ...document.querySelectorAll<HTMLButtonElement>(
          '[data-listen-play], [data-panel="start"] [data-sing="first"], [data-panel="start"] [data-sing="start"], [data-sing="along"]',
        ),
      ].map((b) => b.disabled)
    const before = {
      locked: el('[data-sing-score]').classList.contains('is-locked'),
      line: el('[data-sing-lock]').hidden,
      plays: plays(),
      scenes: staffs().shown.length,
      label: el('[data-sing-score]').getAttribute('aria-label'),
    }

    // Act
    choose()
    await vi.advanceTimersByTimeAsync(0)

    // Assert
    expect(before).toEqual({
      locked: true,
      line: false,
      plays: [true, true, true, true],
      scenes: 0,
      label:
        "The song in two parts, ten bars: Tavi's part above, Merc's below.",
    })
    expect(el('[data-sing-score] .score-locked')).not.toBeNull()
    expect(el('[data-sing-score]').classList.contains('is-locked')).toBe(false)
    expect([el('[data-sing-lock]').hidden, plays()]).toEqual([
      true,
      [false, false, false, false],
    ])
    expect(staffs().last?.scene.staffs.map((s) => s.bars.length)).toEqual([
      8, 8,
    ])
  })

  it('asks the comfort check, then the voice when none is stored, then the headphones, naming the other part', async () => {
    // Arrange
    await loadCard({ voice: null })

    // Act
    await press('[data-comfort="sing"]')
    const voice = [shown('voice'), shown('phones'), status()]
    await press('[data-voice="higher"]')

    // Assert: states 1, 2 and 4; Tavi sings do for the higher voice, Merc's part plays
    expect(voice).toEqual([true, false, "Choose the voice you'll sing with."])
    expect([shown('voice'), shown('phones')]).toEqual([true, true])
    expect(el('[data-panel="phones"]').textContent).toContain("Merc's part")
    expect(el<HTMLImageElement>('.sing-merc').alt).toBe(
      'Tavi, who sings do for the higher voice',
    )
  })

  it('colours the staffs once a voice is chosen: the learner’s part amber, the other part chrome', async () => {
    // Arrange
    await loadCard({ voice: null })
    const before = staffs().last?.scene.staffs.map((s) => s.tone)

    // Act
    await press('[data-comfort="sing"]')
    await press('[data-voice="lower"]')

    // Assert: Merc's staff, the lower, is the learner's
    expect(before).toEqual(['tavi', 'merc'])
    expect(staffs().last?.scene.staffs.map((s) => s.tone)).toEqual([
      'other',
      'learner',
    ])
  })

  it('briefs the alone path after No headphones: no quiet check, Hear Tavi’s part first beside Start, and no microphone asked', async () => {
    // Arrange
    await loadCard()

    // Act
    await toBrief(false)

    // Assert: state 8
    expect([shown('brief'), shown('start'), shown('along')]).toEqual([
      true,
      true,
      false,
    ])
    expect(el('[data-phones-only]').hidden).toBe(true)
    expect(el('[data-panel="start"] [data-sing="first"]').hidden).toBe(false)
    expect(status()).toBe(
      "Read what this does, then press Start, or hear Tavi's part first.",
    )
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
      'Sound is off, so nothing played. Turn sound on to hear do, then press Start.',
    )
    expect([mic.asked, played.runs.length]).toEqual([0, 0])
  })
})

describe('a run with headphones', () => {
  it('checks the quiet over Tavi’s part’s first 2.0 s, sings do, counts in and opens the take with Tavi’s part from bar 1, recording from its open', async () => {
    // Arrange
    const { hush } = await loadCard()
    await toBrief()

    // Act
    await toTake()

    // Assert: states 6 and 7
    expect(mic.asked).toBe(1)
    const tavi = [71, 69, 67, 71, 72, 71, 69, 71, 72, 74, 71, 69, 66, 67]
    const [check, run] = parts.booked
    expect([check.midis, check.at, check.sec]).toEqual([tavi, 0, 2])
    expect(played.runs[0].notes.map((n) => [n.midi, n.dur])).toEqual([[55, 1]])
    expect(clock.runs).toBe(1)
    // the part booked on bar 1's audio time, a bar after the first click
    expect([run.midis, run.sec]).toEqual([tavi, undefined])
    expect(run.at).toBeCloseTo(0.1 + (4 * BEAT_MS) / 1000, 6)
    const c = take.contexts[0]
    expect(c.notes).toHaveLength(14)
    expect(c.notes.slice(0, 3).map((n) => [n.midi, n.beat, n.beats])).toEqual([
      [55, 0, 2],
      [54, 2, 2],
      [52, 4, 2],
    ])
    expect(c.labels.slice(0, 3)).toEqual(['Do', 'Ti', 'La'])
    expect(c.whose).toBe("your part's note")
    expect([c.other?.whose, c.other?.labels.slice(0, 2)]).toEqual([
      "Tavi's",
      ['mi', 're'],
    ])
    expect(c.bpm).toBe(72)
    expect(rec.started).toBe(1)
    // the take keeps the part through its hush
    expect(hush).toHaveBeenLastCalledWith(true, expect.anything())
    expect(status()).toBe('Your turn: sing in time with the cursor.')
  })

  it('draws the pitch line and the lines half a second after the take, keeps the take for its playback, then asks how it felt', async () => {
    // Arrange
    await loadCard()
    await toBrief()
    await toTake()

    // Act
    take.ends.at(-1)?.(VOICED)
    await vi.advanceTimersByTimeAsync(100)
    const soon = el('#singLive').hidden
    await vi.advanceTimersByTimeAsync(500)

    // Assert: states 9 and 10
    expect(soon).toBe(true)
    expect(el('#singLive').hidden).toBe(false)
    expect(take.drawn).toBe(1)
    expect(
      [...document.querySelectorAll('[data-readings] li')].map(
        (li) => li.textContent,
      ),
    ).toEqual(LINES)
    expect([shown('playback'), shown('feel'), status()]).toEqual([
      true,
      true,
      'How did that feel?',
    ])
    expect(el('[data-sing="playback"]').hidden).toBe(false)
    expect(rec.stopped).toBe(1)
    // the recording read round where the frames heard the first note: 0.25 s after bar 1, half a beat after the open
    expect(take.spans[0]).toEqual({ from: 0, to: expect.closeTo(1.667, 3) })
    expect(parts.booked[1].stopped).toBe(true)
  })

  it('plays the take back with Tavi’s part, lined up on when the singer came in; Delete drops it and keeps the lines', async () => {
    // Arrange
    await loadCard()
    await toBrief()
    await toTake()
    await endTake(VOICED)

    // Act
    await press('[data-sing="playback"]', 100)
    const playing = rec.plays[0]
    const said = status()
    playing.end(true)
    await vi.advanceTimersByTimeAsync(100)
    await press('[data-sing="delete"]')
    await press('[data-sing="playback"]', 100)

    // Assert: The playback; Tests 10
    expect(playing.part.onset).toBe(0.25)
    expect(playing.part.seconds).toBeCloseTo(26.667, 3)
    expect(playing.take.voicedAt).toBe(0.6)
    expect(said).toBe("Your take with Tavi's part.")
    expect(rec.plays).toHaveLength(1)
    expect(el('[data-sing="playback"]').hidden).toBe(true)
    expect(el('#singLive').hidden).toBe(false)
    expect(status()).toBe('Your take is deleted. The lines stay.')
  })

  it('says a take this browser could not keep has no playback, with the can’t-record line', async () => {
    // Arrange
    rec.keep = false
    await loadCard()
    await toBrief()
    await toTake()

    // Act
    await endTake(VOICED)

    // Assert
    expect(el('[data-sing="playback"]').hidden).toBe(true)
    expect(el('[data-cant-record]').hidden).toBe(false)
  })

  it('stops before the run when the quiet check hears a note: its line over Start, beside No headphones, and the microphone let go', async () => {
    // Arrange
    await loadCard()
    await toBrief()
    take.heard = true

    // Act
    await press('[data-panel="start"] [data-sing="start"]', 3000)

    // Assert: state 6
    expect([shown('phones'), shown('start'), shown('along')]).toEqual([
      true,
      true,
      false,
    ])
    expect(el('[data-quiet-failed]').hidden).toBe(false)
    expect(status()).toBe(
      "The microphone heard a note during Tavi's part. Check your headphones, or choose No headphones to sing alone.",
    )
    expect(played.runs).toHaveLength(0)
    expect(mic.released).toBeGreaterThan(0)
  })

  it('gives the no-voice line with Start again and no question, records nothing, three takes a visit', async () => {
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

    // Assert: FACTS 65
    expect(first).toEqual([false, ['restart', 'today']])
    expect(el('[data-after="silent"]').hidden).toBe(false)
    expect(offered()).toEqual(['today'])
    expect(status()).toBe("That's every take this visit has.")
    expect([rec.stopped, rec.discarded]).toEqual([0, 3])
  })

  it('sings Again with the quiet check first, its take in the last one’s place', async () => {
    // Arrange
    await loadCard()
    await toBrief()
    await toTake()
    await endTake(VOICED)

    // Act
    await press('[data-feel="easy"]')
    const after = [offered(), status()]
    await toTake('[data-sing="again"]')

    // Assert: FACTS 65; state 10
    expect(after).toEqual([
      ['again', 'today'],
      'Your part, read in time from the page.',
    ])
    // the second quiet check, then the second run's part
    expect(parts.booked.map((b) => b.sec)).toEqual([2, undefined, 2, undefined])
    expect(take.contexts).toHaveLength(2)
    expect(el('[data-sing="playback"]').hidden).toBe(true)
  })

  it('keeps the lines and the take after Effortful, offering only Done for today, with the rest card', async () => {
    // Arrange
    const { VisitEnding } = await loadCard()
    await toBrief()
    await toTake()
    await endTake(VOICED)

    // Act
    await press('[data-feel="effortful"]')

    // Assert: FACTS 65
    expect(offered()).toEqual(['today'])
    expect(el('#singLive').hidden).toBe(false)
    expect([shown('playback'), el('[data-sing="playback"]').hidden]).toEqual([
      true,
      false,
    ])
    expect(status()).toBe('Keep it gentle: rest before you sing again.')
    expect(VisitEnding.ending).toBe('rest')
  })

  it('takes the lines away after Uncomfortable, keeps the take, gives the doctor lines and lets the microphone go', async () => {
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
    expect(shown('playback')).toBe(true)
    expect(mic.released).toBeGreaterThanOrEqual(released)
    expect(VisitEnding.ending).toBe('rest')
  })

  it('holds every other play on the page from Start until the run ends', async () => {
    // Arrange
    await loadCard()
    await toBrief()
    const block = document.createElement('button')
    block.dataset.formBlock = '1'
    document.body.append(block)

    // Act
    await toTake()
    const during = block.disabled
    await endTake(VOICED)

    // Assert: WEB-SPEC, Audio
    expect([during, block.disabled]).toEqual([true, false])
  })
})

describe('the alone path', () => {
  it('runs with no quiet check and nothing under the take, the reader given no other part', async () => {
    // Arrange
    const { hush } = await loadCard()
    await toBrief(false)

    // Act
    await toTake()

    // Assert: state 8
    expect(parts.booked).toHaveLength(0)
    expect(take.contexts[0].other).toBeUndefined()
    expect(hush).toHaveBeenLastCalledWith(true, null)
    expect(status()).toBe('Your turn: sing in time with the cursor.')
  })

  it('plays Tavi’s part first, alone, asking and recording nothing, and offers it again after a run', async () => {
    // Arrange
    await loadCard()
    await toBrief(false)

    // Act
    await press('[data-panel="start"] [data-sing="first"]', 100)
    const said = status()
    const first = played.runs[0].notes.map((n) => n.midi)
    await vi.advanceTimersByTimeAsync(27_000)
    const after = status()
    await toTake()
    await endTake(SILENT)

    // Assert: Tests 12
    expect(said).toBe("Tavi's part alone. Nothing listens.")
    expect(first).toEqual([
      71, 69, 67, 71, 72, 71, 69, 71, 72, 74, 71, 69, 66, 67,
    ])
    expect(after).toBe(
      "Read what this does, then press Start, or hear Tavi's part first.",
    )
    expect(offered()).toEqual(['restart', 'first', 'today'])
    expect(rec.stopped).toBe(0)
  })
})

describe('the sing-along and listening', () => {
  it('opens the sing-along for a refused microphone: do, the count-in and Tavi’s part, asking nothing more, its Again once a visit', async () => {
    // Arrange
    mic.refuse = true
    await loadCard()
    await toBrief()
    await press('[data-panel="start"] [data-sing="start"]', 100)
    const opened = shown('along')

    // Act
    await press('[data-sing="along"]', 32_000)
    const asked = shown('feel')
    await press('[data-feel="easy"]')
    const first = offered()
    await press('[data-sing="along-again"]', 32_000)
    await press('[data-feel="workable"]')

    // Assert: state 11; FACTS 64
    expect([opened, asked]).toEqual([true, true])
    expect(mic.asked).toBe(1)
    expect(played.runs[0].notes.map((n) => n.midi)).toEqual([55])
    expect(parts.booked[0].midis).toHaveLength(14)
    expect(first).toEqual(['along-again', 'today'])
    expect(offered()).toEqual(['today'])
  })

  it('shows no voice choice, headphones check, Start or sing-along after Just listen today, and plays the song’s bars 1 to 8', async () => {
    // Arrange
    const { VisitEnding } = await loadCard()

    // Act
    await press('[data-comfort="listen"]')
    const panels = ['voice', 'phones', 'brief', 'start', 'along'].map(shown)
    await press('[data-listen-play]', 100)

    // Assert: state 3; REQ-GVC-055
    expect(shown('listen')).toBe(true)
    expect(panels).toEqual([false, false, false, false, false])
    expect(played.runs[0].notes).toHaveLength(28)
    expect(
      Math.max(...played.runs[0].notes.map((n) => n.t + n.dur)),
    ).toBeCloseTo(26.667, 3)
    expect([mic.asked, VisitEnding.ending]).toEqual([0, 'rest'])
    expect(staffs().last?.scene.staffs.map((s) => s.tone)).toEqual([
      'tavi',
      'merc',
    ])
  })
})
