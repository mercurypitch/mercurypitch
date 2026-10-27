import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as CaptureModule from '@/components/room-kit/useExerciseCapture'
import { midiToF0 } from '@/lib/glass/test-frames'
import type { PitchFrame } from '@/lib/pitch-f0-stream'
import { setExerciseLevel } from '@/stores/exercise-level'
import { BETWEEN_ROUNDS_MS, FIRST_NOTE_ROUNDS, MERC_GAP_SECONDS, MERC_NOTE_SECONDS, } from './first-note-rules'
import type { FirstNoteEntry, FirstNoteSong } from './first-note-songs'

// ── A capture the test feeds by hand ────────────────────────────

const fake = vi.hoisted(() => ({
  frames: [] as PitchFrame[],
  acquireError: null as Error | null,
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

// ── The songs, as calls the test can read ───────────────────────

/** The lead-in's length on the fake clock, ms; the line's. */
const LEAD_MS = 2000
const LINE_MS = 1500

const songs = vi.hoisted(() => ({
  leadIns: [] as { slug: string; midi: number }[],
  lines: [] as { slug: string; midi: number }[],
  /** The next lead-in fails to play. */
  failNext: false,
  stopped: 0,
  disposed: 0,
}))

/** A sound that plays for `ms` of the fake clock, unless stopped. */
function fakeSound(ms: number, from: number, fails: boolean) {
  const started = performance.now()
  let settle: (played: boolean) => void = () => undefined
  const done = new Promise<boolean>((resolve) => {
    settle = resolve
  })
  const timer = setTimeout(() => settle(!fails), ms)
  return {
    done,
    position: () => from + (performance.now() - started) / 1000,
    stop: () => {
      clearTimeout(timer)
      songs.stopped += 1
      settle(false)
    },
  }
}

vi.mock('./song-player', () => ({
  createSongPlayer: () => ({
    leadIn: (song: FirstNoteSong, entry: FirstNoteEntry) => {
      songs.leadIns.push({ slug: song.slug, midi: entry.midi })
      const fails = songs.failNext
      songs.failNext = false
      return fakeSound(LEAD_MS, entry.from, fails)
    },
    line: (song: FirstNoteSong, entry: FirstNoteEntry) => {
      songs.lines.push({ slug: song.slug, midi: entry.midi })
      return fakeSound(LINE_MS, entry.at, false)
    },
    dispose: () => {
      songs.disposed += 1
    },
  }),
}))

const merc = vi.hoisted(() => ({ sung: [] as number[] }))
vi.mock('@/components/room-kit/round-voice', () => ({
  SYNTH_VOICE: {
    sing: (_ctx: AudioContext, notes: readonly { midi: number }[]) => {
      merc.sung.push(...notes.map((note) => note.midi))
      return { onsets: [], endAt: 0, stop: () => undefined }
    },
  },
  outputLatency: () => 0,
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

const { FirstNoteRoom } = await import('./FirstNoteRoom')

function phase(): string | null {
  return screen.getByTestId('first-note-room').getAttribute('data-phase')
}

function line(): string | null {
  return screen.getByTestId('first-note-scene').getAttribute('data-line')
}

function chip(): string | null {
  return screen.getByTestId('first-note-chip').textContent
}

/** The note of the round on screen, from its last lead-in. */
function target(): number {
  const last = songs.leadIns[songs.leadIns.length - 1]
  if (last === undefined) throw new Error('No lead-in has played.')
  return last.midi
}

/** Tap the mic and let it open; the first lead-in starts. */
async function startRun(): Promise<void> {
  fireEvent.click(screen.getByTestId('first-note-mic'))
  await settle()
}

/** Through the lead-in and past the gate, the singer quiet: their turn. */
async function toTurn(): Promise<void> {
  silent()
  run(LEAD_MS + 50)
  await settle()
  run(250)
  expect(phase()).toBe('sing')
}

/** The line plays out, and the next lead-in starts. */
async function toNextEntry(): Promise<void> {
  silent()
  run(LINE_MS + 50)
  await settle()
  run(BETWEEN_ROUNDS_MS + 50)
  await settle()
}

describe('First note', () => {
  beforeEach(() => {
    vi.useFakeTimers({
      toFake: ['setTimeout', 'clearTimeout', 'performance'],
    })
    setExerciseLevel('singer')
    fake.frames = []
    fake.acquireError = null
    fake.released = 0
    songs.leadIns = []
    songs.lines = []
    songs.failNext = false
    songs.stopped = 0
    songs.disposed = 0
    merc.sung = []
    recorded.calls = []
    localStorage.removeItem('mp_first_note_bests')
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
    render(() => <FirstNoteRoom onDone={() => undefined} />)
    expect(phase()).toBe('intro')
    expect(screen.getByTestId('first-note-room').classList).toContain(
      'mp-dark-stage',
    )
    expect(screen.getByTestId('first-note-bubble').textContent).toMatch(
      /first note/i,
    )
    expect(screen.getByTestId('first-note-level')).toBeTruthy()
    expect(
      screen.getByTestId('first-note-mic').getAttribute('aria-label'),
    ).toBe("Start: hear the band, then come in on the singer's first note")
  })

  it("plays a song's lead-in, counts it down, and names the song with its credit", async () => {
    render(() => <FirstNoteRoom onDone={() => undefined} />)
    await startRun()
    expect(phase()).toBe('band')
    expect(songs.leadIns).toHaveLength(1)
    expect(chip()).toBe(`Entry 1 of ${FIRST_NOTE_ROUNDS}`)
    expect(screen.getByTestId('first-note-song').textContent).toContain(
      'Josh Woodward · CC BY 4.0',
    )
    expect(screen.getByTestId('first-note-mic').dataset.state).toBe('wait')
    run(LEAD_MS / 2)
    expect(screen.getByTestId('first-note-countdown')).toBeTruthy()
    // Singer: the line waits for the singer's entry.
    expect(line()).toBe('hidden')
  })

  it('hears nothing sung over the lead-in', async () => {
    render(() => <FirstNoteRoom onDone={() => undefined} />)
    await startRun()
    singing(target())
    run(LEAD_MS - 200)
    expect(phase()).toBe('band')
  })

  it('takes an entry on the note, shows the line, lands, and the singer joins', async () => {
    render(() => <FirstNoteRoom onDone={() => undefined} />)
    await startRun()
    await toTurn()
    expect(chip()).toBe('Your turn')
    expect(line()).toBe('hidden')

    // The note an octave down: any octave is the note.
    singing(target() - 12)
    run(240)
    expect(chip()).toBe('On the note')
    expect(line()).toBe('shown')
    run(400)
    expect(phase()).toBe('landed')
    expect(chip()).toMatch(/^First note: /)
    expect(songs.lines).toHaveLength(1)
  })

  it('takes a low entry as one, and still lands once the voice finds the note', async () => {
    render(() => <FirstNoteRoom onDone={() => undefined} />)
    await startRun()
    await toTurn()
    singing(target() - 2)
    run(300)
    expect(chip()).toBe('Came in low')
    expect(line()).toBe('shown')
    singing(target())
    run(600)
    expect(phase()).toBe('landed')
  })

  it('misses a silent turn at its deadline: Merc sings the note, then the singer comes in', async () => {
    render(() => <FirstNoteRoom onDone={() => undefined} />)
    await startRun()
    await toTurn()
    run(8000)
    expect(phase()).toBe('missed')
    expect(chip()).toMatch(/^It was /)
    expect(merc.sung).toEqual([target()])
    expect(songs.lines).toHaveLength(0)
    run((MERC_NOTE_SECONDS + MERC_GAP_SECONDS) * 1000 + 200)
    expect(songs.lines).toHaveLength(1)
  })

  it('goes through six entries to the result, and keeps the run', async () => {
    render(() => <FirstNoteRoom onDone={() => undefined} />)
    await startRun()
    for (let round = 0; round < FIRST_NOTE_ROUNDS; round++) {
      await toTurn()
      singing(target())
      run(600)
      expect(phase()).toBe('landed')
      await toNextEntry()
    }
    expect(phase()).toBe('result')
    expect(songs.leadIns).toHaveLength(FIRST_NOTE_ROUNDS)
    // Two entries from each of the three songs.
    const slugs = songs.leadIns.map((lead) => lead.slug)
    expect(new Set(slugs).size).toBe(3)
    expect(screen.getByTestId('first-note-result').textContent).toContain(
      `${FIRST_NOTE_ROUNDS} of ${FIRST_NOTE_ROUNDS}`,
    )
    expect(screen.getByTestId('first-note-result-level').textContent).toBe(
      `All ${FIRST_NOTE_ROUNDS} found, at Singer`,
    )
    expect(recorded.calls).toHaveLength(1)
    expect(recorded.calls[0]).toMatchObject({
      type: 'first-note-stage',
      score: 100,
    })
    expect(fake.released).toBeGreaterThan(0)
    expect(songs.disposed).toBeGreaterThan(0)
  })

  it('stops a run on the mic, keeping nothing', async () => {
    render(() => <FirstNoteRoom onDone={() => undefined} />)
    await startRun()
    await toTurn()
    fireEvent.click(screen.getByTestId('first-note-mic'))
    expect(phase()).toBe('intro')
    expect(recorded.calls).toEqual([])
    expect(songs.disposed).toBeGreaterThan(0)
  })

  it('stops the run, and says so, when a song will not play', async () => {
    render(() => <FirstNoteRoom onDone={() => undefined} />)
    songs.failNext = true
    await startRun()
    run(LEAD_MS + 50)
    await settle()
    expect(phase()).toBe('intro')
    expect(screen.getByTestId('first-note-bubble').textContent).toMatch(
      /wouldn't play/,
    )
  })

  it('shows the blocked notice when the mic is refused', async () => {
    fake.acquireError = new Error('no mic')
    render(() => <FirstNoteRoom onDone={() => undefined} />)
    await startRun()
    expect(phase()).toBe('blocked')
    expect(screen.getByTestId('first-note-retry')).toBeTruthy()
  })

  it('offers the lead-in again once a round at Singer, and replays it', async () => {
    render(() => <FirstNoteRoom onDone={() => undefined} />)
    await startRun()
    await toTurn()
    fireEvent.click(screen.getByTestId('first-note-hear-again'))
    expect(phase()).toBe('band')
    expect(songs.leadIns).toHaveLength(2)
    await toTurn()
    expect(screen.queryByTestId('first-note-hear-again')).toBeNull()
  })

  it('shows the line from the lead-in on at Learning', async () => {
    setExerciseLevel('learning')
    render(() => <FirstNoteRoom onDone={() => undefined} />)
    await startRun()
    expect(line()).toBe('shown')
    await toTurn()
    expect(line()).toBe('shown')
  })

  it('keeps the line hidden after the entry at Professional, until the voice lands', async () => {
    setExerciseLevel('professional')
    render(() => <FirstNoteRoom onDone={() => undefined} />)
    await startRun()
    await toTurn()
    singing(target() + 3)
    run(300)
    expect(chip()).toBe('Came in high')
    expect(line()).toBe('hidden')
    singing(target())
    run(600)
    expect(phase()).toBe('landed')
    expect(line()).toBe('shown')
  })
})
