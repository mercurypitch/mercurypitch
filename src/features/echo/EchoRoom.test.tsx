// ============================================================
// EchoRoom: a run through the real engine, with the mic and Merc faked
// ============================================================
//
// The capture is fed by hand (frames on the window's own clock), Merc's
// call is a schedule with no sound, and time moves only when a test moves
// it: the timers and performance.now() are fake, and each screen frame is
// flushed by hand. Everything between is the room's own: the controller,
// the machine, the sequence engine, the scene and the lines.

import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as SpeechModule from '@/components/room-kit/merc-speech'
import { recordingContext, ribbonColours, } from '@/components/room-kit/ribbon-test-context'
import mic from '@/components/room-kit/RoomControls.module.css'
import type { RoutineStop, StopResult, } from '@/components/room-kit/routine-stop'
import { ROUTINE_RESULT_HOLD_MS } from '@/components/room-kit/routine-stop'
import { EXERCISE_ECHO_STARS } from '@/lib/domain/exercise-contracts'
import { silence, tone } from '@/lib/glass/test-frames'
import type { PitchFrame } from '@/lib/pitch-f0-stream'
import { installHaptics } from '@/lib/platform'
import type { PhraseNote } from '@/lib/sequence/sequence-engine'
import { setExerciseLevel } from '@/stores/exercise-level'
import { CLOUD_LAYER } from './echo-geometry'
import type * as CallModule from './merc-call'
import { ECHO_LINES, fillFields } from './merc-lines'
import type * as SamplerModule from './merc-sampler'
import type * as CaptureModule from './useEchoCapture'

// ── A capture the test feeds by hand ────────────────────────────

const fake = vi.hoisted(() => ({
  frames: [] as PitchFrame[],
  acquireError: null as Error | null,
  windows: 0,
  released: 0,
}))

vi.mock('./useEchoCapture', async () => {
  const actual = await vi.importActual<typeof CaptureModule>('./useEchoCapture')
  const ctx = {
    currentTime: 0,
    outputLatency: 0,
    baseLatency: 0,
    state: 'running',
  } as unknown as AudioContext
  return {
    ...actual,
    useEchoCapture: () => ({
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
        fake.frames = []
      },
      peekFrames: () => fake.frames.slice(),
      takeFrames: () => {
        const taken = fake.frames
        fake.frames = []
        return taken
      },
      playTone: () => Promise.resolve(),
      audio: () => Promise.resolve(ctx),
      runningAudio: () => ctx,
    }),
  }
})

// ── Merc's call: a schedule, and no sound ──────────────────────

const calls = vi.hoisted(() => ({
  sung: [] as { notes: PhraseNote[]; startAt: number }[],
  stopped: 0,
}))

vi.mock('./merc-call', async () => {
  const actual = await vi.importActual<typeof CallModule>('./merc-call')
  return {
    ...actual,
    SYNTH_CALL: {
      sing: (
        _ctx: AudioContext,
        notes: readonly PhraseNote[],
        startAt: number,
      ) => {
        calls.sung.push({ notes: [...notes], startAt })
        return {
          ...actual.callTimes(notes, startAt),
          stop: () => {
            calls.stopped += 1
          },
        }
      },
    },
  }
})

// Merc's own voice never loads here (jsdom decodes nothing), so every call
// goes to the synth above. The load is counted, not made.
const voiceLoads = vi.hoisted(() => ({ count: 0 }))

vi.mock('./merc-sampler', async () => {
  const actual = await vi.importActual<typeof SamplerModule>('./merc-sampler')
  return {
    ...actual,
    preloadMercVoice: () => {
      voiceLoads.count += 1
    },
  }
})

// Merc's renderer needs WebGL: a stand-in that draws nothing.
vi.mock('@/lib/merc/stage', () => ({
  mountMercStage: () => ({
    ok: true,
    setState: () => undefined,
    setVoice: () => undefined,
    setPaused: () => undefined,
    destroy: () => undefined,
  }),
}))

const kept = vi.hoisted(() => ({
  history: [] as unknown[],
  bests: [] as { level: string; run: unknown }[],
  root: 60 as number | null,
  improved: true,
  /** A first visit: the demo opens the room. */
  demoAutoPlays: false,
}))

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
vi.mock('@/stores/exercise-history-store', () => ({
  recordExerciseResult: (entry: unknown) => kept.history.push(entry),
}))
vi.mock('@/stores/echo-store', () => ({
  rememberedEchoRoot: () => kept.root,
  rememberEchoRoot: (midi: number) => {
    kept.root = midi
  },
  recordEchoBest: (level: string, run: unknown) => {
    kept.bests.push({ level, run })
    return { improved: kept.improved }
  },
  echoBest: () => null,
  // The demo has been seen on this device: the room opens on its own start
  // (demo/EchoDemo.test.tsx plays the demo).
  echoDemoSeen: () => true,
  markEchoDemoSeen: () => undefined,
  echoDemoAutoPlays: () => kept.demoAutoPlays,
}))
// No voiceprint on this device: the root is the one kept, or the singer's.
vi.mock('@/db/services/voiceprint-service', () => ({
  loadLocalVoiceprints: () => [],
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

const { CaptureError } = await import('./useEchoCapture')
const { EchoRoom } = await import('./EchoRoom')
const { PHRASE_SHOW_MS, QUIET_LIMIT_SECONDS, YOUR_TURN } =
  await import('./echo-controller-contract')

// ── Screen frames, flushed by hand ─────────────────────────────

let rafQueue: FrameRequestCallback[] = []

function flush(count = 1): void {
  for (let i = 0; i < count; i++) {
    const due = rafQueue
    rafQueue = []
    for (const callback of due) callback(performance.now())
  }
}

async function settle(): Promise<void> {
  for (let i = 0; i < 8; i++) await Promise.resolve()
}

const room = (): HTMLElement => screen.getByTestId('echo-room')
const phase = (): string | undefined => room().dataset.phase
const texts = (moment: keyof typeof ECHO_LINES, fields = {}) =>
  ECHO_LINES[moment].map((line) => fillFields(line.text, fields))
const stars = (size?: string): HTMLElement[] =>
  screen
    .queryAllByTestId('echo-star')
    .filter((el) => size === undefined || el.dataset.size === size)
const rings = (style?: string): Element[] =>
  screen
    .queryAllByTestId('echo-ring')
    .filter(
      (el) => style === undefined || el.getAttribute('data-style') === style,
    )

let done = 0

/** Open the room and tap the mic: with a root kept, the first call starts. */
async function startRun(): Promise<void> {
  render(() => <EchoRoom onDone={() => (done += 1)} />)
  fireEvent.click(screen.getByTestId('echo-mic'))
  await settle()
}

/** The call now being sung, as Merc was asked to sing it. */
const currentCall = () => calls.sung[calls.sung.length - 1]

/** Past the end of the call at the speaker: the singer's turn. */
function toTurn(): void {
  const { notes, startAt } = currentCall()
  const end = startAt + Math.max(...notes.map((n) => n.at + n.seconds))
  vi.advanceTimersByTime(Math.ceil(end * 1000) + 20)
  flush()
}

/** The response's frames start after the call and its tail. */
const RESPONSE_T = 0.05

/** Each note sung back on pitch, half a second each, from `from`. */
function singBack(notes: readonly PhraseNote[], from: number): PitchFrame[] {
  const frames: PitchFrame[] = []
  let t = from
  for (const note of notes) {
    frames.push(...tone(note.midi, 0.5, { startT: t }))
    t += 0.5 + 1 / 60
  }
  return frames
}

/** The window's clock where the response starts (the call's end plus its tail). */
function responseStart(): number {
  const { notes, startAt } = currentCall()
  return startAt + Math.max(...notes.map((n) => n.at + n.seconds)) + 0.2
}

/** Sing the current phrase back: `how` builds the response's frames. */
function respond(
  how: (notes: readonly PhraseNote[], from: number) => PitchFrame[],
): void {
  toTurn()
  fake.frames.push(...how(currentCall().notes, responseStart() + RESPONSE_T))
  flush()
}

/** The rest of the phrase sung back on pitch from `from`, in this window. */
function respondRest(from: number): void {
  fake.frames.push(...singBack(currentCall().notes, from))
  flush()
}

/** Every phrase sung through, to the result. */
function singRun(): void {
  for (let i = 0; i < 5; i++) {
    respond(singBack)
    vi.advanceTimersByTime(PHRASE_SHOW_MS)
  }
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] })
  rafQueue = []
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    rafQueue.push(cb)
    return rafQueue.length
  })
  vi.stubGlobal('cancelAnimationFrame', () => undefined)
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe(): void {}
      disconnect(): void {}
    },
  )
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(390)
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(844)
  // jsdom has no canvas: the ribbon draws into nothing unless a test records it.
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
  setExerciseLevel('learning')
  fake.frames = []
  fake.acquireError = null
  fake.windows = 0
  fake.released = 0
  calls.sung = []
  calls.stopped = 0
  kept.history = []
  kept.bests = []
  kept.root = 60
  kept.improved = true
  kept.demoAutoPlays = false
  spoken.said = []
  spoken.hushed = 0
  felt.taps = 0
  felt.successes = 0
  done = 0
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('the intro', () => {
  it("opens on Merc's line, the level and the mic, with an empty sky", () => {
    render(() => <EchoRoom onDone={() => undefined} />)

    expect(phase()).toBe('intro')
    expect(texts('intro')).toContain(
      screen.getByTestId('echo-bubble').textContent,
    )
    expect(screen.getByTestId('echo-level').textContent).toContain('Learning')
    expect(stars()).toEqual([])
    expect(rings()).toEqual([])
  })

  it("starts loading Merc's voice as the singer comes in, before any call", () => {
    voiceLoads.count = 0
    render(() => <EchoRoom onDone={() => undefined} />)

    expect(voiceLoads.count).toBe(1)
    expect(calls.sung).toEqual([])
  })

  it('asks for any easy note first when there is no root to start on', () => {
    kept.root = null
    render(() => <EchoRoom onDone={() => undefined} />)

    expect(texts('introAny')).toContain(
      screen.getByTestId('echo-bubble').textContent,
    )
  })

  it('has Merc say his opening line aloud as the room opens', () => {
    render(() => <EchoRoom onDone={() => undefined} />)

    expect(spoken.said).toHaveLength(1)
    expect(['intro-first', 'intro-listen']).toContain(spoken.said[0])
  })

  it('says his "any easy note" line aloud when there is no root yet', () => {
    kept.root = null
    render(() => <EchoRoom onDone={() => undefined} />)

    expect(['any-easy', 'any-start']).toContain(spoken.said[0])
  })

  it('leaves the opening to the demo on a first visit', () => {
    kept.demoAutoPlays = true
    render(() => <EchoRoom onDone={() => undefined} />)

    expect(texts('intro')).toContain(
      screen.getByTestId('echo-bubble').textContent,
    )
    expect(spoken.said).toEqual([])
  })
})

describe('a phrase', () => {
  it('starts with Merc singing the call: a ring for each note, fading in on its onset', async () => {
    await startRun()

    expect(phase()).toBe('call')
    expect(calls.sung).toHaveLength(1)
    const { notes } = currentCall()
    expect(notes).toHaveLength(3)
    expect(rings('waiting')).toHaveLength(3)
    const delays = rings().map((ring) =>
      Number.parseFloat((ring as HTMLElement).style.animationDelay),
    )
    expect(delays).toEqual(
      notes.map((note) => Math.round((currentCall().startAt + note.at) * 1000)),
    )
    expect(screen.getByTestId('echo-merc').dataset.mercState).toBe('sing')
  })

  it('gives the singer their turn once the call has ended at the speaker', async () => {
    await startRun()
    toTurn()

    expect(phase()).toBe('response')
    expect(screen.getByTestId('echo-chip').textContent).toBe(YOUR_TURN)
    expect(rings('active')).toHaveLength(1)
    expect(screen.queryByTestId('echo-bubble')).toBeNull()
  })

  it('lights a star for a landed note, with a light tap', async () => {
    await startRun()
    toTurn()
    const first = currentCall().notes[0]
    fake.frames.push(
      ...tone(first.midi, 0.5, { startT: responseStart() + 0.05 }),
    )
    flush()

    expect(stars('phrase')).toHaveLength(1)
    expect(rings()).toHaveLength(2)
    expect(felt.taps).toBe(1)
  })

  it('says a phrase sung through, then moves it into the top band for the next call', async () => {
    await startRun()
    respond(singBack)

    expect(phase()).toBe('between')
    expect(stars('phrase')).toHaveLength(3)
    expect(texts('phraseAll', { count: 3 })).toContain(
      screen.getByTestId('echo-bubble').textContent,
    )
    expect(felt.successes).toBe(1)

    vi.advanceTimersByTime(PHRASE_SHOW_MS)

    expect(phase()).toBe('call')
    expect(calls.sung).toHaveLength(2)
    expect(stars('finished')).toHaveLength(3)
    expect(stars('phrase')).toEqual([])
  })

  it('leaves a missed note its ring, dimmed when the phrase ends, and counts what landed', async () => {
    await startRun()
    respond((notes, from) => [
      ...tone(notes[0].midi, 0.5, { startT: from }),
      ...silence(1.6, from + 0.5),
    ])

    expect(phase()).toBe('between')
    expect(stars('phrase')).toHaveLength(1)
    expect(rings('missed')).toHaveLength(2)
    expect(texts('phraseSome', { landed: 1, count: 3 })).toContain(
      screen.getByTestId('echo-bubble').textContent,
    )
  })

  it('names a note held flat by its place', async () => {
    await startRun()
    respond((notes, from) => [
      ...tone(notes[0].midi, 0.5, { startT: from }),
      ...tone(notes[1].midi, 4.6, { startT: from + 0.52, detuneCents: -70 }),
      ...silence(1.6, from + 5.14),
    ])

    expect(texts('flatNote', { nth: 'second' })).toContain(
      screen.getByTestId('echo-bubble').textContent,
    )
  })

  it('hears nothing over the call, and asks the singer to wait for it', async () => {
    await startRun()
    const { notes, startAt } = currentCall()
    // A voice a fourth away from Merc's first note while he sings it.
    fake.frames.push(
      ...tone(notes[0].midi + 5, 0.5, { startT: startAt + 0.05 }),
    )
    flush()

    expect(texts('early')).toContain(
      screen.getByTestId('echo-bubble').textContent,
    )

    // His own first note, picked up during the call, lands nothing either.
    fake.frames.push(...tone(notes[0].midi, 0.6, { startT: startAt + 0.6 }))
    toTurn()
    expect(stars()).toEqual([])
  })

  it('sings the same phrase again on "hear it again"', async () => {
    await startRun()
    toTurn()
    fireEvent.click(screen.getByTestId('echo-replay'))

    expect(phase()).toBe('call')
    expect(calls.sung).toHaveLength(2)
    expect(calls.sung[1].notes).toEqual(calls.sung[0].notes)
    expect(texts('replay')).toContain(
      screen.getByTestId('echo-bubble').textContent,
    )
  })

  it('offers no "hear it again" at the professional level', async () => {
    setExerciseLevel('professional')
    await startRun()
    toTurn()

    expect(currentCall().notes).toHaveLength(5)
    expect(screen.queryByTestId('echo-replay')).toBeNull()
  })
})

describe('the voice', () => {
  it('draws the voice toward the note: amber off it, cyan on it, and gone when the phrase ends', async () => {
    const { ctx, strokes } = recordingContext()
    // The overloads end on WebGPU's context; the recorder stands in for 2D.
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      ctx as never,
    )
    await startRun()
    toTurn()
    const first = currentCall().notes[0]
    const from = responseStart() + 0.05
    const drawn = () => strokes.filter((stroke) => stroke.stops.length > 0)
    const amber = () =>
      drawn().some((stroke) =>
        ribbonColours(stroke.stops).some((colour) => colour.amber),
      )

    strokes.length = 0
    fake.frames.push(...tone(first.midi + 1.5, 0.15, { startT: from }))
    flush()
    expect(drawn().length).toBeGreaterThan(0)
    expect(amber()).toBe(true)

    strokes.length = 0
    fake.frames.push(...tone(first.midi, 0.15, { startT: from + 0.15 }))
    flush()
    const last = drawn()[drawn().length - 1]
    const colours = ribbonColours(last.stops)
    expect(colours[colours.length - 1]?.amber).toBe(false)

    respondRest(from + 0.3)
    expect(phase()).toBe('between')
    strokes.length = 0
    flush()
    expect(drawn()).toEqual([])
  })
})

describe('the result', () => {
  it('counts the lit stars, keeps the run and offers Again and Done', async () => {
    await startRun()
    singRun()

    expect(phase()).toBe('result')
    expect(screen.getByTestId('echo-result').textContent).toContain('15 of 15')
    expect(screen.getByTestId('echo-result-label').textContent).toBe(
      'notes on pitch',
    )
    expect(screen.getByTestId('echo-result-detail').textContent).toMatch(
      /^Accuracy \d+$/u,
    )
    expect(stars('result')).toHaveLength(15)
    expect(screen.getByTestId('echo-result-plate')).toBeTruthy()
    // The celebration comes up two frames after the result, in its own.
    expect(screen.queryByTestId('echo-celebration')).toBeNull()
    flush(2)
    expect(screen.getByTestId('echo-celebration')).toBeTruthy()
    expect(texts('resultAll', { total: 15, landed: 15 })).toContain(
      screen.getByTestId('echo-bubble').textContent,
    )
    expect(kept.history).toEqual([
      expect.objectContaining({
        type: 'echo-stars',
        score: 100,
        metrics: expect.objectContaining({ landed: 15, notes: 15 }),
      }),
    ])
    expect(kept.bests.map((best) => best.level)).toEqual(['learning'])
    expect(fake.released).toBeGreaterThan(0)

    fireEvent.click(screen.getByTestId('echo-done'))
    expect(done).toBe(1)
  })

  it('starts a new run with new phrases on Again', async () => {
    await startRun()
    singRun()
    fireEvent.click(screen.getByTestId('echo-again'))
    await settle()

    expect(phase()).toBe('call')
    expect(calls.sung).toHaveLength(6)
    expect(stars()).toEqual([])
    expect(texts('again')).toContain(
      screen.getByTestId('echo-bubble').textContent,
    )
  })
})

describe("the take's clouds", () => {
  const clouds = () => screen.queryByTestId('echo-clouds')

  it('come with the run, rise after the first call and go for the result', async () => {
    await startRun()
    // The first call is the storyboard's intro: the layer loads, unseen.
    expect(clouds()?.dataset.on).toBe('false')

    respond(singBack)
    expect(clouds()?.dataset.on).toBe('true')

    vi.advanceTimersByTime(PHRASE_SHOW_MS)
    expect(phase()).toBe('call')
    expect(clouds()?.dataset.on).toBe('true')

    for (let i = 1; i < 5; i++) {
      respond(singBack)
      vi.advanceTimersByTime(PHRASE_SHOW_MS)
    }
    expect(phase()).toBe('result')
    expect(clouds()?.dataset.on).toBe('false')

    // Released once faded.
    vi.advanceTimersByTime(CLOUD_LAYER.outMs)
    expect(clouds()).toBeNull()
  })
})

describe("the town's city light", () => {
  const light = () => screen.getByTestId('echo-citylight').dataset.state

  it("shows the intro's light, the take's with its clouds, none at the result", async () => {
    await startRun()
    // The first call is the storyboard's intro.
    expect(light()).toBe('intro')

    respond(singBack)
    expect(light()).toBe('mid-take')

    vi.advanceTimersByTime(PHRASE_SHOW_MS)
    for (let i = 1; i < 5; i++) {
      respond(singBack)
      vi.advanceTimersByTime(PHRASE_SHOW_MS)
    }
    expect(phase()).toBe('result')
    expect(light()).toBe('none')
  })
})

describe('the top light', () => {
  const opacity = (id: string) => screen.getByTestId(id).style.opacity

  it("gives way to the result's own as the lit town comes up", async () => {
    await startRun()
    expect(opacity('echo-top-light')).toBe('1')
    expect(opacity('echo-top-light-result')).toBe('0')

    respond(singBack)
    vi.advanceTimersByTime(PHRASE_SHOW_MS)
    for (let i = 1; i < 5; i++) {
      respond(singBack)
      vi.advanceTimersByTime(PHRASE_SHOW_MS)
    }
    expect(phase()).toBe('result')
    expect(opacity('echo-top-light')).toBe('0')
    expect(opacity('echo-top-light-result')).toBe('1')
    // A fade, nothing that moves.
    expect(screen.getByTestId('echo-top-light-result').style.transition).toBe(
      'opacity 600ms ease-out',
    )
  })
})

describe('a run that stops', () => {
  it('stops on the mic button: nothing kept, the mic closed, the call silenced', async () => {
    await startRun()
    toTurn()
    fireEvent.click(screen.getByTestId('echo-mic'))

    expect(phase()).toBe('intro')
    expect(kept.history).toEqual([])
    expect(fake.released).toBe(1)
    expect(calls.stopped).toBeGreaterThan(0)
    expect(stars()).toEqual([])
  })

  it('hushes Merc as the run starts, and he says his opening line again after a stop', async () => {
    await startRun()
    // Said as the room opened, hushed by the tap before the mic opened.
    expect(spoken.said).toHaveLength(1)
    expect(spoken.hushed).toBeGreaterThan(0)
    toTurn()
    fireEvent.click(screen.getByTestId('echo-mic'))

    expect(phase()).toBe('intro')
    expect(spoken.said).toHaveLength(2)
  })

  it('says nothing aloud when the singer leaves the app mid-run', async () => {
    await startRun()
    toTurn()
    const before = spoken.hushed
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
    document.dispatchEvent(new Event('visibilitychange'))

    expect(phase()).toBe('intro')
    expect(spoken.said).toHaveLength(1)
    expect(spoken.hushed).toBeGreaterThan(before)
  })

  it('drops the run when the singer leaves the app', async () => {
    await startRun()
    toTurn()
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
    document.dispatchEvent(new Event('visibilitychange'))

    expect(phase()).toBe('intro')
    expect(texts('left')).toContain(
      screen.getByTestId('echo-bubble').textContent,
    )
    expect(kept.history).toEqual([])
  })

  it('stops after a minute with no voice', async () => {
    kept.root = null
    await startRun()
    expect(phase()).toBe('settle')

    vi.advanceTimersByTime((QUIET_LIMIT_SECONDS + 1) * 1000)
    fake.frames.push(...silence(0.5))
    flush()

    expect(phase()).toBe('intro')
    expect(texts('rest')).toContain(
      screen.getByTestId('echo-bubble').textContent,
    )
  })

  it('shows why a refused mic will not open, with a way to try again', async () => {
    fake.acquireError = new CaptureError('denied', 'Echo')
    await startRun()

    expect(phase()).toBe('blocked')
    expect(screen.getByRole('alert').textContent).toContain(
      'Allow it in Settings',
    )

    fake.acquireError = null
    fireEvent.click(screen.getByTestId('echo-retry'))
    await settle()
    expect(phase()).toBe('call')
  })
})

describe('with no root yet', () => {
  it('starts its phrases on the first note the singer settles on', async () => {
    kept.root = null
    await startRun()
    fake.frames.push(...tone(57, 1.4))
    flush()

    expect(phase()).toBe('call')
    expect(calls.sung).toHaveLength(1)
    expect(texts('found', { note: 'A3' })).toContain(
      screen.getByTestId('echo-bubble').textContent,
    )
  })
})

describe('the mic through a phrase', () => {
  const micState = (): string | undefined =>
    screen.getByTestId('echo-mic').dataset.state
  /** The ring's scale as drawn now; NaN with none written. */
  const ringScale = (): number => {
    const ring = screen.getByTestId('echo-mic').querySelector(`.${mic.ring}`)
    const scale = /scale\(([\d.]+)\)/u.exec(
      (ring as HTMLElement | null)?.style.transform ?? '',
    )
    return scale === null ? Number.NaN : Number(scale[1])
  }
  /** Screen frames 16 ms apart, the clock moving with them. */
  const frames = (count: number): void => {
    for (let i = 0; i < count; i++) {
      vi.advanceTimersByTime(16)
      flush()
    }
  }

  it('waits while the mic opens and Merc sings, and is the singer turn once the call has ended', async () => {
    render(() => <EchoRoom onDone={() => undefined} />)
    const resting = micState()
    fireEvent.click(screen.getByTestId('echo-mic'))
    const opening = micState()
    await settle()
    const calling = micState()

    toTurn()

    expect([resting, opening, calling, micState()]).toEqual([
      'ready',
      'wait',
      'wait',
      'sing',
    ])
  })

  it("moves the ring with the reply, not with Merc's call from the speaker", async () => {
    await startRun()
    const { notes, startAt } = currentCall()
    // The call, heard back from the speaker while Merc sings it.
    fake.frames.push(...tone(notes[0].midi, 0.6, { startT: startAt + 0.05 }))
    toTurn()
    frames(6)
    const overTheCall = ringScale()

    fake.frames.push(
      ...tone(notes[0].midi, 0.5, { startT: responseStart() + 0.05 }),
    )
    frames(6)

    expect(overTheCall).toBe(1)
    expect(ringScale()).toBeGreaterThan(1.2)
  })
})

describe('in the Warm-up', () => {
  /** The last stop of four, counting what the room hands it. */
  function warmUp(settledNote: number | null = null) {
    const handed = { finish: [] as StopResult[], skip: 0 }
    const stop: RoutineStop = {
      index: 3,
      count: 4,
      settledNote,
      finish: (result) => handed.finish.push(result),
      skip: () => {
        handed.skip += 1
      },
    }
    return { stop, handed }
  }

  it('opens on the stop\'s chip, Merc\'s cue and "Skip stop", with no level', () => {
    const { stop, handed } = warmUp()
    render(() => <EchoRoom onDone={() => undefined} routine={stop} />)

    expect(screen.getByTestId('echo-chip').textContent).toBe('Warm-up 4 of 4')
    expect(screen.getByTestId('echo-bubble').textContent).toBe(
      ECHO_LINES.routine[0].text,
    )
    expect(screen.queryByTestId('echo-level')).toBeNull()
    fireEvent.click(screen.getByTestId('echo-skip-stop'))
    expect(handed.skip).toBe(1)
  })

  it("says the Warm-up's line aloud as the stop opens", () => {
    render(() => <EchoRoom onDone={() => undefined} routine={warmUp().stop} />)

    expect(spoken.said).toEqual(['routine-first'])
  })

  it('starts on the note an earlier stop started from, when it keeps none', () => {
    kept.root = null
    render(() => (
      <EchoRoom onDone={() => undefined} routine={warmUp(57).stop} />
    ))

    expect(screen.getByTestId('echo-bubble').textContent).toBe(
      ECHO_LINES.routine[0].text,
    )
  })

  it('sings three phrases, keeps them as history and never as a best, then hands "N of M on pitch" on once', async () => {
    const { stop, handed } = warmUp()
    render(() => <EchoRoom onDone={() => undefined} routine={stop} />)
    fireEvent.click(screen.getByTestId('echo-mic'))
    await settle()
    for (let i = 0; i < 3; i++) {
      respond(singBack)
      vi.advanceTimersByTime(PHRASE_SHOW_MS)
    }

    expect(phase()).toBe('result')
    expect(calls.sung).toHaveLength(3)
    expect(screen.getByTestId('echo-result').textContent).toContain('9 of 9')
    expect(stars('result')).toHaveLength(9)
    expect(kept.history).toHaveLength(1)
    expect(kept.bests).toEqual([])
    expect(screen.queryByTestId('echo-again')).toBeNull()
    expect(screen.queryByTestId('echo-done')).toBeNull()
    vi.advanceTimersByTime(1800 + ROUTINE_RESULT_HOLD_MS)
    expect(handed.finish).toEqual([
      { id: EXERCISE_ECHO_STARS, line: '9 of 9 on pitch', settledNote: 60 },
    ])
  })
})
