// Guitar Night Google separation intent — one short-lived exact-song return lease.
// ============================================================
//
// Google sign-in leaves the document, so the in-memory intent behind a
// blocked "Separate guitar" action cannot survive the round trip. This module
// persists only the backing identity needed to resume that explicit action.
// It is consumed once, expires quickly, and remains an intent rather than an
// authorization boundary: account, credits, and server admission are checked
// again before any billable work.

import type { GuitarNightBackingLease } from './song-port'

const STORAGE_KEY = 'mp:guitarNightGoogleSeparationIntent'
export const GUITAR_NIGHT_GOOGLE_SEPARATION_INTENT_TTL_MS = 15 * 60 * 1000

export interface GuitarNightGoogleSeparationIntent {
  version: 1
  sessionId: string
  backingFingerprint: string
  createdAt: number
  expiresAt: number
}

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
  localStorage.removeItem(STORAGE_KEY)
}

/** Persist immediately before Google navigation and return an exact-value
 * rollback for the rare case where `location.assign` throws. */
export function prepareGuitarNightGoogleSeparationIntent(
  backing: GuitarNightBackingLease,
  now = Date.now(),
): () => void {
  clearGuitarNightGoogleSeparationIntent()
  const serialized = JSON.stringify({
    version: 1,
    sessionId: backing.sessionId,
    backingFingerprint: guitarNightBackingFingerprint(backing),
    createdAt: now,
    expiresAt: now + GUITAR_NIGHT_GOOGLE_SEPARATION_INTENT_TTL_MS,
  } satisfies GuitarNightGoogleSeparationIntent)
  localStorage.setItem(STORAGE_KEY, serialized)
  return () => {
    if (localStorage.getItem(STORAGE_KEY) === serialized) {
      localStorage.removeItem(STORAGE_KEY)
    }
  }
}

/** Remove before parsing: invalid, failed, expired, and successful returns are
 * all single-use and can never be replayed by a later unrelated sign-in. */
export function takeGuitarNightGoogleSeparationIntent(
  now = Date.now(),
): GuitarNightGoogleSeparationIntent | null {
  const serialized = localStorage.getItem(STORAGE_KEY)
  localStorage.removeItem(STORAGE_KEY)
  if (serialized === null) return null
  try {
    const value = JSON.parse(
      serialized,
    ) as Partial<GuitarNightGoogleSeparationIntent>
    if (
      value.version !== 1 ||
      typeof value.sessionId !== 'string' ||
      value.sessionId.trim() === '' ||
      typeof value.backingFingerprint !== 'string' ||
      value.backingFingerprint === '' ||
      typeof value.createdAt !== 'number' ||
      !Number.isFinite(value.createdAt) ||
      typeof value.expiresAt !== 'number' ||
      !Number.isFinite(value.expiresAt) ||
      value.createdAt > now ||
      value.expiresAt <= now ||
      value.expiresAt - value.createdAt !==
        GUITAR_NIGHT_GOOGLE_SEPARATION_INTENT_TTL_MS
    ) {
      return null
    }
    return value as GuitarNightGoogleSeparationIntent
  } catch {
    return null
  }
}
