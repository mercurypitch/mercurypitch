// ============================================================
// useVoiceControlController — voice control's dispatcher and lifecycle
// ============================================================
//
// Owns the listener (started/stopped with the persisted enable flag), runs
// each final utterance through the grammar against the registry's live
// command sets, executes the match, and exposes the HUD's signals. Mounted
// once by App, right beside useKeyboardShortcuts — the two drive the same
// handler surface on purpose.

import type { Accessor } from 'solid-js'
import { createSignal, onCleanup, onMount } from 'solid-js'
import { createPersistedSignal } from '@/lib/storage'
import { showNotification } from '@/stores/notifications-store'
import { normalizeUtterance, resolveVoiceCommand, stripFillerTokens, } from './command-grammar'
import type { VoiceCommandResult, VoiceListenerState } from './types'
import { activeVoiceCommands } from './voice-command-registry'
import { createWebSpeechListener } from './webspeech-listener'

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

export function useVoiceControlController(): VoiceControlController {
  const [enabled, setEnabled] = createPersistedSignal<boolean>(
    'pitchperfect_voice_control_enabled',
    false,
  )
  const [listenerState, setListenerState] =
    createSignal<VoiceListenerState>('idle')
  const [interim, setInterim] = createSignal('')
  const [feedback, setFeedback] = createSignal<VoiceFeedback | null>(null)
  const [errorDetail, setErrorDetail] = createSignal<string | null>(null)

  let feedbackTimer: ReturnType<typeof setTimeout> | null = null

  const presentFeedback = (next: VoiceFeedback) => {
    if (feedbackTimer !== null) clearTimeout(feedbackTimer)
    setFeedback(next)
    feedbackTimer = setTimeout(() => {
      feedbackTimer = null
      setFeedback(null)
    }, FEEDBACK_VISIBLE_MS)
  }

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

  const handleUtterance = (text: string) => {
    const outcome = resolveVoiceCommand(text, activeVoiceCommands())

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

    let result: VoiceCommandResult
    try {
      result = outcome.command.run({ n: outcome.n })
    } catch (err) {
      console.error('[voice-control] command failed:', outcome.command.id, err)
      const message = `${outcome.command.label} failed`
      presentFeedback({ kind: 'failed', heard: text, message })
      showNotification(`Voice: ${message}`, 'warning')
      return
    }

    if (typeof result === 'object' && result.failed) {
      presentFeedback({ kind: 'failed', heard: text, message: result.message })
      showNotification(`Voice: ${result.message}`, 'warning')
      return
    }

    const action = typeof result === 'string' ? result : outcome.command.label
    presentFeedback({ kind: 'matched', heard: text, action })
  }

  const listener = createWebSpeechListener({
    onUtterance: handleUtterance,
    onInterim: setInterim,
    onStateChange: (state, detail) => {
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
  })

  const toggle = () => {
    if (!listener.isSupported) {
      showNotification(
        'Voice control needs the Web Speech API — try Chrome, Edge or Safari.',
        'warning',
      )
      return
    }
    const next = !enabled()
    setEnabled(next)
    if (next) {
      listener.start()
    } else {
      listener.stop()
    }
  }

  onMount(() => {
    if (!enabled()) return
    if (listener.isSupported) {
      listener.start()
    } else {
      // The flag was persisted in a supporting browser; drop it quietly here.
      setEnabled(false)
    }
  })

  onCleanup(() => {
    listener.stop()
    if (feedbackTimer !== null) {
      clearTimeout(feedbackTimer)
      feedbackTimer = null
    }
  })

  return {
    isSupported: listener.isSupported,
    enabled,
    toggle,
    listenerState,
    interim,
    feedback,
    errorDetail,
  }
}
