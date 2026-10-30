// ============================================================
// Mic check verdict — the one sentence that says what is wrong
// ============================================================
//
// A mic check can see a dozen things at once: a permission, a track that is
// live, muted or ended, a level, a default that moved, another tab holding
// the lock. Shown as a dozen indicators they would leave the person to work
// out which one matters. So they are ranked, and the first that applies is
// the verdict: a title, one line of what to do, and the action that does it.
//
// The ranking runs from "nothing can work" to "it works": a blocked or
// vanished device outranks a muted one, which outranks digital silence (a
// muted track reads as silence too, and the mute is the better explanation),
// which outranks a merely quiet room.

import type { InputHealth } from '@/lib/input-health'
import type { MicErrorKind } from '@/lib/mic-manager'
import type { RosterInput } from './mic-roster'

export type VerdictKind =
  | 'idle'
  | 'opening'
  | 'denied'
  | 'other-tab'
  | 'busy'
  | 'no-device'
  | 'failed'
  | 'taken'
  | 'closed'
  | 'ended'
  | 'paused'
  | 'interrupted'
  | 'dead'
  | 'default-moved'
  | 'silent'
  | 'waiting'
  | 'hearing'
  | 'singing'

export type VerdictTone = 'neutral' | 'good' | 'warn' | 'bad'

/** What the panel offers next to the verdict. */
export type VerdictAction =
  | 'start'
  | 'restart'
  | 'take-over'
  | 'listen-to-default'

export interface Verdict {
  kind: VerdictKind
  tone: VerdictTone
  title: string
  detail: string
  action: VerdictAction | null
}

/** Why a check that was listening stopped without being asked to. */
export type LostReason = 'other-tab' | 'ended' | 'closed'

export interface VerdictFacts {
  phase: 'idle' | 'opening' | 'listening'
  /** Why the last open failed, or null. */
  openError: { kind: MicErrorKind; message: string } | null
  lost: LostReason | null
  /** What the other MercuryPitch tab said it was doing. */
  otherTabLabel: string | null
  permission: PermissionState | 'unknown'
  trackMuted: boolean
  trackEnded: boolean
  /** The AudioContext was interrupted (a call, Siri) — Safari's own state. */
  contextInterrupted: boolean
  /** The input has delivered exact zeros for a while. */
  digitalSilence: boolean
  health: InputHealth
  /** True unless the check was pointed at one particular input. */
  followingDefault: boolean
  listening: RosterInput | null
  systemDefault: RosterInput | null
  singing: boolean
}

const nameOf = (input: RosterInput | null, fallback: string): string =>
  input !== null && input.name !== '' ? input.name : fallback

function idleVerdict(facts: VerdictFacts): Verdict {
  if (facts.lost === 'other-tab') {
    return {
      kind: 'taken',
      tone: 'warn',
      title: 'Another MercuryPitch tab took the microphone',
      detail:
        facts.otherTabLabel === null
          ? 'Start the check again to bring it back here.'
          : `It is in use for ${facts.otherTabLabel}. Start the check again to bring it back here.`,
      action: 'start',
    }
  }
  if (facts.lost === 'ended') {
    return {
      kind: 'ended',
      tone: 'bad',
      title: 'The microphone went away',
      detail:
        'It was unplugged or switched off, or the system took it back. Plug it back in or pick another input, then start again.',
      action: 'start',
    }
  }
  if (facts.lost === 'closed') {
    return {
      kind: 'closed',
      tone: 'warn',
      title: 'The microphone was closed',
      detail:
        'Something in MercuryPitch let go of it while the check was running. Start again to reopen it.',
      action: 'start',
    }
  }
  const error = facts.openError
  if (error !== null) {
    switch (error.kind) {
      case 'permission-denied':
        // A prompt closed without an answer is refused the same way, but
        // leaves the permission at "ask": nothing is blocked yet.
        if (facts.permission === 'prompt') {
          return {
            kind: 'denied',
            tone: 'warn',
            title: 'The microphone prompt closed without an answer',
            detail: 'Start again, and choose Allow when your browser asks.',
            action: 'start',
          }
        }
        return {
          kind: 'denied',
          tone: 'bad',
          title: 'The microphone is blocked for this site',
          detail:
            "Allow it in your browser's site settings (the icon at the left of the address bar), then start again.",
          action: 'start',
        }
      case 'held-elsewhere':
        return {
          kind: 'other-tab',
          tone: 'warn',
          title: 'Another MercuryPitch tab has the microphone',
          detail:
            facts.otherTabLabel === null
              ? 'Move it here to check it.'
              : `It is in use for ${facts.otherTabLabel}. Move it here to check it.`,
          action: 'take-over',
        }
      case 'device-busy':
        return {
          kind: 'busy',
          tone: 'bad',
          title: 'Another app is holding the microphone',
          detail:
            'The system would not open it. Close recording, meeting and streaming apps, or anything that takes the mic for itself, then try again.',
          action: 'start',
        }
      case 'no-device':
        return {
          kind: 'no-device',
          tone: 'bad',
          title: 'No microphone found',
          detail: error.message,
          action: 'start',
        }
      default:
        return {
          kind: 'failed',
          tone: 'bad',
          title: 'The microphone would not open',
          detail: error.message,
          action: 'start',
        }
    }
  }
  return {
    kind: 'idle',
    tone: 'neutral',
    title: 'Check your microphone',
    detail:
      'Start a check and say something, or sing. You will see what reaches MercuryPitch, which input it came through, and anything that changes while you watch.',
    action: 'start',
  }
}

/** The single most useful thing to say about the microphone right now. */
export function decideVerdict(facts: VerdictFacts): Verdict {
  if (facts.phase === 'idle') return idleVerdict(facts)
  if (facts.phase === 'opening') {
    return {
      kind: 'opening',
      tone: 'neutral',
      title: 'Opening the microphone',
      detail: 'Your browser may ask for permission first.',
      action: null,
    }
  }

  const name = nameOf(facts.listening, 'this input')
  if (facts.permission === 'denied') {
    return {
      kind: 'denied',
      tone: 'bad',
      title: 'Microphone permission was turned off',
      detail:
        "Allow it again in your browser's site settings, then restart the check.",
      action: 'restart',
    }
  }
  if (facts.trackEnded) {
    return {
      kind: 'ended',
      tone: 'bad',
      title: `${name} went away`,
      detail:
        'It was unplugged or switched off, or the system took it back. Pick another input below, or plug it back in and restart.',
      action: 'restart',
    }
  }
  if (facts.trackMuted) {
    return {
      kind: 'paused',
      tone: 'bad',
      title: `Your system paused ${name}`,
      detail:
        'It is still connected, but nothing comes through: a call, another app or a system mute has it. It comes back by itself when that lets go.',
      action: null,
    }
  }
  if (facts.contextInterrupted) {
    return {
      kind: 'interrupted',
      tone: 'warn',
      title: 'Audio was interrupted',
      detail:
        'A call or another app interrupted audio on this device. Restart the check once it is over.',
      action: 'restart',
    }
  }
  if (facts.digitalSilence) {
    return {
      kind: 'dead',
      tone: 'bad',
      title: `${name} is sending pure silence`,
      detail:
        'Not a quiet room: nothing at all. It is muted in your system or on the device, or another app has taken exclusive control of it.',
      action: 'restart',
    }
  }
  if (
    facts.followingDefault &&
    facts.listening !== null &&
    facts.systemDefault !== null &&
    facts.listening.deviceId !== facts.systemDefault.deviceId
  ) {
    const next = nameOf(facts.systemDefault, 'another input')
    return {
      kind: 'default-moved',
      tone: 'warn',
      title: `Your system switched its default to ${next}`,
      detail: `MercuryPitch is still hearing ${name}. Listen to ${next} instead, or make ${name} the default again in your sound settings.`,
      action: 'listen-to-default',
    }
  }
  if (facts.health === 'silent') {
    return {
      kind: 'silent',
      tone: 'warn',
      title: `Nothing is reaching us from ${name}`,
      detail:
        'Six seconds without a sound. Check that this is the input you are singing into, that it is not muted, and that its gain is up.',
      action: 'restart',
    }
  }
  if (facts.singing) {
    return {
      kind: 'singing',
      tone: 'good',
      title: `Hearing you sing on ${name}`,
      detail: 'Each note you hold lands on its key.',
      action: null,
    }
  }
  if (facts.health === 'healthy') {
    return {
      kind: 'hearing',
      tone: 'good',
      title: `We hear you on ${name}`,
      detail: 'Now hold a note, and watch it land on its key.',
      action: null,
    }
  }
  return {
    kind: 'waiting',
    tone: 'neutral',
    title: `Listening on ${name}`,
    detail: 'Say something, or sing a note.',
    action: null,
  }
}
