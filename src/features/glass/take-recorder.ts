// ============================================================
// Glass — on-device take recorder (plan §8, NET-NEW).
//
// Records the singer's REAL voice from the shared mic stream so
// the rep loop can play it back to them — nothing in the app did
// this before (exercises keep pitch contours only).
//
// Privacy is the contract: chunks live in memory, one take at a
// time, dropped on the next take / reset / unload. Nothing is
// persisted, nothing is uploaded, ever. Recording is a
// progressive enhancement — without MediaRecorder the rep loop
// falls back to the contour-only replay.
// ============================================================

/** Preference order: Opus/WebM (Chrome/Firefox/Android), MP4 (Safari). */
const MIME_CANDIDATES = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm']

export interface TakeRecorder {
  /** Begin a fresh take (drops any previous one). */
  start: () => void
  /** Stop and resolve the take's Blob (null when nothing was captured). */
  stop: () => Promise<Blob | null>
  /** Stop and discard without producing a Blob (shatter path, resets). */
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
 * Wrap MediaRecorder over the mic stream micManager already holds (never a
 * second getUserMedia). Returns null when recording is unsupported — the
 * caller degrades to contour-only playback.
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
        const r = new MediaRecorder(stream, { mimeType: mime })
        r.ondataavailable = (event) => {
          if (event.data.size > 0) chunks.push(event.data)
        }
        r.start()
        recorder = r
      } catch {
        recorder = null // capture failed — contour-only fallback for this take
      }
    },

    stop: () => {
      const r = recorder
      recorder = null
      if (r === null || r.state === 'inactive') {
        return Promise.resolve(null)
      }
      return new Promise<Blob | null>((resolve) => {
        // A recorder that never fires onstop must not hang the rep loop.
        const timeout = setTimeout(() => resolve(null), 2000)
        r.onstop = () => {
          clearTimeout(timeout)
          resolve(chunks.length > 0 ? new Blob(chunks, { type: mime }) : null)
        }
        try {
          r.stop()
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
