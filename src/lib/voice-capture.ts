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
  pause: () => Promise<boolean>
  /** Resume a paused take. */
  resume: () => Promise<boolean>
  /** Stop and resolve the take's Blob (null when nothing was captured). */
  stop: () => Promise<Blob | null>
  /** Stop and discard without producing a Blob. */
  discard: () => void
  dispose: () => void
}

const RECORDER_TRANSITION_TIMEOUT_MS = 1000

/**
 * MediaRecorder changes pause/resume state in a queued task. Waiting for the
 * matching event keeps reference audio and rest gaps outside segmented takes.
 */
function awaitRecorderTransition(
  recorder: MediaRecorder,
  eventName: 'pause' | 'resume',
  expectedState: RecordingState,
  transition: () => void,
): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false
    const finish = (ready: boolean): void => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      recorder.removeEventListener(eventName, handleTransition)
      recorder.removeEventListener('error', handleFailure)
      recorder.removeEventListener('stop', handleFailure)
      resolve(ready)
    }
    const handleTransition = (): void =>
      finish(recorder.state === expectedState)
    const handleFailure = (): void => finish(false)
    const timeout = setTimeout(
      () => finish(recorder.state === expectedState),
      RECORDER_TRANSITION_TIMEOUT_MS,
    )

    recorder.addEventListener(eventName, handleTransition)
    recorder.addEventListener('error', handleFailure)
    recorder.addEventListener('stop', handleFailure)
    try {
      transition()
    } catch {
      finish(false)
    }
  })
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

    pause: async () => {
      const current = recorder
      if (current === null || current.state !== 'recording') return false
      return awaitRecorderTransition(current, 'pause', 'paused', () =>
        current.pause(),
      )
    },

    resume: async () => {
      const current = recorder
      if (current === null || current.state !== 'paused') return false
      return awaitRecorderTransition(current, 'resume', 'recording', () =>
        current.resume(),
      )
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
): Promise<{
  durationMs: number
  peaks: Float32Array
  peakAmplitude?: number | null
}> {
  if (audioContext === null) {
    return {
      durationMs: fallbackDurationMs,
      peaks: new Float32Array(),
      peakAmplitude: null,
    }
  }
  try {
    const buffer = await audioContext.decodeAudioData(await blob.arrayBuffer())
    let peakAmplitude = 0
    const channelCount =
      Number.isSafeInteger(buffer.numberOfChannels) &&
      buffer.numberOfChannels > 0
        ? buffer.numberOfChannels
        : 1
    for (let channel = 0; channel < channelCount; channel += 1) {
      const samples = buffer.getChannelData(channel)
      for (let index = 0; index < samples.length; index += 1) {
        peakAmplitude = Math.max(peakAmplitude, Math.abs(samples[index]!))
      }
    }
    return {
      durationMs:
        Number.isFinite(buffer.duration) && buffer.duration > 0
          ? Math.round(buffer.duration * 1000)
          : fallbackDurationMs,
      peaks: computeVoicePeaks(buffer),
      peakAmplitude,
    }
  } catch {
    return {
      durationMs: fallbackDurationMs,
      peaks: new Float32Array(),
      peakAmplitude: null,
    }
  }
}
