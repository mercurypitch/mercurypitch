// ============================================================
// Lesson 24 Sing it tests — the plan, the sets, the quiet check and the sing-along
// ============================================================
//
// WEB-SPEC, Toys 6 and Audio, and FACTS 55 to 59: the plan (two sets, do so
// mi for five seconds then so and mi for ten, the rest card after
// "Effortful", Move do five higher and none lower, every preset of each
// voice at least two semitones inside), the summary's words; and on
// learn/24.html's own markup, with the listener and the runs doubles:
// Move do's readout and ends; "No headphones" opens the sing-along and asks
// for nothing; with sound off Start asks for nothing and says why; Start
// asks once, the quiet check plays the drone on do for two seconds and,
// hearing nothing, the set runs, each hold after its model note with the
// drone kept through the take; a quiet check that heard a note releases the
// microphone and opens the sing-along with Start under it; a hold with no
// voice ends the set; what follows each answer to "How did that feel?",
// the celebration once, the summary after the second set, the rest card;
// from Start until a set ends every other play waits; the sing-along sings
// each note alone, then the drone, Again once a visit; and "Just listen
// today"'s play waits for Step 2's choice.

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import type * as ListenModule from '@/features/lessons/kit/listen'
import type * as MercDuoModule from '@/features/lessons/kit/merc-duo'
import type * as MotionModule from '@/features/lessons/kit/motion-switch'
import { hz } from '@/features/lessons/kit/notes'
import type * as RunModule from '@/features/lessons/kit/run'
import type { RunLine, RunOptions } from '@/features/lessons/kit/run'
import type { Voice } from '@/features/lessons/kit/voice-choice'
import type { F0Frame } from '@/lib/mirror/metrics'
import type { VocalRangePreset } from '@/stores/settings-store'
import { VOCAL_RANGES } from '@/stores/settings-store'
import { heldNotes, PLAN, START_SOUND_OFF, STATUS } from './sing'
import { DO, doOf, MOVE_REACH, noteOf, SETS, setSummary } from './sing-plan'

const PAGE = readFileSync(resolve(process.cwd(), 'learn/24.html'), 'utf8')

const mic = vi.hoisted(() => ({
  /** Times the page asked for the microphone, and released it. */
  asked: 0,
  released: 0,
  /** The microphone refused. */
  refuse: false,
  /** What the quiet check hears. */
  quiet: [] as readonly unknown[],
  /** The frames each take hears, in turn; null, a take cut short. */
  takes: [] as (readonly unknown[] | null)[],
  /** Runs as a take opens, before its frames come. */
  opening: null as (() => void) | null,
}))

vi.mock('@/features/lessons/kit/listen', async (importOriginal) => {
  const real = await importOriginal<typeof ListenModule>()
  return {
    ...real,
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
    framesFor: () => Promise.resolve(mic.quiet),
    takeFrames: () => {
      mic.opening?.()
      return Promise.resolve(mic.takes.shift() ?? null)
    },
  }
})
// every run the page starts, timed on the fake clock and silent
const played = vi.hoisted(() => ({
  runs: [] as { lines: readonly RunLine[]; o: RunOptions; stopped: boolean }[],
}))
vi.mock('@/features/lessons/kit/run', async (actual) => ({
  ...(await actual<typeof RunModule>()),
  playLines: (lines: readonly RunLine[], o: RunOptions) => {
    const run = { lines, o, stopped: false }
    played.runs.push(run)
    const end = Math.max(...lines.map((l) => l.t + (l.points.at(-1)?.t ?? 0)))
    let settle: (heard: boolean) => void = () => undefined
    const done = new Promise<boolean>((r) => {
      settle = r
    })
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
const duo = vi.hoisted(() => ({ cheers: [] as string[] }))
vi.mock('@/features/lessons/kit/merc-duo', async (actual) => ({
  ...(await actual<typeof MercDuoModule>()),
  mercCelebrate: (which: string) => {
    duo.cheers.push(which)
  },
  mercSing: () => undefined,
  mercListen: () => undefined,
}))
vi.mock('@/features/lessons/kit/motion-switch', async (actual) => {
  await import('@/features/lessons/kit/browser-doubles.test-fixtures')
  return {
    ...(await actual<typeof MotionModule>()),
    reducedMotion: vi.fn(() => true),
  }
})

/** `voice` seconds of a steady note at `freq` after half a second of quiet, then quiet, 16 ms a frame. */
function sung(freq: number, voice: number): F0Frame[] {
  const frames: (F0Frame & { rms: number })[] = []
  for (let k = 0; k * 0.016 < voice + 1.1; k++) {
    const t = k * 0.016
    const on = t >= 0.5 && t < 0.5 + voice
    frames.push({
      t,
      f0: on ? freq : 0,
      conf: on ? 0.95 : 0,
      rms: on ? 0.1 : 0,
    })
  }
  return frames
}

/** Two seconds of quiet, or with a voiced run of `run` seconds in it. */
function quiet(run = 0): F0Frame[] {
  return sung(220, run).filter((f) => f.t < 2)
}

/** The takes of a set sung in tune, each note on its own pitch, for the lower voice on D. */
const inTune = (n: 1 | 2): F0Frame[][] =>
  SETS[n].notes.map((d) => sung(hz(noteOf('lower', 0, d)), SETS[n].sec))

beforeEach(() => {
  mic.asked = 0
  mic.released = 0
  mic.refuse = false
  mic.quiet = quiet()
  mic.takes = []
  mic.opening = null
  played.runs.length = 0
  duo.cheers.length = 0
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  document.body.textContent = ''
  localStorage.clear()
})

describe("Sing it's plan", () => {
  it('holds do, so and mi for five seconds, then so and mi for ten, the rest card after Effortful', () => {
    // Assert: WEB-SPEC, Toys 6; FACTS 55
    expect(PLAN).toEqual({
      lengths: [5, 10],
      restAfterEffort: true,
      sets: true,
    })
    expect(SETS).toEqual({
      1: { notes: ['do', 'so', 'mi'], sec: 5 },
      2: { notes: ['so', 'mi'], sec: 10 },
    })
  })

  it('puts do on D3 or D4, so a fifth and mi a major third above, and moves them up to G, never lower', () => {
    // Assert: FACTS 56, 57
    expect(DO).toEqual({ lower: 50, higher: 62 })
    expect(MOVE_REACH).toEqual({ lower: 0, higher: 5 })
    expect(
      ['do', 'so', 'mi'].map((d) => noteOf('lower', 0, d as 'do')),
    ).toEqual([50, 57, 54])
    expect([doOf('lower', 9), doOf('higher', -3)]).toEqual([55, 62])
  })

  it('keeps every preset of each voice at least two semitones inside, do moved up to five', () => {
    // Arrange: each voice's presets, as the table names them
    const PRESETS: Readonly<Record<Voice, readonly VocalRangePreset[]>> = {
      lower: ['bass', 'baritone', 'tenor'],
      higher: ['alto', 'mezzo-soprano', 'soprano'],
    }

    // Act: semitones to spare under do on D and over so with do on G
    const spare = (v: Voice): number[] =>
      PRESETS[v].flatMap((preset) => [
        noteOf(v, 0, 'do') - VOCAL_RANGES[preset].lowMidi,
        VOCAL_RANGES[preset].highMidi - noteOf(v, 5, 'so'),
      ])

    // Assert: FACTS 57
    for (const v of ['lower', 'higher'] as const)
      for (const room of spare(v)) expect(room, v).toBeGreaterThanOrEqual(2)
  })

  it("sums up the ten-second set's two holds, naming one it could not read, and says nothing with neither read", () => {
    // Arrange
    const read = (inBand: number) => ({ inBand, length: 10 })

    // Assert: WEB-SPEC, Toys 6, the set's rules
    expect(
      setSummary([
        { d: 'so', read: read(9.1) },
        { d: 'mi', read: read(8.6) },
      ]),
    ).toBe(
      'This time the middle of your line was in the band for 9.1 of 10 seconds on so, then 8.6 on mi.',
    )
    expect(
      setSummary([
        { d: 'so', read: read(9.1) },
        { d: 'mi', read: null },
      ]),
    ).toBe(
      'This time the middle of your line was in the band for 9.1 of 10 seconds on so; there was no reading on mi.',
    )
    expect(
      setSummary([
        { d: 'so', read: null },
        { d: 'mi', read: read(10) },
      ]),
    ).toBe(
      'This time the middle of your line was in the band for 10 of 10 seconds on mi; there was no reading on so.',
    )
    expect(
      setSummary([
        { d: 'so', read: null },
        { d: 'mi', read: null },
      ]),
    ).toBeNull()
    expect(heldNotes(['so', 'mi'], [])).toEqual([
      { d: 'so', read: null },
      { d: 'mi', read: null },
    ])
  })
})

/** The page's card on its own markup, the lower voice stored unless `voice` is null. */
async function loadCard(o: { on?: boolean; voice?: Voice | null } = {}) {
  vi.resetModules()
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  if (o.voice !== null)
    localStorage.setItem('fyp-voice', JSON.stringify(o.voice ?? 'lower'))
  const { Sound } = await import('@/features/lessons/kit/sound')
  const { NowPlaying } = await import('@/features/lessons/kit/now-playing')
  const { VisitEnding } = await import('@/features/lessons/kit/comfort')
  const { initSing } = await import('./sing')
  // the take's chunks, loaded now so its own imports of them resolve at once
  await import('@/features/lessons/kit/listen')
  await import('@/features/lessons/kit/hold-take')
  await import('@/features/lessons/kit/hold-centre')
  const body = /<body[^>]*>([\s\S]*)<\/body>/.exec(PAGE)
  if (body === null) throw new Error('learn/24.html has no body')
  document.body.innerHTML = body[1]
  const sing = initSing({ blue: 'blue.png', orange: 'orange.png' })
  vi.spyOn(Sound, 'context').mockReturnValue({} as AudioContext)
  const canPlay = vi.spyOn(Sound, 'canPlay').mockReturnValue(o.on ?? true)
  const drones: { hz: number; stopped: number | null }[] = []
  vi.spyOn(Sound, 'voice').mockImplementation((freq: number) => {
    const d = { hz: freq, stopped: null as number | null }
    drones.push(d)
    return {
      stop: (release = 0) => {
        d.stopped = release
      },
    } as unknown as ReturnType<typeof Sound.voice>
  })
  const hush = vi.spyOn(Sound, 'hush').mockReturnValue(true)
  return { sing, canPlay, drones, hush, NowPlaying, VisitEnding }
}

function el<T extends HTMLElement = HTMLElement>(selector: string): T {
  const found = document.querySelector<T>(selector)
  if (found === null) throw new Error(`no ${selector}`)
  return found
}

const shown = (panel: string) => !el(`[data-panel="${panel}"]`).hidden
const status = () => el('#singStatus').textContent ?? ''

/** A button pressed and everything it starts run out on the fake clock. */
async function press(selector: string, ms = 40_000): Promise<void> {
  el(selector).click()
  await vi.dynamicImportSettled()
  await vi.advanceTimersByTimeAsync(ms)
}

/** Past the comfort check and Move do, headphones on: the briefing. */
async function toBrief(): Promise<void> {
  el('[data-comfort="sing"]').click()
  el('[data-phones="on"]').click()
  await Promise.resolve()
}

/** The set's model notes, in order: their MIDI notes and levels. */
const models = () =>
  played.runs
    .filter((r) => r.o.gain === 0.2)
    .map((r) => Math.round(12 * Math.log2(r.lines[0].points[0].hz / 440) + 69))

describe('before Start', { timeout: 15_000 }, () => {
  it('offers Move do and the headphones after "I\'m comfortable", do on D, "lower" at its end, up to G', async () => {
    // Arrange
    await loadCard()
    el('[data-comfort="sing"]').click()
    const lower = el('[data-move-do="-1"]')
    const higher = el('[data-move-do="1"]')
    const before = [
      el('[data-do-now]').textContent,
      lower.getAttribute('aria-disabled'),
    ]

    // Act
    for (let i = 0; i < 7; i++) higher.click()
    lower.click()

    // Assert: FACTS 57, never `disabled`
    expect(shown('prepare')).toBe(true)
    expect(before).toEqual(['Do: D3', 'true'])
    // its sign said in words for a screen reader, beside the sign it shows
    expect(el('[data-do-now]').textContent).toBe('Do: F♯ sharp 3')
    expect([
      lower.hasAttribute('disabled'),
      higher.hasAttribute('disabled'),
    ]).toEqual([false, false])
  })

  it('opens the sing-along after "No headphones", asking for no microphone', async () => {
    // Arrange
    await loadCard()
    el('[data-comfort="sing"]').click()

    // Act
    el('[data-phones="off"]').click()

    // Assert: FACTS 51
    expect(shown('along')).toBe(true)
    expect(el('[data-quiet-failed]').hidden).toBe(true)
    expect(el('[data-start-again]').hidden).toBe(true)
    expect(mic.asked).toBe(0)
    expect(status()).toBe(STATUS.along)
  })

  it('asks for nothing with sound off at Start, and says why under it', async () => {
    // Arrange
    await loadCard({ on: false })
    await toBrief()

    // Act
    await press('[data-panel="brief"] [data-sing="start"]')

    // Assert: WEB-SPEC, Toys 6, state 5
    expect(mic.asked).toBe(0)
    expect(el('[data-start-hint]').textContent).toBe(START_SOUND_OFF)
    expect(played.runs).toHaveLength(0)
  })
})

describe('a set', { timeout: 15_000 }, () => {
  it('checks the quiet first: the drone on do for two seconds, nothing else, then each hold after its model note, the drone kept through the take', async () => {
    // Arrange
    const { drones, hush } = await loadCard()
    await toBrief()
    mic.takes = inTune(1)

    // Act
    await press('[data-panel="brief"] [data-sing="start"]')

    // Assert: the quiet check's drone, then a drone on D3 under each hold, each released over 0.3 s
    expect(mic.asked).toBe(1)
    expect(drones.map((d) => Math.round(d.hz * 100) / 100)).toEqual([
      146.83, 146.83, 146.83, 146.83,
    ])
    expect(drones.map((d) => d.stopped)).toEqual([0.3, 0.3, 0.3, 0.3])
    expect(hush.mock.calls[0]).toEqual([true, expect.anything()])
    expect(models()).toEqual([50, 57, 54])
    expect(
      played.runs.every((r) => r.lines.every((l) => l.vibrato === null)),
    ).toBe(true)
    expect(shown('feel')).toBe(true)
    expect(status()).toMatch(/^Mi, F♯3\. In the band for all 5 seconds\./)
    expect(status()).toMatch(/How did that feel\?$/)
    expect(mic.released).toBeGreaterThan(0)
  })

  it('opens the sing-along when the quiet check heard a note, with Start under it, the microphone let go', async () => {
    // Arrange
    await loadCard()
    await toBrief()
    mic.quiet = quiet(0.5)

    // Act
    await press('[data-panel="brief"] [data-sing="start"]')

    // Assert: FACTS 52
    expect(shown('along')).toBe(true)
    expect(el('[data-quiet-failed]').hidden).toBe(false)
    expect(el('[data-start-again]').hidden).toBe(false)
    expect(status()).toBe(STATUS.heard)
    expect(models()).toEqual([])
    expect(mic.released).toBeGreaterThan(0)
  })

  it('ends the set at a hold with no voice, asks how it felt since do was sung, and offers Again but never the next set', async () => {
    // Arrange
    await loadCard()
    await toBrief()
    mic.takes = [inTune(1)[0], quiet()]

    // Act
    await press('[data-panel="brief"] [data-sing="start"]')
    el('[data-feel="easy"]').click()

    // Assert: WEB-SPEC, Toys 6, the set's rules
    expect(models()).toEqual([50, 57])
    expect(el('[data-panel="after"] [data-sing="hold2"]').hidden).toBe(true)
    expect(el('[data-panel="after"] [data-sing="again"]').hidden).toBe(false)
    expect(el('[data-panel="after"] [data-sing="today"]').hidden).toBe(false)
    expect(duo.cheers).toEqual([])
  })

  it('holds every other play on the page while it runs, and gives back only what it held', async () => {
    // Arrange
    await loadCard()
    await toBrief()
    mic.takes = inTune(1)
    const word = el<HTMLButtonElement>('[data-word-play="drone"]')
    const pure = el<HTMLButtonElement>('[data-word-play="pure"]')
    let during: boolean[] = []
    mic.opening = () => {
      during = [word.disabled, pure.disabled]
    }

    // Act
    await press('[data-panel="brief"] [data-sing="start"]')

    // Assert: WEB-SPEC, Audio, rule 4
    expect(during).toEqual([true, true])
    expect([word.disabled, pure.disabled]).toEqual([false, true])
  })
})

describe('after a set', { timeout: 20_000 }, () => {
  it('celebrates a set read whole and in the band, once, and offers the ten-second set, Again and Done for today', async () => {
    // Arrange
    await loadCard()
    await toBrief()
    mic.takes = inTune(1)
    await press('[data-panel="brief"] [data-sing="start"]')

    // Act
    el('[data-feel="workable"]').click()

    // Assert
    expect(duo.cheers).toEqual(['blue'])
    expect(el('[data-closing="rest"]').hidden).toBe(false)
    expect(el('[data-sing="hold2"]').hidden).toBe(false)
    expect(el('[data-panel="after"] [data-sing="again"]').hidden).toBe(false)
    expect(status()).toBe(STATUS.rest)
  })

  it('sums up the ten-second set after it, with Again and Done for today', async () => {
    // Arrange
    await loadCard()
    await toBrief()
    mic.takes = inTune(1)
    await press('[data-panel="brief"] [data-sing="start"]')
    el('[data-feel="easy"]').click()
    mic.takes = inTune(2)

    // Act
    await press('[data-sing="hold2"]', 60_000)
    el('[data-feel="easy"]').click()

    // Assert: a second quiet check, then so and mi for ten seconds
    expect(models()).toEqual([50, 57, 54, 57, 54])
    expect(el('[data-summary]').textContent).toBe(
      'This time the middle of your line was in the band for 10 of 10 seconds on so, then 10 on mi.',
    )
    expect(el('[data-panel="after"] [data-sing="done"]').hidden).toBe(false)
    expect(duo.cheers).toEqual(['blue', 'blue'])
  })

  it('keeps it gentle after Effortful: no more holds, only Done for today, and the rest card', async () => {
    // Arrange
    const { VisitEnding } = await loadCard()
    await toBrief()
    mic.takes = inTune(1)
    await press('[data-panel="brief"] [data-sing="start"]')

    // Act
    el('[data-feel="effortful"]').click()

    // Assert
    expect(el('[data-closing="gentle"]').hidden).toBe(false)
    expect(el('[data-sing="hold2"]').hidden).toBe(true)
    expect(el('[data-panel="after"] [data-sing="again"]').hidden).toBe(true)
    expect(el('[data-panel="after"] [data-sing="today"]').hidden).toBe(false)
    expect(VisitEnding.ending).toBe('rest')
    expect(duo.cheers).toEqual([])
  })

  it('takes the readings away after Uncomfortable, with the doctor lines and no more singing', async () => {
    // Arrange
    const { VisitEnding } = await loadCard()
    await toBrief()
    mic.takes = inTune(1)
    await press('[data-panel="brief"] [data-sing="start"]')

    // Act
    el('[data-feel="uncomfortable"]').click()

    // Assert
    expect(el('#singLive').hidden).toBe(true)
    expect(el('[data-after-doctor]').hidden).toBe(false)
    expect(status()).toBe(STATUS.enough)
    expect(VisitEnding.ending).toBe('rest')
  })
})

describe('the sing-along', { timeout: 15_000 }, () => {
  it('sings each note alone, then the drone with the singer for five seconds, nothing listening, Again once a visit', async () => {
    // Arrange
    await loadCard()
    el('[data-comfort="sing"]').click()
    el('[data-phones="off"]').click()

    // Act
    await press('[data-sing="along"]')
    el('[data-feel="easy"]').click()
    const again = !el('[data-sing="along-again"]').hidden
    await press('[data-sing="along-again"]')
    el('[data-feel="easy"]').click()

    // Assert: FACTS 59, 70
    expect(mic.asked).toBe(0)
    const drones = played.runs.filter((r) => r.o.gain === 0.1)
    expect(
      drones.map((r) => [r.lines[0].points[0].hz, r.lines[0].points[1].t]),
    ).toEqual(Array.from({ length: 6 }, () => [expect.closeTo(146.83, 2), 5]))
    expect(models()).toEqual([50, 57, 54, 50, 57, 54])
    expect(again).toBe(true)
    expect(el('[data-closing="along"]').hidden).toBe(false)
    expect(el('[data-sing="along-again"]').hidden).toBe(true)
  })
})

describe('just listening', { timeout: 15_000 }, () => {
  it("holds Merc's notes over the drone until Step 2's choice, then plays each alone and then with the drone", async () => {
    // Arrange
    const { sing, VisitEnding } = await loadCard()
    el('[data-comfort="listen"]').click()
    const play = el<HTMLButtonElement>('[data-listen-play]')
    const held = [play.disabled, el('[data-listen-lock]').hidden]

    // Act
    sing.unlockListen()
    await press('[data-listen-play]')

    // Assert: FACTS 46; do, so, mi, each 2 s alone, then 5 s with the drone from one onset
    expect(held).toEqual([true, false])
    expect(shown('listen')).toBe(true)
    expect(VisitEnding.ending).toBe('rest')
    const lines = played.runs[0].lines
    expect(
      lines.map((l) => [l.t, Math.round(l.points[0].hz * 100) / 100]),
    ).toEqual([
      [0, 146.83],
      [2, 146.83],
      [2, 146.83],
      [7, 220],
      [9, 220],
      [9, 146.83],
      [14, 185],
      [16, 185],
      [16, 146.83],
    ])
    expect(mic.asked).toBe(0)
  })
})
