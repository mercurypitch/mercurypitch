import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as SpeechModule from '@/components/room-kit/merc-speech'
import type * as CaptureModule from '@/components/room-kit/useExerciseCapture'
import { midiToF0 } from '@/lib/glass/test-frames'
import type { PitchFrame } from '@/lib/pitch-f0-stream'
import type { PhraseNote } from '@/lib/sequence/sequence-engine'
import { setExerciseLevel } from '@/stores/exercise-level'
import { HARMONY_BESTS_KEY, HARMONY_WAY_KEY, resetHarmonyStoreForTests, } from '@/stores/harmony-store'
import { BETWEEN_LINES_MS, HARMONY_LEVELS, HARMONY_LINES, MERC_GAP_SECONDS, } from './harmony-rules'

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

// ── Merc's voice, as calls the test can read ───────────────────

const merc = vi.hoisted(() => ({
  sung: [] as number[][],
  /** When each call's first note sounds, audio clock s. */
  starts: [] as number[],
  stopped: 0,
}))

vi.mock('@/components/room-kit/round-voice', () => ({
  SYNTH_VOICE: {
    sing: (
      _ctx: AudioContext,
      notes: readonly PhraseNote[],
      startAt: number,
    ) => {
      merc.sung.push(notes.map((note) => note.midi))
      merc.starts.push(startAt)
      const last = notes[notes.length - 1]
      return {
        onsets: notes.map((note) => startAt + note.at),
        endAt: startAt + (last === undefined ? 0 : last.at + last.seconds),
        stop: () => {
          merc.stopped += 1
        },
      }
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

vi.mock('@/db/services/voiceprint-service', () => ({
  loadLocalVoiceprints: () => [],
}))

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
    dispose: () => undefined,
  }),
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

function singing(midi: number): void {
  source = (t) => ({ t, f0: midiToF0(midi), conf: 0.9, rms: 0.6 })
}

function silent(): void {
  source = (t) => ({ t, f0: 0, conf: 0, rms: 0.001 })
}

/** Advance the clocks by `ms`, a 60 Hz frame at a time. */
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

const { HarmonyRoom } = await import('./HarmonyRoom')

const room = () => screen.getByTestId('harmony-room')
const phase = (): string | null => room().getAttribute('data-phase')
const chip = (): string | null =>
  screen.queryByTestId('harmony-chip')?.textContent ?? null

/** The harmony's notes, as its lamps carry them. */
const harmony = (): number[] =>
  screen.getAllByTestId('harmony-lamp').map((lamp) => Number(lamp.dataset.midi))
const lampStates = (): string[] =>
  screen.getAllByTestId('harmony-lamp').map((lamp) => lamp.dataset.state ?? '')

async function startRun(): Promise<void> {
  fireEvent.click(screen.getByTestId('harmony-mic'))
  await settle()
}

/** Past Merc's call, the singer quiet: the singer's turn, or together. */
function toTurn(): void {
  silent()
  for (let i = 0; i < 1200 && phase() === 'call'; i++) run(1000 / 60)
}

/** The harmony sung back, each note held long enough to land. */
function singLine(notes: readonly number[], holdMs = 500): void {
  for (const note of notes) {
    singing(note)
    run(holdMs)
  }
  silent()
}

describe('Harmony', () => {
  beforeEach(() => {
    spoken.said = []
    spoken.hushed = 0
    vi.useFakeTimers({
      toFake: ['setTimeout', 'clearTimeout', 'performance'],
    })
    setExerciseLevel('learning')
    fake.frames = []
    fake.acquireError = null
    fake.released = 0
    merc.sung = []
    merc.starts = []
    merc.stopped = 0
    recorded.calls = []
    localStorage.removeItem(HARMONY_BESTS_KEY)
    localStorage.removeItem(HARMONY_WAY_KEY)
    resetHarmonyStoreForTests()
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

  it('opens at rest on the lake, Merc saying the task, the way and the level in the bar', () => {
    setExerciseLevel('singer')
    render(() => <HarmonyRoom onDone={() => undefined} />)
    expect(phase()).toBe('intro')
    expect(room().classList).toContain('mp-dark-stage')
    expect(screen.getByTestId('harmony-bubble').textContent).toMatch(
      /^I sing my line\. You sing it a third higher\.$|^My line is the teal lamps\./,
    )
    expect(spoken.said).toHaveLength(1)
    expect(screen.getByTestId('harmony-ways').textContent).toBe('Turns')
    expect(screen.getByTestId('harmony-level').textContent).toBe('Singer')
    expect(screen.getByTestId('harmony-mic').getAttribute('aria-label')).toBe(
      'Start: Merc sings his line, then it is your turn',
    )
    // Four lamps a line at Singer: G3 A3 B3 A3 under B3 C4 D4 C4.
    expect(harmony()).toEqual([59, 60, 62, 60])
    expect(lampStates()).toEqual(['waiting', 'waiting', 'waiting', 'waiting'])
  })

  it('sets how to sing it from its sheet, kept for next time', () => {
    render(() => <HarmonyRoom onDone={() => undefined} />)
    fireEvent.click(screen.getByTestId('harmony-ways'))
    const options = screen.getAllByTestId('harmony-ways-option')
    expect(options.map((one) => one.dataset.way)).toEqual(['turns', 'together'])
    expect(options[0].getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(options[1])
    expect(screen.getByTestId('harmony-ways').textContent).toBe('Together')
    expect(localStorage.getItem(HARMONY_WAY_KEY)).toBe('together')
    expect(screen.getByTestId('harmony-mic').getAttribute('aria-label')).toBe(
      'Start: Merc sings his line, then you sing it with him',
    )
    // His line for the way (Learning: the harmony from him first), shown
    // and not said again.
    expect(screen.getByTestId('harmony-bubble').textContent).toBe(
      'Headphones on. I sing my line, then yours. Then we sing them together.',
    )
    expect(spoken.said).toHaveLength(1)
  })

  it('says the opening line for a level chosen at rest, shown and not said again', () => {
    setExerciseLevel('singer')
    render(() => <HarmonyRoom onDone={() => undefined} />)
    setExerciseLevel('learning')
    expect(screen.getByTestId('harmony-bubble').textContent).toBe(
      'I sing my line, then yours. Then you sing yours, a third above.',
    )
    expect(spoken.said).toHaveLength(1)
  })

  it('takes turns: Merc sings his line and the harmony, then the singer lights each lamp', async () => {
    render(() => <HarmonyRoom onDone={() => undefined} />)
    await startRun()
    expect(phase()).toBe('call')
    expect(chip()).toBe('Line 1 of 6')
    expect(screen.getByTestId('harmony-task').textContent).toBe('A third above')
    // At Learning his call is his line, then the harmony a third above it.
    const call = merc.sung[0]
    const notes = harmony()
    expect(call).toHaveLength(6)
    expect(call.slice(3)).toEqual(notes)
    call.slice(0, 3).forEach((his, i) => {
      expect([3, 4]).toContain(notes[i] - his)
    })
    expect(screen.getByTestId('harmony-mic').dataset.state).toBe('wait')

    toTurn()
    expect(phase()).toBe('sing')
    expect(chip()).toBe('Your turn')
    expect(lampStates()).toEqual(['waiting', 'waiting', 'waiting'])

    singing(notes[0])
    run(500)
    expect(lampStates()).toEqual(['lit', 'waiting', 'waiting'])
    singLine(notes.slice(1))
    expect(phase()).toBe('landed')
    expect(chip()).toBe('In harmony')
    expect(lampStates()).toEqual(['lit', 'lit', 'lit'])
    expect(screen.getByTestId('harmony-task').dataset.lamp).toBe('landed')

    run(BETWEEN_LINES_MS)
    expect(phase()).toBe('call')
    expect(chip()).toBe('Line 2 of 6')
  })

  it('misses a note, and Merc sings his note, then the third above it', async () => {
    render(() => <HarmonyRoom onDone={() => undefined} />)
    await startRun()
    const call = merc.sung[0]
    const notes = harmony()
    toTurn()
    // The first note, then nothing: the voice's silence ends the line.
    singing(notes[0])
    run(500)
    silent()
    run(2_000)
    expect(phase()).toBe('missed')
    expect(lampStates()).toEqual(['lit', 'missed', 'missed'])
    expect(screen.getByTestId('harmony-task').dataset.lamp).toBe('missed')
    expect(chip()).toMatch(/^It was [A-G]#?\d$/)
    expect(merc.sung[merc.sung.length - 1]).toEqual([call[1], notes[1]])
    expect(screen.getByTestId('harmony-scene').className).toMatch(/answering/)
  })

  it('sings together after the call: his line again, the singer with him, no words', async () => {
    localStorage.setItem(HARMONY_WAY_KEY, 'together')
    render(() => <HarmonyRoom onDone={() => undefined} />)
    await startRun()
    const notes = harmony()
    // One schedule: his call (his line, then the harmony), then his line again.
    const call = merc.sung[0]
    expect(call).toHaveLength(9)
    expect(call.slice(6)).toEqual(call.slice(0, 3))
    toTurn()
    expect(phase()).toBe('together')
    expect(chip()).toBe('Line 1 of 6')
    expect(screen.getByTestId('harmony-together').textContent).toBe('Together')
    expect(screen.queryByTestId('harmony-bubble')).toBeNull()
    expect(screen.getByTestId('harmony-mic').getAttribute('aria-label')).toBe(
      'Singing together. Tap to stop',
    )
    // In time with him: each note as he sings his under it.
    const step = (HARMONY_LEVELS.learning.noteSeconds + MERC_GAP_SECONDS) * 1000
    singLine(notes, step)
    run(600)
    expect(phase()).toBe('landed')
    expect(lampStates()).toEqual(['lit', 'lit', 'lit'])
  })

  it('lets Merc finish his line together when the last note lands early, then answers', async () => {
    localStorage.setItem(HARMONY_WAY_KEY, 'together')
    render(() => <HarmonyRoom onDone={() => undefined} />)
    await startRun()
    const notes = harmony()
    toTurn()
    const step = (HARMONY_LEVELS.learning.noteSeconds + MERC_GAP_SECONDS) * 1000
    singLine(notes.slice(0, 2), step)
    // The last note held just long enough to land, well before his ends.
    singing(notes[2])
    run(HARMONY_LEVELS.learning.landMs + 100)
    expect(phase()).toBe('landed')
    expect(lampStates()).toEqual(['lit', 'lit', 'lit'])
    // His line plays on to its end, and his answer waits for it.
    expect(merc.stopped).toBe(0)
    expect(chip()).toBe('Line 1 of 6')
    silent()
    run(1000)
    expect(chip()).toBe('In harmony')
  })

  it('misses a note sung together after its time has passed', async () => {
    localStorage.setItem(HARMONY_WAY_KEY, 'together')
    render(() => <HarmonyRoom onDone={() => undefined} />)
    await startRun()
    const notes = harmony()
    toTurn()
    const step = (HARMONY_LEVELS.learning.noteSeconds + MERC_GAP_SECONDS) * 1000
    singing(notes[0])
    run(step)
    silent()
    run(step)
    singing(notes[2])
    run(step + 600)
    silent()
    run(400)
    expect(phase()).toBe('missed')
    expect(lampStates()).toEqual(['lit', 'missed', 'lit'])
  })

  it('goes on through the run to the result, its lines as rows that play in two voices', async () => {
    render(() => <HarmonyRoom onDone={() => undefined} />)
    await startRun()
    for (let line = 0; line < HARMONY_LINES; line++) {
      const notes = harmony()
      toTurn()
      if (line === 1) {
        // The second line: silent, so each note misses at its deadline in
        // turn (4 s each at Learning), and Merc's pair after it.
        run(12_200)
        expect(phase()).toBe('missed')
        run(2_000 + 700 + 400)
        continue
      }
      singLine(notes)
      expect(phase()).toBe('landed')
      run(BETWEEN_LINES_MS)
    }
    expect(phase()).toBe('result')
    expect(screen.getByTestId('harmony-result').textContent).toContain('5 of 6')
    expect(screen.getByTestId('harmony-detail').textContent).toBe(
      '15 of 18 notes a third above',
    )
    expect(screen.getByTestId('harmony-result-level').textContent).toBe(
      'Lines in harmony at Learning',
    )
    const rows = screen.getAllByTestId('harmony-row')
    expect(rows).toHaveLength(HARMONY_LINES)
    expect(rows[1].getAttribute('aria-label')).toMatch(
      /^Line 2, [A-G]#?\d [A-G]#?\d [A-G]#?\d, 0 of 3 in harmony\. Hear it in two voices$/,
    )
    expect(recorded.calls).toHaveLength(1)
    expect(fake.released).toBeGreaterThan(0)

    // A row: his line and the harmony together.
    const before = merc.sung.length
    fireEvent.click(rows[0])
    await settle()
    const [his, theirs] = merc.sung.slice(before)
    expect(his).toHaveLength(3)
    expect(theirs).toHaveLength(3)
    expect(merc.starts[before]).toBeCloseTo(merc.starts[before + 1], 6)
    expect(screen.getAllByTestId('harmony-row')[0].dataset.playing).toBe('true')

    // Leaving the app stops both voices, at the result too.
    const stopped = merc.stopped
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
    document.dispatchEvent(new Event('visibilitychange'))
    expect(merc.stopped).toBe(stopped + 2)
    expect(screen.getAllByTestId('harmony-row')[0].dataset.playing).toBe(
      'false',
    )
    expect(phase()).toBe('result')
  })

  it('hears Merc again in the turn, as Learning allows at any time', async () => {
    render(() => <HarmonyRoom onDone={() => undefined} />)
    await startRun()
    toTurn()
    fireEvent.click(screen.getByTestId('harmony-hear-again'))
    expect(phase()).toBe('call')
    expect(merc.sung).toHaveLength(2)
    expect(merc.sung[1]).toEqual(merc.sung[0])
  })

  it('drops a run stopped part-way, keeping nothing, and Merc says his line again', async () => {
    render(() => <HarmonyRoom onDone={() => undefined} />)
    await startRun()
    toTurn()
    fireEvent.click(screen.getByTestId('harmony-mic'))
    expect(phase()).toBe('intro')
    expect(recorded.calls).toEqual([])
    expect(spoken.said).toHaveLength(2)
  })

  it('drops a run when the singer leaves the app, saying nothing aloud', async () => {
    render(() => <HarmonyRoom onDone={() => undefined} />)
    await startRun()
    toTurn()
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
    document.dispatchEvent(new Event('visibilitychange'))
    expect(phase()).toBe('intro')
    expect(recorded.calls).toEqual([])
    expect(spoken.said).toHaveLength(1)
  })

  it('shows the blocked notice when the mic is refused', async () => {
    fake.acquireError = new Error('no mic')
    render(() => <HarmonyRoom onDone={() => undefined} />)
    await startRun()
    expect(phase()).toBe('blocked')
    expect(screen.getByTestId('harmony-retry').textContent).toMatch(/Try again/)
  })
})
