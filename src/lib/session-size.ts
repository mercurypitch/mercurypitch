// ── Session size ─────────────────────────────────────────────────────
// How much of this device a prepared song actually occupies.
//
// The obvious number -- `originalFile.size` -- is the wrong one twice
// over. It is the MP3 somebody uploaded, so it reads around 5 MB while
// the separated stems it produced take 25; and a song that arrived by
// device sync has stems but no original at all, so the figure vanishes
// on exactly the device whose storage is tightest.
//
// What a person means by "how big is this song" is the whole of it:
// every stem, plus the source if this device still holds one.

import type { UvrSession } from '@/stores/uvr-store'

/**
 * The separated audio a session stores.
 *
 * Only these two: `outputs` also carries `vocalMidi` / `instrumentalMidi`,
 * which are transcriptions rather than audio and are kilobytes against
 * the stems' megabytes — counting them would add noise to the figure
 * without changing it.
 */
const STEM_KEYS = ['vocal', 'instrumental'] as const

export interface SessionSize {
  /** Total bytes on this device, 0 when nothing is measurable. */
  bytes: number
  /** Bytes of separated stems alone. */
  stemBytes: number
  /** Bytes of the uploaded source, 0 when this device never had one. */
  originalBytes: number
  /**
   * Whether every stem present actually reported a size.
   *
   * Stem sizes are recorded when a stem is written, so a session
   * separated before that landed has outputs with no `stemMeta`. Showing
   * its partial total as if it were the whole thing is worse than saying
   * nothing, so callers can tell the difference.
   */
  complete: boolean
}

/**
 * Measure what a session occupies here.
 *
 * Reads only recorded metadata — no blob reads — because this runs for
 * every card in a library list.
 */
export function sessionSize(session: UvrSession): SessionSize {
  const meta = session.stemMeta ?? {}
  const outputs = session.outputs ?? {}
  const present = STEM_KEYS.filter((stem) => outputs[stem] !== undefined)

  let stemBytes = 0
  let complete = true
  for (const stem of present) {
    const size = meta[stem]?.size ?? 0
    if (size > 0) stemBytes += size
    else complete = false
  }

  const originalBytes = session.originalFile?.size ?? 0
  return {
    bytes: stemBytes + originalBytes,
    stemBytes,
    originalBytes,
    complete: present.length === 0 ? originalBytes > 0 : complete,
  }
}

/**
 * What the size chip should say, or null when there is nothing honest to
 * put there.
 *
 * `null` rather than "0 Bytes" or "Unknown": a card that omits the chip
 * reads as "no figure available", while a card claiming zero reads as a
 * song that occupies nothing, which is never true of one you can play.
 */
export function sessionSizeLabel(
  session: UvrSession,
  format: (bytes: number) => string,
): string | null {
  const size = sessionSize(session)
  if (size.bytes <= 0) return null
  // A partial total is marked as a floor rather than dressed up as exact.
  return size.complete ? format(size.bytes) : `≥ ${format(size.bytes)}`
}
