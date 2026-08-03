// ============================================================
// Voice Capture — shared, on-device session recording primitives
// ============================================================

/** Preference order: Opus/WebM (Chrome/Firefox/Android), MP4 (Safari). */
const MIME_CANDIDATES = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm']

const DEFAULT_PEAK_BUCKETS = 72

export interface TakeRecorder {
  /** Begin a fresh take (drops any previous one). */
  start: () => boolean
  /** Pause without adding the transport break to the encoded take. */
  pause: () => boolean
  /** Resume a paused take. */
  resume: () => boolean
  /** Stop and resolve the take's Blob (null when nothing was captured). */
  stop: () => Promise<Blob | null>
  /** Stop and discard without producing a Blob. */
  discard: () => void
  dispose: () => void
}

export function pickRecorderMime(): string | null {
  if (typeof MediaRecorder === 'undefined') return null
  for (const mime of MIME_CANDIDATES) {
    try {
      if (MediaRecorder.isTypeSupported(mime)) return mime
    } catch {
      // isTypeSupported itself can throw on exotic UAs — treat as no.
    }
  }
  return null
}

/**
 * Wrap MediaRecorder over a stream the active surface already owns. This
 * helper never calls getUserMedia and never sends the resulting audio away.
 */
export function createTakeRecorder(stream: MediaStream): TakeRecorder | null {
  const mime = pickRecorderMime()
  if (mime === null) return null

  let recorder: MediaRecorder | null = null
  let chunks: BlobPart[] = []

  const stopCurrent = (): void => {
    if (recorder !== null && recorder.state !== 'inactive') {
      try {
        recorder.stop()
      } catch {
        // Already stopping/stopped — fine.
      }
    }
    recorder = null
  }

  return {
    start: () => {
      stopCurrent()
      chunks = []
      try {
        const next = new MediaRecorder(stream, { mimeType: mime })
        next.ondataavailable = (event) => {
          if (event.data.size > 0) chunks.push(event.data)
        }
        next.start()
        recorder = next
        return true
      } catch {
        recorder = null
        return false
      }
    },

    pause: () => {
      if (recorder === null || recorder.state !== 'recording') return false
      try {
        recorder.pause()
        return true
      } catch {
        return false
      }
    },

    resume: () => {
      if (recorder === null || recorder.state !== 'paused') return false
      try {
        recorder.resume()
        return true
      } catch {
        return false
      }
    },

    stop: () => {
      const current = recorder
      recorder = null
      if (current === null || current.state === 'inactive') {
        return Promise.resolve(null)
      }
      return new Promise<Blob | null>((resolve) => {
        const timeout = setTimeout(() => resolve(null), 2000)
        current.onstop = () => {
          clearTimeout(timeout)
          resolve(chunks.length > 0 ? new Blob(chunks, { type: mime }) : null)
        }
        try {
          current.stop()
        } catch {
          clearTimeout(timeout)
          resolve(null)
        }
      })
    },

    discard: () => {
      stopCurrent()
      chunks = []
    },

    dispose: () => {
      stopCurrent()
      chunks = []
    },
  }
}

/** Max-|sample| buckets over the first channel for compact waveform display. */
export function computeVoicePeaks(
  buffer: AudioBuffer,
  buckets: number = DEFAULT_PEAK_BUCKETS,
): Float32Array {
  const data = buffer.getChannelData(0)
  const peaks = new Float32Array(buckets)
  const perBucket = Math.max(1, Math.floor(data.length / buckets))
  let maximum = 0
  for (let bucket = 0; bucket < buckets; bucket++) {
    let peak = 0
    const start = bucket * perBucket
    const end = Math.min(data.length, start + perBucket)
    for (let index = start; index < end; index++) {
      peak = Math.max(peak, Math.abs(data[index]!))
    }
    peaks[bucket] = peak
    maximum = Math.max(maximum, peak)
  }
  if (maximum > 0.001) {
    for (let bucket = 0; bucket < buckets; bucket++) {
      peaks[bucket] = peaks[bucket]! / maximum
    }
  }
  return peaks
}

/**
 * Decode once while the active surface's AudioContext is available. Failure
 * is non-fatal: the original Blob remains exportable and playable by URL.
 */
export async function inspectVoiceTake(
  blob: Blob,
  audioContext: AudioContext | null,
  fallbackDurationMs: number,
): Promise<{ durationMs: number; peaks: Float32Array }> {
  if (audioContext === null) {
    return { durationMs: fallbackDurationMs, peaks: new Float32Array() }
  }
  try {
    const buffer = await audioContext.decodeAudioData(await blob.arrayBuffer())
    return {
      durationMs: Math.max(0, Math.round(buffer.duration * 1000)),
      peaks: computeVoicePeaks(buffer),
    }
  } catch {
    return { durationMs: fallbackDurationMs, peaks: new Float32Array() }
  }
}
