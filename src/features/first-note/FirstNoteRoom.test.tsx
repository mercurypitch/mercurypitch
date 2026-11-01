import { cleanup, fireEvent, render, screen, within, } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as SpeechModule from '@/components/room-kit/merc-speech'
import type * as CaptureModule from '@/components/room-kit/useExerciseCapture'
import type { RoomSong } from '@/features/karaoke-room/karaoke-room-library'
import { midiToF0 } from '@/lib/glass/test-frames'
import type { PitchFrame } from '@/lib/pitch-f0-stream'
import { setExerciseLevel } from '@/stores/exercise-level'
import { resetFirstNoteChoicesForTests } from './first-note-choices'
import { resetOwnSongsForTests, setOwnSongReaderForTests, } from './first-note-own-songs'
import { BETWEEN_ROUNDS_MS, FIRST_NOTE_ROUNDS, MERC_GAP_SECONDS, MERC_NOTE_SECONDS, } from './first-note-rules'
import type { FirstNoteEntry, FirstNoteSong } from './first-note-songs'
import { FIRST_NOTE_SONGS, singOnFrom } from './first-note-songs'

// ── The singer's own songs, as the Karaoke room's library lists them ──

const library = vi.hoisted(() => ({
  songs: [] as RoomSong[],
  /** Read with the songs, so a test can change them under the room. */
  version: (() => 0) as () => number,
  setVersion: (() => undefined) as (next: number) => unknown,
}))

vi.mock('@/features/karaoke-room/karaoke-room-library', () => ({
  roomLibrary: () => {
    library.version()
    return library.songs
  },
  hydrateSong: async (song: RoomSong) => ({
    vocal: `blob:fresh-${song.sessionId}-vocal`,
    instrumental: `blob:fresh-${song.sessionId}-band`,
  }),
}))

/** The library changes under the room: the session store loads, a split finishes. */
function libraryNow(songs: RoomSong[]): void {
  library.songs = songs
  library.setVersion(library.version() + 1)
}

const ownSong = (sessionId: string, title: string): RoomSong => ({
  sessionId,
  title,
  artist: null,
  durationSec: 200,
  credit: null,
  kind: 'yours',
  stems: { vocal: 'blob:dead-vocal', instrumental: 'blob:dead-band' },
})

const ownEntry = (at: number, midi: number): FirstNoteEntry => ({
  at,
  midi,
  from: at - 8,
  until: at + 4,
  beats: [],
  words: `The line at ${at}`,
})

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
      runningAudio: () => clock,
    }),
  }
})

// ── The songs, as calls the test can read ───────────────────────

/** The lead-in's length on the fake clock, ms; the line's. */
const LEAD_MS = 2000
const LINE_MS = 1500

const songs = vi.hoisted(() => ({
  leadIns: [] as {
    slug: string
    midi: number
    at: number
    vocal: string
    words: string
  }[],
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
      songs.leadIns.push({
        slug: song.slug,
        midi: entry.midi,
        at: entry.at,
        vocal: song.stems.vocal,
        words: entry.words ?? '',
      })
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

// ── Merc's spoken lines, as calls the test can read ───────────

const spoken = vi.hoisted(() => ({ said: [] as string[], hushed: 0 }))
vi.mock('@/components/room-kit/merc-speech', async () => ({
  ...(await vi.importActual<typeof SpeechModule>(
    '@/components/room-kit/merc-speech',
  )),
  createMercSpeech: () => ({
    say: (id: string) => {
      spoken.said.push(id)
    },
    hush: () => {
      spoken.hushed += 1
    },
    speaking: () => false,
    dispose: () => {
      spoken.hushed += 1
    },
  }),
}))

describe('First note', () => {
  beforeEach(() => {
    spoken.said = []
    spoken.hushed = 0
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
    resetFirstNoteChoicesForTests()
    resetOwnSongsForTests()
    library.songs = []
    const [version, setVersion] = createSignal(0)
    library.version = version
    library.setVersion = setVersion
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
    setOwnSongReaderForTests(null)
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
    // Merc says the result aloud as the run ends, the mic closed.
    expect(spoken.said.at(-1)).toBe('all-on')
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

  it('has Merc say his opening line aloud, quiet through a run and again after a stop', async () => {
    render(() => <FirstNoteRoom onDone={() => undefined} />)
    expect(spoken.said).toHaveLength(1)
    expect(['intro-stop', 'intro-entry']).toContain(spoken.said[0])
    const before = spoken.hushed
    await startRun()
    // Hushed on the tap, before the mic opens.
    expect(spoken.hushed).toBeGreaterThan(before)
    await toTurn()
    expect(spoken.said).toHaveLength(1)
    fireEvent.click(screen.getByTestId('first-note-mic'))
    expect(spoken.said).toHaveLength(2)
    expect(spoken.said[1]).not.toBe(spoken.said[0])
  })

  it("says Learning's opening line aloud at Learning", () => {
    setExerciseLevel('learning')
    render(() => <FirstNoteRoom onDone={() => undefined} />)
    expect(spoken.said).toEqual(['line-slide'])
  })

  it('says nothing aloud when the singer leaves the app mid-run', async () => {
    render(() => <FirstNoteRoom onDone={() => undefined} />)
    await startRun()
    await toTurn()
    const before = spoken.hushed
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
    document.dispatchEvent(new Event('visibilitychange'))
    expect(phase()).toBe('intro')
    expect(spoken.said).toHaveLength(1)
    expect(spoken.hushed).toBeGreaterThan(before)
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

  describe("the songs: the examples, the singer's own, or a mix", () => {
    const sheet = (): HTMLElement =>
      screen.getByTestId('first-note-songs-sheet')
    const choose = (source: 'examples' | 'yours' | 'mix'): void => {
      fireEvent.click(screen.getByTestId('first-note-songs'))
      fireEvent.click(
        within(sheet()).getByTestId(`first-note-source-${source}`),
      )
      fireEvent.click(within(sheet()).getByRole('button', { name: 'Close' }))
    }

    it('names the choice over the mic at rest, the examples at first', () => {
      render(() => <FirstNoteRoom onDone={() => undefined} />)
      const pill = screen.getByTestId('first-note-songs')
      expect(pill.textContent).toContain('The examples')
      fireEvent.click(pill)
      const choices = within(sheet()).getAllByRole('radio')
      expect(choices.map((one) => one.textContent)).toEqual([
        expect.stringContaining('The examples'),
        expect.stringContaining('Your songs'),
        expect.stringContaining('A mix'),
      ])
      expect(choices[0].getAttribute('aria-checked')).toBe('true')
      // The singer's own songs can make a shorter run: up to six.
      expect(sheet().textContent).toContain('Each run is up to six entries.')
    })

    it("reads a song of the singer's own that turns up while the room rests", async () => {
      const read = vi.fn(async () => ({
        entries: [ownEntry(20, 55), ownEntry(40, 57)],
        dropped: [],
      }))
      setOwnSongReaderForTests(read)
      render(() => <FirstNoteRoom onDone={() => undefined} />)
      choose('yours')
      await settle()
      expect(read).not.toHaveBeenCalled()

      // The session store, loading after the room opened, brings a song.
      libraryNow([ownSong('late', 'Wild Mountain Thyme')])
      await settle()
      expect(read).toHaveBeenCalledTimes(1)
      expect(read.mock.calls[0]).toEqual(['late', expect.anything()])
    })

    it("keeps a song's row in place while its read goes on", async () => {
      library.songs = [
        ownSong('mine', 'Danny Boy'),
        ownSong('next', 'Scarborough Fair'),
      ]
      let progress: (percent: number) => void = () => undefined
      setOwnSongReaderForTests(
        (_id, run) =>
          new Promise(() => {
            progress = (percent) => run.onProgress?.(percent)
          }),
      )
      render(() => <FirstNoteRoom onDone={() => undefined} />)
      choose('mix')
      await settle()
      fireEvent.click(screen.getByTestId('first-note-songs'))
      const [reading, waiting] = within(sheet()).getAllByTestId(
        'first-note-own-song',
      )

      progress(30)
      progress(31)
      const [readingNow, waitingNow] = within(sheet()).getAllByTestId(
        'first-note-own-song',
      )
      expect(readingNow).toBe(reading)
      expect(waitingNow).toBe(waiting)
      expect(
        within(readingNow)
          .getByRole('progressbar')
          .getAttribute('aria-valuenow'),
      ).toBe('31')
    })

    it('says plainly that a song could not be read, with no error in sight', async () => {
      vi.spyOn(console, 'warn').mockImplementation(() => undefined)
      library.songs = [
        ownSong('broken', 'Danny Boy'),
        ownSong('long', 'The Long Song'),
      ]
      setOwnSongReaderForTests(async (id) => {
        if (id === 'broken') {
          throw new Error('EncodingError: Unable to decode audio data')
        }
        return { entries: [], dropped: [], out: 'too-long' }
      })
      render(() => <FirstNoteRoom onDone={() => undefined} />)
      choose('yours')
      await settle()

      fireEvent.click(screen.getByTestId('first-note-songs'))
      const [broken, long] = within(sheet()).getAllByTestId(
        'first-note-own-song',
      )
      expect(broken.dataset.state).toBe('failed')
      expect(broken.textContent).toContain('Could not read this song')
      expect(broken.textContent).not.toMatch(/decode|Error/)
      expect(long.textContent).toContain(
        'Left out: too long for this phone to read',
      )
    })

    it("plays the singer's own song once it is read, from stems minted for the run", async () => {
      library.songs = [ownSong('mine', 'Danny Boy')]
      setOwnSongReaderForTests(async (_id, run) => {
        run.onProgress?.(50)
        return {
          entries: [ownEntry(20, 55), ownEntry(40, 57), ownEntry(60, 59)],
          dropped: [],
        }
      })
      render(() => <FirstNoteRoom onDone={() => undefined} />)
      choose('yours')
      await settle()

      fireEvent.click(screen.getByTestId('first-note-songs'))
      const row = within(sheet()).getByTestId('first-note-own-song')
      expect(row.dataset.state).toBe('ready')
      expect(row.textContent).toContain('3 entries')
      fireEvent.click(within(sheet()).getByRole('button', { name: 'Close' }))

      await startRun()
      await settle()
      expect(phase()).toBe('band')
      expect(songs.leadIns[0]).toMatchObject({
        slug: 'mine',
        vocal: 'blob:fresh-mine-vocal',
      })
      // Three entries are all the run there is in one song with three.
      expect(chip()).toBe('Entry 1 of 3')
      // A song of the singer's own has no credit to show.
      expect(screen.getByTestId('first-note-song').textContent).toBe(
        'Danny Boy',
      )
    })

    it('shows how far a read has got, over the mic and in the sheet', async () => {
      library.songs = [ownSong('mine', 'Danny Boy')]
      setOwnSongReaderForTests(
        (_id, run) =>
          new Promise(() => {
            run.onProgress?.(42)
          }),
      )
      render(() => <FirstNoteRoom onDone={() => undefined} />)
      choose('mix')
      await settle()

      expect(screen.getByTestId('first-note-songs').textContent).toContain(
        '42%',
      )
      fireEvent.click(screen.getByTestId('first-note-songs'))
      const row = within(sheet()).getByTestId('first-note-own-song')
      expect(row.dataset.state).toBe('reading')
      expect(
        within(row).getByRole('progressbar').getAttribute('aria-valuenow'),
      ).toBe('42')
    })

    it('lets go of a read when a run starts, and the mix plays the examples meanwhile', async () => {
      library.songs = [ownSong('mine', 'Danny Boy')]
      let stopped = false
      setOwnSongReaderForTests(
        (_id, run) =>
          new Promise((_resolve, reject) => {
            run.signal?.addEventListener('abort', () => {
              stopped = true
              const error = new Error('stopped')
              error.name = 'AbortError'
              reject(error)
            })
          }),
      )
      render(() => <FirstNoteRoom onDone={() => undefined} />)
      choose('mix')
      await settle()
      expect(stopped).toBe(false)

      await startRun()
      expect(phase()).toBe('band')
      expect(stopped).toBe(true)
      const examples = new Set(FIRST_NOTE_SONGS.map((song) => song.slug))
      expect(examples.has(songs.leadIns[0].slug)).toBe(true)
    })

    it('says plainly that a song with too few clear entries sits out', async () => {
      library.songs = [ownSong('mine', 'Amazing Grace')]
      setOwnSongReaderForTests(async () => ({
        entries: [ownEntry(20, 55)],
        dropped: [],
      }))
      render(() => <FirstNoteRoom onDone={() => undefined} />)
      choose('yours')
      await settle()

      fireEvent.click(screen.getByTestId('first-note-songs'))
      const row = within(sheet()).getByTestId('first-note-own-song')
      expect(row.dataset.state).toBe('few')
      expect(row.textContent).toContain(
        'Left out: only 1 clear entry, it needs 2',
      )
    })

    it('reads a song again from its row, one an earlier read left out', async () => {
      library.songs = [ownSong('mine', 'Shadow of the Gods')]
      // The read before found one clear entry; the read again, three.
      const reads = [
        [ownEntry(20, 55)],
        [ownEntry(20, 55), ownEntry(40, 57), ownEntry(60, 59)],
      ]
      setOwnSongReaderForTests(async () => ({
        entries: reads.shift() ?? [],
        dropped: [],
      }))
      render(() => <FirstNoteRoom onDone={() => undefined} />)
      choose('yours')
      await settle()

      fireEvent.click(screen.getByTestId('first-note-songs'))
      const row = () => within(sheet()).getByTestId('first-note-own-song')
      expect(row().dataset.state).toBe('few')
      fireEvent.click(
        within(row()).getByRole('button', {
          name: 'Read Shadow of the Gods again',
        }),
      )
      await settle()
      expect(row().dataset.state).toBe('ready')
      expect(row().textContent).toContain('3 entries')
    })

    it('offers no read again on a song not read yet', async () => {
      library.songs = [ownSong('mine', 'Danny Boy')]
      setOwnSongReaderForTests(() => new Promise(() => undefined))
      render(() => <FirstNoteRoom onDone={() => undefined} />)
      choose('yours')
      await settle()

      fireEvent.click(screen.getByTestId('first-note-songs'))
      const row = within(sheet()).getByTestId('first-note-own-song')
      expect(row.dataset.state).toBe('reading')
      expect(within(row).queryByTestId('first-note-read-again')).toBeNull()
    })

    it('opens the songs instead of starting when none of the chosen can play', async () => {
      const onOwnSongs = vi.fn()
      render(() => (
        <FirstNoteRoom onDone={() => undefined} onOwnSongs={onOwnSongs} />
      ))
      choose('yours')
      expect(screen.queryByTestId('first-note-songs-sheet')).toBeNull()

      fireEvent.click(screen.getByTestId('first-note-mic'))
      await settle()
      expect(phase()).toBe('intro')
      // No song of the singer's own yet: how one comes to be here, and the way.
      const empty = within(sheet()).getByTestId('first-note-no-songs')
      expect(empty.textContent).toContain('No songs of your own yet')
      fireEvent.click(within(empty).getByTestId('first-note-own-songs'))
      expect(onOwnSongs).toHaveBeenCalledTimes(1)
    })

    it('offers no way to the songs where the shell has none', () => {
      render(() => <FirstNoteRoom onDone={() => undefined} />)
      choose('yours')
      fireEvent.click(screen.getByTestId('first-note-songs'))
      expect(within(sheet()).getByTestId('first-note-no-songs')).toBeTruthy()
      expect(screen.queryByTestId('first-note-own-songs')).toBeNull()
    })
  })

  describe('Sing on in Karaoke', () => {
    /** The example song and entry a lead-in played. */
    const played = (
      lead: (typeof songs.leadIns)[number],
    ): { song: FirstNoteSong; entry: FirstNoteEntry } => {
      const song = FIRST_NOTE_SONGS.find((one) => one.slug === lead.slug)
      const entry = song?.entries.find((one) => one.at === lead.at)
      if (song === undefined || entry === undefined) {
        throw new Error(`No entry at ${lead.at} in ${lead.slug}`)
      }
      return { song, entry }
    }

    it('follows a landing, with the song from a breath before the entry', async () => {
      const onSingOn = vi.fn()
      render(() => (
        <FirstNoteRoom onDone={() => undefined} onSingOn={onSingOn} />
      ))
      await startRun()
      await toTurn()
      expect(screen.queryByTestId('first-note-sing-on')).toBeNull()
      singing(target())
      run(600)
      expect(phase()).toBe('landed')

      fireEvent.click(screen.getByTestId('first-note-sing-on'))
      const { song, entry } = played(songs.leadIns[0])
      expect(onSingOn).toHaveBeenCalledWith(song.sessionId, singOnFrom(entry))
      // The run is dropped on the way, as Back drops it.
      expect(phase()).toBe('intro')
      expect(recorded.calls).toEqual([])
      expect(fake.released).toBeGreaterThan(0)
    })

    it('is offered for each song at the result, from where the singer first came in', async () => {
      const onSingOn = vi.fn()
      render(() => (
        <FirstNoteRoom onDone={() => undefined} onSingOn={onSingOn} />
      ))
      await startRun()
      for (let round = 0; round < FIRST_NOTE_ROUNDS; round++) {
        await toTurn()
        singing(target())
        run(600)
        await toNextEntry()
      }
      expect(phase()).toBe('result')

      const rows = within(
        screen.getByTestId('first-note-by-song'),
      ).getAllByRole('listitem')
      expect(rows).toHaveLength(3)
      const { song, entry } = played(songs.leadIns[0])
      expect(rows[0].textContent).toContain(song.title)
      expect(rows[0].textContent).toContain('2 of 2')
      fireEvent.click(within(rows[0]).getByTestId('first-note-result-sing-on'))
      expect(onSingOn).toHaveBeenCalledWith(song.sessionId, singOnFrom(entry))
    })

    it('is not offered where the shell has no way to the Karaoke room', async () => {
      render(() => <FirstNoteRoom onDone={() => undefined} />)
      await startRun()
      await toTurn()
      singing(target())
      run(600)
      expect(phase()).toBe('landed')
      expect(screen.queryByTestId('first-note-sing-on')).toBeNull()
    })
  })

  describe('the words, a hint the singer asks for', () => {
    const words = (): HTMLElement | null =>
      screen.queryByTestId('first-note-words')

    it('stay away by default: the room is ear first', async () => {
      render(() => <FirstNoteRoom onDone={() => undefined} />)
      await startRun()
      expect(phase()).toBe('band')
      expect(words()).toBeNull()
      await toTurn()
      expect(words()).toBeNull()
    })

    it('show the line the singer comes in on, while the band counts in and in the turn', async () => {
      render(() => <FirstNoteRoom onDone={() => undefined} />)
      fireEvent.click(screen.getByTestId('first-note-songs'))
      const sheet = screen.getByTestId('first-note-songs-sheet')
      const toggle = within(sheet).getByRole('switch', {
        name: 'Show the words',
      })
      // What it does, in a sentence (owner, 29 Oct).
      expect(sheet.textContent).toContain(
        'Shows the lyrics you sing when the music stops.',
      )
      expect(toggle.getAttribute('aria-checked')).toBe('false')
      fireEvent.click(toggle)
      expect(toggle.getAttribute('aria-checked')).toBe('true')
      // Remembered on this device.
      expect(localStorage.getItem('mp_first_note_words')).toBe('true')
      fireEvent.click(within(sheet).getByRole('button', { name: 'Close' }))
      // The pill says so before the run.
      expect(screen.getByTestId('first-note-songs').textContent).toContain(
        'Words',
      )

      await startRun()
      const line = songs.leadIns[0].words
      expect(line).not.toBe('')
      expect(words()?.textContent).toContain(line)
      expect(screen.getByTestId('first-note-said').textContent).toContain(
        `Your line: ${line}`,
      )
      await toTurn()
      expect(words()?.textContent).toContain(line)

      // Landed: Merc has the place again, and the song sings the line.
      singing(target())
      run(600)
      expect(phase()).toBe('landed')
      expect(words()).toBeNull()
    })

    it('come back on as they were left', async () => {
      localStorage.setItem('mp_first_note_words', 'true')
      render(() => <FirstNoteRoom onDone={() => undefined} />)
      await startRun()
      expect(words()?.textContent).toContain(songs.leadIns[0].words)
    })
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
