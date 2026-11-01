import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as CaptureModule from '@/components/room-kit/useExerciseCapture'
import { midiToF0 } from '@/lib/glass/test-frames'
import type { PitchFrame } from '@/lib/pitch-f0-stream'
import type { PhraseNote } from '@/lib/sequence/sequence-engine'
import { setExerciseLevel } from '@/stores/exercise-level'
import { BETWEEN_ROUNDS_MS, LEAP_ROUNDS } from './leap-rules'

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

// ── Merc's voice, as calls the test can read ───────────────────

const merc = vi.hoisted(() => ({
  sung: [] as number[][],
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

const { LeapRoom } = await import('./LeapRoom')

function phase(): string | null {
  return screen.getByTestId('leap-room').getAttribute('data-phase')
}

/** Merc's last call: his note, and at Learning the target after it. */
function lastCall(): number[] {
  const last = merc.sung[merc.sung.length - 1]
  if (last === undefined) throw new Error('Merc has not sung.')
  return last
}

async function startRun(): Promise<void> {
  fireEvent.click(screen.getByTestId('leap-mic'))
  await settle()
}

/** Past Merc's call and the gate, the singer quiet: the singer's turn. */
function toTurn(): void {
  silent()
  // Learning's call: two notes of 0.9 s, a breath, his voice's tail, the
  // gate. Singer's: one note.
  run(2600)
  expect(phase()).toBe('sing')
}

// ── Merc's spoken lines, as calls the test can read ───────────

const spoken = vi.hoisted(() => ({ said: [] as string[], hushed: 0 }))
vi.mock('@/components/room-kit/merc-speech', () => ({
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

describe('Leap', () => {
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
    merc.stopped = 0
    recorded.calls = []
    localStorage.removeItem('mp_leap_bests')
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
    render(() => <LeapRoom onDone={() => undefined} />)
    expect(phase()).toBe('intro')
    expect(screen.getByTestId('leap-room').classList).toContain('mp-dark-stage')
    expect(screen.getByTestId('leap-bubble').textContent).toMatch(/both notes/)
    expect(screen.getByTestId('leap-level')).toBeTruthy()
    expect(screen.getByTestId('leap-mic').getAttribute('aria-label')).toBe(
      "Start: hear Merc's note, then leap",
    )
  })

  it('names the leap, has Merc sing both notes at Learning, then hears the singer leap', async () => {
    render(() => <LeapRoom onDone={() => undefined} />)
    await startRun()
    expect(phase()).toBe('call')
    expect(screen.getByTestId('leap-chip').textContent).toBe('Leap 1 of 6')
    const lamp = screen.getByTestId('leap-lamp')
    expect(lamp.textContent).toMatch(/^Up a (fourth|fifth)$/)
    expect(lamp.dataset.lamp).toBe('toCome')
    // Merc's line names the song that opens on it.
    expect(screen.getByTestId('leap-bubble').textContent).toMatch(
      /Here Comes the Bride|Twinkle, Twinkle/,
    )
    const [from, to] = lastCall()
    expect([5, 7]).toContain(to - from)
    expect(screen.getByTestId('leap-mic').dataset.state).toBe('wait')

    toTurn()
    expect(screen.getByTestId('leap-mic').dataset.state).toBe('sing')
    expect(screen.getByTestId('leap-chip').textContent).toBe('Your turn')

    // His note, then the leap.
    singing(from)
    run(450)
    expect(phase()).toBe('sing')
    singing(to)
    run(500)
    expect(phase()).toBe('landed')
    expect(screen.getByTestId('leap-lamp').dataset.lamp).toBe('landed')
    expect(screen.getByTestId('leap-chip').textContent).toMatch(/^Landed: /)
  })

  it('hears a voice that goes straight to the target as a leap landed', async () => {
    render(() => <LeapRoom onDone={() => undefined} />)
    await startRun()
    const [, to] = lastCall()
    toTurn()
    singing(to)
    run(600)
    expect(phase()).toBe('landed')
  })

  it('never lands a leap the wrong way, an octave out', async () => {
    render(() => <LeapRoom onDone={() => undefined} />)
    await startRun()
    const [from, to] = lastCall()
    toTurn()
    singing(from)
    run(450)
    // The target an octave down: the leap's own size the wrong way round.
    singing(to - 12)
    run(1500)
    expect(phase()).toBe('sing')
  })

  it('misses a silent turn, and Merc sings both notes', async () => {
    render(() => <LeapRoom onDone={() => undefined} />)
    await startRun()
    const call = lastCall()
    toTurn()
    // Learning: 5 s for his note, then 5 s for the target.
    run(10_200)
    expect(phase()).toBe('missed')
    expect(screen.getByTestId('leap-lamp').dataset.lamp).toBe('missed')
    expect(screen.getByTestId('leap-chip').textContent).toMatch(/^It was /)
    expect(lastCall()).toEqual(call)
    expect(screen.getByTestId('leap-scene').className).toMatch(/answering/)
  })

  it('goes on through the run to the result, its leaps as rows that play again', async () => {
    render(() => <LeapRoom onDone={() => undefined} />)
    await startRun()
    for (let round = 0; round < LEAP_ROUNDS; round++) {
      const [from, to] = lastCall()
      toTurn()
      if (round === 1) {
        // The second leap: silent, missed, and Merc's answer after it.
        run(10_200)
        expect(phase()).toBe('missed')
        run(2_000 + 700 + 400)
        continue
      }
      singing(from)
      run(450)
      singing(to)
      run(500)
      expect(phase()).toBe('landed')
      silent()
      run(BETWEEN_ROUNDS_MS)
    }
    expect(phase()).toBe('result')
    expect(screen.getByTestId('leap-result').textContent).toContain('5 of 6')
    expect(screen.getByTestId('leap-detail').textContent).toMatch(
      /^Landed in \d\.\d s on average$/,
    )
    expect(recorded.calls).toHaveLength(1)
    expect(recorded.calls[0]).toMatchObject({ type: 'leap-cliffs', score: 83 })

    const rows = screen.getAllByTestId('leap-row')
    expect(rows.length).toBeGreaterThanOrEqual(1)
    expect(rows.length).toBeLessThanOrEqual(2)
    const sungBefore = merc.sung.length
    fireEvent.click(rows[0])
    await settle()
    expect(merc.sung).toHaveLength(sungBefore + 1)
    expect(lastCall()).toHaveLength(2)
    expect(screen.getAllByTestId('leap-row')[0].dataset.playing).toBe('true')
    run(3000)
    expect(screen.getAllByTestId('leap-row')[0].dataset.playing).toBe('false')
    // Nothing more is kept for it.
    expect(recorded.calls).toHaveLength(1)
  })

  it('offers Merc again once a leap at Singer, and calls it again', async () => {
    setExerciseLevel('singer')
    render(() => <LeapRoom onDone={() => undefined} />)
    await startRun()
    // Singer: Merc sings his note alone.
    expect(lastCall()).toHaveLength(1)
    toTurn()
    fireEvent.click(screen.getByTestId('leap-hear-again'))
    expect(phase()).toBe('call')
    expect(merc.sung).toHaveLength(2)
    toTurn()
    expect(screen.queryByTestId('leap-hear-again')).toBeNull()
  })

  it('stops a run on the mic, keeping nothing', async () => {
    render(() => <LeapRoom onDone={() => undefined} />)
    await startRun()
    toTurn()
    fireEvent.click(screen.getByTestId('leap-mic'))
    expect(phase()).toBe('intro')
    expect(recorded.calls).toEqual([])
  })

  it('has Merc say his opening line aloud, quiet through a run and again after a stop', async () => {
    setExerciseLevel('singer')
    render(() => <LeapRoom onDone={() => undefined} />)
    expect(spoken.said).toHaveLength(1)
    expect(['intro-ledges', 'intro-lantern']).toContain(spoken.said[0])
    const before = spoken.hushed
    await startRun()
    // Hushed on the tap, before the mic opens.
    expect(spoken.hushed).toBeGreaterThan(before)
    toTurn()
    expect(spoken.said).toHaveLength(1)
    fireEvent.click(screen.getByTestId('leap-mic'))
    expect(spoken.said).toHaveLength(2)
    expect(spoken.said[1]).not.toBe(spoken.said[0])
  })

  it("says Learning's opening line aloud at Learning", () => {
    setExerciseLevel('learning')
    render(() => <LeapRoom onDone={() => undefined} />)
    expect(spoken.said).toEqual(['match-both'])
  })

  it('says nothing aloud when the singer leaves the app mid-run', async () => {
    render(() => <LeapRoom onDone={() => undefined} />)
    await startRun()
    toTurn()
    const before = spoken.hushed
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
    document.dispatchEvent(new Event('visibilitychange'))
    expect(phase()).toBe('intro')
    expect(spoken.said).toHaveLength(1)
    expect(spoken.hushed).toBeGreaterThan(before)
  })

  it('shows the blocked notice when the mic is refused', async () => {
    fake.acquireError = new Error('no mic')
    render(() => <LeapRoom onDone={() => undefined} />)
    await startRun()
    expect(phase()).toBe('blocked')
    expect(screen.getByTestId('leap-retry')).toBeTruthy()
  })
})
