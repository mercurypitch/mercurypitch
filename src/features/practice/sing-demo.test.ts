// Merc singing through the Sing tab for a tour stop (sing-demo.ts), on a
// fake host: what he sings, the line and the voice agreeing, the flat note
// of Repeat's first round, the silent rests, his pose and line, and that
// stopping puts every control back, asks for no mic and leaves nothing on.

import { createSignal } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MelodyItem, PlaybackMode, SpacedRestMode } from '@/types'
import { contourCents, DEMO_LINES, DEMO_VIBRATO, demoMelody, FLAT_CENTS, shortScale, startSingDemo, stopSeconds, voicePoints, } from './sing-demo'
import type { SingDemoHost, SingDemoLoop } from './sing-demo-host'
import { singDemo } from './sing-demo-host'

const { playVoiceContour } = vi.hoisted(() => ({
  playVoiceContour: vi.fn(() => ({ stop: vi.fn() })),
}))
vi.mock('@/lib/demo-voice', () => ({ playVoiceContour }))

const note = (midi: number, startBeat: number, duration = 1): MelodyItem => ({
  id: midi * 10 + startBeat,
  note: {
    midi,
    name: 'C',
    octave: 4,
    freq: 440 * 2 ** ((midi - 69) / 12),
  },
  startBeat,
  duration,
})

/** The singer's melody: `count` one-beat notes up from C4. */
const melodyOf = (count: number): MelodyItem[] =>
  Array.from({ length: count }, (_, i) => note(60 + i, i))

type Handler = (e: unknown) => void

/** A Sing tab to lend: its controls as signals, its transport as a spy. */
function fakeHost(own: MelodyItem[] = melodyOf(30)) {
  const handlers = new Map<string, Set<Handler>>()
  const [isPlaying, setIsPlaying] = createSignal(false)
  const [playMode, setPlayMode] = createSignal<PlaybackMode>('session')
  const [repeatCycles, setRepeatCycles] = createSignal(5)
  const [currentRepeat, setCurrentRepeat] = createSignal(3)
  const [rest, setRest] = createSignal<SpacedRestMode>('fourth')
  const [loop, setLoop] = createSignal<SingDemoLoop>({
    enabled: true,
    a: 2,
    b: 6,
  })
  let onRuntime: readonly MelodyItem[] = []
  const calls: string[] = []
  const ctx = {
    state: 'running',
    destination: {},
    createGain: () => ({
      gain: { value: 1 },
      context: ctx,
      connect: vi.fn(),
      disconnect: vi.fn(),
    }),
  }
  const host: SingDemoHost = {
    audioEngine: {
      getAudioContext: () => ctx as unknown as AudioContext,
      getVolume: () => 0.8,
    },
    playbackRuntime: {
      on: ((event: string, fn: Handler) => {
        if (!handlers.has(event)) handlers.set(event, new Set())
        handlers.get(event)?.add(fn)
      }) as SingDemoHost['playbackRuntime']['on'],
      off: (event: string, fn: unknown) => {
        handlers.get(event)?.delete(fn as Handler)
      },
      getMelody: () => [...onRuntime],
      getBPM: () => 60,
    },
    onSingTab: () => true,
    isPlaying,
    melody: () => own,
    melodyKind: () => 'melody',
    tonicMidi: () => 60,
    bpm: () => 60,
    playMode,
    setPlayMode,
    repeatCycles,
    setRepeatCycles,
    currentRepeat,
    setCurrentRepeat,
    spacedRestMode: rest,
    setSpacedRestMode: setRest,
    loop,
    setLoop,
    play: () => {
      calls.push('play')
      // the tab's Play: his melody on the transport, as App would build it
      onRuntime = singDemo()?.melody ?? []
      setIsPlaying(true)
    },
    reset: () => {
      calls.push('reset')
      setIsPlaying(false)
    },
  }
  return {
    host,
    calls,
    setIsPlaying,
    setRuntimeMelody: (items: readonly MelodyItem[]) => {
      onRuntime = items
    },
    emit: (event: string, e: unknown) => {
      for (const fn of [...(handlers.get(event) ?? [])]) fn(e)
    },
    listening: (event: string) => handlers.get(event)?.size ?? 0,
  }
}

const getUserMedia = vi.fn()

beforeEach(() => {
  playVoiceContour.mockClear()
  getUserMedia.mockClear()
  Object.defineProperty(navigator, 'mediaDevices', {
    value: { getUserMedia },
    configurable: true,
  })
})

afterEach(() => {
  Object.defineProperty(document, 'visibilityState', {
    value: 'visible',
    configurable: true,
  })
})

describe('his line and his voice', () => {
  it('scoop into the note and grow a vibrato, the same in both', () => {
    expect(contourCents(0, 0)).toBeCloseTo(-35)
    expect(Math.abs(contourCents(0.5, 0))).toBeLessThanOrEqual(
      DEMO_VIBRATO.cents,
    )
    const points = voicePoints(1, FLAT_CENTS)
    expect(points[0]).toMatchObject({ t: 0, level: 0 })
    expect(points.at(-1)).toMatchObject({ t: 1, level: 0 })
    for (const point of points) {
      // the voice adds the vibrato as its own sine: within its depth
      expect(
        Math.abs(contourCents(point.t, FLAT_CENTS) - point.cents),
      ).toBeLessThanOrEqual(DEMO_VIBRATO.cents + 1e-9)
    }
  })
})

describe('what Merc sings', () => {
  const host = (own: MelodyItem[], kind: 'melody' | 'drums' = 'melody') => ({
    melody: () => own,
    melodyKind: () => kind,
    tonicMidi: () => 57,
    bpm: () => 60,
  })

  it("sings the singer's own melody when a stop of it lasts 8 to 20 seconds", () => {
    const own = melodyOf(6)
    expect(stopSeconds('repeat', own, 60)).toBe(12)
    expect(stopSeconds('rests', own, 60)).toBe(16)

    expect(demoMelody('repeat', host(own))).toEqual(own)
    expect(demoMelody('repeat', host(own))).not.toBe(own)
  })

  it('sings a short scale of the app’s when the singer’s is too long, too short, a drum pattern or has rests', () => {
    const scale = shortScale(57, 60)
    const rested = [...melodyOf(5), { ...note(70, 5), isRest: true }]
    for (const own of [melodyOf(30), melodyOf(2)]) {
      expect(demoMelody('repeat', host(own))).toEqual(scale)
    }
    expect(demoMelody('repeat', host(melodyOf(6), 'drums'))).toEqual(scale)
    expect(demoMelody('repeat', host(rested))).toEqual(scale)
  })

  it('makes that scale do to sol in the key, a whole number of beats near a second each', () => {
    const at60 = shortScale(57, 60)
    expect(at60.map((item) => item.note.midi)).toEqual([57, 59, 61, 62, 64])
    expect(at60.map((item) => item.duration)).toEqual([1, 1, 1, 1, 1])
    expect(shortScale(57, 120).map((item) => item.startBeat)).toEqual([
      0, 2, 4, 6, 8,
    ])
  })
})

describe('startSingDemo', () => {
  it('sets Repeat twice round with the loop off, after a reset, and plays', () => {
    const tab = fakeHost()
    const run = startSingDemo('repeat', tab.host)

    expect(tab.calls).toEqual(['reset', 'play'])
    expect(tab.host.playMode()).toBe('repeat')
    expect(tab.host.repeatCycles()).toBe(2)
    expect(tab.host.currentRepeat()).toBe(1)
    expect(tab.host.loop()).toEqual({ enabled: false, a: 2, b: 6 })
    expect(singDemo()?.melody).toEqual(shortScale(60, 60))
    run.stop()
  })

  it('sings one note flat the first time round and on it the second', () => {
    const tab = fakeHost()
    const run = startSingDemo('repeat', tab.host)
    const pitchAt = singDemo()?.pitchAt
    // mi, the middle of do to sol, half a second in: past the scoop
    const flat = pitchAt?.(2.5)
    const onIt = pitchAt?.(1.5)

    expect(flat?.cents).toBeGreaterThanOrEqual(FLAT_CENTS - DEMO_VIBRATO.cents)
    expect(flat?.cents).toBeLessThanOrEqual(FLAT_CENTS + DEMO_VIBRATO.cents)
    expect(Math.abs(onIt?.cents ?? 99)).toBeLessThanOrEqual(DEMO_VIBRATO.cents)
    expect(run.said()).toBe(DEMO_LINES.repeatFirst)

    tab.host.setCurrentRepeat(2)
    expect(Math.abs(pitchAt?.(2.5)?.cents ?? 99)).toBeLessThanOrEqual(
      DEMO_VIBRATO.cents,
    )
    expect(run.said()).toBe(DEMO_LINES.repeatSecond)
    // the count-in and past the end are silent
    expect(pitchAt?.(-1)).toBeNull()
    expect(pitchAt?.(5)).toBeNull()
    run.stop()
  })

  it('keeps the rests silent, once through with a half rest', () => {
    const tab = fakeHost()
    const run = startSingDemo('rests', tab.host)
    expect(tab.host.playMode()).toBe('once')
    expect(tab.host.spacedRestMode()).toBe('half')
    tab.setRuntimeMelody([
      note(60, 0),
      { ...note(60, 1, 2), isRest: true },
      note(62, 3),
    ])

    expect(singDemo()?.pitchAt(0.5)).not.toBeNull()
    expect(singDemo()?.pitchAt(2)).toBeNull()
    expect(singDemo()?.pitchAt(3.5)?.targetMidi).toBe(62)
    expect(run.said()).toBe(DEMO_LINES.rests)
    run.stop()
  })

  it("sings each of the transport's notes in his voice, and stops it when the transport stops", () => {
    const tab = fakeHost()
    const run = startSingDemo('repeat', tab.host)
    const [first, second] = shortScale(60, 60)

    tab.emit('noteStart', { note: first, index: 0 })
    expect(playVoiceContour).toHaveBeenCalledOnce()
    expect(playVoiceContour).toHaveBeenCalledWith(
      expect.anything(),
      expect.arrayContaining([expect.objectContaining({ t: 1 })]),
      expect.objectContaining({ hz: first?.note.freq, vibrato: DEMO_VIBRATO }),
    )
    const firstVoice = playVoiceContour.mock.results[0]?.value as {
      stop: ReturnType<typeof vi.fn>
    }
    tab.emit('noteStart', { note: second, index: 1 })
    expect(firstVoice.stop).toHaveBeenCalledOnce()

    const secondVoice = playVoiceContour.mock.results[1]?.value as {
      stop: ReturnType<typeof vi.fn>
    }
    tab.emit('state', { type: 'state', state: 'paused' })
    expect(secondVoice.stop).toHaveBeenCalledOnce()
    run.stop()
  })

  it('sings in his sing pose while the transport plays, and says how to hear him again after', () => {
    const tab = fakeHost()
    const run = startSingDemo('repeat', tab.host)
    expect(run.pose()).toBe('sing')

    tab.setIsPlaying(false)

    expect(run.pose()).toBeNull()
    expect(run.said()).toBe(DEMO_LINES.again)
    run.stop()
  })

  it('puts back every control it set, clears his line, and asks for no mic', () => {
    const tab = fakeHost()
    const run = startSingDemo('repeat', tab.host)
    tab.emit('noteStart', { note: shortScale(60, 60)[0], index: 0 })
    const voice = playVoiceContour.mock.results[0]?.value as {
      stop: ReturnType<typeof vi.fn>
    }

    run.stop()
    run.stop()

    expect(voice.stop).toHaveBeenCalledOnce()
    expect(tab.calls).toEqual(['reset', 'play', 'reset'])
    expect(singDemo()).toBeNull()
    expect(tab.host.playMode()).toBe('session')
    expect(tab.host.repeatCycles()).toBe(5)
    expect(tab.host.currentRepeat()).toBe(3)
    expect(tab.host.spacedRestMode()).toBe('fourth')
    expect(tab.host.loop()).toEqual({ enabled: true, a: 2, b: 6 })
    expect(tab.listening('noteStart')).toBe(0)
    expect(tab.listening('state')).toBe(0)
    expect(run.pose()).toBeNull()
    expect(run.said()).toBe('')
    expect(getUserMedia).not.toHaveBeenCalled()
  })

  it('stops, and puts everything back, when the page is hidden', () => {
    const tab = fakeHost()
    startSingDemo('rests', tab.host)

    Object.defineProperty(document, 'visibilityState', {
      value: 'hidden',
      configurable: true,
    })
    document.dispatchEvent(new Event('visibilitychange'))

    expect(singDemo()).toBeNull()
    expect(tab.host.spacedRestMode()).toBe('fourth')
    expect(tab.calls).toEqual(['reset', 'play', 'reset'])
  })

  it('starts nothing away from the Sing tab', () => {
    const tab = fakeHost()
    const away = { ...tab.host, onSingTab: () => false }

    const run = startSingDemo('repeat', away)

    expect(tab.calls).toEqual([])
    expect(singDemo()).toBeNull()
    expect(tab.host.playMode()).toBe('session')
    expect(run.pose()).toBeNull()
    expect(run.said()).toBe('')
  })
})
