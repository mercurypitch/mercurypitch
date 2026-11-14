// ============================================================
// Take onset tests — where a recorded take's voice starts
// ============================================================
//
// Lesson 28 WEB-SPEC, The playback, on synthetic recordings at 48 kHz: the
// listener's detector, read over the buffer a frame apart, finds a sung
// note's start just after it begins, by no more than its window; a note
// recorded a quarter of a second later is found a quarter of a second
// later, which is what lines a playback up; a blip shorter than the
// reader's first-note run is passed over for the note after it; silence,
// or a note outside the span read, finds nothing; and two channels are
// heard as one, as the analyser hears them.

import { describe, expect, it } from 'vitest'
import { F0_DETECTOR } from '@/lib/pitch-f0-stream'
import { ONSET_HOP_SEC, voiceOnsetOf } from './take-onset'

const RATE = 48000
/** The window's length, s: the most a reading can lag the voice. */
const WINDOW = F0_DETECTOR.bufferSize / RATE

/** A recording `seconds` long, silent but for each tone: `hz` from `from` for `sec` seconds. */
function recording(
  seconds: number,
  tones: readonly { from: number; sec: number; hz: number }[],
  channels = 1,
): AudioBuffer {
  const data = new Float32Array(Math.round(seconds * RATE))
  for (const tone of tones) {
    const first = Math.round(tone.from * RATE)
    const last = Math.min(
      data.length,
      Math.round((tone.from + tone.sec) * RATE),
    )
    for (let i = first; i < last; i++)
      data[i] = 0.2 * Math.sin((2 * Math.PI * tone.hz * (i - first)) / RATE)
  }
  return {
    numberOfChannels: channels,
    length: data.length,
    duration: seconds,
    sampleRate: RATE,
    getChannelData: () => data,
  } as unknown as AudioBuffer
}

const G3 = 196

describe('where a recorded take’s voice starts', () => {
  it('finds a sung note just after it begins, by no more than the listener’s window, never before it', async () => {
    // Arrange: notes starting across one frame's hop, so some start just
    // after a frame: each window ends at its frame, so that frame hears none
    const starts = [0, 0.25, 0.5, 0.75].map((f) => 0.6 + f * ONSET_HOP_SEC)

    // Act
    const found = await Promise.all(
      starts.map((from) =>
        voiceOnsetOf(recording(2, [{ from, sec: 1, hz: G3 }])),
      ),
    )

    // Assert
    found.forEach((at, i) => {
      expect(at).not.toBeNull()
      expect(at ?? 0).toBeGreaterThanOrEqual(starts[i])
      expect(at ?? 0).toBeLessThanOrEqual(starts[i] + WINDOW + ONSET_HOP_SEC)
    })
  })

  it('finds a note recorded a quarter of a second later a quarter of a second later, to a frame', async () => {
    // Arrange: the same take, its recorder started 0.25 s sooner
    const one = recording(2.5, [{ from: 0.6, sec: 1, hz: G3 }])
    const two = recording(2.5, [{ from: 0.85, sec: 1, hz: G3 }])

    // Act
    const [a, b] = await Promise.all([voiceOnsetOf(one), voiceOnsetOf(two)])

    // Assert
    expect(Math.abs((b ?? 0) - (a ?? 0) - 0.25)).toBeLessThanOrEqual(
      ONSET_HOP_SEC + 1e-9,
    )
  })

  it('passes over a blip shorter than a first note’s run for the note after it', async () => {
    // Arrange: a twentieth of a second at 0.3 s, then the note at 1.0 s
    const take = recording(2.5, [
      { from: 0.3, sec: 0.05, hz: G3 },
      { from: 1, sec: 1, hz: G3 },
    ])

    // Act
    const at = await voiceOnsetOf(take)

    // Assert
    expect(at ?? 0).toBeGreaterThanOrEqual(1)
    expect(at ?? 0).toBeLessThanOrEqual(1 + WINDOW + ONSET_HOP_SEC)
  })

  it('reads only its span: nothing in silence, or before a note, and nothing before where it starts', async () => {
    // Arrange: a note at 0.3 s and one at 1.5 s
    const silent = recording(1.5, [])
    const two = recording(2.5, [
      { from: 0.3, sec: 0.5, hz: G3 },
      { from: 1.5, sec: 0.8, hz: G3 },
    ])

    // Act
    const none = await voiceOnsetOf(silent)
    const before = await voiceOnsetOf(two, { from: 0.9, to: 1.4 })
    const after = await voiceOnsetOf(two, { from: 1 })

    // Assert
    expect([none, before]).toEqual([null, null])
    expect(after ?? 0).toBeGreaterThanOrEqual(1.5)
    expect(after ?? 0).toBeLessThanOrEqual(1.5 + WINDOW + ONSET_HOP_SEC)
  })

  it('hears two channels as one, as the analyser does', async () => {
    // Arrange: the same note on both channels
    const mono = recording(2, [{ from: 0.6, sec: 1, hz: G3 }])
    const stereo = recording(2, [{ from: 0.6, sec: 1, hz: G3 }], 2)

    // Act / Assert
    expect(await voiceOnsetOf(stereo)).toBe(await voiceOnsetOf(mono))
  })
})
