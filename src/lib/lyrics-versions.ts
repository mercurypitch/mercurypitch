// ============================================================
// Lyrics versions — keep the original / edited / auto-synced word mappings
// side by side so a singer can switch between and compare them
// ============================================================
//
// The lyrics record used to hold ONE active `text` + `wordTimings` slot
// (each operation — upload, edit, LRC-Gen, auto word-sync — overwrote it)
// plus a single hidden `originalText` backup with no UI. This models the
// mappings as named versions, one per KIND, so switching is possible.
// Lyrics are kilobytes of text, so all versions persist across reloads;
// a per-version delete frees one when another is clearly better.
//
// Tests: src/tests/lyrics-versions.test.ts

import type { WordSweepTimingsMap, WordTimingsMap, } from '@/features/stem-mixer/types'

export type LyricsVersionKind = 'imported' | 'edited' | 'auto-sync' | 'lrc-gen'

export interface LyricsVersion {
  /** One version per kind — re-running an operation updates its own version
   *  in place rather than spawning duplicates. The kind is also the id. */
  kind: LyricsVersionKind
  text: string
  wordTimings?: WordTimingsMap
  wordEndTimings?: WordTimingsMap
  wordSweepTimings?: WordSweepTimingsMap
  /** Epoch ms; stamped by the caller (kept out of this pure module). */
  createdAt: number
}

export const VERSION_LABELS: Record<LyricsVersionKind, string> = {
  imported: 'Original',
  edited: 'Edited',
  'auto-sync': 'Auto-sync',
  'lrc-gen': 'Tapped',
}

/** Display order in the switcher (original first, then the derived ones). */
const KIND_ORDER: LyricsVersionKind[] = [
  'imported',
  'edited',
  'auto-sync',
  'lrc-gen',
]

export function sortVersions(versions: LyricsVersion[]): LyricsVersion[] {
  return [...versions].sort(
    (a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind),
  )
}

/** Add or replace the version of `next.kind`, returning a new sorted array. */
export function upsertVersion(
  versions: LyricsVersion[],
  next: LyricsVersion,
): LyricsVersion[] {
  const others = versions.filter((v) => v.kind !== next.kind)
  return sortVersions([...others, next])
}

export function removeVersion(
  versions: LyricsVersion[],
  kind: LyricsVersionKind,
): LyricsVersion[] {
  return versions.filter((v) => v.kind !== kind)
}

export function findVersion(
  versions: LyricsVersion[],
  kind: LyricsVersionKind | undefined,
): LyricsVersion | undefined {
  if (kind === undefined) return undefined
  return versions.find((v) => v.kind === kind)
}

/**
 * The active version after one is deleted: prefer the remaining version
 * nearest the front of the display order, or undefined when none remain.
 */
export function nextActiveAfterDelete(
  versions: LyricsVersion[],
  deleted: LyricsVersionKind,
): LyricsVersionKind | undefined {
  const remaining = sortVersions(removeVersion(versions, deleted))
  return remaining[0]?.kind
}

export interface LegacyLyricsShape {
  text?: string
  wordTimings?: WordTimingsMap
  originalText?: string
  versions?: LyricsVersion[]
  activeVersionKind?: LyricsVersionKind
}

export interface SynthesizedVersions {
  versions: LyricsVersion[]
  activeVersionKind: LyricsVersionKind | undefined
}

/**
 * Build the versions list for a lyrics record. New records already carry
 * `versions`; legacy records (just `text` + optional `originalText`) are
 * migrated once, without data loss:
 *   - the active mapping becomes an 'edited' version when it has word
 *     timings, else 'imported';
 *   - a distinct `originalText` becomes a separate 'imported' version so the
 *     pre-edit lyrics remain reachable.
 */
export function synthesizeVersions(
  data: LegacyLyricsShape,
  now: number,
): SynthesizedVersions {
  if (data.versions !== undefined && data.versions.length > 0) {
    const versions = sortVersions(data.versions)
    const active =
      findVersion(versions, data.activeVersionKind)?.kind ?? versions[0]?.kind
    return { versions, activeVersionKind: active }
  }

  const text = data.text ?? ''
  if (text === '') return { versions: [], activeVersionKind: undefined }

  const hasTimings =
    data.wordTimings !== undefined && Object.keys(data.wordTimings).length > 0
  const activeKind: LyricsVersionKind = hasTimings ? 'edited' : 'imported'
  const versions: LyricsVersion[] = [
    {
      kind: activeKind,
      text,
      wordTimings: hasTimings ? data.wordTimings : undefined,
      createdAt: now,
    },
  ]
  // A distinct pre-edit original is worth keeping as its own version — but
  // only when the active one isn't already the import.
  if (
    activeKind !== 'imported' &&
    data.originalText !== undefined &&
    data.originalText !== '' &&
    data.originalText !== text
  ) {
    versions.push({ kind: 'imported', text: data.originalText, createdAt: now })
  }
  return {
    versions: sortVersions(versions),
    activeVersionKind: activeKind,
  }
}
