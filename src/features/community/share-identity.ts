// ============================================================
// Share identity — what makes two shares "the same thing"
// ============================================================
//
// Nothing stopped a singer sharing the same melody twenty times. The
// Community shelf filled with identical cards, and since a share is
// dual-written (localStorage then the DB), each duplicate cost a row
// too.
//
// The fix is a content fingerprint rather than a name check: renaming
// "Warm-up" to "Warm-up 2" must NOT make it a new share, and two
// genuinely different melodies that happen to share a name must both be
// allowed. So the fingerprint is over what the thing IS — its notes and
// how they are played — never over its title.

import type { MelodyItem } from '@/types'

/**
 * A small, stable, non-cryptographic hash (FNV-1a, 32-bit).
 *
 * This guards a shelf, not a secret: collisions cost a wrongly-refused
 * duplicate, so speed and determinism matter more than strength. Written
 * out rather than pulled in so the fingerprint format cannot drift with
 * a dependency bump — an old share must keep matching a new one.
 */
export function fingerprintOf(input: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    // h *= 16777619, kept in 32-bit range without overflowing to float.
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h.toString(16).padStart(8, '0')
}

/**
 * What a melody IS: its notes in order, plus the settings that change
 * how it sounds. Not the name — renaming is not re-composing.
 */
export function melodyFingerprint(melody: {
  items: readonly MelodyItem[]
  bpm?: number
  key?: string
  scale?: string
}): string {
  const notes = melody.items
    .map((it) => {
      const anyItem = it as unknown as Record<string, unknown>
      // Shape varies across item kinds (note / rest / chord), so read
      // defensively rather than assuming one.
      const pitch = anyItem.note ?? anyItem.midi ?? anyItem.degree ?? ''
      const dur = anyItem.duration ?? anyItem.beats ?? ''
      return `${String(pitch)}:${String(dur)}`
    })
    .join('|')
  return fingerprintOf(
    `m1;${melody.bpm ?? ''};${melody.key ?? ''};${melody.scale ?? ''};${notes}`,
  )
}

/**
 * What a shared session IS: one run, identified by the attempt behind it.
 *
 * Deliberately includes the timestamp — two runs of the same exercise on
 * different days are genuinely different results and both worth showing.
 * What this stops is the same run being published twice.
 */
export function sessionFingerprint(session: {
  name: string
  score: number
  completedAt: number
}): string {
  return fingerprintOf(
    `s1;${session.name};${session.score};${session.completedAt}`,
  )
}

/** True when this fingerprint is already on the shelf. */
export function alreadyShared(
  fingerprint: string,
  existing: readonly { shareFingerprint?: string }[],
): boolean {
  return existing.some((e) => e.shareFingerprint === fingerprint)
}
