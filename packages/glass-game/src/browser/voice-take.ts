// Optional musical take — bounded local recording of a stream the voice session already owns.
import type { GlassVoiceTake } from '../host'

const MAXIMUM_TAKE_MS = 45_000
const MAXIMUM_TAKE_BYTES = 12 * 1024 * 1024
const FINALIZE_TIMEOUT_MS = 2000
const TYPES = [
  'audio/mp4',
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/ogg;codecs=opus',
]

export function supportedTakeMime(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined
  return TYPES.find((type) => {
    try {
      return MediaRecorder.isTypeSupported(type)
    } catch {
      return false
    }
  })
}

/** No upload, permission request, microphone ownership or automatic recording happens here. */
export function createBrowserVoiceTake(stream: MediaStream): GlassVoiceTake {
  const mimeType = supportedTakeMime()
  if (mimeType === undefined)
    throw new Error(
      'This browser cannot save a musical take. You can still sing the encore.',
    )
  const recorder = new MediaRecorder(stream, {
    mimeType,
    audioBitsPerSecond: 128_000,
  })
  const chunks: Blob[] = []
  let bytes = 0
  let ending = false
  let settled = false
  let finalizeTimer: ReturnType<typeof setTimeout> | undefined
  let resolve!: (blob: Blob | null) => void
  const result = new Promise<Blob | null>((done) => {
    resolve = done
  })
  const settle = (blob: Blob | null) => {
    if (settled) return
    settled = true
    clearTimeout(limitTimer)
    clearTimeout(finalizeTimer)
    recorder.ondataavailable = null
    recorder.onstop = null
    recorder.onerror = null
    chunks.length = 0
    resolve(blob)
  }
  const discard = () => {
    settle(null)
    if (recorder.state !== 'inactive') {
      try {
        recorder.stop()
      } catch {
        /* The stream may already have ended. */
      }
    }
  }
  const limitTimer = setTimeout(discard, MAXIMUM_TAKE_MS)
  recorder.ondataavailable = (event) => {
    if (settled || event.data.size === 0) return
    bytes += event.data.size
    if (bytes > MAXIMUM_TAKE_BYTES) {
      discard()
      return
    }
    chunks.push(event.data)
  }
  recorder.onerror = discard
  recorder.onstop = () => {
    if (!ending || bytes === 0) {
      settle(null)
      return
    }
    settle(new Blob(chunks, { type: recorder.mimeType || mimeType }))
  }
  try {
    recorder.start(200)
  } catch (error) {
    discard()
    throw error
  }
  return {
    isRecording: () => !settled && !ending && recorder.state === 'recording',
    finish() {
      if (settled || ending) return result
      ending = true
      clearTimeout(limitTimer)
      finalizeTimer = setTimeout(discard, FINALIZE_TIMEOUT_MS)
      try {
        recorder.stop()
      } catch {
        discard()
      }
      return result
    },
    discard,
  }
}
