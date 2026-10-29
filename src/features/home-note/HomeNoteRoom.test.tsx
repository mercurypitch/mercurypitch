import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MERC_FEET } from '@/components/room-kit/MercView'
import type * as CaptureModule from '@/components/room-kit/useExerciseCapture'
import { midiToF0 } from '@/lib/glass/test-frames'
import type { PitchFrame } from '@/lib/pitch-f0-stream'
import { setExerciseLevel } from '@/stores/exercise-level'
import { LANDSCAPE_PLATE_MEDIA, layoutHarbour } from './harbour-layout'
import type { HomeRound } from './home-note-round'
import type { HomeNoteLevel } from './home-note-rules'
import { BETWEEN_ROUNDS_MS, HOME_NOTE_ROUNDS } from './home-note-rules'

// ── A capture the test feeds by hand ────────────────────────────

const fake = vi.hoisted(() => ({
  frames: [] as PitchFrame[],
  acquireError: null as Error | null,
  windows: 0,
  /** When the room's last capture window opened, fake performance ms. */
  windowAt: 0,
  released: 0,
}))

/** The audio clock: the fake performance clock, in seconds. */
const clock = {
  get currentTime(): number {
    return performance.now() / 1000
  },
  outputLatency: 0,
  baseLatency: 0,
  state: 'running',
} as unknown as AudioContext

vi.mock('@/components/room-kit/useExerciseCapture', async () => {
  const actual = await vi.importActual<typeof CaptureModule>(
    '@/components/room-kit/useExerciseCapture',
  )
  return {
    ...actual,
    useExerciseCapture: () => ({
      acquire: () =>
        fake.acquireError === null
          ? Promise.resolve()
          : Promise.reject(fake.acquireError),
      release: () => {
        fake.released += 1
      },
      held: () => true,
      startWindow: () => {
        fake.windows += 1
        fake.windowAt = performance.now()
        fake.frames = []
      },
      peekFrames: () => fake.frames.slice(),
      takeFrames: () => {
        const taken = fake.frames
        fake.frames = []
        return taken
      },
      playTone: () => Promise.resolve(),
      audio: () => Promise.resolve(clock),
    }),
  }
})

// ── The band, as calls the test can read ───────────────────────

/** The intro's length on the fake clock, s. */
const INTRO_SECONDS = 2

const band = vi.hoisted(() => ({
  intros: [] as { home: number; level: string }[],
  resolves: [] as { home: number; withMerc: boolean }[],
  stopped: 0,
}))

vi.mock('@/components/room-kit/round-voice', () => ({
  SYNTH_VOICE: {
    sing: () => ({ onsets: [], endAt: 0, stop: () => undefined }),
  },
  outputLatency: () => 0,
}))

vi.mock('./home-note-band', () => ({
  playIntro: (ctx: AudioContext, round: HomeRound, level: HomeNoteLevel) => {
    band.intros.push({ home: round.home, level: level.intro.join(' ') })
    return {
      endAt: ctx.currentTime + INTRO_SECONDS,
      stop: () => {
        band.stopped += 1
      },
    }
  },
  playResolve: (ctx: AudioContext, round: HomeRound, answer: unknown) => {
    band.resolves.push({ home: round.home, withMerc: answer !== null })
    return { endAt: ctx.currentTime + 1.5, stop: () => undefined }
  },
}))

vi.mock('@/lib/merc/stage', () => ({
  mountMercStage: () => ({
    ok: true,
    setState: () => undefined,
    setVoice: () => undefined,
    setPaused: () => undefined,
    destroy: () => undefined,
  }),
}))

const recorded = vi.hoisted(() => ({ calls: [] as unknown[] }))
vi.mock('@/stores/exercise-history-store', () => ({
  recordExerciseResult: (entry: unknown) => recorded.calls.push(entry),
}))

vi.mock('@/db/services/voiceprint-service', () => ({
  loadLocalVoiceprints: () => [],
}))

// ── Frames the test advances one at a time ─────────────────────

let rafQueue: FrameRequestCallback[] = []

function flushFrame(): void {
  const due = rafQueue
  rafQueue = []
  for (const callback of due) callback(performance.now())
}

/** What the mic hears now: a note, silence, or nothing at all. */
let source: ((t: number) => PitchFrame) | null = null

/** Sing `midi` from now on. */
function singing(midi: number): void {
  source = (t) => ({ t, f0: midiToF0(midi), conf: 0.9, rms: 0.6 })
}

/** Stay silent from now on. */
function silent(): void {
  source = (t) => ({ t, f0: 0, conf: 0, rms: 0.001 })
}

/**
 * Advance the clocks by `ms`, a 60 Hz frame at a time: the mic hears its
 * frame on the room's window clock, then the screen draws.
 */
function run(ms: number): void {
  for (let t = 0; t < ms; t += 1000 / 60) {
    vi.advanceTimersByTime(1000 / 60)
    if (source !== null) {
      fake.frames.push(source((performance.now() - fake.windowAt) / 1000))
    }
    flushFrame()
  }
}

async function settle(): Promise<void> {
  for (let i = 0; i < 6; i++) await Promise.resolve()
}

const { HomeNoteRoom } = await import('./HomeNoteRoom')

function phase(): string | null {
  return screen.getByTestId('home-note-room').getAttribute('data-phase')
}

/** The home of the round on screen, from the band's last intro. */
function home(): number {
  const last = band.intros[band.intros.length - 1]
  if (last === undefined) throw new Error('No intro has played.')
  return last.home
}

/** Tap the mic and let it open; the first intro starts. */
async function startRun(): Promise<void> {
  fireEvent.click(screen.getByTestId('home-note-mic'))
  await settle()
}

/** Past the intro and the gate, the singer quiet: the singer's turn. */
function toTurn(): void {
  silent()
  run(INTRO_SECONDS * 1000 + 300)
  expect(phase()).toBe('sing')
}

describe('Home note', () => {
  beforeEach(() => {
    vi.useFakeTimers({
      toFake: ['setTimeout', 'clearTimeout', 'performance'],
    })
    setExerciseLevel('singer')
    fake.frames = []
    fake.acquireError = null
    fake.windows = 0
    fake.released = 0
    band.intros = []
    band.resolves = []
    band.stopped = 0
    recorded.calls = []
    localStorage.removeItem('mp_home_note_bests')
    rafQueue = []
    source = null
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      rafQueue.push(cb)
      return rafQueue.length
    })
    vi.stubGlobal('cancelAnimationFrame', () => undefined)
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe(): void {}
        unobserve(): void {}
        disconnect(): void {}
      },
    )
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('opens at rest, on the dark stage, with Merc saying the task', () => {
    render(() => <HomeNoteRoom onDone={() => undefined} />)
    expect(phase()).toBe('intro')
    expect(screen.getByTestId('home-note-room').classList).toContain(
      'mp-dark-stage',
    )
    expect(screen.getByTestId('home-note-bubble').textContent).toMatch(/home/i)
    expect(screen.getByTestId('home-note-level')).toBeTruthy()
    expect(screen.getByTestId('home-note-mic').getAttribute('aria-label')).toBe(
      'Start: hear the band, then sing home',
    )
  })

  it('plays the intro, then hears the singer land home', async () => {
    render(() => <HomeNoteRoom onDone={() => undefined} />)
    await startRun()
    expect(phase()).toBe('band')
    expect(band.intros).toHaveLength(1)
    // Singer: three chords, nobody singing home first.
    expect(band.intros[0].level).toBe('I IV V')
    // The mic waits through the intro.
    expect(screen.getByTestId('home-note-mic').dataset.state).toBe('wait')

    toTurn()
    expect(screen.getByTestId('home-note-mic').dataset.state).toBe('sing')
    expect(screen.getByTestId('home-note-chip').textContent).toBe('Your turn')

    // Home, an octave under: it still lands.
    singing(home() - 12)
    run(600)
    expect(phase()).toBe('landed')
    expect(band.resolves).toEqual([{ home: home(), withMerc: false }])
    expect(screen.getByTestId('home-note-chip').textContent).toMatch(/^Home: /)
  })

  it('hears nothing sung over the intro', async () => {
    render(() => <HomeNoteRoom onDone={() => undefined} />)
    await startRun()
    // Home, sung before the band has stopped: not a landing.
    singing(home())
    run(1600)
    expect(phase()).toBe('band')
  })

  it('lands a voice that hummed along with the intro and carried on into the turn', async () => {
    render(() => <HomeNoteRoom onDone={() => undefined} />)
    await startRun()
    singing(home())
    // Through the intro: heard, but never judged.
    run(INTRO_SECONDS * 1000)
    expect(phase()).toBe('band')
    // The turn opens on a voice already on home, and it lands.
    run(700)
    expect(phase()).toBe('landed')
  })

  it('misses a silent turn at its deadline, and Merc sings home', async () => {
    render(() => <HomeNoteRoom onDone={() => undefined} />)
    await startRun()
    toTurn()
    // Singer's deadline: 8 s from the turn's start (2.2 s on the window).
    run(7800)
    expect(phase()).toBe('sing')
    run(200)
    expect(phase()).toBe('missed')
    expect(band.resolves).toEqual([{ home: home(), withMerc: true }])
    expect(screen.getByTestId('home-note-chip').textContent).toMatch(
      /^Home was /,
    )
  })

  it('goes on to the next key, then to the result, and keeps the run', async () => {
    render(() => <HomeNoteRoom onDone={() => undefined} />)
    await startRun()
    for (let round = 0; round < HOME_NOTE_ROUNDS; round++) {
      toTurn()
      singing(home())
      run(600)
      expect(phase()).toBe('landed')
      silent()
      run(BETWEEN_ROUNDS_MS)
    }
    expect(phase()).toBe('result')
    expect(band.intros).toHaveLength(HOME_NOTE_ROUNDS)
    expect(screen.getByTestId('home-note-result').textContent).toContain(
      `${HOME_NOTE_ROUNDS} of ${HOME_NOTE_ROUNDS}`,
    )
    expect(recorded.calls).toHaveLength(1)
    expect(recorded.calls[0]).toMatchObject({
      type: 'home-note-lighthouse',
      score: 100,
    })
    expect(fake.released).toBeGreaterThan(0)
    expect(screen.getByTestId('home-note-again')).toBeTruthy()
  })

  it('stops a run on the mic, keeping nothing', async () => {
    render(() => <HomeNoteRoom onDone={() => undefined} />)
    await startRun()
    toTurn()
    fireEvent.click(screen.getByTestId('home-note-mic'))
    expect(phase()).toBe('intro')
    expect(band.stopped).toBeGreaterThan(0)
    expect(recorded.calls).toEqual([])
  })

  it('shows the blocked notice when the mic is refused', async () => {
    fake.acquireError = new Error('no mic')
    render(() => <HomeNoteRoom onDone={() => undefined} />)
    await startRun()
    expect(phase()).toBe('blocked')
    expect(screen.getByTestId('home-note-retry')).toBeTruthy()
  })

  it('offers the intro again once a round at Singer, and replays it', async () => {
    render(() => <HomeNoteRoom onDone={() => undefined} />)
    await startRun()
    toTurn()
    fireEvent.click(screen.getByTestId('home-note-hear-again'))
    expect(phase()).toBe('band')
    expect(band.intros).toHaveLength(2)
    toTurn()
    expect(screen.queryByTestId('home-note-hear-again')).toBeNull()
  })

  it('has Merc sing home after the chords at Learning', async () => {
    setExerciseLevel('learning')
    render(() => <HomeNoteRoom onDone={() => undefined} />)
    await startRun()
    expect(band.intros[0].level).toBe('I IV V I')
  })

  it('stands Merc on the plate the picture shows, as the screen turns', () => {
    // An upright screen whose room is a little wider than tall: the
    // picture's media query says portrait, the room's own box does not.
    let sideways = false
    const turned: (() => void)[] = []
    vi.stubGlobal('matchMedia', (query: string) => ({
      media: query,
      get matches() {
        return query === LANDSCAPE_PLATE_MEDIA && sideways
      },
      addEventListener: (_type: string, listener: () => void) => {
        turned.push(listener)
      },
      removeEventListener: () => undefined,
    }))
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(700)
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(680)
    render(() => <HomeNoteRoom onDone={() => undefined} />)
    const size = (): string =>
      (screen.getByTestId('home-note-merc').parentElement as HTMLElement).style
        .width
    const on = (landscape: boolean): string =>
      `${layoutHarbour(700, 680, MERC_FEET, landscape).merc.size.toFixed(1)}px`
    expect(on(false)).not.toBe(on(true))
    expect(size()).toBe(on(false))

    // The screen turns on its side: the landscape plate, and his place on it.
    sideways = true
    for (const listener of turned) listener()
    expect(size()).toBe(on(true))
  })
})
