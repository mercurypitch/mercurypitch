// ============================================================
// useVoiceControlController — voice control's dispatcher and lifecycle
// ============================================================
//
// Owns the listener (started/stopped with the persisted enable flag, engine
// chosen in Settings), runs each final utterance through the grammar against
// the registry's live command sets, executes the match, and exposes the
// HUD's signals. Interim transcripts from the browser engine are matched
// EAGERLY: an interim that exactly equals a command and stays stable for a
// beat executes immediately, and the confirming final is suppressed so the
// command cannot double-fire. Mounted once by App, right beside
// useKeyboardShortcuts — the two drive the same handler surface on purpose.

import type { Accessor } from 'solid-js'
import { createEffect, createSignal, on, onCleanup, onMount, untrack, } from 'solid-js'
import { createPersistedSignal } from '@/lib/storage'
import { showNotification } from '@/stores/notifications-store'
import type { VoiceControlEngine } from '@/stores/settings-store'
import { voiceControlEngine, voiceWakeWordWhilePlaying, } from '@/stores/settings-store'
import type { VoiceResolveOptions, VoiceResolveOutcome, } from './command-grammar'
import { normalizeUtterance, phraseExtendsFurther, resolveVoiceCommand, stripFillerTokens, } from './command-grammar'
import { createLocalWhisperListener } from './local-whisper-listener'
import type { VoiceCommandResult, VoiceListener, VoiceListenerState, } from './types'
import { activeVoiceCommands, anyRegisteredMusicPlaying, } from './voice-command-registry'
import { createWebSpeechListener } from './webspeech-listener'

/** Experimental on-device alternative, selectable in Settings for latency
 *  comparison against whisper-tiny. */
const MOONSHINE_MODEL_ID = 'onnx-community/moonshine-tiny-ONNX'

export interface VoiceFeedback {
  /**
   * matched      — the command ran; `action` says what it did.
   * failed       — the command matched but did nothing; `message` says why.
   * unavailable  — the phrase exists but is gated off on this view.
   * unrecognized — no registered phrase consumed the utterance.
   */
  kind: 'matched' | 'failed' | 'unavailable' | 'unrecognized'
  /** What the recognizer heard, verbatim. */
  heard: string
  /** What happened, when it matched (e.g. 'Loop B set', 'Speed 1.5x'). */
  action?: string
  /** Why nothing happened, for 'failed' / 'unavailable'. */
  message?: string
}

export interface VoiceControlControllerDeps {
  /** True while any transport is audibly rolling — gates the optional
   *  wake-word-required mode. */
  musicPlaying?: Accessor<boolean>
}

export interface VoiceControlController {
  isSupported: boolean
  enabled: Accessor<boolean>
  toggle: () => void
  listenerState: Accessor<VoiceListenerState>
  /** Live interim transcript while a phrase is still being spoken. */
  interim: Accessor<string>
  /** Most recent utterance outcome; clears itself after a short hold. */
  feedback: Accessor<VoiceFeedback | null>
  errorDetail: Accessor<string | null>
  /** End-of-speech to action time in ms, when the engine measures it. */
  lastLatencyMs: Accessor<number | null>
}

const FEEDBACK_VISIBLE_MS = 2600

/** Permission-shaped listener errors that force the flag back off. */
const PERMISSION_ERRORS = new Set(['not-allowed', 'service-not-allowed'])

// Unrecognized-speech toasts are rationed: only short, command-shaped
// utterances qualify (long ones are ambient talk or backing-track lyrics
// bleeding in — the HUD still shows those), and no more than one toast per
// interval so singing near the mic cannot flood the corner.
const UNRECOGNIZED_TOAST_MAX_TOKENS = 4
const UNRECOGNIZED_TOAST_INTERVAL_MS = 6000

// Eager interim execution: an interim transcript that resolves to a command
// and stays unchanged this long runs immediately; the confirming final is
// then suppressed for the window below so it cannot double-fire.
const EAGER_STABLE_MS = 150
const EAGER_FINAL_SUPPRESS_MS = 2500

export function useVoiceControlController(
  deps?: VoiceControlControllerDeps,
): VoiceControlController {
  const [enabled, setEnabled] = createPersistedSignal<boolean>(
    'pitchperfect_voice_control_enabled',
    false,
  )
  const [listenerState, setListenerState] =
    createSignal<VoiceListenerState>('idle')
  const [interim, setInterim] = createSignal('')
  const [feedback, setFeedback] = createSignal<VoiceFeedback | null>(null)
  const [errorDetail, setErrorDetail] = createSignal<string | null>(null)
  const [lastLatencyMs, setLastLatencyMs] = createSignal<number | null>(null)

  let feedbackTimer: ReturnType<typeof setTimeout> | null = null

  const presentFeedback = (next: VoiceFeedback) => {
    if (feedbackTimer !== null) clearTimeout(feedbackTimer)
    setFeedback(next)
    feedbackTimer = setTimeout(() => {
      feedbackTimer = null
      setFeedback(null)
    }, FEEDBACK_VISIBLE_MS)
  }

  const resolveOptions = (): VoiceResolveOptions => ({
    requireWakeWord:
      voiceWakeWordWhilePlaying() &&
      ((deps?.musicPlaying?.() ?? false) || anyRegisteredMusicPlaying()),
  })

  /** Filler-stripped normalized form — the identity used to pair an eager
   *  execution with the final transcript that confirms it. */
  const utteranceKey = (text: string): string =>
    stripFillerTokens(normalizeUtterance(text).split(' ').filter(Boolean)).join(
      ' ',
    )

  let lastUnrecognizedToastAt = 0

  const toastUnrecognizedMaybe = (heard: string) => {
    const tokens = stripFillerTokens(
      normalizeUtterance(heard).split(' ').filter(Boolean),
    )
    if (tokens.length === 0 || tokens.length > UNRECOGNIZED_TOAST_MAX_TOKENS) {
      return
    }
    const now = Date.now()
    if (now - lastUnrecognizedToastAt < UNRECOGNIZED_TOAST_INTERVAL_MS) return
    lastUnrecognizedToastAt = now
    showNotification(`Voice: no command matches "${heard.trim()}"`, 'info')
  }

  const executeMatched = (
    outcome: Extract<VoiceResolveOutcome, { kind: 'matched' }>,
    heard: string,
  ) => {
    let result: VoiceCommandResult
    try {
      result = outcome.command.run({ n: outcome.n, m: outcome.m })
    } catch (err) {
      console.error('[voice-control] command failed:', outcome.command.id, err)
      const message = `${outcome.command.label} failed`
      presentFeedback({ kind: 'failed', heard, message })
      showNotification(`Voice: ${message}`, 'warning')
      return
    }
    if (typeof result === 'object' && result.failed) {
      presentFeedback({ kind: 'failed', heard, message: result.message })
      showNotification(`Voice: ${result.message}`, 'warning')
      return
    }
    const action = typeof result === 'string' ? result : outcome.command.label
    presentFeedback({ kind: 'matched', heard, action })
  }

  // ── Eager interim execution ────────────────────────────────

  let eagerTimer: ReturnType<typeof setTimeout> | null = null
  let eagerCandidateKey = ''
  let eagerFiredKey = ''
  let eagerFiredAt = 0

  const clearEagerTimer = () => {
    if (eagerTimer !== null) {
      clearTimeout(eagerTimer)
      eagerTimer = null
    }
    eagerCandidateKey = ''
  }

  const handleInterim = (text: string) => {
    setInterim(text)
    if (text === '') {
      clearEagerTimer()
      return
    }
    const key = utteranceKey(text)
    if (key === '') {
      clearEagerTimer()
      return
    }
    if (key === eagerCandidateKey) return
    clearEagerTimer()
    eagerCandidateKey = key
    eagerTimer = setTimeout(() => {
      eagerTimer = null
      eagerCandidateKey = ''
      const commands = activeVoiceCommands()
      const outcome = resolveVoiceCommand(text, commands, resolveOptions())
      if (outcome.kind !== 'matched') return
      // An interim that could still grow into a longer phrase ("go" on its
      // way to "go to karaoke", "loop" to "loop off") waits for the final.
      if (phraseExtendsFurther(outcome.phrase, commands)) return
      eagerFiredKey = key
      eagerFiredAt = Date.now()
      executeMatched(outcome, text)
    }, EAGER_STABLE_MS)
  }

  // ── Final utterances ───────────────────────────────────────

  const handleUtterance = (text: string) => {
    clearEagerTimer()

    // The final confirming an utterance the eager path already executed.
    const key = utteranceKey(text)
    if (
      key !== '' &&
      key === eagerFiredKey &&
      Date.now() - eagerFiredAt < EAGER_FINAL_SUPPRESS_MS
    ) {
      eagerFiredKey = ''
      return
    }

    const outcome = resolveVoiceCommand(
      text,
      activeVoiceCommands(),
      resolveOptions(),
    )

    if (outcome.kind === 'ignored') {
      // Wake word required and absent: this is the backing track singing,
      // not the user talking to us. Stay completely quiet.
      return
    }

    if (outcome.kind === 'none') {
      presentFeedback({ kind: 'unrecognized', heard: text })
      toastUnrecognizedMaybe(text)
      return
    }

    if (outcome.kind === 'unavailable') {
      const message = `${outcome.command.label} is not available on this view`
      presentFeedback({ kind: 'unavailable', heard: text, message })
      showNotification(`Voice: ${message}`, 'warning')
      return
    }

    executeMatched(outcome, text)
  }

  // ── Listener lifecycle ─────────────────────────────────────

  const listenerCallbacks = {
    onUtterance: handleUtterance,
    onInterim: handleInterim,
    onStateChange: (state: VoiceListenerState, detail?: string) => {
      setListenerState(state)
      if (state !== 'error') {
        setErrorDetail(null)
        return
      }
      setErrorDetail(detail ?? null)
      if (detail !== undefined && PERMISSION_ERRORS.has(detail)) {
        setEnabled(false)
        showNotification(
          'Microphone access for voice control was denied. Allow it in the browser and try again.',
          'warning',
        )
      }
    },
    onLatency: (roundTripMs: number) => {
      setLastLatencyMs(Math.round(roundTripMs))
    },
  }

  let webspeechListener: VoiceListener | null = null
  let localListener: VoiceListener | null = null
  let moonshineListener: VoiceListener | null = null
  let activeListener: VoiceListener | null = null

  const listenerFor = (engine: VoiceControlEngine): VoiceListener => {
    if (engine === 'local') {
      localListener ??= createLocalWhisperListener(listenerCallbacks)
      return localListener
    }
    if (engine === 'moonshine') {
      moonshineListener ??= createLocalWhisperListener(listenerCallbacks, {
        modelId: MOONSHINE_MODEL_ID,
      })
      return moonshineListener
    }
    webspeechListener ??= createWebSpeechListener(listenerCallbacks)
    return webspeechListener
  }

  const startListening = () => {
    const listener = listenerFor(voiceControlEngine())
    activeListener = listener
    listener.start()
  }

  const stopListening = () => {
    activeListener?.stop()
    activeListener = null
  }

  const toggle = () => {
    const listener = listenerFor(voiceControlEngine())
    if (!listener.isSupported) {
      showNotification(
        'The browser speech engine needs Chrome, Edge or Safari. Switch voice control to the on-device engine in Settings.',
        'warning',
      )
      return
    }
    const next = !enabled()
    setEnabled(next)
    if (next) {
      setLastLatencyMs(null)
      startListening()
    } else {
      stopListening()
    }
  }

  // Switching the engine in Settings while listening swaps listeners live.
  createEffect(
    on(
      voiceControlEngine,
      (engine, previous) => {
        if (previous === undefined || engine === previous) return
        if (!untrack(enabled)) return
        stopListening()
        setLastLatencyMs(null)
        startListening()
      },
      { defer: true },
    ),
  )

  onMount(() => {
    if (!enabled()) return
    const listener = listenerFor(voiceControlEngine())
    if (listener.isSupported) {
      activeListener = listener
      listener.start()
    } else {
      // The flag was persisted in a supporting browser; drop it quietly here.
      setEnabled(false)
    }
  })

  onCleanup(() => {
    stopListening()
    clearEagerTimer()
    if (feedbackTimer !== null) {
      clearTimeout(feedbackTimer)
      feedbackTimer = null
    }
  })

  return {
    isSupported: true,
    enabled,
    toggle,
    listenerState,
    interim,
    feedback,
    errorDetail,
    lastLatencyMs,
  }
}
