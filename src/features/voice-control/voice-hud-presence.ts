// ============================================================
// voice-hud-presence — when the voice pill has words on screen
// ============================================================
//
// The pill is a mic and a cog until it has something to say, and it says
// things for a second or two at a time. Two surfaces need the same answer to
// "is it saying something now?": the pill, which expands, and the app header,
// which gives up its title for the width. Computed twice they could disagree
// for a frame and the title would flicker back over the transcript, so it is
// computed once, here, and read from the controller.

import type { Accessor } from 'solid-js'
import { createEffect, createSignal, onCleanup } from 'solid-js'
import type { VoiceListenerState } from './types'

/**
 * How long the words stay after the last of them. Long enough to read a
 * verdict and to ride out the pause between two halves of a sentence; short
 * enough that a singer who has stopped talking gets the header back.
 */
export const VOICE_QUIET_HOLD_MS = 3000

export interface VoiceHudPresenceSource {
  enabled: Accessor<boolean>
  /** Live not-yet-final transcript; '' between phrases. */
  interim: Accessor<string>
  /** The last utterance's outcome, or null once it has aged out. */
  feedback: Accessor<unknown>
  listenerState: Accessor<VoiceListenerState>
}

/**
 * True while the pill has words on screen.
 *
 * `listening` with an empty transcript is the ONE quiet state. Every other
 * listener state carries a sentence the singer has to be able to read and act
 * on — "Loading voice engine", "Mic unavailable", "tap the mic to restart" —
 * and collapsing over those would hide the only way out of them.
 *
 * Switched off collapses on the same frame rather than after the hold: that
 * is a decision, not a pause.
 */
export function createHasSomethingToSay(
  source: VoiceHudPresenceSource,
  quietHoldMs: number = VOICE_QUIET_HOLD_MS,
): Accessor<boolean> {
  const [hasSomethingToSay, setHasSomethingToSay] = createSignal(false)
  let quietTimer: ReturnType<typeof setTimeout> | null = null
  const clearQuietTimer = (): void => {
    if (quietTimer === null) return
    clearTimeout(quietTimer)
    quietTimer = null
  }

  createEffect(() => {
    clearQuietTimer()
    if (!source.enabled()) {
      setHasSomethingToSay(false)
      return
    }
    if (
      source.interim() !== '' ||
      source.feedback() !== null ||
      source.listenerState() !== 'listening'
    ) {
      setHasSomethingToSay(true)
      return
    }
    quietTimer = setTimeout(() => {
      quietTimer = null
      setHasSomethingToSay(false)
    }, quietHoldMs)
  })

  onCleanup(clearQuietTimer)
  return hasSomethingToSay
}
