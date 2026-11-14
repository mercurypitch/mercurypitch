// ============================================================
// Take onset — where a recorded take's voice starts
// ============================================================
//
// Lesson 28 plays a take back with the part sung under it, lined up on the
// singer's first note (its WEB-SPEC, The playback). The take's frames say
// when that note came against bar 1 (take-in-time.ts `onset`), but the
// recorder gives no time for its first sample (MediaRecorder starts when it
// can), so where the note sits in the recording is found in the recording
// itself, the way the take found it: the listener's own detector
// (src/lib/pitch-f0-stream.ts `F0_DETECTOR`, YIN over 2048 samples) run over
// the decoded buffer a listener's frame apart, each window ending at its
// frame's time as the analyser's does, and the reader's rule for the first
// note, the first run of voice at least 0.15 s long (read-in-time.ts
// `firstRunAt`). Both readings carry the same window's lag, which cancels.
//
// It reads only the span it is given, round where the frames heard the note
// begin, and gives the page back its thread every few frames, so a phone
// never stalls while it reads. It brings the pitch code, so a page loads it
// with the take, on Start.

import type { F0Frame } from '@/lib/mirror/metrics'
import { preprocess } from '@/lib/mirror/metrics'
import { PitchDetector } from '@/lib/pitch-detector'
import { F0_DETECTOR } from '@/lib/pitch-f0-stream'
import { ANCHOR_RUN_SEC, firstRunAt } from './read-in-time'

/** Seconds between frames: the listener's, one an animation frame at 60 a second. */
export const ONSET_HOP_SEC = 1 / 60

/** Frames read between the turns given back to the page. */
const FRAMES_A_TURN = 12

/** Seconds past a run's start before it is settled: its 0.15 s and the smoothing's reach beyond it. */
const SETTLED_SEC = ANCHOR_RUN_SEC + 0.15

/** The buffer's channels mixed to one, as the analyser hears them. */
function monoOf(buffer: AudioBuffer): Float32Array {
  if (buffer.numberOfChannels === 1) return buffer.getChannelData(0)
  const mono = new Float32Array(buffer.length)
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const data = buffer.getChannelData(c)
    for (let i = 0; i < mono.length; i++)
      mono[i] += data[i] / buffer.numberOfChannels
  }
  return mono
}

/** Lets the page run before the next frames are read. */
const turn = (): Promise<void> =>
  new Promise((resolve) => {
    window.setTimeout(resolve, 0)
  })

/**
 * Seconds into `buffer` where its first run of voice at least 0.15 s long
 * starts, read from `from` to `to` seconds in; null with none there.
 */
export async function voiceOnsetOf(
  buffer: AudioBuffer,
  span: { readonly from?: number; readonly to?: number } = {},
): Promise<number | null> {
  const rate = buffer.sampleRate
  const size = F0_DETECTOR.bufferSize
  const detector = new PitchDetector({ ...F0_DETECTOR, sampleRate: rate })
  const data = monoOf(buffer)
  const hop = ONSET_HOP_SEC * rate
  const last = Math.min(data.length, Math.round((span.to ?? Infinity) * rate))
  const first = Math.max(size, Math.round((span.from ?? 0) * rate))
  const frames: F0Frame[] = []
  for (let k = 0; first + Math.round(k * hop) <= last; k++) {
    // the window the analyser would hold at this frame: the samples before it
    const end = first + Math.round(k * hop)
    const heard = detector.detect(data.subarray(end - size, end))
    const voiced = heard.frequency > 0
    frames.push({
      t: end / rate,
      f0: voiced ? heard.frequency : 0,
      conf: voiced ? heard.clarity : 0,
    })
    if ((k + 1) % FRAMES_A_TURN !== 0) continue
    // a run found and read past is settled: nothing later moves its start
    const at = firstRunAt(preprocess(frames))
    if (at !== null && end / rate - at >= SETTLED_SEC) return at
    await turn()
  }
  return firstRunAt(preprocess(frames))
}
