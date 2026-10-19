import { cleanup, fireEvent, render, screen, within, } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { recordingContext, ribbonColours, } from '@/components/room-kit/ribbon-test-context'
import type { RoutineStop, StopResult, } from '@/components/room-kit/routine-stop'
import { ROUTINE_RESULT_HOLD_MS } from '@/components/room-kit/routine-stop'
import { EXERCISE_LONG_NOTE_LANTERN } from '@/lib/domain/exercise-contracts'
import { FPS, midiToF0, sequence, silence, tone } from '@/lib/glass/test-frames'
import type { HoldState } from '@/lib/hold/hold-engine'
import { createHoldState, holdTickFromFrame, LANTERN_LEVELS, tickHold, } from '@/lib/hold/hold-engine'
import type { TakeShape } from '@/lib/hold/test-takes'
import { realisticTake } from '@/lib/hold/test-takes'
import type { PitchFrame } from '@/lib/pitch-f0-stream'
import { installHaptics } from '@/lib/platform'
import { setExerciseLevel } from '@/stores/exercise-level'
import type { NativeDeviceApi } from '@/stores/native-shell-store'
import { registerNativeDevice } from '@/stores/native-shell-store'
import { accuracyTier, applyAccuracyTier, scoreMode, SENSITIVITY_PRESETS, sensitivityPreset, settings, } from '@/stores/settings-store'
import { STEADY_WORDS } from './chip-follower'
import lanternStyles from './Lantern.module.css'
import { CHIMNEY_BOTTOM, CHIMNEY_TOP, fillLevel, HOLD_FILL_MAX, LANTERN_VIEW_H, } from './lantern-geometry'
import styles from './LongNoteRoom.module.css'
import type { LongNoteMoment } from './merc-lines'
import { fillNote, MERC_LINES } from './merc-lines'
import { GLIDE_MS } from './stage-layout'
import type * as CaptureModule from './useLongNoteCapture'
import { TRACE_PX_PER_CENT } from './VoiceTrace'

// ── A capture the test feeds by hand ────────────────────────────

const fake = vi.hoisted(() => {
  const state = {
    frames: [] as PitchFrame[],
    acquireError: null as Error | null,
    /** When set, the mic takes this long to open: the permission prompt. */
    acquireGate: null as Promise<void> | null,
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
        if (fake.acquireGate !== null) return fake.acquireGate
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

// The room's haptics, counted through the seam the native app fills with
// the device's own at boot (installHaptics, main.tsx): what an iPhone feels.
const felt = { taps: 0, successes: 0 }
installHaptics({
  tapLight: () => {
    felt.taps += 1
  },
  success: () => {
    felt.successes += 1
  },
  warning: () => undefined,
})

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

interface MeasuredRoom {
  /** Sizes the stage and tells the room, as the browser's observer would. */
  resize: (width: number, height: number) => void
  mercEl: HTMLElement
}

/** The room on a stage whose size the test sets, and changes, by hand. */
function renderMeasuredRoom(width: number, height: number): MeasuredRoom {
  const observers: ResizeObserverCallback[] = []
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(callback: ResizeObserverCallback) {
        observers.push(callback)
      }
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    },
  )
  render(() => <LongNoteRoom onDone={() => undefined} />)
  const stage = screen.getByTestId('long-note-stage')
  let size = { width, height }
  Object.defineProperty(stage, 'clientWidth', { get: () => size.width })
  Object.defineProperty(stage, 'clientHeight', { get: () => size.height })
  const resize = (newWidth: number, newHeight: number): void => {
    size = { width: newWidth, height: newHeight }
    for (const callback of observers) callback([], {} as ResizeObserver)
  }
  resize(width, height)
  return { resize, mercEl: screen.getByTestId('long-note-merc') }
}

/**
 * A take on A3 on a 360 x 253 stage, to the note's end: he hops out of the
 * glass, and the result's taller top makes the stage 222 tall on the hop's
 * first frame. The timers and the clock are fake; the caller restores them.
 */
async function hopOutOfTheGlass(): Promise<
  MeasuredRoom & {
    /** The box's width as the hop began, px. */
    held: number
    boxWidth: () => number
    hopping: () => boolean
    /** Advances this many ms, a 60 Hz frame at a time. */
    frames: (ms: number) => void
    /** What shows: his size on screen, then where his feet are. */
    shown: () => number[]
  }
> {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] })
  const room = renderMeasuredRoom(360, 253)
  const boxWidth = (): number => parseFloat(room.mercEl.style.width)
  const hopping = (): boolean => room.mercEl.className.includes(styles.mercHop)
  const frames = (ms: number): void => {
    for (let t = 0; t < ms; t += 1000 / 60) {
      vi.advanceTimersByTime(1000 / 60)
      flushFrames()
    }
  }
  const shown = (): number[] => {
    const [, left, top, scale] =
      /translate\(([-\d.]+)px, ([-\d.]+)px\) scale\(([\d.]+)\)/
        .exec(room.mercEl.style.transform)
        ?.map(Number) ?? []
    const box = boxWidth()
    return [box * scale, left + box / 2, top + box * 0.81]
  }
  await startListening()

  // A take on A3: he hops into the glass and settles there.
  fake.frames = tone(57, 3)
  flushFrames()
  frames(1000)
  expect(phase()).toBe('hold')
  expect(hopping()).toBe(false)

  // The note ends. He hops out, and the stage gets shorter at once.
  fake.frames = [...fake.frames, ...silence(0.8, 3)]
  flushFrames()
  expect(phase()).toBe('result')
  expect(hopping()).toBe(true)
  const held = boxWidth()
  room.resize(360, 222)
  return { ...room, held, boxWidth, hopping, frames, shown }
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

/** A3-relative voice for `seconds`, its offset `cents(u)` u seconds in. */
const sung =
  (seconds: number, cents: (u: number) => number) =>
  (startT: number): PitchFrame[] =>
    voice(seconds, (t) => cents(t - startT), startT)

/** Hand the room one frame per animation frame, as a phone delivers them. */
function feed(frames: readonly PitchFrame[]): void {
  for (const frame of frames) {
    fake.frames.push(frame)
    flushFrames()
  }
}

interface RecordedRun {
  metrics: { targetMidi: number; durationMs: number; inBandSeconds: number }
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
      LANTERN_LEVELS.singer,
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

/** A practised singer: a slow wander, the tracker's grain, a light vibrato. */
const PRACTISED: TakeShape = {
  seconds: 26,
  wanderCents: 4,
  wanderSeconds: 0.4,
  jitterCents: 3,
  vibratoHz: 5.5,
  vibratoCents: 12,
  seed: 12,
}
/**
 * On the line all along, with a wide vibrato: +-30 cents, a spread of 21,
 * a steadiness under Singer's bar.
 */
const WIDE: TakeShape = { ...PRACTISED, vibratoCents: 30, seed: 18 }

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
 * The longest stretch, engine seconds, where the chip says something the
 * engine does not: the voice steady (its steadiness under STEADY_WORDS),
 * the top filling when it has stopped, or stopped when it fills.
 */
function longestClaimDisagreement(heard: readonly Heard[]): number {
  let worst = 0
  let since: number | null = null
  for (const { chip, state } of heard) {
    const filling = state.reach > state.topCharge + 1e-6
    const steady = (state.steadiness ?? 0) >= STEADY_WORDS
    const wrong =
      ((says('steady', chip) || says('topSteady', chip)) && !steady) ||
      ((says('topSteady', chip) || says('topFilling', chip)) && !filling) ||
      (says('topStalled', chip) && filling)
    if (!wrong) since = null
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
    // The room's tests sing at Singer, the +-30 cent band the room had
    // before levels; the level's own tests pick theirs.
    setExerciseLevel('singer')
    fake.frames = []
    fake.acquireError = null
    fake.acquireGate = null
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
    felt.taps = 0
    felt.successes = 0
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

  it('owns the dark stage, whatever the app theme', () => {
    // Review B of PR 973, M1: on the Light theme the room painted the
    // light --bg-primary behind its near-white timer, chips and note tag.
    render(() => <LongNoteRoom onDone={() => undefined} />)
    expect(screen.getByTestId('long-note-room').classList).toContain(
      'mp-dark-stage',
    )
  })

  it('says why the note tag will not play during a take, and plays it after', async () => {
    // Review B of PR 973, minor 10: the tag refused silently mid-take.
    render(() => <LongNoteRoom onDone={() => undefined} />)
    const tag = (): HTMLButtonElement =>
      screen.getByTestId('long-note-note') as HTMLButtonElement
    expect(tag().disabled).toBe(false)
    await startListening()
    const tones = fake.tones.length

    for (const take of [() => undefined, () => tone(57, 1)]) {
      const frames = take()
      if (frames !== undefined) {
        fake.frames = frames
        flushFrames()
        await settle()
      }
      expect(['listen', 'hold']).toContain(phase())
      expect(tag().disabled).toBe(true)
      expect(tag().title).toBe('Hear A3 after the take: the mic is listening.')
      fireEvent.click(tag())
      expect(fake.tones).toHaveLength(tones)
    }

    // The take over, it plays again.
    fake.frames = [...fake.frames, ...silence(0.8, 1)]
    flushFrames()
    await settle()
    expect(phase()).toBe('result')
    expect(tag().disabled).toBe(false)
    expect(tag().title).toBe('')
    fireEvent.click(tag())
    expect(fake.tones).toEqual([57, 57])
  })

  it('offers one "Hear A3" to a screen reader wherever it stands', async () => {
    // Review B of PR 973, minor 11: the tag and the picker's Hear were two
    // buttons of the same name in the intro.
    render(() => <LongNoteRoom onDone={() => undefined} />)
    expect(screen.getAllByRole('button', { name: 'Hear A3' })).toHaveLength(1)
    // The tag stays a tap target for a finger.
    fireEvent.click(screen.getByTestId('long-note-note'))
    expect(fake.tones).toEqual([57])

    await startListening()
    fake.frames = sequence(
      (t) => tone(57, 3, { startT: t }),
      (t) => silence(0.8, t),
    )
    flushFrames()
    await settle()
    expect(phase()).toBe('result')
    expect(screen.getAllByRole('button', { name: 'Hear A3' })).toHaveLength(1)
  })

  it('names the picker as a group for a screen reader', () => {
    // Review B of PR 973, minor 12: its label sat on a div with no role.
    render(() => <LongNoteRoom onDone={() => undefined} />)
    const picker = screen.getByRole('group', { name: 'The note to hold' })
    expect(picker).toBe(screen.getByTestId('long-note-picker'))
  })

  it('speaks Merc, the hold and the result from one region that is there from the start', async () => {
    // Review B of PR 973, minor 12: the chip's and the bubble's live
    // regions arrived with their first words, which readers often skip,
    // and the result had none.
    render(() => <LongNoteRoom onDone={() => undefined} />)
    const said = screen.getByTestId('long-note-said')
    expect(said.getAttribute('aria-live')).toBe('polite')
    expect(said.textContent).toBe(
      screen.getByTestId('long-note-line').textContent,
    )
    // The visible words are not regions of their own.
    expect(screen.getByTestId('long-note-line').hasAttribute('aria-live')).toBe(
      false,
    )

    await startListening()
    fake.frames = tone(57, 3)
    flushFrames()
    await settle()
    expect(phase()).toBe('hold')
    const chip = screen.getByTestId('long-note-chip')
    expect(chip.parentElement?.hasAttribute('aria-live')).toBe(false)
    expect(screen.getByTestId('long-note-said')).toBe(said)
    expect(said.textContent).toBe(chip.textContent)

    fake.frames = [...fake.frames, ...silence(0.8, 3)]
    flushFrames()
    await settle()
    expect(phase()).toBe('result')
    expect(screen.getByTestId('long-note-said')).toBe(said)
    expect(said.textContent).toMatch(/^\d+\.\d seconds\. Steadiness \d+\. /)
    expect(said.textContent).toContain(
      screen.getByTestId('long-note-line').textContent ?? '',
    )
  })

  it('hands focus to the control that takes the place of the one it was on', async () => {
    // Review B of PR 973, minor 12: focus fell to the page when the mic
    // button went at the result.
    render(() => <LongNoteRoom onDone={() => undefined} />)
    screen.getByTestId('long-note-mic').focus()
    await startListening()
    fake.frames = sequence(
      (t) => tone(57, 3, { startT: t }),
      (t) => silence(0.8, t),
    )
    flushFrames()
    await settle()
    expect(phase()).toBe('result')
    expect(document.activeElement).toBe(screen.getByTestId('long-note-again'))

    fireEvent.click(screen.getByTestId('long-note-again'))
    await settle()
    expect(phase()).toBe('listen')
    expect(document.activeElement).toBe(screen.getByTestId('long-note-mic'))
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

  it('times the 90 s cap and the run from the first voice, not the wait', async () => {
    // Review A of PR 973, m1 and m2: the cap and durationMs counted from
    // the mic opening, so a wait before singing cut the note short and
    // was credited as practice. The page's clock runs with the frames.
    let wall = 0
    vi.spyOn(performance, 'now').mockImplementation(() => wall)
    render(() => <LongNoteRoom onDone={() => undefined} />)
    await startListening()

    // Act: 40 s of room, then 55 s on the note: 95 s since the mic opened.
    fake.frames = sequence(
      (t) => silence(40, t),
      (t) => tone(57, 55, { startT: t }),
    )
    wall = 95_000
    flushFrames()
    await settle()

    // Assert: 55 s of singing is well inside the cap.
    expect(phase()).toBe('hold')

    // Act: on to 91 s of singing.
    fake.frames = [...fake.frames, ...tone(57, 36, { startT: 95 })]
    wall = 131_000
    flushFrames()
    await settle()

    // Assert: the cap ends it, and the run lasted the singing.
    expect(phase()).toBe('result')
    expect(recorded.calls).toHaveLength(1)
    const [entry] = recorded.calls as {
      metrics: { durationMs: number; inBandSeconds: number }
    }[]
    expect(entry.metrics.inBandSeconds).toBeGreaterThan(90)
    expect(entry.metrics.durationMs).toBeGreaterThanOrEqual(90_000)
    expect(entry.metrics.durationMs).toBeLessThanOrEqual(91_000)
  })

  it('closes the mic after a minute with no voice, and says so', async () => {
    // Review A of PR 973, m3: Merc fell asleep at 25 s, and the mic stayed
    // open for as long as the phone was left.
    let wall = 0
    vi.spyOn(performance, 'now').mockImplementation(() => wall)
    render(() => <LongNoteRoom onDone={() => undefined} />)
    await startListening()

    fake.frames = silence(59, 0)
    wall = 59_000
    flushFrames()
    await settle()
    expect(phase()).toBe('listen')

    fake.frames = [...fake.frames, ...silence(2, 59)]
    wall = 61_000
    flushFrames()
    await settle()
    expect(phase()).toBe('intro')
    expect(fake.released).toBe(1)
    expect(says('rest', screen.getByTestId('long-note-line').textContent)).toBe(
      true,
    )
  })

  it('with no note yet, listens while the voice goes on, then rests after a quiet minute', async () => {
    target.pick = { midi: 52, source: 'preset' }
    let wall = 0
    vi.spyOn(performance, 'now').mockImplementation(() => wall)
    render(() => <LongNoteRoom onDone={() => undefined} />)
    await startListening()

    // 70 s of a voice that never sits still on one note.
    fake.frames = sequence(
      ...Array.from(
        { length: 233 },
        (_, i) => (t: number) =>
          tone(i % 2 === 0 ? 55 : 59, 0.3, { startT: t }),
      ),
    )
    wall = 70_000
    flushFrames()
    await settle()
    expect(phase()).toBe('listen')

    // Then a minute and more of quiet.
    fake.frames = [...fake.frames, ...silence(61, 70)]
    wall = 131_000
    flushFrames()
    await settle()
    expect(phase()).toBe('intro')
    expect(fake.released).toBe(1)
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

  // Review A2 of PR 973, Major: once the room named the singer's note, it
  // replayed everything since the mic opened against it. A sound before
  // the note, then a pause, was a note the engine had already ended, so
  // the take ended the moment it began.
  it('with no note yet, a sentence before the note leaves the note to be held', async () => {
    target.pick = { midi: 52, source: 'preset' }
    render(() => <LongNoteRoom onDone={() => undefined} />)
    await startListening()

    // Act: "okay, ready", 1.6 s of speech well off A3, a breath, then A3.
    feed(
      sequence(
        (t) => silence(1, t),
        sung(1.6, (u) => 400 + 250 * Math.sin(2 * Math.PI * 1.7 * u)),
        (t) => silence(0.8, t),
        (t) => tone(57, 6, { startT: t }),
      ),
    )
    await settle()

    // Assert: the singer is still holding A3, and the mic is still open.
    expect(phase()).toBe('hold')
    expect(fake.released).toBe(0)
    expect(recorded.calls).toHaveLength(0)

    // Act: the note ends.
    feed(silence(0.8, 9.4))
    await settle()

    // Assert: one run on A3, timed from the note's first voice.
    expect(phase()).toBe('result')
    const [run] = recorded.calls as RecordedRun[]
    expect(run.metrics.targetMidi).toBe(57)
    expect(run.metrics.inBandSeconds).toBeGreaterThan(5.5)
    expect(run.metrics.durationMs).toBeGreaterThanOrEqual(6000)
    expect(run.metrics.durationMs).toBeLessThan(7000)
  })

  it('with no note yet, keeps nothing of a hum that crossed the note before it', async () => {
    target.pick = { midi: 52, source: 'preset' }
    render(() => <LongNoteRoom onDone={() => undefined} />)
    await startListening()

    // Act: a tentative hum sliding up across A3, a breath, then A3.
    feed(
      sequence(
        (t) => silence(1, t),
        sung(2, (u) => -150 + 120 * u + 40 * Math.sin(2 * Math.PI * 3 * u)),
        (t) => silence(0.6, t),
        (t) => tone(57, 6, { startT: t }),
      ),
    )
    await settle()

    // Assert: nothing kept from the hum. keepRun writes the history first,
    // then the best and the remembered note, so no history means neither.
    expect(phase()).toBe('hold')
    expect(recorded.calls).toHaveLength(0)
    expect(memory.note).toBeNull()

    // Act: the note ends.
    feed(silence(0.8, 9.6))
    await settle()

    // Assert: the run kept is the note's.
    const [run] = recorded.calls as RecordedRun[]
    expect(recorded.calls).toHaveLength(1)
    expect(run.metrics.inBandSeconds).toBeGreaterThan(5.5)
    expect(memory.note).toBe(57)
  })

  it('with no note yet, restarts nothing over a cough before the note', async () => {
    target.pick = { midi: 52, source: 'preset' }
    render(() => <LongNoteRoom onDone={() => undefined} />)
    await startListening()

    // Act: a cough, quiet, then A3.
    feed(
      sequence(
        (t) => silence(1, t),
        sung(0.1, () => 700),
        (t) => silence(1.9, t),
        (t) => tone(57, 6, { startT: t }),
      ),
    )
    await settle()

    // Assert: one window all along, the note held from its start.
    expect(phase()).toBe('hold')
    expect(fake.windows).toBe(1)

    feed(silence(0.8, 9))
    await settle()
    const [run] = recorded.calls as RecordedRun[]
    expect(run.metrics.durationMs).toBeGreaterThanOrEqual(6000)
    expect(run.metrics.durationMs).toBeLessThan(7000)
    expect(run.metrics.inBandSeconds).toBeGreaterThan(5.5)
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

  // Owner, 11 Oct 2026: "its a exercise which gets done or not, so we
  // don't even have to keep it if user left". Back drops a hold (the room
  // goes away with it); the app going to the background drops it the same.
  it('drops a hold when the app goes to the background: nothing kept, the mic closed, the intro back', async () => {
    render(() => <LongNoteRoom onDone={() => undefined} />)
    await startListening()
    // Three seconds on the note, still singing.
    fake.frames = tone(57, 3)
    flushFrames()
    await settle()
    expect(phase()).toBe('hold')
    expect(shownLevel()).toBeGreaterThan(0.1)

    const hidden = vi
      .spyOn(document, 'visibilityState', 'get')
      .mockReturnValue('hidden')
    document.dispatchEvent(new Event('visibilitychange'))
    await settle()
    hidden.mockRestore()

    // No run, no best, no note remembered, so no practice time either.
    expect(phase()).toBe('intro')
    expect(recorded.calls).toHaveLength(0)
    expect(
      localStorage.getItem('pitchperfect_long_note_lantern_bests'),
    ).toBeNull()
    expect(memory.note).toBeNull()
    expect(screen.queryByTestId('long-note-result')).toBeNull()
    // The mic closed, the lantern empty, and one plain line.
    expect(fake.released).toBe(1)
    expect(shownLevel()).toBeCloseTo(0, 6)
    expect(says('left', screen.getByTestId('long-note-line').textContent)).toBe(
      true,
    )

    // Back in the app, a new take starts from nothing.
    await startListening()
    expect(phase()).toBe('listen')
    fake.frames = sequence(
      (t) => tone(57, 2, { startT: t }),
      (t) => silence(0.8, t),
    )
    flushFrames()
    await settle()
    expect(phase()).toBe('result')
    expect(recorded.calls).toHaveLength(1)
  })

  it('picks the level in the corner across from "?": the accuracy tier, set as Settings sets it, and the next take is heard at it', async () => {
    setExerciseLevel('learning')
    render(() => <LongNoteRoom onDone={() => undefined} />)
    const pill = (): HTMLElement => screen.getByTestId('long-note-level')
    const band = (): number =>
      parseFloat(screen.getByTestId('long-note-band').style.height) / 2
    expect(pill().textContent).toBe('Learning')
    expect(pill().getAttribute('aria-label')).toBe('Level: Learning')
    expect(band()).toBeCloseTo(40 * TRACE_PX_PER_CENT, 6)

    // The three tiers, the one in use pressed, and where they live; a tap
    // picks one and closes.
    fireEvent.click(pill())
    const sheet = screen.getByRole('dialog', { name: 'Level' })
    expect(sheet.textContent).toContain('Accuracy Tier')
    const levels = within(
      within(sheet).getByRole('group', { name: 'Levels' }),
    ).getAllByRole('button')
    expect(levels.map((row) => row.getAttribute('data-level'))).toEqual([
      'learning',
      'singer',
      'professional',
    ])
    expect(levels.map((row) => row.getAttribute('aria-pressed'))).toEqual([
      'true',
      'false',
      'false',
    ])
    fireEvent.click(
      within(sheet).getByRole('button', { name: /^Professional\b/ }),
    )
    expect(screen.queryByRole('dialog', { name: 'Level' })).toBeNull()
    expect(pill().textContent).toBe('Professional')
    expect(band()).toBeCloseTo(20 * TRACE_PX_PER_CENT, 6)
    // Set through applyAccuracyTier, as Settings sets it: the tier, its mic
    // preset and its score mode.
    expect(accuracyTier()).toBe('professional')
    expect(sensitivityPreset()).toBe('noisy')
    expect(scoreMode()).toBe('full')
    expect(settings().minConfidence).toBe(
      SENSITIVITY_PRESETS.noisy.minConfidence,
    )

    // Out of reach while the take listens, and the take is heard at
    // Professional: 30 cents sharp is off its line, so the note is never
    // found.
    await startListening()
    expect(screen.queryByTestId('long-note-level')).toBeNull()
    fake.frames = sequence(
      (t) => tone(57.3, 3, { startT: t }),
      (t) => silence(0.8, t),
    )
    flushFrames()
    await settle()
    expect(phase()).toBe('result')
    expect(recorded.calls).toHaveLength(0)
    expect(pill().textContent).toBe('Professional')
  })

  it('takes a tier picked in Settings as its level, and keeps a take at the level it opened at', async () => {
    render(() => <LongNoteRoom onDone={() => undefined} />)
    const pill = (): HTMLElement => screen.getByTestId('long-note-level')
    const band = (): number =>
      parseFloat(screen.getByTestId('long-note-band').style.height) / 2
    expect(band()).toBeCloseTo(30 * TRACE_PX_PER_CENT, 6)

    // Settings' own control picks Professional: between takes, the room
    // follows.
    applyAccuracyTier('professional')
    expect(pill().textContent).toBe('Professional')
    expect(band()).toBeCloseTo(20 * TRACE_PX_PER_CENT, 6)

    // A take opens at Singer, and the tier moves to Professional 0.15 s in,
    // before the lock (Settings, or another device through the account).
    applyAccuracyTier('singer')
    await startListening()
    const take = sequence(
      (t) => tone(57.25, 3, { startT: t }),
      (t) => silence(0.8, t),
    )
    fake.frames = take.filter((frame) => frame.t < 0.15)
    flushFrames()
    applyAccuracyTier('professional')
    fake.frames = take
    flushFrames()
    await settle()

    // 25 cents sharp is inside Singer's band and outside Professional's:
    // the take kept Singer's, found the note and was kept.
    expect(phase()).toBe('result')
    expect(recorded.calls).toHaveLength(1)

    // The next take is heard at Professional.
    fireEvent.click(screen.getByTestId('long-note-again'))
    await settle()
    expect(phase()).toBe('listen')
    expect(band()).toBeCloseTo(20 * TRACE_PX_PER_CENT, 6)
  })

  it('keeps the screen on while it listens and holds, and only then', async () => {
    // Review B of PR 973, M2: the mic tap is the singer's last touch, and a
    // phone that locks 30 s after it hid the page and ended the hold there.
    const keepAwake = vi.fn()
    const unregister = registerNativeDevice({
      keepAwake,
    } as unknown as NativeDeviceApi)
    try {
      const { unmount } = render(() => (
        <LongNoteRoom onDone={() => undefined} />
      ))
      expect(keepAwake).not.toHaveBeenCalled()

      await startListening()
      expect(keepAwake).toHaveBeenLastCalledWith(true)

      // Three seconds on the note and a breath: the result lets it sleep.
      fake.frames = sequence(
        (t) => tone(57, 3, { startT: t }),
        (t) => silence(0.8, t),
      )
      flushFrames()
      await settle()
      expect(phase()).toBe('result')
      expect(keepAwake).toHaveBeenLastCalledWith(false)

      // Again listens; the page going to the background lets it sleep.
      fireEvent.click(screen.getByTestId('long-note-again'))
      await settle()
      expect(keepAwake).toHaveBeenLastCalledWith(true)
      const hidden = vi
        .spyOn(document, 'visibilityState', 'get')
        .mockReturnValue('hidden')
      document.dispatchEvent(new Event('visibilitychange'))
      expect(phase()).toBe('intro')
      expect(keepAwake).toHaveBeenLastCalledWith(false)
      hidden.mockRestore()

      // Leaving mid-hold lets it sleep too.
      await startListening()
      fake.frames = tone(57, 1)
      flushFrames()
      await settle()
      expect(phase()).toBe('hold')
      expect(keepAwake).toHaveBeenLastCalledWith(true)
      unmount()
      expect(keepAwake).toHaveBeenLastCalledWith(false)

      // Each call flips the switch: on, off, on, off, on, off.
      expect(keepAwake.mock.calls.map(([on]) => on as boolean)).toEqual([
        true,
        false,
        true,
        false,
        true,
        false,
      ])
    } finally {
      unregister()
    }
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

  it('waits through the note it plays, then is the singer turn from the open mic', async () => {
    let endTone: () => void = () => undefined
    fake.toneGate = new Promise<void>((resolve) => {
      endTone = resolve
    })
    const micState = (): string | undefined =>
      screen.queryByTestId('long-note-mic')?.dataset.state
    render(() => <LongNoteRoom onDone={() => undefined} />)
    const resting = micState()
    fireEvent.click(screen.getByTestId('long-note-mic'))
    await settle()
    const cue = micState()
    endTone()
    await settle()
    const listening = micState()

    feed(sung(1, () => 0)(0))

    expect(phase()).toBe('hold')
    expect([resting, cue, listening, micState()]).toEqual([
      'ready',
      'wait',
      'sing',
      'sing',
    ])
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

  it('opens no mic in the background when the app goes there during the note', async () => {
    // Review A of PR 973, m7: the start went on behind the singer's back,
    // and the mic opened in the background once the note ended.
    let endTone: () => void = () => undefined
    fake.toneGate = new Promise<void>((resolve) => {
      endTone = resolve
    })
    render(() => <LongNoteRoom onDone={() => undefined} />)
    fireEvent.click(screen.getByTestId('long-note-mic'))
    await settle()
    expect(phase()).toBe('starting')

    const hidden = vi
      .spyOn(document, 'visibilityState', 'get')
      .mockReturnValue('hidden')
    document.dispatchEvent(new Event('visibilitychange'))
    expect(phase()).toBe('intro')

    endTone()
    await settle()
    hidden.mockRestore()
    expect(fake.acquired).toBe(0)
    expect(phase()).toBe('intro')
  })

  it('comes back to the intro, not a refusal, when the mic is refused in the background', async () => {
    // No note yet, so the mic opens in the tap; the prompt is still up
    // when the app goes to the background, and the platform says no.
    target.pick = { midi: 52, source: 'preset' }
    const { CaptureError } = await import('./useLongNoteCapture')
    let refuse: (error: Error) => void = () => undefined
    fake.acquireGate = new Promise<void>((_, reject) => {
      refuse = reject
    })
    render(() => <LongNoteRoom onDone={() => undefined} />)
    fireEvent.click(screen.getByTestId('long-note-mic'))
    await settle()
    expect(phase()).toBe('starting')

    const hidden = vi
      .spyOn(document, 'visibilityState', 'get')
      .mockReturnValue('hidden')
    document.dispatchEvent(new Event('visibilitychange'))
    refuse(new CaptureError('unavailable'))
    await settle()
    hidden.mockRestore()

    expect(phase()).toBe('intro')
    expect(fake.released).toBe(1)
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

  it('keeps Merc to still moves under reduced motion: no drop, hop or jumping cheer', async () => {
    // Review B of PR 973, minor 2: the room's CSS stopped its own hops,
    // but Merc's canvas still dropped in, hopped and cheered with jumps
    // and sparkles.
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query.includes('reduce'),
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }))
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    try {
      render(() => <LongNoteRoom onDone={() => undefined} />)
      const mercEl = (): HTMLElement => screen.getByTestId('long-note-merc')
      const inGlass = (): boolean =>
        mercEl().style.transform.includes('scale(0.7)')
      // Every state he shows, from the first.
      const shown = [mercEl().getAttribute('data-merc-state') ?? '']
      const watch = new MutationObserver(() => {
        shown.push(mercEl().getAttribute('data-merc-state') ?? '')
      })
      watch.observe(mercEl(), {
        attributes: true,
        attributeFilter: ['data-merc-state'],
      })
      const wait = async (ms: number): Promise<void> => {
        vi.advanceTimersByTime(ms)
        await settle()
      }
      await wait(1200)
      await startListening()

      // Into the glass with the voice.
      fake.frames = tone(57, 11.5)
      flushFrames()
      await wait(1000)
      expect(inGlass()).toBe(true)
      // The goal: out of the glass, and his cheer.
      fake.frames = [...fake.frames, ...tone(57, 1.5, { startT: 11.5 })]
      flushFrames()
      await wait(700)
      expect(inGlass()).toBe(false)
      await wait(1700)
      // A breath ends it, half full: the result's cheer.
      fake.frames = [...fake.frames, ...silence(0.8, 13)]
      flushFrames()
      await wait(2000)
      watch.disconnect()

      expect(phase()).toBe('result')
      expect(screen.getByTestId('lantern-halo').style.opacity).toBe(
        String(GOAL_SHINE),
      )
      expect(shown).toContain('lock')
      for (const lively of ['drop', 'hop', 'celebrate']) {
        expect(shown).not.toContain(lively)
      }
    } finally {
      vi.useRealTimers()
    }
  })

  it("sizes Merc's canvas once a move, and glides it by its transform", async () => {
    // Review B of PR 973, minor 3: the canvas followed the gliding scale,
    // so the renderer resized it, and rebuilt its render targets, on every
    // frame of a glide.
    let wall = 0
    vi.spyOn(performance, 'now').mockImplementation(() => wall)
    const { resize, mercEl } = renderMeasuredRoom(430, 461)
    const scaleOf = (): number =>
      Number(/scale\(([\d.]+)\)/.exec(mercEl.style.transform)?.[1])
    const before = parseFloat(mercEl.style.width) * scaleOf()

    // Act: the stage gets shorter (the controls below it change), and the
    // lantern and Merc shrink over a glide.
    resize(430, 380)
    const widths = new Set<string>()
    const shown: number[] = []
    for (let i = 0; i < 45; i++) {
      wall += 1000 / 60
      flushFrames()
      widths.add(mercEl.style.width)
      shown.push(parseFloat(mercEl.style.width) * scaleOf())
    }

    // Assert: one canvas size for the whole glide, the new one, while what
    // shows still eases from the old size down to it.
    expect(widths.size).toBe(1)
    const after = parseFloat(mercEl.style.width)
    expect(after).toBeLessThan(before)
    expect(shown[0]).toBeLessThan(before)
    expect(shown[0]).toBeGreaterThan(after)
    expect(shown[shown.length - 1]).toBeCloseTo(after, 6)
    for (let i = 1; i < shown.length; i++) {
      expect(shown[i]).toBeLessThanOrEqual(shown[i - 1] + 1e-9)
    }
  })

  it("holds Merc's canvas size and his aim through a hop, and takes the new size after it", async () => {
    // Review B2 of PR 973, N1: at a result the hop out of the glass and a
    // shorter stage (the result's taller top) land together. The hop eases
    // the transform in CSS, but width and height land at once, so on the
    // hop's first frame the old transform sat on a new, smaller box: Merc
    // shrank and his feet jumped against the hop.
    try {
      // Arrange, act: he hops out of the glass onto a shorter stage.
      const { mercEl, held, boxWidth, hopping, shown } =
        await hopOutOfTheGlass()
      const lantern = screen.getByTestId('long-note-lantern')

      // Assert: the box keeps its size while he hops...
      const during: number[] = []
      const aims = new Set<string>()
      const lanternWidths = new Set<string>()
      for (let t = 0; t < 600; t += 1000 / 60) {
        vi.advanceTimersByTime(1000 / 60)
        flushFrames()
        if (!hopping()) continue
        during.push(boxWidth())
        aims.add(mercEl.style.transform)
        lanternWidths.add(lantern.style.width)
      }
      expect(during.length).toBeGreaterThan(30)
      expect(new Set(during)).toEqual(new Set([held]))
      // ...and his transform keeps one aim, where the glide ends, while the
      // lantern glides under it. The hop's CSS ease starts again from where
      // it is at each new value, so an aim that moved with the glide left
      // the ease trailing it, and the new size cut the rest short in one
      // frame as the hop ended.
      expect(lanternWidths.size).toBeGreaterThan(10)
      expect(aims.size).toBe(1)

      // ...and takes the shorter stage's size once the hop is over, with
      // what shows unmoved: the same size, his feet on the same spot.
      let last = shown()
      while (hopping()) {
        last = shown()
        vi.advanceTimersByTime(1000 / 60)
        flushFrames()
      }
      expect(boxWidth()).toBeLessThan(held)
      expect(boxWidth()).toBeCloseTo(held * (222 / 253), 6)
      shown().forEach((value, i) => expect(value).toBeCloseTo(last[i], 6))
    } finally {
      vi.useRealTimers()
    }
  })

  it('runs his hop again from a stage that moves mid-hop, so he lands before his new size', async () => {
    // A stage that moves after the hop began gives him a new end to aim at.
    // His ease starts again from where it is, and so does the glide, and
    // each needs its full 650 ms from there. Had the hop still ended 700 ms
    // after it began, the new size and the gliding lantern would have cut
    // both short in one frame.
    try {
      // Arrange: he is 300 ms into his hop out of the glass.
      const { mercEl, resize, held, boxWidth, hopping, frames, shown } =
        await hopOutOfTheGlass()
      frames(300)
      expect(hopping()).toBe(true)

      // Act: the stage gets shorter again.
      resize(360, 200)
      const aim = mercEl.style.transform

      // Assert: 600 ms on, past where the first hop would have ended, he is
      // still hopping, to the one new aim, on the box he began with...
      frames(600)
      expect(hopping()).toBe(true)
      expect(mercEl.style.transform).toBe(aim)
      expect(boxWidth()).toBe(held)

      // ...and the box takes the new size once he lands, with what shows
      // unmoved.
      let last = shown()
      while (hopping()) {
        last = shown()
        frames(1000 / 60)
      }
      expect(boxWidth()).toBeCloseTo(held * (200 / 253), 6)
      shown().forEach((value, i) => expect(value).toBeCloseTo(last[i], 6))
    } finally {
      vi.useRealTimers()
    }
  })

  // Two 26 s takes through the rendered room, frame by frame: about 1 s here
  // and 1.9 s on a CI runner, so this case gets 10 s (TESTING.md 3.7).
  it('fills the top past the goal only with steady singing, as the engine counts it', async () => {
    for (const [shape, brims] of [
      [PRACTISED, true],
      [WIDE, false],
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
  }, 10_000)

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
    // The note ended while the top was still filling: hold on longer.
    expect(
      says(
        'resultLonger',
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
    // Felt: a tick as the note locks, a success at the goal and at the brim.
    expect(felt).toEqual({ taps: 1, successes: 2 })
    expect(
      says('resultBrim', screen.getByTestId('long-note-line').textContent),
    ).toBe(true)
  })

  it('calls a voice steady only when its steadiness says so: a natural vibrato brims at Learning, and nothing calls it steady', async () => {
    // A natural vibrato (+-40 cents, a steadiness of about 44) clears
    // Learning's bar and fills the top. The light says how far the level
    // lets it fill; the words say how steady the voice was.
    setExerciseLevel('learning')
    render(() => <LongNoteRoom onDone={() => undefined} />)
    await startListening()

    // Act: four frames an animation frame (the room takes whatever the
    // mic delivered since the last one). A chip line stands at least
    // 0.7 s, so reading the chip every 4 frames misses none.
    const take = [
      ...realisticTake(57, {
        seconds: 25.5,
        vibratoHz: 5.5,
        vibratoCents: 40,
        jitterCents: 2,
        seed: 5,
      }),
      ...silence(0.8, 25.5),
    ]
    const chips = new Set<string>()
    for (let i = 0; i < take.length; i += 4) {
      fake.frames.push(...take.slice(i, i + 4))
      flushFrames()
      const chip = screen.queryByTestId('long-note-chip')?.textContent
      if (chip !== undefined) chips.add(chip)
    }
    await settle()

    // Assert: to the brim, a steadiness under STEADY_WORDS, and not one
    // chip, result line or spoken result that calls the voice steady.
    expect(phase()).toBe('result')
    expect(shownLevel()).toBeCloseTo(1, 6)
    const steadiness = Number(
      /\d+/.exec(
        screen.getByTestId('long-note-steadiness').textContent ?? '',
      )?.[0],
    )
    expect(steadiness).toBeLessThan(STEADY_WORDS)
    const line = screen.getByTestId('long-note-line').textContent
    expect(says('resultBrim', line)).toBe(true)
    const words = [
      ...chips,
      line,
      screen.getByTestId('long-note-said').textContent,
    ]
    for (const text of words) expect(text ?? '').not.toMatch(/\bsteady\b/i)
    expect([...chips].some((chip) => says('topFilling', chip))).toBe(true)
    expect([...chips].some((chip) => says('brim', chip))).toBe(true)
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
    expect(felt).toEqual({ taps: 0, successes: 0 })
    expect(screen.getByTestId('long-note-result').textContent).toMatch(
      /^0\.0 s/,
    )
    expect(
      says('missed', screen.getByTestId('long-note-line').textContent),
    ).toBe(true)
  })

  // Two 26 s takes through the rendered room, as above: 1.7 s on a CI
  // runner, so this case gets 10 s too.
  it('says the goal is halfway, then whether the top fills', async () => {
    for (const shape of [PRACTISED, WIDE]) {
      render(() => <LongNoteRoom onDone={() => undefined} />)
      await startListening()

      const heard = hear(realisticTake(57, shape))

      // The goal's line first, on the goal itself.
      const said = changes(heard).filter((h) => h.state.goalReached)
      const goal = heard.find((h) => h.state.events.includes('goal'))
      expect(says('full', said[0].chip)).toBe(true)
      expect(said[0].state.clock).toBe(goal?.state.clock)
      // Then whether the top fills, never against the engine for longer
      // than the line takes to settle and be read.
      const top = said.slice(1).map((h) => h.chip)
      if (shape === PRACTISED) {
        expect(
          top.some(
            (chip) => says('topSteady', chip) || says('topFilling', chip),
          ),
        ).toBe(true)
        expect(says('brim', top[top.length - 1])).toBe(true)
      } else {
        expect(top.some((chip) => says('topStalled', chip))).toBe(true)
        expect(top.some((chip) => says('brim', chip))).toBe(false)
      }
      expect(longestClaimDisagreement(heard)).toBeLessThanOrEqual(
        1 + 0.7 + 1 / FPS,
      )
      cleanup()
    }
  }, 10_000)

  describe('in the Warm-up', () => {
    /** The third stop of four, counting what the room hands it. */
    function warmUp(settledNote: number | null = null) {
      const handed = { finish: [] as StopResult[], skip: 0 }
      const stop: RoutineStop = {
        index: 2,
        count: 4,
        settledNote,
        finish: (result) => handed.finish.push(result),
        skip: () => {
          handed.skip += 1
        },
      }
      return { stop, handed }
    }

    afterEach(() => {
      vi.useRealTimers()
    })

    it('opens on the stop\'s chip, Merc\'s cue and "Skip stop", with no level', () => {
      const { stop, handed } = warmUp()
      render(() => <LongNoteRoom onDone={() => undefined} routine={stop} />)

      expect(screen.getByTestId('long-note-chip').textContent).toBe(
        'Warm-up 3 of 4',
      )
      expect(screen.getByTestId('long-note-line').textContent).toBe(
        fillNote(MERC_LINES.routine[0].text, 'A3'),
      )
      expect(screen.queryByTestId('long-note-level')).toBeNull()
      fireEvent.click(screen.getByTestId('long-note-skip-stop'))
      expect(handed.skip).toBe(1)
    })

    it('opens on the note an earlier stop started from, with no voiceprint and none kept', () => {
      target.pick = { midi: 60, source: 'preset' }
      render(() => (
        <LongNoteRoom onDone={() => undefined} routine={warmUp(55).stop} />
      ))

      expect(screen.getByTestId('long-note-note').textContent).toBe('G3')
    })

    it('holds its result without Again, Done or another note, then hands its seconds and note on once', async () => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
      const { stop, handed } = warmUp()
      render(() => <LongNoteRoom onDone={() => undefined} routine={stop} />)
      await startListening()
      expect(
        screen.queryByTestId('long-note-chip')?.textContent ?? '',
      ).not.toBe('Warm-up 3 of 4')

      fake.frames = sequence(
        (t) => tone(57, 3, { startT: t }),
        (t) => silence(0.8, t),
      )
      flushFrames()
      await settle()

      expect(phase()).toBe('result')
      expect(screen.queryByTestId('long-note-again')).toBeNull()
      expect(screen.queryByTestId('long-note-done')).toBeNull()
      expect(screen.queryByText('Pick another note')).toBeNull()
      expect(recorded.calls).toHaveLength(1)
      const seconds = /\d+\.\d s/u.exec(
        screen.getByTestId('long-note-result').textContent ?? '',
      )?.[0]
      expect(seconds).toBeDefined()
      vi.advanceTimersByTime(GLIDE_MS + ROUTINE_RESULT_HOLD_MS)
      expect(handed.finish).toEqual([
        { id: EXERCISE_LONG_NOTE_LANTERN, line: seconds, settledNote: 57 },
      ])
    })
  })
})
