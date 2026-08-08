// ============================================================
// Web Speech listener — the phase-1 ear for voice control
// ============================================================
//
// Wraps SpeechRecognition in the VoiceListener seam: continuous mode,
// interim results, and — unlike the lyric-capture wrapper in
// src/lib/speech-recognition.ts, which accumulates a transcript — DISCRETE
// final utterances: each final result is emitted alone, because the grammar
// matches whole utterances. Chrome ends continuous sessions on its own
// (silence, ~60 s, tab switches), so while started we respawn on `end`,
// backing off when the session dies immediately (a broken mic would
// otherwise hot-loop). Capture happens inside the browser's recognizer, NOT
// through mic-manager.ts — a phase-2 local engine must go through
// MicManager and register a mic indicator instead.

import type { VoiceListener, VoiceListenerCallbacks } from './types'

interface SpeechRecognitionResultLike {
  isFinal: boolean
  0: { transcript: string }
  length: number
}

interface SpeechRecognitionLike {
  continuous: boolean
  interimResults: boolean
  lang: string
  maxAlternatives: number
  onresult:
    | ((event: {
        resultIndex: number
        results: SpeechRecognitionResultLike[]
      }) => void)
    | null
  onerror: ((event: Event & { error: string }) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
}

const RESTART_DELAY_MS = 300
const FAST_END_BACKOFF_MS = 3000
/** Session lifetimes under this count as "died immediately". */
const FAST_END_THRESHOLD_MS = 1000
/** Consecutive immediate deaths before the restart delay backs off. */
const FAST_END_LIMIT = 5

/** Permission-shaped errors: do not restart, the user has to act first. */
const FATAL_ERRORS = new Set(['not-allowed', 'service-not-allowed'])

export function createWebSpeechListener(
  callbacks: VoiceListenerCallbacks,
): VoiceListener {
  const w = window as unknown as Record<string, unknown>
  const RecognitionCtor = (w.SpeechRecognition ?? w.webkitSpeechRecognition) as
    | (new () => SpeechRecognitionLike)
    | undefined

  if (RecognitionCtor === undefined) {
    return { isSupported: false, start: () => {}, stop: () => {} }
  }

  let started = false
  let recognition: SpeechRecognitionLike | null = null
  let restartTimer: ReturnType<typeof setTimeout> | null = null
  let spinUpAt = 0
  let fastEnds = 0

  const clearRestartTimer = () => {
    if (restartTimer !== null) {
      clearTimeout(restartTimer)
      restartTimer = null
    }
  }

  const spinUp = () => {
    const r = new RecognitionCtor()
    r.continuous = true
    r.interimResults = true
    r.lang = 'en-US'
    r.maxAlternatives = 1

    r.onresult = (event) => {
      let interim = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        if (result.isFinal) {
          const text = result[0].transcript.trim()
          if (text !== '') callbacks.onUtterance(text)
        } else {
          interim += result[0].transcript
        }
      }
      callbacks.onInterim(interim.trim())
    }

    r.onerror = (event) => {
      if (event.error === 'no-speech' || event.error === 'aborted') return
      if (FATAL_ERRORS.has(event.error)) {
        started = false
        clearRestartTimer()
      }
      // Transient errors (network, audio-capture) also land here; onend
      // follows and restarts because `started` is still true.
      callbacks.onStateChange('error', event.error)
    }

    r.onend = () => {
      recognition = null
      callbacks.onInterim('')
      if (!started) {
        // A fatal error got here first — leave its 'error' state standing.
        return
      }
      const lifetime = Date.now() - spinUpAt
      fastEnds = lifetime < FAST_END_THRESHOLD_MS ? fastEnds + 1 : 0
      const delay =
        fastEnds >= FAST_END_LIMIT ? FAST_END_BACKOFF_MS : RESTART_DELAY_MS
      clearRestartTimer()
      restartTimer = setTimeout(() => {
        restartTimer = null
        if (started) spinUp()
      }, delay)
    }

    recognition = r
    spinUpAt = Date.now()
    try {
      r.start()
    } catch {
      // start() throws when a session is already running — treat as running.
    }
    callbacks.onStateChange('listening')
  }

  return {
    isSupported: true,
    start: () => {
      if (started) return
      started = true
      fastEnds = 0
      spinUp()
    },
    stop: () => {
      started = false
      clearRestartTimer()
      const r = recognition
      recognition = null
      if (r !== null) {
        r.onresult = null
        r.onerror = null
        r.onend = null
        try {
          r.stop()
        } catch {
          // Already stopped.
        }
      }
      callbacks.onInterim('')
      callbacks.onStateChange('idle')
    },
  }
}
