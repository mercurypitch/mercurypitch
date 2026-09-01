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
//
// ── Why this file is more careful than `r.start()` ──
//
// On iOS every assumption a desktop recognizer lets you make is wrong.
//
//  1. `start()` is only reliably permitted inside a user gesture. Voice
//     control is a persisted preference, so the start that matters happens at
//     mount — no gesture in sight — and WebKit refuses it. It refuses by
//     throwing, which this file used to swallow and then report `listening`
//     anyway: the pill said it was listening and nothing was ever connected.
//     That is the bug this file is built around. Nothing here reports
//     `listening` on its own say-so; only the recognizer's own `start` event
//     does, and until it arrives the state is `starting`.
//
//  2. A session can die with no `end` and no `error`, and the respawn logic
//     hangs off `end`, so a silent death used to be permanent. There are two
//     shapes of it and they need different answers. One never got going —
//     another audio consumer holding the mic — and `CONFIRM_START_MS` is the
//     watchdog for it: a session that does not announce itself is dead. The
//     other confirmed, worked, and then died inside a freeze the document
//     came back from, leaving `live` true over nothing; no watchdog can see
//     that, so a page returning from hidden or from the back/forward cache
//     replaces its session rather than trusting it.
//
//  3. Karaoke Night is a separate document, so walking into it and back out
//     is two full page loads, each with its own gesture-less mount. Recovery
//     therefore cannot depend on the singer finding the pill and pressing it
//     twice — while we are meant to be listening but nothing is, the next
//     touch ANYWHERE in the app respawns. That is the seam iOS leaves open,
//     and it is the same one `local-whisper-listener.ts` uses to resume its
//     AudioContext.

import type { VoiceListener, VoiceListenerCallbacks } from './types'

interface SpeechRecognitionResultLike {
  isFinal: boolean
  0: { transcript: string; confidence?: number }
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
  /** Fires when the service has actually begun listening. */
  onstart: (() => void) | null
  start: () => void
  stop: () => void
  abort?: () => void
}

const RESTART_DELAY_MS = 300
const FAST_END_BACKOFF_MS = 3000
/** Session lifetimes under this count as "died immediately". */
const FAST_END_THRESHOLD_MS = 1000
/** Consecutive immediate deaths before the restart delay backs off. */
const FAST_END_LIMIT = 5
/**
 * How long a session gets to fire `start` before we call it stillborn.
 * Chrome answers in tens of milliseconds; this is sized for a phone that is
 * also decoding a song, not for the happy path.
 */
const CONFIRM_START_MS = 4000

/** Permission-shaped errors: do not restart, the user has to act first. */
const FATAL_ERRORS = new Set(['not-allowed', 'service-not-allowed'])

/**
 * `start()` throws this when a session is already running. It is the one
 * throw that means "carry on" rather than "that did not work".
 */
const ALREADY_RUNNING = 'InvalidStateError'

/**
 * Finals with a REAL low confidence estimate are dropped before they reach
 * the grammar. Chrome reports 0 when it has no estimate at all, so only a
 * positive-but-low value blocks the utterance.
 */
const MIN_FINAL_CONFIDENCE = 0.3

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

  /** The caller wants us listening. Independent of whether we manage to. */
  let started = false
  /** The recognizer has confirmed this session with its own `start` event. */
  let live = false
  /**
   * Some session, at some point, actually worked.
   *
   * Chrome ends a continuous session on every silence, so respawning is the
   * normal rhythm rather than an event — and `starting` is a talking state
   * that pops the pill open over the header (see voice-hud-presence.ts). A
   * respawn after a healthy session is a continuation and says nothing; only
   * a cold start, or a restart after we have admitted an error, announces
   * itself. The watchdog still catches a respawn that turns out to be dead.
   */
  let hasBeenLive = false
  let recognition: SpeechRecognitionLike | null = null
  let restartTimer: ReturnType<typeof setTimeout> | null = null
  let confirmTimer: ReturnType<typeof setTimeout> | null = null
  let listeningForGesture = false
  let spinUpAt = 0
  let fastEnds = 0

  const clearRestartTimer = () => {
    if (restartTimer !== null) {
      clearTimeout(restartTimer)
      restartTimer = null
    }
  }

  const clearConfirmTimer = () => {
    if (confirmTimer !== null) {
      clearTimeout(confirmTimer)
      confirmTimer = null
    }
  }

  /** Drop a session we no longer believe in, without hearing from it again. */
  const discard = () => {
    const r = recognition
    recognition = null
    live = false
    clearConfirmTimer()
    if (r === null) return
    r.onresult = null
    r.onerror = null
    r.onend = null
    r.onstart = null
    try {
      // `abort` drops the session without waiting for a final result; `stop`
      // is the graceful form and is all some engines implement.
      if (typeof r.abort === 'function') r.abort()
      else r.stop()
    } catch {
      // Already gone, which is the state we wanted.
    }
  }

  /** Nothing is running and nothing is scheduled to run. */
  const isSilent = (): boolean => recognition === null && restartTimer === null

  const scheduleRestart = (delay: number) => {
    clearRestartTimer()
    restartTimer = setTimeout(() => {
      restartTimer = null
      if (started) spinUp()
    }, delay)
  }

  // ── The gesture seam ──────────────────────────────────────────
  //
  // iOS grants `start()` inside a user gesture and, often enough, nowhere
  // else. So while we are meant to be listening and are not, the next touch
  // or key anywhere in the app is spent restarting. Capture phase and
  // passive, so it never interferes with what the user was actually doing.

  const onGesture = () => {
    if (!started || !isSilent()) return
    spinUp()
  }

  const listenForGesture = () => {
    if (listeningForGesture) return
    listeningForGesture = true
    window.addEventListener('pointerdown', onGesture, {
      capture: true,
      passive: true,
    })
    window.addEventListener('keydown', onGesture, { capture: true })
  }

  /**
   * Admit that nothing is listening and wait to be touched. The one exit from
   * every way iOS takes the recognizer away silently.
   */
  const failToGesture = (detail: string) => {
    hasBeenLive = false
    callbacks.onStateChange('error', detail)
    listenForGesture()
  }

  const stopListeningForGesture = () => {
    if (!listeningForGesture) return
    listeningForGesture = false
    window.removeEventListener('pointerdown', onGesture, { capture: true })
    window.removeEventListener('keydown', onGesture, { capture: true })
  }

  // ── Coming back to a page that was put away ───────────────────
  //
  // iOS suspends a backgrounded document and does not always tell the
  // recognizer, so a tab returning from the app switcher, from a lock, or
  // from the back/forward cache can hold a session that will never speak
  // again — `live` stays true over a recognizer that stopped existing, which
  // is the shape of "it just does not hear me any more".
  //
  // Nothing here can ask a session whether it is still alive, and the only
  // proof is a result the room may never produce. So a page that was put away
  // replaces its session rather than trusting it. The cost is one restart the
  // singer cannot see — a respawn after a healthy session says nothing (see
  // `hasBeenLive`) — against a mic that is otherwise deaf until the tab is
  // reloaded.

  const onVisibility = () => {
    // `visibilitychange` only fires on a transition, so arriving here at
    // `visible` means the document was hidden until a moment ago.
    if (!started || document.visibilityState !== 'visible') return
    clearRestartTimer()
    spinUp()
  }

  const onPageShow = (event: Event) => {
    // `persisted` is the back/forward-cache tell: the document was frozen
    // whole and thawed with its JS state intact, which is exactly the case
    // where a stale `live` looks healthy. iOS does not reliably fire
    // `visibilitychange` for it, so it is listened for separately.
    if (!started) return
    if ((event as { persisted?: boolean }).persisted !== true) return
    clearRestartTimer()
    spinUp()
  }

  const spinUp = () => {
    discard()

    const r = new RecognitionCtor()
    r.continuous = true
    r.interimResults = true
    r.lang = 'en-US'
    r.maxAlternatives = 1

    r.onstart = () => {
      if (recognition !== r) return
      live = true
      hasBeenLive = true
      fastEnds = 0
      clearConfirmTimer()
      stopListeningForGesture()
      callbacks.onStateChange('listening')
    }

    r.onresult = (event) => {
      // Some engines deliver results without ever firing `start`. Hearing
      // one is proof enough that the session is alive.
      if (recognition === r && !live) {
        live = true
        hasBeenLive = true
        clearConfirmTimer()
        stopListeningForGesture()
        callbacks.onStateChange('listening')
      }
      let interim = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        if (result.isFinal) {
          const alternative = result[0]
          const text = alternative.transcript.trim()
          const confidence = alternative.confidence
          const tooUncertain =
            typeof confidence === 'number' &&
            confidence > 0 &&
            confidence < MIN_FINAL_CONFIDENCE
          if (text !== '' && !tooUncertain) callbacks.onUtterance(text)
        } else {
          interim += result[0].transcript
        }
      }
      callbacks.onInterim(interim.trim())
    }

    r.onerror = (event) => {
      if (event.error === 'no-speech' || event.error === 'aborted') return
      if (FATAL_ERRORS.has(event.error)) {
        // The user has to act — but a permission that was refused because the
        // mic was busy elsewhere comes back, and their next touch is a fair
        // moment to find out. `started` stays true so that touch is spent.
        clearRestartTimer()
        clearConfirmTimer()
        failToGesture(event.error)
        return
      }
      // Transient errors (network, audio-capture) also land here; onend
      // follows and restarts because `started` is still true.
      hasBeenLive = false
      callbacks.onStateChange('error', event.error)
    }

    r.onend = () => {
      if (recognition !== r) return
      recognition = null
      const wasLive = live
      live = false
      clearConfirmTimer()
      callbacks.onInterim('')
      if (!started) return
      const lifetime = Date.now() - spinUpAt
      fastEnds = lifetime < FAST_END_THRESHOLD_MS ? fastEnds + 1 : 0
      // A session that never got going is not worth respawning on a timer —
      // on iOS that is the gesture refusal, and every timed retry is refused
      // in exactly the same way. Wait to be touched instead.
      if (!wasLive && fastEnds >= FAST_END_LIMIT) {
        failToGesture('needs-gesture')
        return
      }
      scheduleRestart(
        fastEnds >= FAST_END_LIMIT ? FAST_END_BACKOFF_MS : RESTART_DELAY_MS,
      )
    }

    recognition = r
    live = false
    spinUpAt = Date.now()
    if (!hasBeenLive) callbacks.onStateChange('starting')

    try {
      r.start()
    } catch (err) {
      const name = (err as { name?: string } | null)?.name
      if (name === ALREADY_RUNNING) {
        // A session is already running somewhere in this document. Leave it
        // be and let the watchdog below decide whether it ever speaks.
      } else {
        // The iOS refusal, and any other hard failure. Saying `listening`
        // here is what made this bug invisible for so long.
        recognition = null
        failToGesture('needs-gesture')
        return
      }
    }

    // Nothing above proves a session exists — only `onstart` does.
    clearConfirmTimer()
    confirmTimer = setTimeout(() => {
      confirmTimer = null
      if (!started || recognition !== r || live) return
      // Stillborn: no start, no error, no end. Another consumer holding the
      // mic looks exactly like this on iOS.
      discard()
      callbacks.onInterim('')
      failToGesture('needs-gesture')
    }, CONFIRM_START_MS)
  }

  return {
    isSupported: true,
    start: () => {
      if (started) return
      started = true
      fastEnds = 0
      document.addEventListener('visibilitychange', onVisibility)
      window.addEventListener('pageshow', onPageShow)
      spinUp()
    },
    stop: () => {
      started = false
      hasBeenLive = false
      clearRestartTimer()
      stopListeningForGesture()
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pageshow', onPageShow)
      discard()
      callbacks.onInterim('')
      callbacks.onStateChange('idle')
    },
  }
}
