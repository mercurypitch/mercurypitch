// ============================================================
// Lesson 28 playback tests — a take played back as it was sung against the part
// ============================================================
//
// WEB-SPEC, Tests 10, end to end on synthetic audio at 48 kHz: a voice
// that comes in on bar 1, or half a beat late, heard by the listener's
// detector a frame at a time from the take's open (the frames the take
// reads, take-in-time.ts `onset`), and recorded by a recorder that starts a
// little after the open, as MediaRecorder does, so the recording's first
// sample is at no known time; the note found again in the recording
// (kit/take-onset.ts), as the page finds it; and the playback booked
// (kit/record.ts `playWithPart`). The first sung note plays as far after
// the part's bar 1 as it was sung after bar 1, within one analysis frame,
// whatever the recorder's offset.

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import { createSoundOwner } from '@/features/lessons/kit/now-playing'
import { onsetOf } from '@/features/lessons/kit/read-in-time'
import { PART_LEAD_SEC, playWithPart } from '@/features/lessons/kit/record'
import { Sound } from '@/features/lessons/kit/sound'
import { ONSET_HOP_SEC, voiceOnsetOf } from '@/features/lessons/kit/take-onset'
import type { F0Frame } from '@/lib/mirror/metrics'
import { PitchDetector } from '@/lib/pitch-detector'
import { F0_DETECTOR } from '@/lib/pitch-f0-stream'
import { OPEN_BEATS, PART_SEC } from './sing-plan'
import { BEAT_SEC } from './song'

const RATE = 48000
/** Bar 1's first beat after the take's open, s. */
const BAR1 = OPEN_BEATS * BEAT_SEC
const G3 = 196

/** What the microphone hears from the take's open, `seconds` long: silence, then G3 from `from` s. */
function heard(from: number, seconds = 4): Float32Array {
  const data = new Float32Array(Math.round(seconds * RATE))
  for (let i = Math.round(from * RATE); i < data.length; i++)
    data[i] = 0.2 * Math.sin((2 * Math.PI * G3 * i) / RATE)
  return data
}

/** The listener's frames: the detector over the window the analyser holds at each frame, from the take's open. */
function framesOf(live: Float32Array, seconds: number): F0Frame[] {
  const size = F0_DETECTOR.bufferSize
  const detector = new PitchDetector({ ...F0_DETECTOR, sampleRate: RATE })
  const padded = new Float32Array(size + live.length)
  padded.set(live, size)
  const frames: F0Frame[] = []
  for (let k = 0; k * ONSET_HOP_SEC <= seconds; k++) {
    const t = k * ONSET_HOP_SEC
    const end = size + Math.round(t * RATE)
    const d = detector.detect(padded.subarray(end - size, end))
    frames.push({
      t,
      f0: d.frequency > 0 ? d.frequency : 0,
      conf: d.frequency > 0 ? d.clarity : 0,
    })
  }
  return frames
}

/** A recording of `live` from `lag` s after the take's open, as a decoded buffer. */
function recordingOf(live: Float32Array, lag: number): AudioBuffer {
  const data = live.slice(Math.round(lag * RATE))
  return {
    numberOfChannels: 1,
    length: data.length,
    duration: data.length / RATE,
    sampleRate: RATE,
    getChannelData: () => data,
  } as unknown as AudioBuffer
}

/** An audio context that keeps where its one buffer source was started. */
function contextDouble() {
  const started: [number, number][] = []
  const param = {
    value: 1,
    setValueAtTime: () => undefined,
    linearRampToValueAtTime: () => undefined,
  }
  const context = {
    currentTime: 20,
    state: 'running',
    destination: {},
    createBufferSource: () => ({
      buffer: null,
      onended: null,
      connect: () => undefined,
      start: (when: number, offset: number) => {
        started.push([when, offset])
      },
      stop: () => undefined,
    }),
    createGain: () => ({ gain: param, connect: () => undefined }),
  }
  return { context: context as unknown as AudioContext, started }
}

beforeEach(() => {
  Sound.set('on')
})

afterEach(() => {
  Sound.set('unset')
})

/** Where the take's first sung sample plays against the part's bar 1, s, for a voice in `late` s after bar 1 and a recorder `lag` s after the open. */
async function playedLate(late: number, lag: number): Promise<number> {
  const live = heard(BAR1 + late)
  const onset = onsetOf(framesOf(live, 3), { bar1: BAR1, opened: 0 })
  if (onset === null) throw new Error('the frames heard no first note')
  const buffer = recordingOf(live, lag)
  // as the page reads it: round where the frames heard the note, from the open
  const near = onset + BAR1
  const voicedAt = await voiceOnsetOf(buffer, {
    from: Math.max(0, near - 1),
    to: near + 1,
  })
  if (voicedAt === null) throw new Error('the recording held no first note')
  const { context, started } = contextDouble()
  playWithPart(
    { buffer, gain: 1, voicedAt, length: buffer.duration },
    context,
    createSoundOwner(),
    { book: () => null, seconds: PART_SEC, onset },
  )
  const [when, offset] = started[0]
  const p = context.currentTime + PART_LEAD_SEC
  // the first sung sample's place in the recording, and when it plays
  const first = BAR1 + late - lag
  return when + (first - offset) - p
}

describe('the playback lines the take up on its part (Tests 10)', () => {
  it('plays a take sung on bar 1 with its first note on the part’s bar 1, within a frame, whatever the recorder’s offset', async () => {
    for (const lag of [0.013, 0.087, 0.161]) {
      const at = await playedLate(0, lag)
      expect(Math.abs(at)).toBeLessThanOrEqual(ONSET_HOP_SEC + 1e-3)
    }
  })

  it('plays a take sung half a beat late half a beat late', async () => {
    for (const lag of [0.029, 0.142]) {
      const at = await playedLate(BEAT_SEC / 2, lag)
      expect(Math.abs(at - BEAT_SEC / 2)).toBeLessThanOrEqual(
        ONSET_HOP_SEC + 1e-3,
      )
    }
  })
})
