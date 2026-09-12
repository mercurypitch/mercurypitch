// ============================================================
// The Sing room's own three preferences
// ============================================================
//
// Everything else the options sheet shows already belongs to an app-wide
// store (key, scale, octave, tempo, speed, metronome, precount). These three
// are the room's and nobody else's, so they live beside it rather than in
// `settings-store.ts`, which is read by every surface in the app.
//
// All three are `createPersistedSignal`: re-derivable preferences, not the
// identity keys the storage port exists for.

import { createPersistedSignal } from '@/lib/storage'

/**
 * "Microphone: on when the room opens" (owner answer 8).
 *
 * The only switch in the whole automatic-mic policy. Off means the room
 * waits for the capsule every time, which is the answer for somebody who
 * shares a room with other people.
 */
export const [singMicOnArrival, setSingMicOnArrival] =
  createPersistedSignal<boolean>('pitchperfect_sing_mic_on_arrival', true, {
    validator: (value): value is boolean => typeof value === 'boolean',
  })

/**
 * Per-note results — the accuracy burn on the target line (owner answer 6).
 *
 * Default OFF. The free tracker has no scored targets at all, and a melody
 * run gets its numbers at the end; this is for somebody who deliberately
 * wants the per-note read while they sing.
 */
export const [singPerNoteBurn, setSingPerNoteBurn] =
  createPersistedSignal<boolean>('pitchperfect_sing_per_note_burn', false, {
    validator: (value): value is boolean => typeof value === 'boolean',
  })

/**
 * Whether this device has ever granted the microphone to this app.
 *
 * NOT `navigator.permissions.query`: iOS's WebKit does not answer for the
 * microphone at all, so the one platform the automatic policy was designed
 * for is the one that would always fall back to asking. A remembered yes is
 * enough — if the permission was revoked since, the next acquisition fails
 * and the room lands on the denied screen, which is where a revoked
 * permission belongs anyway.
 */
export const [singMicGranted, setSingMicGranted] =
  createPersistedSignal<boolean>('pitchperfect_sing_mic_granted', false, {
    validator: (value): value is boolean => typeof value === 'boolean',
  })

/**
 * Whether the one coach mark has been dismissed.
 *
 * Dismissed BY USE, not by a close button: touching the key chip, the state
 * chip or the gear is proof it was read.
 */
export const [singCoachMarkSeen, setSingCoachMarkSeen] =
  createPersistedSignal<boolean>('pitchperfect_sing_coach_seen', false, {
    validator: (value): value is boolean => typeof value === 'boolean',
  })

/** The coach mark's copy, from brief §4. One string, written once. */
export const SING_COACH_MARK = {
  title: 'Your note',
  body: 'The chip says the note and how far from it you are, in cents. Tap the key chip to change the key; range and what you hear live under the gear.',
} as const
