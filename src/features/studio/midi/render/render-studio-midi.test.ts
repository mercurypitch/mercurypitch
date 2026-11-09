// Studio MIDI render tests — each note on its whole frame of a 48 kHz render, every note of a 1,000-note take heard to its own end, the kit offline for drums, the grand when its samples load in time and the synth when they do not, a note's release velocity, the take's own level, the sequence's window and tail, and an abort before, during and after loading.
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { StudioMidiModules } from '@/features/studio/record/midi/studio-midi-sounds'
import { loadStudioMidiModules } from '@/features/studio/record/midi/studio-midi-sounds'
import { studioReservedMemoryBytes } from '@/lib/studio/memory-budget'
import { STUDIO_CAPTURE_INPUT } from '@/lib/studio/record/capture-input'
import type { RenderClock, RenderGain } from './render-clock.fixture'
import { renderClocks } from './render-clock.fixture'
import type { StudioMidiRenderInput, StudioMidiRenderNote, } from './render-studio-midi'
import { renderStudioMidi } from './render-studio-midi'

/** At the song's 960 ticks a beat and 120 beats a minute, a tick is 25 frames of 48 kHz. */
const BPM = 120
const PRE_ROLL = 24000

const note = (
  pitch: number,
  startTick: number,
  lengthTicks = 480,
): StudioMidiRenderNote => ({ pitch, startTick, lengthTicks, velocity: 0.7 })

function render(
  input: Partial<StudioMidiRenderInput>,
  clocks = renderClocks(),
): Promise<Awaited<ReturnType<typeof renderStudioMidi>>> {
  return renderStudioMidi({
    notes: [],
    tempoBpm: BPM,
    lengthTicks: 3840,
    sound: 'piano',
    ...input,
    deps: { createContext: clocks.create, grandTimeoutMs: 50, ...input.deps },
  })
}

/** The frames a source reaching the output started on, and how many started on each. */
function marks(samples: Float32Array): [number, number][] {
  const found: [number, number][] = []
  samples.forEach((count, frame) => {
    if (count > 0) found.push([frame, count])
  })
  return found
}

/** The piano's samples answer at once with a few bytes each. */
function samplesServed(): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(new Uint8Array([1, 2, 3]))),
  )
}

/** The piano's samples are refused at once, as when offline. */
function samplesRefused(): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => {
      throw new TypeError('offline')
    }),
  )
}

/** The piano's samples never arrive; each request ends only when it is aborted. */
function samplesStalled(): AbortSignal[] {
  const asked: AbortSignal[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          const signal = init.signal as AbortSignal
          asked.push(signal)
          signal.addEventListener('abort', () =>
            reject(new DOMException('Aborted', 'AbortError')),
          )
        }),
    ),
  )
  return asked
}

/** The real sound modules, with every kit's options kept as it is made. */
async function watchedKit() {
  const real = await loadStudioMidiModules()
  type KitOptions = Parameters<typeof real.drumKit.createDrumKitPlayer>[0]
  const kits: KitOptions[] = []
  const modules = {
    ...real,
    drumKit: {
      ...real.drumKit,
      createDrumKitPlayer: (options: KitOptions) => {
        kits.push(options)
        return real.drumKit.createDrumKitPlayer(options)
      },
    },
  } as StudioMidiModules
  return { modules, kits }
}

/** A clock factory whose render is aborted as it reaches `seconds`, before anything more is scheduled there. */
function abortingAt(seconds: number, abort: AbortController) {
  const clocks = renderClocks()
  return {
    clocks,
    create: (options: OfflineAudioContextOptions) => {
      const context = clocks.create(options)
      const clock = context as unknown as RenderClock
      const suspend = clock.suspend.bind(clock)
      clock.suspend = (at: number) =>
        suspend(at).then(() => {
          if (at === seconds) abort.abort()
        })
      return context
    },
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('the Studio MIDI render', () => {
  it('starts each note on its frame of a 48 kHz render, tick 0 on frame 0, and runs the sequence and the piano tail', async () => {
    // Arrange
    samplesRefused()
    const notes = [note(60, 0), note(64, 480), note(67, 961)]

    // Act
    const result = await render({ notes })

    // Assert: two synth oscillators start on each note's frame.
    expect(result.engine).toBe('synth')
    expect(result.frames).toBe(96000 + 72000)
    expect(result.samples).toHaveLength(result.frames)
    expect(marks(result.samples)).toEqual([
      [0, 2],
      [12000, 2],
      [24025, 2],
    ])
  })

  it('starts a note that falls between two frames on the nearer one, never a hair before it', async () => {
    // Arrange: at 90 bpm a tick is 33 1/3 frames.
    samplesRefused()
    const clocks = renderClocks()

    // Act
    const result = await render(
      { tempoBpm: 90, notes: [note(60, 1), note(64, 2)] },
      clocks,
    )

    // Assert
    expect(marks(result.samples)).toEqual([
      [33, 2],
      [67, 2],
    ])
    const starts = clocks.made[0].startFrames('oscillator')
    const wanted = [33, 33, 67, 67].map((frame) => PRE_ROLL + frame)
    expect(
      starts.every(
        (frame, i) => frame >= wanted[i] && frame - wanted[i] < 1e-6,
      ),
    ).toBe(true)
  })

  it('sounds every note of a 1,000-note take to its own end, though 128 overlap at a time', async () => {
    // Arrange: a note every 60 ticks, each held 7,680 ticks (four seconds).
    samplesRefused()
    const clocks = renderClocks()
    const notes = Array.from({ length: 1000 }, (_, i) =>
      note(36 + (i % 48), i * 60, 7680),
    )

    // Act
    const result = await render({ notes, lengthTicks: 999 * 60 + 7680 }, clocks)

    // Assert: each starts on its frame, and its fundamental stops once, at its own release.
    const found = marks(result.samples)
    expect(found).toHaveLength(1000)
    expect(
      found.every(([frame, count], i) => frame === i * 1500 && count === 2),
    ).toBe(true)
    const fundamentals = clocks.made[0].sources.filter(
      (source) => source.type === 'triangle',
    )
    expect(fundamentals).toHaveLength(1000)
    expect(
      fundamentals.every((source, i) => {
        const release = (PRE_ROLL + (i * 60 + 7680) * 25) / 48000 + 0.1
        return (
          source.stopTimes.length === 1 &&
          Math.abs(source.stopTimes[0] - release) < 1e-9
        )
      }),
    ).toBe(true)
  })

  it("renders a drum lane on Drum Night's kit, built offline, each hit on its frame, and the drums' shorter tail", async () => {
    // Arrange
    const { modules, kits } = await watchedKit()

    // Act
    const result = await render({
      sound: 'drums',
      notes: [note(36, 0), note(38, 480), note(42, 960)],
      deps: { loadModules: async () => modules },
    })

    // Assert
    expect(result.engine).toBe('kit')
    expect(kits).toEqual([expect.objectContaining({ offline: true })])
    expect(marks(result.samples).map(([frame]) => frame)).toEqual([
      0, 12000, 24000,
    ])
    expect(result.frames).toBe(96000 + 38400)
  })

  it('plays every note on the sampled grand when its samples load in time', async () => {
    // Arrange
    samplesServed()
    const clocks = renderClocks()

    // Act
    const result = await render({ notes: [note(48, 0), note(72, 960)] }, clocks)

    // Assert: each note's attack on its frame and its release sample on its note-off; the synth plays nothing.
    const [clock] = clocks.made
    expect(result.engine).toBe('grand')
    expect(clock.startFrames('oscillator')).toEqual([])
    expect(marks(result.samples)).toEqual([
      [0, 1],
      [12000, 1],
      [24000, 1],
      [36000, 1],
    ])
  })

  it("releases each note at its own release velocity, and at the song's 0.5 where it keeps none", async () => {
    // Arrange
    samplesServed()
    const clocks = renderClocks()
    const notes = [{ ...note(48, 0), releaseVelocity: 1 }, note(72, 960)]

    // Act
    await render({ notes }, clocks)

    // Assert: each note's release sample is 0.1 + 0.08 x its release velocity loud.
    const [clock] = clocks.made
    const releases = clock.sources
      .filter((source) => source.nodeType === 'buffer-source')
      .filter((_, index) => index % 2 === 1)
    const loudness = releases.map((source) => {
      const [gain] = source.wired as RenderGain[]
      return Number(gain.gain.events[0].value?.toFixed(4))
    })
    expect(loudness).toEqual([0.18, 0.14])
  })

  it('plays the synth when the grand cannot load its samples in time, and stops asking for them', async () => {
    // Arrange
    const asked = samplesStalled()
    const clocks = renderClocks()

    // Act
    const result = await render(
      { notes: [note(60, 0), note(64, 480)], deps: { grandTimeoutMs: 20 } },
      clocks,
    )

    // Assert
    expect(result.engine).toBe('synth')
    expect(asked.length).toBeGreaterThan(0)
    expect(asked.every((signal) => signal.aborted)).toBe(true)
    expect(marks(result.samples)).toEqual([
      [0, 2],
      [12000, 2],
    ])
  })

  it("is as loud as a take: the sound's own node at unity, folded to one channel as the capture folds it", async () => {
    // Arrange
    samplesRefused()
    const clocks = renderClocks()

    // Act
    await render({ notes: [note(60, 0)] }, clocks)

    // Assert: on a mono 48 kHz clock, sound -> bus -> fold -> output, both at unity.
    const [clock] = clocks.made
    const into = (target: object) =>
      clock.gains.filter((gain) => gain.wired.includes(target as never))
    const [fold] = into(clock.destination)
    const [bus] = into(fold)
    expect([clock.numberOfChannels, clock.sampleRate]).toEqual([1, 48000])
    expect({
      channelCount: fold.channelCount,
      channelCountMode: fold.channelCountMode,
      channelInterpretation: fold.channelInterpretation,
    }).toEqual(STUDIO_CAPTURE_INPUT)
    for (const gain of [fold, bus]) {
      expect(gain.gain.value).toBe(1)
      expect(gain.gain.events).toEqual([])
      expect(gain.gain.ramps).toEqual([])
    }
  })

  it('hears only the notes that start inside the sequence, and releases one still held at its end', async () => {
    // Arrange
    samplesRefused()
    const clocks = renderClocks()

    // Act
    const result = await render(
      { notes: [note(60, 3000, 2000), note(64, 3840)], lengthTicks: 3840 },
      clocks,
    )

    // Assert: the held note stops 0.1 s after the sequence's end.
    const [fundamental] = clocks.made[0].sources
    expect(marks(result.samples)).toEqual([[75000, 2]])
    expect(fundamental.stopTimes).toHaveLength(1)
    expect(fundamental.stopTimes[0]).toBeCloseTo(
      (PRE_ROLL + 96000) / 48000 + 0.1,
      9,
    )
  })

  it('runs the tail it is given past the sequence', async () => {
    // Arrange
    samplesRefused()

    // Act
    const result = await render({ tailSeconds: 0.25 })

    // Assert
    expect(result.frames).toBe(96000 + 12000)
  })

  it.each([
    ['no tempo', { tempoBpm: Number.NaN }],
    ['a tempo of zero', { tempoBpm: 0 }],
    ['a negative length', { lengthTicks: -1 }],
    ['a negative tail', { tailSeconds: -0.5 }],
  ])('refuses %s', async (_name, wrong) => {
    // Arrange
    const clocks = renderClocks()

    // Act
    const rendering = render(wrong, clocks)

    // Assert
    await expect(rendering).rejects.toBeInstanceOf(RangeError)
    expect(clocks.made).toHaveLength(0)
  })

  it('makes no clock when aborted before it starts', async () => {
    // Arrange
    const clocks = renderClocks()
    const abort = new AbortController()
    abort.abort()

    // Act
    const rendering = render(
      { notes: [note(60, 0)], signal: abort.signal },
      clocks,
    )

    // Assert
    await expect(rendering).rejects.toMatchObject({ name: 'AbortError' })
    expect(clocks.made).toHaveLength(0)
  })

  it('reports an abort while the grand loads as an abort, not as the synth, and renders nothing', async () => {
    // Arrange
    const asked = samplesStalled()
    const clocks = renderClocks()
    const abort = new AbortController()
    const rendering = render(
      {
        notes: [note(60, 0)],
        signal: abort.signal,
        deps: { grandTimeoutMs: 60_000 },
      },
      clocks,
    )
    await vi.waitFor(() => expect(asked.length).toBeGreaterThan(0))

    // Act
    abort.abort()

    // Assert
    await expect(rendering).rejects.toMatchObject({ name: 'AbortError' })
    expect(asked.every((signal) => signal.aborted)).toBe(true)
    expect(clocks.made[0].suspends).toEqual([])
    expect(studioReservedMemoryBytes()).toBe(0)
  })

  it('schedules nothing more once aborted mid-render, silences what it had scheduled, and gives its memory back as the render settles', async () => {
    // Arrange: a note every half second for 30 s, aborted as the render reaches 2 s.
    samplesRefused()
    const abort = new AbortController()
    const { clocks, create } = abortingAt(2, abort)
    const notes = Array.from({ length: 60 }, (_, i) => note(60, i * 960))

    // Act
    const rendering = render({
      notes,
      lengthTicks: 60 * 960,
      signal: abort.signal,
      deps: { createContext: create },
    })

    // Assert: only the first window's notes were made, and none of them after 2 s reached the output.
    await expect(rendering).rejects.toMatchObject({ name: 'AbortError' })
    const [clock] = clocks.made
    expect(clock.startFrames('oscillator')).toHaveLength(2 * 7)
    expect(marks(clock.output!.getChannelData(0))).toEqual([
      [PRE_ROLL, 2],
      [PRE_ROLL + 24000, 2],
      [PRE_ROLL + 48000, 2],
    ])
    expect(studioReservedMemoryBytes()).toBe(0)
  })
})
