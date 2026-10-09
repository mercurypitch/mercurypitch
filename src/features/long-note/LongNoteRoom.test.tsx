import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { sequence, silence, tone } from '@/lib/glass/test-frames'
import type { PitchFrame } from '@/lib/pitch-f0-stream'
import type * as CaptureModule from './useLongNoteCapture'

// ── A capture the test feeds by hand ────────────────────────────

const fake = vi.hoisted(() => {
  const state = {
    frames: [] as PitchFrame[],
    acquireError: null as Error | null,
    tones: [] as number[],
    windows: 0,
    released: 0,
    acquired: 0,
    /** When set, every tone waits for this before it ends. */
    toneGate: null as Promise<void> | null,
  }
  return state
})

vi.mock('./useLongNoteCapture', async () => {
  const actual = await vi.importActual<typeof CaptureModule>(
    './useLongNoteCapture',
  )
  return {
    ...actual,
    useLongNoteCapture: () => ({
      acquire: () => {
        fake.acquired += 1
        return fake.acquireError === null
          ? Promise.resolve()
          : Promise.reject(fake.acquireError)
      },
      release: () => {
        fake.released += 1
      },
      held: () => true,
      startWindow: () => {
        fake.windows += 1
        fake.frames = []
      },
      peekFrames: () => fake.frames.slice(),
      takeFrames: () => {
        const taken = fake.frames
        fake.frames = []
        return taken
      },
      playTone: (midi: number) => {
        fake.tones.push(midi)
        return fake.toneGate ?? Promise.resolve()
      },
    }),
  }
})

const merc = vi.hoisted(() => ({ states: [] as string[] }))
vi.mock('@/lib/merc/stage', () => ({
  mountMercStage: () => ({
    ok: true,
    setState: (name: string) => merc.states.push(name),
    setVoice: () => undefined,
    setPaused: () => undefined,
    destroy: () => undefined,
  }),
}))

const recorded = vi.hoisted(() => ({ calls: [] as unknown[] }))
vi.mock('@/stores/exercise-history-store', () => ({
  recordExerciseResult: (entry: unknown) => recorded.calls.push(entry),
}))

vi.mock('@/lib/haptics', () => ({
  haptics: { tapLight: () => undefined, success: () => undefined },
}))

// A3 from a voiceprint, unless a test takes the voiceprint away.
const target = vi.hoisted(() => ({
  pick: { midi: 57, source: 'voiceprint' } as {
    midi: number
    source: 'voiceprint' | 'preset'
  },
}))
vi.mock('@/lib/hold/load-hold-target', () => ({
  loadHoldTarget: () => target.pick,
}))

// The note held last time, kept per test rather than in the persisted store.
const memory = vi.hoisted(() => ({ note: null as number | null }))
vi.mock('./remembered-note', () => ({
  rememberedLongNote: () => memory.note,
  rememberLongNote: (midi: number) => {
    memory.note = midi
  },
}))

// ── Frames the test advances one at a time ─────────────────────

let rafQueue: FrameRequestCallback[] = []

function flushFrames(count = 1): void {
  for (let i = 0; i < count; i++) {
    const due = rafQueue
    rafQueue = []
    for (const callback of due) callback(performance.now())
  }
}

async function settle(): Promise<void> {
  for (let i = 0; i < 5; i++) await Promise.resolve()
}

const { LongNoteRoom } = await import('./LongNoteRoom')

function phase(): string | null {
  return screen.getByTestId('long-note-room').getAttribute('data-phase')
}

async function startListening(): Promise<void> {
  fireEvent.click(screen.getByTestId('long-note-mic'))
  await settle()
}

describe('LongNoteRoom', () => {
  beforeEach(() => {
    localStorage.clear()
    fake.frames = []
    fake.acquireError = null
    fake.tones = []
    fake.windows = 0
    fake.released = 0
    fake.acquired = 0
    fake.toneGate = null
    target.pick = { midi: 57, source: 'voiceprint' }
    memory.note = null
    merc.states = []
    recorded.calls = []
    rafQueue = []
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      rafQueue.push(cb)
      return rafQueue.length
    })
    vi.stubGlobal('cancelAnimationFrame', () => undefined)
    // jsdom has no 2D canvas; the trace draws nothing rather than logging.
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('opens on the note to hold, with Merc saying it', () => {
    render(() => <LongNoteRoom onDone={() => undefined} />)
    expect(phase()).toBe('intro')
    expect(screen.getByTestId('long-note-note').textContent).toBe('A3')
    expect(screen.getByText(/A3/, { selector: 'p' })).toBeTruthy()
  })

  it('plays the note, then listens', async () => {
    render(() => <LongNoteRoom onDone={() => undefined} />)
    await startListening()
    expect(fake.tones).toEqual([57])
    expect(phase()).toBe('listen')
    expect(fake.windows).toBe(1)
  })

  it('times a held note and records one result', async () => {
    render(() => <LongNoteRoom onDone={() => undefined} />)
    await startListening()

    fake.frames = sequence(
      (t) => tone(57, 3, { startT: t }),
      (t) => silence(0.8, t),
    )
    flushFrames()
    await settle()

    expect(phase()).toBe('result')
    const result = screen.getByTestId('long-note-result')
    expect(result.textContent).toMatch(/\d+\.\d s/)
    expect(result.textContent).toMatch(/Steadiness \d+/)
    expect(recorded.calls).toHaveLength(1)
    expect(recorded.calls[0]).toMatchObject({
      type: 'long-note-lantern',
      metrics: { targetMidi: 57 },
    })
  })

  it('treats a cough as a false start and keeps listening', async () => {
    render(() => <LongNoteRoom onDone={() => undefined} />)
    await startListening()

    fake.frames = sequence(
      (t) => tone(57, 0.05, { startT: t }),
      (t) => silence(0.8, t),
    )
    flushFrames()
    await settle()

    expect(phase()).toBe('listen')
    expect(recorded.calls).toHaveLength(0)
    expect(fake.windows).toBe(2)
  })

  it('goes again on the same note, and Done leaves', async () => {
    const onDone = vi.fn()
    render(() => <LongNoteRoom onDone={onDone} />)
    await startListening()
    fake.frames = sequence(
      (t) => tone(57, 2, { startT: t }),
      (t) => silence(0.8, t),
    )
    flushFrames()
    await settle()
    expect(phase()).toBe('result')
    // Nothing listens on the result card.
    expect(fake.released).toBe(1)

    fireEvent.click(screen.getByTestId('long-note-again'))
    expect(phase()).toBe('starting')
    await settle()
    expect(phase()).toBe('listen')
    expect(fake.tones).toEqual([57, 57])

    fake.frames = sequence(
      (t) => tone(57, 2, { startT: t }),
      (t) => silence(0.8, t),
    )
    flushFrames()
    await settle()
    fireEvent.click(screen.getByTestId('long-note-done'))
    expect(onDone).toHaveBeenCalledTimes(1)
    expect(recorded.calls).toHaveLength(2)
  })

  it('moves the note before the first breath', async () => {
    render(() => <LongNoteRoom onDone={() => undefined} />)
    fireEvent.click(screen.getByTestId('long-note-higher'))
    await settle()
    expect(screen.getByTestId('long-note-note').textContent).toBe('A#3')
    expect(fake.tones).toEqual([58])
  })

  it('says what to do when the microphone is refused', async () => {
    const { CaptureError } = await import('./useLongNoteCapture')
    fake.acquireError = new CaptureError('denied')
    render(() => <LongNoteRoom onDone={() => undefined} />)
    await startListening()
    expect(phase()).toBe('blocked')
    expect(screen.getByRole('alert').textContent).toMatch(/Settings/)
  })

  it("with no note yet, takes the singer's own and keeps it", async () => {
    target.pick = { midi: 52, source: 'preset' }
    render(() => <LongNoteRoom onDone={() => undefined} />)
    expect(screen.getByTestId('long-note-any').textContent).toBe(
      'Any easy note',
    )
    expect(screen.queryByTestId('long-note-note')).toBeNull()

    await startListening()
    // No note to play before the take.
    expect(fake.tones).toEqual([])
    expect(phase()).toBe('listen')

    fake.frames = sequence(
      (t) => tone(60, 3, { startT: t }),
      (t) => silence(0.8, t),
    )
    flushFrames()
    await settle()

    expect(phase()).toBe('result')
    expect(screen.getByTestId('long-note-note').textContent).toBe('C4')
    expect(recorded.calls[0]).toMatchObject({ metrics: { targetMidi: 60 } })

    // Next time the room opens on it.
    cleanup()
    render(() => <LongNoteRoom onDone={() => undefined} />)
    expect(screen.getByTestId('long-note-note').textContent).toBe('C4')
  })

  it('starts the arrows from the voice type when there is no note', async () => {
    target.pick = { midi: 52, source: 'preset' }
    render(() => <LongNoteRoom onDone={() => undefined} />)
    fireEvent.click(screen.getByTestId('long-note-higher'))
    await settle()
    expect(screen.getByTestId('long-note-note').textContent).toBe('F3')
  })

  it('gives the mic back when the app goes to the background', async () => {
    render(() => <LongNoteRoom onDone={() => undefined} />)
    await startListening()
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
    document.dispatchEvent(new Event('visibilitychange'))
    expect(phase()).toBe('intro')
    expect(fake.released).toBe(1)
  })

  it('finishes the note when the mic is tapped mid-hold', async () => {
    render(() => <LongNoteRoom onDone={() => undefined} />)
    await startListening()
    // Still singing: no silence to end the note on its own.
    fake.frames = tone(57, 3)
    flushFrames()
    await settle()
    expect(phase()).toBe('hold')

    fireEvent.click(screen.getByTestId('long-note-mic'))
    await settle()
    expect(phase()).toBe('result')
    expect(recorded.calls).toHaveLength(1)
    expect(fake.released).toBe(1)
  })

  it('keeps the mic button where it was pressed', async () => {
    render(() => <LongNoteRoom onDone={() => undefined} />)
    await startListening()
    // The picker stays in the layout, out of sight and out of reach.
    const lower = screen.getByTestId('long-note-lower')
    expect(lower.hasAttribute('disabled')).toBe(true)
    expect(lower.parentElement?.getAttribute('aria-hidden')).toBe('true')
  })

  it('opens no mic when the singer leaves during the note', async () => {
    let endTone: () => void = () => undefined
    fake.toneGate = new Promise<void>((resolve) => {
      endTone = resolve
    })
    render(() => <LongNoteRoom onDone={() => undefined} />)
    fireEvent.click(screen.getByTestId('long-note-mic'))
    cleanup()
    endTone()
    await settle()
    expect(fake.acquired).toBe(0)
  })

  it('runs one take loop however many false starts', async () => {
    render(() => <LongNoteRoom onDone={() => undefined} />)
    await startListening()
    const cough = (): void => {
      fake.frames = sequence(
        (t) => tone(57, 0.05, { startT: t }),
        (t) => silence(0.8, t),
      )
      flushFrames()
    }
    // The controller's frame callback is a function named `tick`.
    const takeLoops = (): number =>
      rafQueue.filter((callback) => callback.name === 'tick').length
    for (let i = 0; i < 3; i++) {
      cough()
      await settle()
      expect(phase()).toBe('listen')
      expect(takeLoops()).toBe(1)
    }
  })

  it('lets no late landing move Merc after he settled', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    try {
      render(() => <LongNoteRoom onDone={() => undefined} />)
      await startListening()
      // A short sound starts the hold; the tap ends it as a false start and
      // the room goes back to the intro.
      fake.frames = tone(57, 0.1)
      flushFrames()
      await settle()
      expect(phase()).toBe('hold')
      fireEvent.click(screen.getByTestId('long-note-mic'))
      await settle()
      expect(phase()).toBe('intro')
      vi.advanceTimersByTime(1000)
      await settle()
      expect(
        screen.getByTestId('long-note-merc').getAttribute('data-merc-state'),
      ).toBe('idle')
    } finally {
      vi.useRealTimers()
    }
  })

  it('tells a singer off the note which way to go', async () => {
    target.pick = { midi: 52, source: 'preset' }
    render(() => <LongNoteRoom onDone={() => undefined} />)
    await startListening()
    // Steady, but 40 cents above C4: named C4, never inside its band.
    fake.frames = tone(60, 3, { detuneCents: 40 })
    flushFrames()
    await settle()
    expect(phase()).toBe('hold')
    expect(screen.getByText(/high|down/i, { selector: 'span' })).toBeTruthy()

    fake.frames = [...fake.frames, ...silence(0.8, 3)]
    flushFrames()
    await settle()
    expect(phase()).toBe('result')
    // The mic is closed: the line does not ask for more singing now.
    expect(
      screen.getByText(/hear it|still waiting/, { selector: 'p' }),
    ).toBeTruthy()
  })

  it('stops listening on a second tap and gives the mic back', async () => {
    render(() => <LongNoteRoom onDone={() => undefined} />)
    await startListening()
    fireEvent.click(screen.getByTestId('long-note-mic'))
    expect(phase()).toBe('intro')
    expect(fake.released).toBe(1)
  })
})
