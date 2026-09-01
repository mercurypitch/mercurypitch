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
import { createEffect, createSignal, onCleanup, onMount, untrack, } from 'solid-js'
import { createPersistedSignal } from '@/lib/storage'
import { singingCaptureActive } from '@/stores/mic-store'
import { showNotification } from '@/stores/notifications-store'
import type { VoiceControlEngine } from '@/stores/settings-store'
import { voiceControlEngine, voiceWakeWordWhilePlaying, } from '@/stores/settings-store'
import type { VoiceResolveOptions, VoiceResolveOutcome, } from './command-grammar'
import { normalizeUtterance, phraseExtendsFurther, resolveVoiceCommand, stripFillerTokens, } from './command-grammar'
import { createLocalWhisperListener } from './local-whisper-listener'
import type { VoiceCommandResult, VoiceListener, VoiceListenerState, } from './types'
import { activeVoiceCommands, anyRegisteredMusicPlaying, reportHeardSpeech, wakeWordHoldActive, } from './voice-command-registry'
import { createHasSomethingToSay } from './voice-hud-presence'
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
  /**
   * Unconditionally off, for the HUD's dismiss. Not `toggle()`: from a
   * stopped listener that now means "start again", so the one control a
   * person reaches for to put the pill away would have re-opened the mic.
   */
  turnOff: () => void
  listenerState: Accessor<VoiceListenerState>
  /** Live interim transcript while a phrase is still being spoken. */
  interim: Accessor<string>
  /** Most recent utterance outcome; clears itself after a short hold. */
  feedback: Accessor<VoiceFeedback | null>
  errorDetail: Accessor<string | null>
  /** End-of-speech to action time in ms, when the engine measures it. */
  lastLatencyMs: Accessor<number | null>
  /**
   * True while the HUD has words to show — a phrase being spoken, a verdict
   * just landed, or a listener that stopped and needs saying so. False while
   * voice control is on and simply waiting, which is most of the time.
   *
   * It lives here rather than in the HUD because two surfaces read it: the
   * pill, which expands, and the app header, which gives up its title for
   * the width. One timer, one answer — computed twice they could disagree
   * for a frame, and the title would flicker back over the transcript.
   */
  hasSomethingToSay: Accessor<boolean>
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

// Defense in depth against ANY upstream duplication (engine echo, decode
// repeats): the identical command key executing twice inside this window is
// dropped. Deliberately short — repeating "faster" on purpose only needs a
// beat of pause between the two.
const DUPLICATE_EXEC_SUPPRESS_MS = 1500

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

  const hasSomethingToSay = createHasSomethingToSay({
    enabled,
    interim,
    feedback,
    listenerState,
  })

  const presentFeedback = (next: VoiceFeedback) => {
    if (feedbackTimer !== null) clearTimeout(feedbackTimer)
    setFeedback(next)
    feedbackTimer = setTimeout(() => {
      feedbackTimer = null
      setFeedback(null)
    }, FEEDBACK_VISIBLE_MS)
  }

  const resolveOptions = (): VoiceResolveOptions => ({
    // A wake-word hold (the Mercury Sing stage) overrides the setting: while
    // a surface is deliberately capturing singing, only wake-word commands
    // and the stage's own exempt phrases may fire.
    requireWakeWord:
      wakeWordHoldActive() ||
      (voiceWakeWordWhilePlaying() &&
        ((deps?.musicPlaying?.() ?? false) || anyRegisteredMusicPlaying())),
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

  let lastExecutedKey = ''
  let lastExecutedAt = 0

  const executeMatched = (
    outcome: Extract<VoiceResolveOutcome, { kind: 'matched' }>,
    heard: string,
  ) => {
    const key = utteranceKey(heard)
    const now = Date.now()
    if (
      key !== '' &&
      key === lastExecutedKey &&
      now - lastExecutedAt < DUPLICATE_EXEC_SUPPRESS_MS
    ) {
      console.log('[voice] duplicate execution suppressed:', key)
      return
    }
    lastExecutedKey = key
    lastExecutedAt = now
    console.log('[voice] execute:', outcome.command.id, 'for:', heard)
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
    // Tell the rest of the app someone is talking — see the registry.
    reportHeardSpeech(text)
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
    reportHeardSpeech(text)

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
    console.log('[voice] heard:', JSON.stringify(text), '->', outcome.kind)

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
      } else if (detail === 'local-engine-failed') {
        // Almost always the model download (network hiccup or a
        // rate-limited model host) — the service retries on the next
        // start, so tell the user the retry is one toggle away.
        showNotification(
          'The on-device voice model failed to load. Toggle voice control to retry the download, or switch to the Browser engine in Settings.',
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

  // ── Standing down while a voice is being scored ──────────────
  //
  // Voice control and the karaoke stage's pitch mic want opposite things
  // from the same audio (see mic-store's singingCaptureActive). Commands
  // over a playing backing track are the point — "stop", "next song" — but
  // the moment somebody taps the zen mic to SING, every held vowel goes to
  // a speech recognizer that will eventually hear an instruction in it.
  //
  // So this is a pause, never a preference change: `enabled` stays on, the
  // HUD keeps saying voice control is on, and the listener comes back by
  // itself when the singing stops. Nothing asks the user to manage it.
  let suspendedForSinging = false

  /** Start unless a voice is being scored right now; remember either way. */
  const startUnlessSinging = () => {
    if (singingCaptureActive()) {
      suspendedForSinging = true
      return
    }
    startListening()
  }

  const turnOff = () => {
    setEnabled(false)
    // An explicit turn-off outranks the pause: forget it, so ending the
    // song does not quietly switch the recognizer back on.
    suspendedForSinging = false
    stopListening()
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
    // On, but not listening: the listener stopped under us — the mic sentinel
    // killing a dead stream, or a backgrounded tab losing its hold. Toggling
    // OFF from there spends a press to silence something already silent, and
    // that is the only reason the pill had to ask for two of them. A phone
    // has no key to press twice, so the second press was simply unavailable.
    // One activation, from any input, means "start listening again".
    if (enabled() && listenerState() === 'idle') {
      setLastLatencyMs(null)
      startUnlessSinging()
      return
    }
    if (enabled()) {
      turnOff()
      return
    }
    setEnabled(true)
    setLastLatencyMs(null)
    startUnlessSinging()
  }

  createEffect(() => {
    const singing = singingCaptureActive()
    if (singing) {
      if (suspendedForSinging || !untrack(enabled)) return
      suspendedForSinging = true
      stopListening()
      setListenerState('idle')
      setInterim('')
      return
    }
    if (!suspendedForSinging) return
    suspendedForSinging = false
    if (untrack(enabled)) startListening()
  })

  // Switching the engine in Settings while listening swaps listeners live.
  // Tracked by hand rather than `on(..., { defer: true })`: with defer, the
  // FIRST change arrives with `previous === undefined`, and guarding on it
  // silently ignored the user's first engine switch — the old engine kept
  // running under the new engine's label.
  let lastEngine = untrack(voiceControlEngine)
  createEffect(() => {
    const engine = voiceControlEngine()
    if (engine === lastEngine) return
    lastEngine = engine
    if (!untrack(enabled)) return
    console.log('[voice] engine switched to:', engine)
    stopListening()
    setLastLatencyMs(null)
    // toggle() checks support before starting; a switch must too, or an
    // unsupported engine (browser engine on Firefox, picked from the pill
    // menu) "runs" as a silent no-op stub under a Listening label.
    if (!listenerFor(engine).isSupported) {
      showNotification(
        'The browser speech engine needs Chrome, Edge or Safari — voice control turned off. Pick Whisper or Moonshine to stay on-device.',
        'warning',
      )
      setEnabled(false)
      return
    }
    startUnlessSinging()
  })

  onMount(() => {
    if (!enabled()) return
    const listener = listenerFor(voiceControlEngine())
    if (listener.isSupported) {
      // Mounting mid-song (the zen stage remounts on a playlist advance)
      // must not start a recognizer the singing is already meant to hold off.
      if (untrack(singingCaptureActive)) {
        suspendedForSinging = true
        return
      }
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
    turnOff,
    listenerState,
    interim,
    feedback,
    errorDetail,
    lastLatencyMs,
    hasSomethingToSay,
  }
}
