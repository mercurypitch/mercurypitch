import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { sequence, silence, tone } from '@/lib/glass/test-frames'
import { LANTERN_LEVELS } from '@/lib/hold/hold-engine'
import type { PitchFrame } from '@/lib/pitch-f0-stream'
import { setExerciseLevel } from '@/stores/exercise-level'
import type { NativeDeviceApi } from '@/stores/native-shell-store'
import { registerNativeDevice } from '@/stores/native-shell-store'
import type * as BestModule from '../long-note-best'
import type * as CaptureModule from '../useLongNoteCapture'
import { DEMO_COPY } from './demo-cues'
import type { DemoTake } from './demo-script'

// The room with its demo, on a fake clock: timers, performance.now() and
// animation frames all advance together, so the demo's two takes play
// through the room's own engine exactly as they do on a phone.

// ── A capture the test controls ─────────────────────────────────

const fake = vi.hoisted(() => ({
  frames: [] as PitchFrame[],
  acquired: 0,
  released: 0,
  windows: 0,
  tones: [] as number[],
  /** What asking for the audio clock answers: running, no, or never. */
  audio: 'running' as 'running' | 'none' | 'never',
  /** When set, the clock answers only when this resolves. */
  audioGate: null as Promise<AudioContext | null> | null,
}))

vi.mock('../useLongNoteCapture', async () => {
  const actual = await vi.importActual<typeof CaptureModule>(
    '../useLongNoteCapture',
  )
  return {
    ...actual,
    useLongNoteCapture: () => ({
      acquire: () => {
        fake.acquired += 1
        return Promise.resolve()
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
        return Promise.resolve()
      },
      audio: () => {
        if (fake.audioGate !== null) return fake.audioGate
        if (fake.audio === 'never') return new Promise<never>(() => undefined)
        return Promise.resolve(
          fake.audio === 'running' ? ({} as AudioContext) : null,
        )
      },
    }),
  }
})

// ── The demo's sound, recorded rather than played ──────────────

const sound = vi.hoisted(() => ({
  made: 0,
  tones: [] as number[],
  sung: [] as string[],
  stops: 0,
}))
vi.mock('./demo-sound', () => ({
  createDemoSound: () => {
    sound.made += 1
    let stopped = false
    return {
      lead: 0.12,
      tone: (midi: number) => sound.tones.push(midi),
      sing: (take: DemoTake) => sound.sung.push(take.id),
      stop: () => {
        if (!stopped) sound.stops += 1
        stopped = true
      },
    }
  },
}))

const seen = vi.hoisted(() => ({ value: false }))
vi.mock('./demo-seen', () => ({
  longNoteDemoSeen: () => seen.value,
  markLongNoteDemoSeen: () => {
    seen.value = true
  },
}))

// ── What a run keeps, and what a phone feels ────────────────────

const kept = vi.hoisted(() => ({
  results: [] as unknown[],
  bests: 0,
  haptics: 0,
  note: null as number | null,
}))
vi.mock('@/stores/exercise-history-store', () => ({
  recordExerciseResult: (entry: unknown) => kept.results.push(entry),
}))
vi.mock('../long-note-best', async () => {
  const actual = await vi.importActual<typeof BestModule>('../long-note-best')
  return {
    ...actual,
    recordLongNoteBest: (
      ...args: Parameters<typeof actual.recordLongNoteBest>
    ) => {
      kept.bests += 1
      return actual.recordLongNoteBest(...args)
    },
  }
})
vi.mock('@/lib/haptics', () => ({
  haptics: {
    tapLight: () => {
      kept.haptics += 1
    },
    success: () => {
      kept.haptics += 1
    },
  },
}))
vi.mock('../remembered-note', () => ({
  rememberedLongNote: () => kept.note,
  chosenLongNote: () => kept.note,
  rememberLongNote: (midi: number) => {
    kept.note = midi
  },
}))

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

vi.mock('@/lib/hold/load-hold-target', () => ({
  loadHoldTarget: () => ({ midi: 57, source: 'voiceprint' }),
}))

const { LongNoteRoom } = await import('../LongNoteRoom')

// ── The clock ──────────────────────────────────────────────────

let rafQueue: FrameRequestCallback[] = []

function flushFrames(): void {
  const due = rafQueue
  rafQueue = []
  for (const callback of due) callback(performance.now())
}

/** The room around a tooltip the moment it showed. */
interface Moment {
  chip: string | null
  phase: string | undefined
  fast: boolean
  take: string | null
  /** Merc's state, and the lantern's halo (half at the goal, all at the brim). */
  merc: string | null
  halo: number
  /** The band's height either side of the line, px. */
  band: number
}

/** What the screen showed along the way, each change once. */
interface Seen {
  tips: string[]
  takes: string[]
  phases: string[]
  said: string[]
  fast: boolean
  /** Each tooltip's first moment. */
  at: Record<string, Moment>
  /** What Merc said while the demo played, before a take or in one. */
  mercAlone: string[]
  mercInTakes: string[]
}

function watched(): Seen {
  return {
    tips: [],
    takes: [],
    phases: [],
    said: [],
    fast: false,
    at: {},
    mercAlone: [],
    mercInTakes: [],
  }
}

/** Merc's words on screen now: his bubble, then his chip. */
function mercSays(): string[] {
  return [
    screen.queryByTestId('long-note-line')?.textContent,
    screen.queryByTestId('long-note-chip')?.textContent,
  ].filter((text): text is string => text !== undefined && text !== null)
}

const push = (list: string[], value: string | null | undefined): void => {
  if (value === null || value === undefined || value === '') return
  if (list[list.length - 1] !== value) list.push(value)
}

/** Advance the fake clock a frame at a time, noting what showed. */
async function run(ms: number, log: Seen = watched()): Promise<Seen> {
  const step = 16
  for (let t = 0; t < ms; t += step) {
    await vi.advanceTimersByTimeAsync(step)
    flushFrames()
    const tip = screen.queryByTestId('long-note-demo-tip')?.dataset.tip
    if (tip !== undefined && !(tip in log.at)) {
      log.at[tip] = {
        chip: screen.queryByTestId('long-note-chip')?.textContent ?? null,
        phase: room().dataset.phase,
        fast: screen.queryByTestId('long-note-demo-fast') !== null,
        take: screen.queryByTestId('long-note-demo-take')?.textContent ?? null,
        merc:
          screen
            .getByTestId('long-note-merc')
            .getAttribute('data-merc-state') ?? null,
        halo: Number(screen.getByTestId('lantern-halo').style.opacity),
        band: parseFloat(screen.getByTestId('long-note-band').style.height) / 2,
      }
    }
    push(log.tips, tip)
    const take = screen.queryByTestId('long-note-demo-take')?.textContent
    for (const words of demoMode() === 'playing' ? mercSays() : []) {
      push(take === undefined ? log.mercAlone : log.mercInTakes, words)
    }
    push(log.takes, take)
    push(log.phases, room().dataset.phase)
    push(log.said, screen.getByTestId('long-note-demo-said').textContent)
    if (screen.queryByTestId('long-note-demo-fast') !== null) log.fast = true
  }
  return log
}

const room = (): HTMLElement => screen.getByTestId('long-note-room')
const demoMode = (): string | undefined => room().dataset.demo

/** A phone's keep-awake switch, and each flip of it in order. */
function phoneScreen(): { calls: () => boolean[]; unregister: () => void } {
  const keepAwake = vi.fn()
  const unregister = registerNativeDevice({
    keepAwake,
  } as unknown as NativeDeviceApi)
  return {
    calls: () => keepAwake.mock.calls.map(([on]) => on as boolean),
    unregister,
  }
}

/** A singer's own take: three seconds on A3, then a breath. */
async function liveTake(): Promise<void> {
  fireEvent.click(screen.getByTestId('long-note-mic'))
  await run(50)
  fake.frames = sequence(
    (t) => tone(57, 3, { startT: t }),
    (t) => silence(0.8, t),
  )
  await run(50)
}

describe('the Long note demo', () => {
  beforeEach(() => {
    vi.useFakeTimers({
      toFake: ['setTimeout', 'clearTimeout', 'Date', 'performance'],
    })
    rafQueue = []
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      rafQueue.push(cb)
      return rafQueue.length
    })
    vi.stubGlobal('cancelAnimationFrame', () => undefined)
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
    Object.assign(fake, {
      frames: [],
      acquired: 0,
      released: 0,
      windows: 0,
      tones: [],
      audio: 'running',
      audioGate: null,
    })
    Object.assign(sound, { made: 0, tones: [], sung: [], stops: 0 })
    Object.assign(kept, { results: [], bests: 0, haptics: 0, note: null })
    seen.value = false
    merc.states = []
    localStorage.clear()
    setExerciseLevel('learning')
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('plays by itself on a first visit, every tooltip on its event, and keeps nothing', async () => {
    // A Professional singer's room: the demo sings at its own level
    // (Singer), so its story is the same at every level.
    setExerciseLevel('professional')
    render(() => <LongNoteRoom onDone={() => undefined} />)
    expect(demoMode()).toBe('idle')
    const bandAtProfessional = parseFloat(
      screen.getByTestId('long-note-band').style.height,
    )

    const log = await run(1300)
    expect(demoMode()).toBe('playing')
    expect(sound.tones).toEqual([57])

    await run(21_000, log)
    expect(demoMode()).toBe('end')
    expect(screen.getByTestId('long-note-demo-end')).toBeTruthy()

    // Take 1 drifts and stops; take 2 holds to the goal, then steady to
    // the brim and a result.
    expect(sound.sung).toEqual(['off', 'on'])
    expect(log.takes).toEqual(['Not like this', 'Like this'])
    expect(log.tips).toEqual([
      'line',
      'stops',
      'breath',
      'fills',
      'twelve',
      'steady',
      'score',
    ])
    // Each one after the event it explains.
    expect(log.at.stops.take).toBe('Not like this')
    // One voice at a time: Merc says "Watch me first." before the takes,
    // and nothing in them, so the pill and the tooltip speak alone.
    expect(log.mercAlone).toEqual([DEMO_COPY.watch])
    expect(log.mercInTakes).toEqual([])
    expect(log.at.stops.chip).toBeNull()
    expect(log.at.breath.chip).toBeNull()
    expect(log.at.fills.take).toBe('Like this')
    expect(log.at.fills.fast).toBe(false)
    // He sings in Singer's band, half again the Professional band the room
    // showed.
    expect(log.at.fills.band * 2).toBeCloseTo(
      (bandAtProfessional * LANTERN_LEVELS.singer.tolCents) /
        LANTERN_LEVELS.professional.tolCents,
      6,
    )
    expect(log.at.twelve.fast).toBe(true)
    expect(log.at.twelve.halo).toBe(0)
    // Past the goal, at its own speed: Merc out of the glass to cheer, half
    // the halo on, and the top still to fill.
    expect(log.at.steady.fast).toBe(false)
    expect(log.at.steady.phase).toBe('hold')
    expect(['hop', 'celebrate']).toContain(log.at.steady.merc)
    expect(log.at.steady.halo).toBe(0.5)
    // The result comes on the brim: all of the halo.
    expect(log.at.score.phase).toBe('result')
    expect(log.at.score.halo).toBe(1)
    expect(log.fast).toBe(true)
    expect(log.phases).toContain('hold')
    expect(log.phases).toContain('result')
    expect(log.said).toContain('Steadier holds score higher.')
    expect(log.said).toContain('Off the line, it stops filling.')

    // The end card marks it seen and stops the sound.
    expect(seen.value).toBe(true)
    expect(sound.stops).toBe(1)

    // Nothing of a demo is kept, felt or listened to.
    expect(kept.results).toEqual([])
    expect(kept.bests).toBe(0)
    expect(kept.note).toBeNull()
    expect(kept.haptics).toBe(0)
    expect(fake.acquired).toBe(0)
    expect(fake.windows).toBe(0)
  })

  // Review A2 of PR 973, minor 4: Android's shortest screen timeout is
  // 15 s, and the demo plays for about 20 s.
  it('keeps the screen on while it plays, lets go at its end, then keeps it on for the singer', async () => {
    const screenOn = phoneScreen()
    try {
      render(() => <LongNoteRoom onDone={() => undefined} />)
      await run(4000)
      expect(demoMode()).toBe('playing')
      expect(screenOn.calls()).toEqual([true])

      await run(18_500)
      expect(demoMode()).toBe('end')
      expect(screenOn.calls()).toEqual([true, false])

      // The singer's own take holds it again, and only while it listens.
      fireEvent.click(screen.getByTestId('long-note-demo-try'))
      await run(50)
      await liveTake()
      expect(room().dataset.phase).toBe('result')
      expect(screenOn.calls()).toEqual([true, false, true, false])
    } finally {
      screenOn.unregister()
    }
  })

  it('lets the screen go on Skip', async () => {
    const screenOn = phoneScreen()
    try {
      render(() => <LongNoteRoom onDone={() => undefined} />)
      await run(4000)
      expect(screenOn.calls()).toEqual([true])

      fireEvent.click(screen.getByTestId('long-note-demo-skip'))
      await run(50)
      expect(demoMode()).toBe('end')
      expect(screenOn.calls()).toEqual([true, false])
    } finally {
      screenOn.unregister()
    }
  })

  it('lets the screen go when the singer leaves mid-demo', async () => {
    const screenOn = phoneScreen()
    try {
      render(() => <LongNoteRoom onDone={() => undefined} />)
      await run(4000)
      expect(screenOn.calls()).toEqual([true])

      cleanup()
      expect(screenOn.calls()).toEqual([true, false])
    } finally {
      screenOn.unregister()
    }
  })

  it('lets the screen go when the app goes to the background mid-demo', async () => {
    const screenOn = phoneScreen()
    try {
      render(() => <LongNoteRoom onDone={() => undefined} />)
      await run(4000)
      expect(screenOn.calls()).toEqual([true])

      vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
      document.dispatchEvent(new Event('visibilitychange'))
      await run(50)
      expect(demoMode()).toBe('card')
      expect(screenOn.calls()).toEqual([true, false])
    } finally {
      screenOn.unregister()
    }
  })

  it('hands over to the singer on Try it, and the mic opens on its tap', async () => {
    render(() => <LongNoteRoom onDone={() => undefined} />)
    await run(22_500)
    expect(demoMode()).toBe('end')

    fireEvent.click(screen.getByTestId('long-note-demo-try'))
    await run(50)
    expect(demoMode()).toBe('idle')
    expect(room().dataset.phase).toBe('intro')
    expect(screen.getByTestId('long-note-demo-tip').textContent).toBe(
      'Tap the mic, then hold your note.',
    )
    expect(screen.getByTestId('long-note-mic').className).toMatch(/micPulse/)
    expect(screen.getByTestId('long-note-note').textContent).toBe('A3')

    fireEvent.click(screen.getByTestId('long-note-mic'))
    await run(50)
    expect(fake.acquired).toBe(1)
    expect(room().dataset.phase).toBe('listen')
    expect(screen.queryByTestId('long-note-demo-tip')).toBeNull()
  })

  it('neither opens the mic nor cuts a take when the mic is tapped mid-demo', async () => {
    render(() => <LongNoteRoom onDone={() => undefined} />)
    // The intro: the room is at its start, as for a singer's first tap.
    await run(1500)
    expect(demoMode()).toBe('playing')
    expect(room().dataset.phase).toBe('intro')
    fireEvent.click(screen.getByTestId('long-note-mic'))
    await run(100)
    expect(fake.acquired).toBe(0)
    expect(room().dataset.phase).toBe('intro')

    // Mid-take, where a singer's tap would end the note.
    await run(2500)
    expect(room().dataset.phase).toBe('hold')
    fireEvent.click(screen.getByTestId('long-note-mic'))
    await run(100)
    expect(room().dataset.phase).toBe('hold')
    expect(fake.acquired).toBe(0)
    expect(demoMode()).toBe('playing')

    // Both takes still play out to the end card.
    const log = await run(19_000)
    expect(log.tips).toContain('breath')
    expect(log.tips).toContain('score')
    expect(demoMode()).toBe('end')
  })

  it('never plays by itself in the Warm-up, even on a first visit; "?" still plays it', async () => {
    render(() => (
      <LongNoteRoom
        onDone={() => undefined}
        routine={{
          index: 0,
          count: 4,
          settledNote: null,
          finish: () => undefined,
          skip: () => undefined,
        }}
      />
    ))
    await run(3000)
    expect(demoMode()).toBe('idle')
    expect(sound.made).toBe(0)

    fireEvent.click(screen.getByTestId('long-note-ask'))
    await run(100)

    expect(demoMode()).toBe('playing')
    expect(screen.queryByTestId('long-note-skip-stop')).toBeNull()
  })

  it('waits for "?" on a second visit, and Skip goes to the end card', async () => {
    seen.value = true
    render(() => <LongNoteRoom onDone={() => undefined} />)
    await run(3000)
    expect(demoMode()).toBe('idle')
    expect(sound.made).toBe(0)

    fireEvent.click(screen.getByTestId('long-note-ask'))
    await run(100)
    expect(demoMode()).toBe('playing')
    // No "?" while it plays.
    expect(screen.queryByTestId('long-note-ask')).toBeNull()

    await run(3000)
    fireEvent.click(screen.getByTestId('long-note-demo-skip'))
    await run(50)
    expect(demoMode()).toBe('end')
    expect(sound.stops).toBe(1)
    expect(room().dataset.phase).toBe('intro')
  })

  it('stops its sound when the singer leaves mid-demo, and plays next time', async () => {
    render(() => <LongNoteRoom onDone={() => undefined} />)
    await run(4000)
    expect(demoMode()).toBe('playing')
    cleanup()
    expect(sound.stops).toBe(1)
    expect(seen.value).toBe(false)
  })

  it('stops where it is when the app goes to the background', async () => {
    render(() => <LongNoteRoom onDone={() => undefined} />)
    await run(4000)
    expect(demoMode()).toBe('playing')

    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
    document.dispatchEvent(new Event('visibilitychange'))
    await run(50)
    expect(sound.stops).toBe(1)
    expect(demoMode()).toBe('card')
    expect(seen.value).toBe(false)
    expect(room().dataset.phase).toBe('intro')
  })

  it('never starts in the background while it waits for its sound', async () => {
    // Review A of PR 973, m8: a hide in the sound wait was ignored, and
    // the demo began behind the singer's back.
    let answer: (ctx: AudioContext | null) => void = () => undefined
    fake.audioGate = new Promise((resolve) => {
      answer = resolve
    })
    render(() => <LongNoteRoom onDone={() => undefined} />)
    await run(1300)
    expect(demoMode()).toBe('idle')

    const visibility = vi
      .spyOn(document, 'visibilityState', 'get')
      .mockReturnValue('hidden')
    document.dispatchEvent(new Event('visibilitychange'))
    answer({} as AudioContext)
    await run(50)

    // Held for the singer, the room as it was: no card, no sound.
    expect(demoMode()).toBe('idle')
    expect(sound.made).toBe(0)
    expect(room().dataset.phase).toBe('intro')
    expect(seen.value).toBe(false)

    // Back: it starts as a first visit's does, AUTO_PLAY_MS later.
    visibility.mockReturnValue('visible')
    document.dispatchEvent(new Event('visibilitychange'))
    await run(1100)
    expect(demoMode()).toBe('idle')
    await run(200)
    expect(demoMode()).toBe('playing')
    expect(sound.made).toBe(1)
  })

  it('never starts in the background on a Watch that was still waiting', async () => {
    seen.value = true
    let answer: (ctx: AudioContext | null) => void = () => undefined
    fake.audioGate = new Promise((resolve) => {
      answer = resolve
    })
    render(() => <LongNoteRoom onDone={() => undefined} />)
    await run(50)
    fireEvent.click(screen.getByTestId('long-note-ask'))

    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
    document.dispatchEvent(new Event('visibilitychange'))
    answer({} as AudioContext)
    await run(50)

    expect(demoMode()).toBe('card')
    expect(sound.made).toBe(0)
    expect(room().dataset.phase).toBe('intro')
  })

  it('offers its play card when the audio cannot start without a tap', async () => {
    fake.audio = 'never'
    render(() => <LongNoteRoom onDone={() => undefined} />)
    await run(2000)
    expect(demoMode()).toBe('card')
    expect(sound.made).toBe(0)

    // The tap that wants it brings the sound.
    fake.audio = 'running'
    fireEvent.click(screen.getByTestId('long-note-demo-watch'))
    await run(100)
    expect(demoMode()).toBe('playing')
    expect(sound.tones).toEqual([57])
  })

  it('hands focus on from its card to the control that follows it', async () => {
    // Review B of PR 973, minor 12: the card took focus and nothing gave
    // it back, so it fell to the page when the card went.
    fake.audio = 'never'
    render(() => <LongNoteRoom onDone={() => undefined} />)
    await run(2000)
    expect(demoMode()).toBe('card')
    expect(document.activeElement).toBe(
      screen.getByTestId('long-note-demo-watch'),
    )

    // Watch: the demo plays, and Skip is the way out of it.
    fake.audio = 'running'
    fireEvent.click(screen.getByTestId('long-note-demo-watch'))
    await run(100)
    expect(demoMode()).toBe('playing')
    expect(document.activeElement).toBe(
      screen.getByTestId('long-note-demo-skip'),
    )

    // Skip, then Try it: the singer's mic.
    fireEvent.click(screen.getByTestId('long-note-demo-skip'))
    await run(100)
    expect(document.activeElement).toBe(
      screen.getByTestId('long-note-demo-try'),
    )
    fireEvent.click(screen.getByTestId('long-note-demo-try'))
    await run(100)
    expect(demoMode()).toBe('idle')
    expect(document.activeElement).toBe(screen.getByTestId('long-note-mic'))
  })

  it('takes no for an answer on its play card', async () => {
    fake.audio = 'none'
    render(() => <LongNoteRoom onDone={() => undefined} />)
    await run(2000)
    expect(demoMode()).toBe('card')
    fireEvent.click(screen.getByTestId('long-note-demo-not-now'))
    await run(50)
    expect(demoMode()).toBe('idle')
    expect(seen.value).toBe(true)
  })

  it('plays nothing by itself for a singer who has held a note before', async () => {
    kept.note = 57
    render(() => <LongNoteRoom onDone={() => undefined} />)
    await run(3000)
    expect(demoMode()).toBe('idle')
    expect(sound.made).toBe(0)
  })

  it('hides "?" while the singer holds, and plays from a result', async () => {
    seen.value = true
    render(() => <LongNoteRoom onDone={() => undefined} />)
    fireEvent.click(screen.getByTestId('long-note-mic'))
    await run(50)
    fake.frames = tone(57, 1, { startT: 0 })
    await run(50)
    expect(room().dataset.phase).toBe('hold')
    expect(screen.queryByTestId('long-note-ask')).toBeNull()

    fake.frames = [...fake.frames, ...silence(0.8, 1)]
    await run(50)
    expect(room().dataset.phase).toBe('result')
    expect(kept.results).toHaveLength(1)

    fireEvent.click(screen.getByTestId('long-note-ask'))
    await run(22_500)
    expect(demoMode()).toBe('end')
    // The singer's own result is the only one kept.
    expect(kept.results).toHaveLength(1)
    expect(kept.haptics).toBeGreaterThan(0)
  })

  it('keeps a live take after the demo exactly as before it', async () => {
    seen.value = true
    render(() => <LongNoteRoom onDone={() => undefined} />)
    fireEvent.click(screen.getByTestId('long-note-ask'))
    await run(22_500)
    fireEvent.click(screen.getByTestId('long-note-demo-try'))
    await run(50)

    await liveTake()
    expect(room().dataset.phase).toBe('result')
    expect(kept.results).toHaveLength(1)
    expect(kept.results[0]).toMatchObject({
      type: 'long-note-lantern',
      metrics: { targetMidi: 57 },
    })
    expect(kept.note).toBe(57)
  })

  it('drops the pulses with reduced motion, and keeps the beats', async () => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query.includes('reduce'),
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }))
    render(() => <LongNoteRoom onDone={() => undefined} />)
    const log = await run(22_500)
    expect(log.tips).toEqual([
      'line',
      'stops',
      'breath',
      'fills',
      'twelve',
      'steady',
      'score',
    ])
    fireEvent.click(screen.getByTestId('long-note-demo-try'))
    await run(50)
    expect(screen.getByTestId('long-note-mic').className).not.toMatch(
      /micPulse/,
    )
  })
})
