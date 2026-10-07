// ============================================================
// StemMixer — how long a stopping song's fade lasts, key shift included
// ============================================================
//
// A song that stops fades its stems out (50 ms and a slack, upstream of the
// key shifter) and the shared clock, or the room's graph, waits for the fade.
// The shifter holds about 120 ms of audio that went into it before the fade
// began, and plays it after the stem gains are shut, still at full level. A
// clock that stopped when the stems' own fade ended cut that audio off (iOS
// can make the cut a buzz) and played the rest of it when the clock next ran.
// So the wait is the fade plus whatever the shifter still has to say.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AudioHarness } from '@/tests/helpers/stem-mixer-audio-harness'
import { createAudioHarness } from '@/tests/helpers/stem-mixer-audio-harness'

const shifter = vi.hoisted(() => ({ latencySec: 0 }))

// The silent <audio> that unlocks playback on iOS is a browser concern, and
// jsdom cannot play it.
vi.mock('@/lib/audio-unlock', () => ({
  installAudioUnlock: () => () => undefined,
  unlockAudio: () => undefined,
  unlockForPlayback: (ensure: () => AudioContext | null) => ensure(),
}))

// The engine needs AudioWorklet; what the controller asks of the graph does
// not. The latency is whatever the test says the shifter holds.
vi.mock('@/lib/key-shift/key-shift-graph', () => ({
  createKeyShiftGraph: () => ({
    input: () => ({ connect: vi.fn(), disconnect: vi.fn() }),
    apply: async () => Promise.resolve(),
    latencySec: () => shifter.latencySec,
    shiftSemitones: () => 0,
    available: () => true,
    dispose: () => undefined,
  }),
}))

let active: AudioHarness | null = null

/** A playing song, then the clock of the test pinned: the fade is read exactly. */
async function playingSong(): Promise<AudioHarness> {
  active = createAudioHarness()
  await active.load()
  active.audio.handlePlay()
  active.runFrames(2)
  expect(active.audio.playing()).toBe(true)
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
  return active
}

beforeEach(() => {
  shifter.latencySec = 0
})

afterEach(() => {
  active?.dispose()
  active = null
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('the fade a stopping song leaves behind', () => {
  it('asks the clock to wait for the shifter to play out what it holds', async () => {
    shifter.latencySec = 0.12
    const { audio } = await playingSong()

    // The stems' fade and slack are 80 ms; the shifter's 120 ms comes after.
    expect(audio.prepareToSuspend()).toBe(200)
  })

  it('asks no more than its own fade of a song that is not shifted', async () => {
    const { audio } = await playingSong()

    expect(audio.prepareToSuspend()).toBe(80)
  })

  it('tells the room how much of the shifter is left to wait for, as time passes', async () => {
    // The room's mixer going away lets its graph go after this long, so a
    // shifter's tail is not cut off by the graph either.
    shifter.latencySec = 0.12
    const { audio } = await playingSong()
    audio.handlePause()

    expect(audio.releaseLeft()).toBe(200)
    vi.advanceTimersByTime(150)
    expect(audio.releaseLeft()).toBe(50)
    vi.advanceTimersByTime(50)
    expect(audio.releaseLeft()).toBe(0)
  })
})
