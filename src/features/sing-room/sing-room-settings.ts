// ============================================================
// The Sing room's own three preferences
// ============================================================
//
// Everything else the options sheet shows already belongs to an app-wide
// store (key, scale, octave, tempo, speed, metronome, precount). These three
// are the room's and nobody else's, so they live beside it rather than in
// `settings-store.ts`, which is read by every surface in the app.
//
// All four are `createPersistedSignal`: re-derivable preferences, not the
// identity keys the storage port exists for.
//
// AND ALL FOUR ARE BUILT ON FIRST READ, not when this module is imported.
// `App.tsx` imports the room unconditionally and folds it away with
// `IS_NATIVE_BUILD`, but a module whose top level CALLS something has side
// effects the bundler must assume matter — so the web bundle shipped four
// `localStorage` reads for a room it does not contain, and the keys were in
// `dist`. Nothing at this module's top level runs now, so an unused import of
// it costs the web build nothing at all.

import type { Signal } from 'solid-js'
import { createPersistedSignal } from '@/lib/storage'

/** A boolean preference, built the first time somebody reads or writes it. */
function lazyFlag(
  key: string,
  fallback: boolean,
): [() => boolean, (value: boolean) => void] {
  let signal: Signal<boolean> | undefined
  const resolve = (): Signal<boolean> => {
    signal ??= createPersistedSignal<boolean>(key, fallback, {
      validator: (value): value is boolean => typeof value === 'boolean',
    })
    return signal
  }
  return [() => resolve()[0](), (value) => void resolve()[1](value)]
}

/**
 * "Microphone: on when the room opens" (owner answer 8).
 *
 * The only switch in the whole automatic-mic policy. Off means the room
 * waits for the capsule every time, which is the answer for somebody who
 * shares a room with other people.
 */
export const [singMicOnArrival, setSingMicOnArrival] = lazyFlag(
  'pitchperfect_sing_mic_on_arrival',
  true,
)

/**
 * Per-note results — the accuracy burn on the target line (owner answer 6).
 *
 * Default OFF. The free tracker has no scored targets at all, and a melody
 * run gets its numbers at the end; this is for somebody who deliberately
 * wants the per-note read while they sing.
 */
export const [singPerNoteBurn, setSingPerNoteBurn] = lazyFlag(
  'pitchperfect_sing_per_note_burn',
  false,
)

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
export const [singMicGranted, setSingMicGranted] = lazyFlag(
  'pitchperfect_sing_mic_granted',
  false,
)

/**
 * Whether the one coach mark has been dismissed.
 *
 * Dismissed BY USE, not by a close button: touching the key chip, the state
 * chip or the gear is proof it was read.
 */
export const [singCoachMarkSeen, setSingCoachMarkSeen] = lazyFlag(
  'pitchperfect_sing_coach_seen',
  false,
)

/**
 * The coach mark's copy. One string, written once.
 *
 * It now says what a tap DOES (device round 2, R4). The first version
 * described three chips and promised nothing about touching them, while the
 * pill — the thing the mark points at — did nothing at all when pressed. The
 * pill opens "Your takes"; the sentence says so.
 */
export const SING_COACH_MARK = {
  title: 'Your note',
  body: 'The pill says the note and how far from it you are, in cents. Tap it for your takes. The key chip changes the key; range and what you hear live under the gear.',
} as const
