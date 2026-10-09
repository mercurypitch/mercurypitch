// Guitar Night Google separation intent — one short-lived exact-song return lease.
// ============================================================
//
// Google sign-in leaves the document, so the in-memory intent behind a
// blocked "Separate guitar" action cannot survive the round trip. This module
// persists only the backing identity needed to resume that explicit action.
// It is consumed once, expires quickly, and remains an intent rather than an
// authorization boundary: account, credits, and server admission are checked
// again before any billable work.
//
// The lease itself (single use, expiry, exact rollback) lives in
// lib/google-separation-intent, shared with Drum Night; what is Guitar
// Night's own is the key and the fingerprint of its backing lease.

import type { GoogleSeparationIntent } from '@/lib/google-separation-intent'
import { GOOGLE_SEPARATION_INTENT_TTL_MS, googleSeparationIntentStore, } from '@/lib/google-separation-intent'
import type { GuitarNightBackingLease } from './song-port'

const intents = googleSeparationIntentStore(
  'mp:guitarNightGoogleSeparationIntent',
)
export const GUITAR_NIGHT_GOOGLE_SEPARATION_INTENT_TTL_MS =
  GOOGLE_SEPARATION_INTENT_TTL_MS

export type GuitarNightGoogleSeparationIntent = GoogleSeparationIntent

/** Object URLs change when a durable song is reopened; its musical asset
 * identity does not. Sort the stable fields so port ordering cannot create a
 * false mismatch after the redirect. */
export function guitarNightBackingFingerprint(
  backing: GuitarNightBackingLease,
): string {
  const stems = backing.stems
    .map((stem) => ({
      kind: stem.kind,
      sizeBytes: stem.sizeBytes,
      durationSeconds: stem.durationSeconds ?? null,
    }))
    .sort((left, right) =>
      `${left.kind}:${left.sizeBytes}:${left.durationSeconds ?? ''}`.localeCompare(
        `${right.kind}:${right.sizeBytes}:${right.durationSeconds ?? ''}`,
      ),
    )
  return JSON.stringify({
    sessionId: backing.sessionId,
    title: backing.title,
    source: backing.source ?? 'device',
    defaultMix: {
      kind: backing.defaultMix.kind,
      audible: [...backing.defaultMix.audible].sort(),
      muted: [...backing.defaultMix.muted].sort(),
    },
    stems,
  })
}

export function clearGuitarNightGoogleSeparationIntent(): void {
  intents.clear()
}

/** Persist immediately before Google navigation and return an exact-value
 * rollback for the rare case where `location.assign` throws. */
export function prepareGuitarNightGoogleSeparationIntent(
  backing: GuitarNightBackingLease,
  now = Date.now(),
): () => void {
  return intents.prepare(
    backing.sessionId,
    guitarNightBackingFingerprint(backing),
    now,
  )
}

/** Single-use: see GoogleSeparationIntentStore.take. */
export function takeGuitarNightGoogleSeparationIntent(
  now = Date.now(),
): GuitarNightGoogleSeparationIntent | null {
  return intents.take(now)
}
