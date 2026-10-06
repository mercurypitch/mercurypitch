// ============================================================
// StemMixer — the A-B loop, as the playback clock runs it
// ============================================================
//
// Paused at 0:05, A and then B on that same instant, then Play: the loop's
// end was already behind the playhead, so every frame seeked back to A and
// the song stood still on it, counting a "loop" sixty times a second. These
// drive the real controller through decoded stems and a hand-cranked frame
// clock, because the freeze lived in how the frame loop and the loop points
// meet, not in either one alone.

import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AudioHarness } from '@/tests/helpers/stem-mixer-audio-harness'
import { createAudioHarness, SONG_SECONDS, } from '@/tests/helpers/stem-mixer-audio-harness'

// The silent <audio> that unlocks playback on iOS is a browser concern, and
// jsdom cannot play it.
vi.mock('@/lib/audio-unlock', () => ({
  installAudioUnlock: () => () => undefined,
  unlockAudio: () => undefined,
  unlockForPlayback: (ensure: () => AudioContext | null) => ensure(),
}))

let active: AudioHarness | null = null

async function loadedSong() {
  active = createAudioHarness()
  await active.load()
  expect(active.audio.duration()).toBe(SONG_SECONDS)
  return active.audio
}

const runFrames = (count: number): void => active?.runFrames(count)

afterEach(() => {
  active?.dispose()
  active = null
  vi.unstubAllGlobals()
})

describe('the A-B loop while the song plays', () => {
  it('plays on through an A and a B on the same instant, instead of holding on A', async () => {
    const audio = await loadedSong()
    audio.seekTo(5)
    audio.setLoopStart(5)
    audio.setLoopEnd(5)
    audio.setLoopEnabled(true)

    audio.handlePlay()
    runFrames(20)

    expect(audio.elapsed()).toBeGreaterThan(5.9)
    expect(audio.loopCount()).toBe(0)
  })

  it('still takes a loop of at least 0.1 s back to A at its end', async () => {
    const audio = await loadedSong()
    audio.seekTo(5)
    audio.setLoopStart(5)
    audio.setLoopEnd(6)
    audio.setLoopEnabled(true)

    audio.handlePlay()
    runFrames(25)

    expect(audio.loopCount()).toBe(1)
    expect(audio.elapsed()).toBeLessThan(6)
    expect(audio.elapsed()).toBeGreaterThanOrEqual(5)
  })
})
