// ============================================================
// Voice control — shared types for the ear/brain/hands seams
// ============================================================
//
// The VoiceListener seam is what keeps the STT engine swappable: phase 1
// runs the Web Speech API, phase 2 swaps in a local whisper/moonshine
// utterance engine without touching the grammar or the dispatcher. See
// docs/plans/voice-control.md for the whole architecture.

export type VoiceListenerState = 'idle' | 'listening' | 'error'

export interface VoiceListenerCallbacks {
  /** One discrete final utterance — a phrase the recognizer closed. */
  onUtterance: (text: string) => void
  /** Live not-yet-final text for the HUD ('' when cleared). */
  onInterim: (text: string) => void
  onStateChange: (state: VoiceListenerState, detail?: string) => void
}

export interface VoiceListener {
  readonly isSupported: boolean
  start: () => void
  stop: () => void
}

export interface VoiceCommandArgs {
  /** Parsed `<n>` slot value when the matched phrase has one. */
  n?: number
}

export interface VoiceCommandFailure {
  failed: true
  /** Why nothing happened — surfaces in the HUD and as a toast. */
  message: string
}

/**
 * What `run` reports back: a string label (success feedback overriding
 * `label`), undefined (success, HUD falls back to `label`), or a failure
 * whose message tells the user the command did nothing and why — so they
 * know to fix the situation or just say it again.
 */
export type VoiceCommandResult = string | VoiceCommandFailure | undefined

export function voiceFailure(message: string): VoiceCommandFailure {
  return { failed: true, message }
}

export interface VoiceCommand {
  /** Stable id, e.g. 'transport.play'. */
  id: string
  /** Fallback HUD label when `run` returns nothing, e.g. 'Play'. */
  label: string
  /**
   * Spoken forms: lowercase words separated by single spaces, matching the
   * normalized utterance. `<n>` marks a numeric slot — digits ("15", "1.5")
   * and English number words ("twenty five") both fill it.
   */
  phrases: string[]
  /** When present and false, the command is skipped during matching. */
  available?: () => boolean
  /**
   * Perform the action. May return a feedback label that overrides `label`
   * (e.g. 'Speed 1.5x'), undefined to fall back to `label`, or a
   * `voiceFailure(...)` explaining why nothing happened.
   */
  run: (args: VoiceCommandArgs) => VoiceCommandResult
}

export interface VoiceMatch {
  command: VoiceCommand
  n?: number
}
