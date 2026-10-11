import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FPS, midiToF0, sequence, silence, tone } from '@/lib/glass/test-frames'
import type { HoldState } from '@/lib/hold/hold-engine'
import { createHoldState, HOLD_PRESETS, holdTickFromFrame, tickHold, } from '@/lib/hold/hold-engine'
import type { TakeShape } from '@/lib/hold/test-takes'
import { realisticTake } from '@/lib/hold/test-takes'
import type { PitchFrame } from '@/lib/pitch-f0-stream'
import lanternStyles from './Lantern.module.css'
import { CHIMNEY_BOTTOM, CHIMNEY_TOP, fillLevel, HOLD_FILL_MAX, LANTERN_VIEW_H, } from './lantern-geometry'
import styles from './LongNoteRoom.module.css'
import type { LongNoteMoment } from './merc-lines'
import { fillNote, MERC_LINES } from './merc-lines'
import { recordingContext, ribbonColours } from './trace-test-context'
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

const merc = vi.hoisted(() => ({
  states: [] as string[],
  options: [] as unknown[],
}))
vi.mock('@/lib/merc/stage', () => ({
  mountMercStage: (_host: HTMLElement, options: unknown) => {
    merc.options.push(options)
    return {
      ok: true,
      setState: (name: string) => merc.states.push(name),
      setVoice: () => undefined,
      setPaused: () => undefined,
      destroy: () => undefined,
    }
  },
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
const { GOAL_SHINE } = await import('./useLongNoteController')

function phase(): string | null {
  return screen.getByTestId('long-note-room').getAttribute('data-phase')
}

async function startListening(): Promise<void> {
  fireEvent.click(screen.getByTestId('long-note-mic'))
  await settle()
}

/** A voiced take on A3 whose offset follows `cents(t)`, from `startT`. */
function voice(
  seconds: number,
  cents: (t: number) => number,
  startT: number,
): PitchFrame[] {
  return Array.from({ length: Math.round(seconds * FPS) }, (_, i) => ({
    t: startT + i / FPS,
    f0: midiToF0(57 + cents(startT + i / FPS) / 100),
    conf: 0.9,
    rms: 0.6,
  }))
}

/**
 * The chip and the lantern's level after a frame, beside the engine's own
 * state on that frame.
 */
interface Heard {
  chip: string | null
  level: number
  state: HoldState
}

/**
 * Hand the room one frame per animation frame, as a phone delivers them,
 * and replay the same frames through the engine alongside: the trace is
 * amber exactly where `state.inBand` is false.
 */
function hear(frames: readonly PitchFrame[]): Heard[] {
  let state = createHoldState()
  let previous: PitchFrame | null = null
  return frames.map((frame) => {
    fake.frames.push(frame)
    flushFrames()
    state = tickHold(
      state,
      holdTickFromFrame(frame, previous, 57),
      HOLD_PRESETS.lantern,
    )
    previous = frame
    return {
      chip: screen.queryByTestId('long-note-chip')?.textContent ?? null,
      level: shownLevel(),
      state,
    }
  })
}

/** Each change of the chip's words, with the frame it happened on. */
function changes(heard: readonly Heard[]): Heard[] {
  return heard.filter(
    (now, i) => now.chip !== null && now.chip !== heard[i - 1]?.chip,
  )
}

const SHARP = /sharp/i
const FLAT = /flat/i
const OFF_WORDS = /sharp|flat|off the note/i

/** Whether a chip or a bubble says one of a moment's lines on a note. */
const says = (
  moment: LongNoteMoment,
  text: string | null,
  note = 'A3',
): boolean =>
  MERC_LINES[moment].some((line) => fillNote(line.text, note) === text)

/** A practised singer: a slow wander, the tracker's grain, a vibrato. */
const PRACTISED: TakeShape = {
  seconds: 26,
  wanderCents: 4,
  wanderSeconds: 0.4,
  jitterCents: 3,
  vibratoHz: 5.5,
  vibratoCents: 35,
  seed: 12,
}
/** On the line all along, but wobbling on it. */
const WOBBLY: TakeShape = {
  seconds: 26,
  wanderCents: 15,
  wanderSeconds: 0.2,
  jitterCents: 4,
  seed: 18,
}

/** The lantern's level, read off the liquid's window in its back layer. */
function shownLevel(): number {
  const liquid = screen
    .getByTestId('lantern-back')
    .querySelector<HTMLElement>(`.${lanternStyles.window}`)
  const shift = /translateY\((-?[\d.]+)%\)/.exec(liquid?.style.transform ?? '')
  const surface = (Number(shift?.[1]) / 100) * LANTERN_VIEW_H
  return (CHIMNEY_BOTTOM - surface) / (CHIMNEY_BOTTOM - CHIMNEY_TOP)
}

const haloShine = (): number =>
  Number(screen.getByTestId('lantern-halo').style.opacity)
const sparkles = (): number =>
  screen
    .getByTestId('lantern-front')
    .querySelectorAll(`.${lanternStyles.sparkle}`).length

/**
 * The longest stretch, engine seconds, where the chip calls the voice
 * steady (or the top not filling) while the engine's own steady flag, the
 * one that fills the top, says otherwise.
 */
function longestSteadyDisagreement(heard: readonly Heard[]): number {
  let worst = 0
  let since: number | null = null
  for (const { chip, state } of heard) {
    const claim =
      says('steady', chip) || says('topSteady', chip)
        ? true
        : says('topShaky', chip)
          ? false
          : null
    if (claim === null || claim === state.steady) since = null
    else {
      since ??= state.clock
      worst = Math.max(worst, state.clock - since)
    }
  }
  return worst
}

/**
 * The longest stretch, engine seconds, where the chip's words and the
 * trace's colour disagree: off-note words on a cyan frame, or on-note words
 * on an amber one. Silent frames have no colour and do not count.
 */
function longestDisagreement(heard: readonly Heard[]): number {
  let worst = 0
  let since: number | null = null
  for (const { chip, state } of heard) {
    const voiced = state.silentSeconds === 0 && state.needleCents !== null
    const disagree =
      voiced && chip !== null && OFF_WORDS.test(chip) === state.inBand
    if (!disagree) since = null
    else {
      since ??= state.clock
      worst = Math.max(worst, state.clock - since)
    }
  }
  return worst
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
    merc.options = []
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

  it('keeps Merc content while the note holds, and singing off it', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    try {
      render(() => <LongNoteRoom onDone={() => undefined} />)
      await startListening()
      const mercState = (): string | null =>
        screen.getByTestId('long-note-merc').getAttribute('data-merc-state')

      // On the note: the hold locks, and he keeps the lock's closed eyes.
      fake.frames = tone(57, 1.5)
      flushFrames()
      await settle()
      expect(phase()).toBe('hold')
      vi.advanceTimersByTime(2000)
      await settle()
      expect(mercState()).toBe('lock')

      // Off it, the band breaks: he sings after the voice again.
      fake.frames = [
        ...fake.frames,
        ...tone(57, 1, { startT: 1.5, detuneCents: 60 }),
      ]
      flushFrames()
      await settle()
      expect(mercState()).toBe('sing')

      // Back on it: content again.
      fake.frames = [...fake.frames, ...tone(57, 1, { startT: 2.5 })]
      flushFrames()
      await settle()
      expect(mercState()).toBe('lock')
    } finally {
      vi.useRealTimers()
    }
  })

  it('runs the line behind Merc in the glass and over the frame, and dims it for the result', async () => {
    render(() => <LongNoteRoom onDone={() => undefined} />)
    // Back to front: the liquid, the line in the glass, Merc, the glass and
    // frame, the line outside the glass.
    const layers = [
      'lantern-back',
      'long-note-trace-inner',
      'long-note-merc',
      'lantern-front',
      'long-note-trace',
    ].map((id) => screen.getByTestId(id))
    for (let i = 1; i < layers.length; i++) {
      expect(
        layers[i - 1].compareDocumentPosition(layers[i]) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy()
    }

    await startListening()
    fake.frames = sequence(
      (t) => tone(57, 3, { startT: t }),
      (t) => silence(0.8, t),
    )
    flushFrames()
    await settle()

    expect(phase()).toBe('result')
    for (const id of ['long-note-trace-inner', 'long-note-trace']) {
      expect(screen.getByTestId(id).classList).toContain(styles.lineAway)
    }
  })

  it("keeps all of Merc's canvas on the stage beside the lantern", () => {
    // A celebration's sparkles, a hop's landing and the drop's splash reach
    // the canvas's edge. The stages of a 430 x 932 and a 390 x 844 phone.
    const width = vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get')
    const height = vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get')
    for (const [w, h] of [
      [430, 461],
      [390, 373],
    ]) {
      width.mockReturnValue(w)
      height.mockReturnValue(h)
      render(() => <LongNoteRoom onDone={() => undefined} />)
      const lantern = screen.getByTestId('long-note-lantern')
      const canvas = screen.getByTestId('long-note-merc')
      const x = /translate\(([-\d.]+)px/.exec(canvas.style.transform)
      expect(x).not.toBeNull()
      const left = parseFloat(lantern.style.left)
      expect(left).toBeGreaterThan(0)
      expect(
        left + Number(x?.[1]) + parseFloat(canvas.style.width),
      ).toBeLessThanOrEqual(w)
      cleanup()
    }
  })

  it("puts his celebration's stars on his far side, off the lantern", async () => {
    render(() => <LongNoteRoom onDone={() => undefined} />)
    // His renderer arrives in a chunk of its own.
    await vi.waitFor(() => expect(merc.options).toHaveLength(1))
    expect(merc.options[0]).toMatchObject({ sparkles: 'right' })
  })

  it('centres the lantern while Merc is in the glass, gliding there', async () => {
    // Review of pass 3: in the hold the lantern sat 14 to 22 px left of
    // the middle with nothing beside it. A 430 x 932 phone's stage.
    vi.useFakeTimers({ toFake: ['performance'] })
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(430)
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(461)
    render(() => <LongNoteRoom onDone={() => undefined} />)
    const lantern = screen.getByTestId('long-note-lantern')
    const middle = (): number =>
      parseFloat(lantern.style.left) + parseFloat(lantern.style.width) / 2
    const run = (seconds: number): number[] => {
      const seen: number[] = []
      for (let i = 0; i < seconds * 60; i++) {
        vi.advanceTimersByTime(1000 / 60)
        flushFrames()
        seen.push(middle())
      }
      return seen
    }
    // Merc beside it: moved over to make room for him.
    expect(middle()).toBeLessThan(215 - 40)
    await startListening()

    // Act: the voice starts and he hops into the glass.
    fake.frames = tone(57, 1.5)
    const glide = [middle(), ...run(1)]

    // Assert: it eases to the middle, a few px a frame at most.
    expect(phase()).toBe('hold')
    expect(glide[glide.length - 1]).toBeCloseTo(215, 6)
    for (let i = 1; i < glide.length; i++) {
      expect(Math.abs(glide[i] - glide[i - 1])).toBeLessThan(3)
    }
  })

  it("turns the voice amber where the light stops filling, by the engine's centre", async () => {
    vi.useFakeTimers({ toFake: ['performance'] })
    try {
      const { ctx, strokes } = recordingContext()
      // The overloads end on WebGPU's context; the recorder stands in for 2D.
      vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
        ctx as never,
      )
      render(() => <LongNoteRoom onDone={() => undefined} />)
      await startListening()
      /** Whether the ribbon drawn by the next frames has any amber in it. */
      const amberDrawn = async (atSeconds: number): Promise<boolean> => {
        vi.advanceTimersByTime(atSeconds * 1000 - performance.now())
        strokes.length = 0
        flushFrames(2)
        await settle()
        const ribbon = strokes.filter((stroke) => stroke.stops.length > 0)
        expect(ribbon.length).toBeGreaterThan(0)
        return ribbon.some((stroke) =>
          ribbonColours(stroke.stops).some((colour) => colour.amber),
        )
      }

      // On the note, with one raw reading 90 cents off: the engine's
      // smoothed centre moves 14 cents, still on the line, and the light
      // keeps filling. The ribbon stays cyan.
      fake.frames = [
        ...tone(57, 0.5),
        ...tone(57, 1 / 60, { startT: 0.5, detuneCents: 90 }),
        ...tone(57, 0.5, { startT: 0.5 + 1 / 60 }),
      ]
      expect(await amberDrawn(1.05)).toBe(false)
      expect(phase()).toBe('hold')

      // Off it for half a second: amber where the light stopped.
      fake.frames = [
        ...fake.frames,
        ...tone(57, 0.5, { startT: 1.04, detuneCents: 60 }),
      ]
      expect(await amberDrawn(1.6)).toBe(true)
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
    expect(screen.getByText(/sharp/i, { selector: 'span' })).toBeTruthy()

    fake.frames = [...fake.frames, ...silence(0.8, 3)]
    flushFrames()
    await settle()
    expect(phase()).toBe('result')
    // The mic is closed: the line does not ask for more singing now.
    expect(screen.getByText(/hear it/i, { selector: 'p' })).toBeTruthy()
  })

  it('stops listening on a second tap and gives the mic back', async () => {
    render(() => <LongNoteRoom onDone={() => undefined} />)
    await startListening()
    fireEvent.click(screen.getByTestId('long-note-mic'))
    expect(phase()).toBe('intro')
    expect(fake.released).toBe(1)
  })

  it('names the side the moment the engine stops the light, in one line while it lasts', async () => {
    render(() => <LongNoteRoom onDone={() => undefined} />)
    await startListening()

    // Two seconds on A3, then 50 cents sharp, then 50 cents flat.
    const heard = hear([
      ...voice(2, () => 0, 0),
      ...voice(1.5, () => 50, 2),
      ...voice(1.5, () => -50, 3.5),
    ])

    const sharpAt = heard.findIndex((h) => SHARP.test(h.chip ?? ''))
    const breakAt = heard.findIndex((h) => h.state.events.includes('break'))
    expect(breakAt).toBeGreaterThan(0)
    // Said on the engine's break itself: amber, and sharp of the band.
    expect(sharpAt).toBe(breakAt)
    expect(heard[sharpAt].state.inBand).toBe(false)
    expect(heard[sharpAt].state.needleCents ?? 0).toBeGreaterThan(30)
    // One sharp line for as long as the voice stays sharp.
    const whileSharp = heard
      .slice(sharpAt)
      .filter((h) => h.state.clock < 3.5)
      .map((h) => h.chip)
    expect(new Set(whileSharp).size).toBe(1)

    // Across to flat: named once the flat side has held, on an amber frame.
    const flatAt = heard.findIndex((h) => FLAT.test(h.chip ?? ''))
    expect(flatAt).toBeGreaterThan(sharpAt)
    expect(heard[flatAt].state.inBand).toBe(false)
    expect(heard[flatAt].state.needleCents ?? 0).toBeLessThan(-30)
    const amberFlat = heard.findIndex(
      (h) => h.state.clock > 3.5 && !h.state.inBand,
    )
    expect(
      heard[flatAt].state.clock - heard[amberFlat].state.clock,
    ).toBeLessThan(0.05)
    expect(longestDisagreement(heard)).toBeLessThanOrEqual(0.7 + 1 / FPS)
  })

  it('catches up within 0.7 s when the voice leaves the note right after the lock', async () => {
    render(() => <LongNoteRoom onDone={() => undefined} />)
    await startListening()

    // On the note just long enough to lock, then 45 cents flat, then back.
    const heard = hear([
      ...voice(0.4, () => 0, 0),
      ...voice(1.2, () => -45, 0.4),
      ...voice(2, () => 0, 1.6),
    ])

    const said = changes(heard).map((h) => h.chip)
    expect(said).toEqual([
      expect.stringContaining('A3'),
      expect.stringMatching(FLAT),
      expect.stringContaining('A3'),
    ])
    expect(longestDisagreement(heard)).toBeLessThanOrEqual(0.7 + 1 / FPS)
  })

  it('never flickers, and never says one thing while the line shows another', async () => {
    render(() => <LongNoteRoom onDone={() => undefined} />)
    await startListening()

    // On the note, then six seconds hovering at the band's sharp edge: the
    // engine breaks and locks again about every half second.
    const heard = hear([
      ...voice(1.5, () => 0, 0),
      ...voice(6, (t) => 32 + 16 * Math.sin(2 * Math.PI * 1.2 * t), 1.5),
    ])
    const breaks = heard.filter((h) => h.state.events.includes('break'))
    expect(breaks.length).toBeGreaterThan(4)

    const said = changes(heard)
    // On the note once, then a little sharp, and it stays said.
    expect(said.map((h) => h.chip)).toEqual([
      expect.stringContaining('A3'),
      expect.stringMatching(SHARP),
    ])
    for (const h of said) {
      // Words and colour agree on the frame the words change.
      expect(h.state.inBand).toBe(!OFF_WORDS.test(h.chip ?? ''))
    }
    // In between, the colour flickers at the edge; the words wait it out.
    expect(longestDisagreement(heard)).toBeLessThanOrEqual(0.7 + 1 / FPS)
  })

  it('steps Merc out of the glass at the goal to cheer, then sings along beside it', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    try {
      render(() => <LongNoteRoom onDone={() => undefined} />)
      await startListening()
      const mercEl = (): HTMLElement => screen.getByTestId('long-note-merc')
      const inGlass = (): boolean =>
        mercEl().style.transform.includes('scale(0.7)')
      const mercState = (): string | null =>
        mercEl().getAttribute('data-merc-state')

      // Arrange: on the note, just short of the goal, in the glass.
      fake.frames = tone(57, 11.5)
      flushFrames()
      await settle()
      vi.advanceTimersByTime(1000)
      await settle()
      expect(inGlass()).toBe(true)
      expect(mercState()).toBe('lock')

      // Act: the goal.
      fake.frames = [...fake.frames, ...tone(57, 1.5, { startT: 11.5 })]
      flushFrames()
      await settle()

      // Assert: the take goes on, and he hops out of the glass.
      expect(phase()).toBe('hold')
      expect(mercState()).toBe('hop')
      expect(inGlass()).toBe(false)
      // A slip off the note mid-cheer leaves him cheering beside it.
      fake.frames = [
        ...fake.frames,
        ...tone(57, 0.5, { startT: 13, detuneCents: 60 }),
      ]
      flushFrames()
      await settle()
      vi.advanceTimersByTime(650)
      await settle()
      expect(mercState()).toBe('celebrate')
      // The cheer over, he sings after the voice again, still beside it.
      vi.advanceTimersByTime(1600)
      await settle()
      expect(mercState()).toBe('sing')
      fake.frames = [...fake.frames, ...tone(57, 1, { startT: 13.5 })]
      flushFrames()
      await settle()
      expect(mercState()).toBe('lock')
      expect(inGlass()).toBe(false)
    } finally {
      vi.useRealTimers()
    }
  })

  it('fills the top past the goal only with steady singing, as the engine counts it', async () => {
    for (const [shape, brims] of [
      [PRACTISED, true],
      [WOBBLY, false],
    ] as const) {
      // Arrange
      render(() => <LongNoteRoom onDone={() => undefined} />)
      await startListening()

      // Act: 26 seconds on the line, frame by frame.
      const heard = hear(realisticTake(57, shape))

      // Assert: the light is the engine's two fills on every frame, half
      // full at the goal, and only the steady take reaches the brim.
      for (const h of heard) {
        expect(h.level).toBeCloseTo(
          fillLevel(h.state.charge, h.state.topCharge),
          6,
        )
      }
      const goal = heard.find((h) => h.state.events.includes('goal'))
      expect(goal?.level).toBeCloseTo(HOLD_FILL_MAX, 2)
      const last = heard[heard.length - 1]
      if (brims) {
        expect(last.level).toBeCloseTo(1, 6)
      } else {
        expect(last.level).toBeGreaterThan(HOLD_FILL_MAX + 0.04)
        expect(last.level).toBeLessThan(0.9)
      }
      cleanup()
    }
  })

  it('shows the real fill at the result: halfway at the goal, half the halo', async () => {
    vi.useFakeTimers({ toFake: ['performance'] })
    // A note no other test sings, so this first run on it is no new best.
    target.pick = { midi: 55, source: 'voiceprint' }
    render(() => <LongNoteRoom onDone={() => undefined} />)
    await startListening()

    // Two seconds past the goal, then a breath.
    fake.frames = [
      ...realisticTake(55, { ...PRACTISED, seconds: 14 }),
      ...silence(0.8, 14),
    ]
    flushFrames()
    await settle()
    expect(phase()).toBe('result')
    const atResult = shownLevel()
    for (let i = 0; i < 90; i++) {
      vi.advanceTimersByTime(1000 / 60)
      flushFrames()
    }

    // Nothing tops it up: it stays where the take left it.
    expect(shownLevel()).toBeCloseTo(atResult, 6)
    expect(atResult).toBeGreaterThan(HOLD_FILL_MAX)
    expect(atResult).toBeLessThan(0.7)
    expect(haloShine()).toBe(GOAL_SHINE)
    expect(sparkles()).toBe(0)
    expect(
      says(
        'resultFull',
        screen.getByTestId('long-note-line').textContent,
        'G3',
      ),
    ).toBe(true)
  })

  it('brims, with all of the halo and the sparkles, when steady singing fills the top', async () => {
    render(() => <LongNoteRoom onDone={() => undefined} />)
    await startListening()

    fake.frames = [...realisticTake(57, PRACTISED), ...silence(0.8, 26)]
    flushFrames()
    await settle()

    expect(phase()).toBe('result')
    expect(shownLevel()).toBeCloseTo(1, 6)
    expect(haloShine()).toBe(1)
    expect(sparkles()).toBeGreaterThan(0)
    expect(
      says('resultBrim', screen.getByTestId('long-note-line').textContent),
    ).toBe(true)
  })

  it('celebrates nothing it would not keep: a vibrato at the band edge never finds the note', async () => {
    // Review A of PR 973, M2: 28 c sharp with a +-40 c vibrato never locks,
    // and the room used to reach the goal on it anyway: the haptic, the
    // halo, "half full", and then a result that kept nothing.
    render(() => <LongNoteRoom onDone={() => undefined} />)
    await startListening()

    // Act: 25 s at the band's sharp edge, frame by frame, then a breath.
    const heard = hear(
      realisticTake(57, {
        seconds: 25,
        offsetCents: 28,
        vibratoHz: 5.5,
        vibratoCents: 40,
        jitterCents: 3,
        seed: 1,
      }),
    )
    fake.frames = [...fake.frames, ...silence(0.8, 25)]
    flushFrames()
    await settle()

    // Assert: no light, no goal line and no halo, and the result says so.
    expect(heard.some((h) => says('full', h.chip))).toBe(false)
    for (const h of heard) expect(h.level).toBeCloseTo(0, 6)
    expect(haloShine()).toBe(0)
    expect(phase()).toBe('result')
    expect(recorded.calls).toHaveLength(0)
    expect(screen.getByTestId('long-note-result').textContent).toMatch(
      /^0\.0 s/,
    )
    expect(
      says('missed', screen.getByTestId('long-note-line').textContent),
    ).toBe(true)
  })

  it('says the goal is halfway and the top takes steady singing, then whether it fills', async () => {
    for (const shape of [PRACTISED, WOBBLY]) {
      render(() => <LongNoteRoom onDone={() => undefined} />)
      await startListening()

      const heard = hear(realisticTake(57, shape))

      // The goal's line first, on the goal itself.
      const said = changes(heard).filter((h) => h.state.goalReached)
      const goal = heard.find((h) => h.state.events.includes('goal'))
      expect(says('full', said[0].chip)).toBe(true)
      expect(said[0].state.clock).toBe(goal?.state.clock)
      // Then whether the top fills, never against the engine's own steady
      // flag for longer than the line takes to settle and be read.
      const top = said.slice(1).map((h) => h.chip)
      if (shape === PRACTISED) {
        expect(top.some((chip) => says('topSteady', chip))).toBe(true)
        expect(says('brim', top[top.length - 1])).toBe(true)
      } else {
        expect(top.some((chip) => says('topShaky', chip))).toBe(true)
        expect(top.some((chip) => says('brim', chip))).toBe(false)
      }
      expect(longestSteadyDisagreement(heard)).toBeLessThanOrEqual(
        1 + 0.7 + 1 / FPS,
      )
      cleanup()
    }
  })
})
