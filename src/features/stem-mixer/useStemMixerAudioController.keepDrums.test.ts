// ============================================================
// StemMixer — "Leave drums unshifted", changed while the song plays
// ============================================================
//
// The setting decides which key-graph bus a Drums source joins, and a source
// joins one as it is made. It was read only then, so turning the setting off
// mid-song left the drums out of the key change (and on the shifter the other
// way round) until the next pause, seek or speed change.

import { createSignal } from 'solid-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AudioHarness } from '@/tests/helpers/stem-mixer-audio-harness'
import { createAudioHarness, decodedStem, } from '@/tests/helpers/stem-mixer-audio-harness'

const graph = vi.hoisted(() => ({ routes: [] as string[] }))

// The silent <audio> that unlocks playback on iOS is a browser concern, and
// jsdom cannot play it.
vi.mock('@/lib/audio-unlock', () => ({
  installAudioUnlock: () => () => undefined,
  unlockAudio: () => undefined,
}))

// The engine needs AudioWorklet; the routing does not. Every bus a source is
// sent to is recorded, in order.
vi.mock('@/lib/key-shift/key-shift-graph', () => ({
  createKeyShiftGraph: () => ({
    input: (bus: string) => {
      graph.routes.push(bus)
      return { connect: vi.fn(), disconnect: vi.fn() }
    },
    apply: async () => Promise.resolve(),
    latencySec: () => 0,
    shiftSemitones: () => 0,
    available: () => true,
    dispose: () => undefined,
  }),
}))

let active: AudioHarness | null = null

afterEach(() => {
  active?.dispose()
  active = null
  graph.routes = []
  vi.unstubAllGlobals()
})

/** The buses of the last vocal, instrumental and drums sources made. */
const lastRoutes = () => graph.routes.slice(-3)

/** Plays the song from 0:10 for a few frames. */
async function startPlaying(harness: AudioHarness): Promise<AudioHarness> {
  active = harness
  await harness.load()
  harness.audio.seekTo(10)
  harness.audio.handlePlay()
  harness.runFrames(4)
  return harness
}

const drums = () => [decodedStem('Drums')]

describe('leave drums unshifted, changed mid-song', () => {
  it('sends the drums through the key change as soon as it is turned off', async () => {
    const [keepDrums, setKeepDrums] = createSignal(true)
    const { audio, runFrames } = await startPlaying(
      createAudioHarness({ extraTracks: drums(), keepDrums }),
    )
    expect(lastRoutes()).toEqual(['vocal', 'pitched', 'unpitched'])
    const before = audio.elapsed()

    setKeepDrums(false)

    expect(lastRoutes()).toEqual(['vocal', 'pitched', 'pitched'])
    runFrames(2)
    expect(audio.playing()).toBe(true)
    expect(audio.elapsed()).toBeGreaterThan(before)
    expect(audio.elapsed()).toBeLessThan(before + 0.2)
  })

  it('takes the drums back out when it is turned on again', async () => {
    const [keepDrums, setKeepDrums] = createSignal(false)
    await startPlaying(createAudioHarness({ extraTracks: drums(), keepDrums }))
    expect(lastRoutes()).toEqual(['vocal', 'pitched', 'pitched'])

    setKeepDrums(true)

    expect(lastRoutes()).toEqual(['vocal', 'pitched', 'unpitched'])
  })

  it('leaves a paused song alone until it plays again', async () => {
    const [keepDrums, setKeepDrums] = createSignal(true)
    const { audio } = await startPlaying(
      createAudioHarness({ extraTracks: drums(), keepDrums }),
    )
    audio.handlePause()
    const routesSoFar = graph.routes.length

    setKeepDrums(false)

    expect(graph.routes.length).toBe(routesSoFar)
    audio.handlePlay()
    expect(lastRoutes()).toEqual(['vocal', 'pitched', 'pitched'])
  })
})
