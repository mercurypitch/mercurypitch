// ============================================================
// MercuryPitch timing metadata embedded in otherwise-valid LRC files
// ============================================================
//
// LRC can store word onsets but has no portable word-end or intra-word curve
// syntax. Unknown ID tags are ignored by conventional LRC players, so exports
// carry one compact x-mp-timing tag for lossless MercuryPitch round-trips.

import type { LyricsTimingExtension, WordSweepPoint, WordSweepTimingsMap, WordTimingsMap, } from '@/features/stem-mixer/types'

interface SerializedTimingExtension {
  v: 1
  ends?: WordTimingsMap
  sweeps?: WordSweepTimingsMap
}

const META_RE = /^\[x-mp-timing:([A-Za-z0-9+/=]+)\]\s*$/m

/** Looser than META_RE on purpose: a damaged payload is still a tag. */
const META_PRESENT_RE = /^\[x-mp-timing:/m

/**
 * True when the text carries the tag at all, readable or not — which is how
 * a caller tells "no word ends were authored" from "they were, and are lost".
 */
export function hasLrcTimingMetadata(text: string): boolean {
  return META_PRESENT_RE.test(text)
}

/**
 * Word ends as they come back out of JSON, with the holes put back.
 *
 * An end is marked per word, so a line is sparse far more often than not:
 * one mark on the tenth word is an array with nine holes in front of it.
 * JSON has no hole, and `JSON.stringify` writes each as `null` -- so every
 * file with a partly marked line carries them, and a reader that takes
 * only numbers throws away the whole tag, sweeps included, for exactly the
 * mappings somebody took the most care over.
 *
 * Null is the only stand-in accepted. Anything else in a slot is a file
 * this app did not write, and null is returned so the caller ignores it.
 */
function restoreWordEnds(value: unknown): WordTimingsMap | null {
  if (typeof value !== 'object' || value === null) return null
  const restored: WordTimingsMap = {}
  for (const [key, line] of Object.entries(value)) {
    if (!/^\d+$/.test(key) || !Array.isArray(line)) return null
    const times: number[] = []
    for (const [wordIdx, item] of line.entries()) {
      if (item === null) continue
      if (typeof item !== 'number' || !Number.isFinite(item) || item < 0) {
        return null
      }
      times[wordIdx] = item
    }
    if (times.length > 0) restored[Number(key)] = times
  }
  return restored
}

function isSweepPoint(value: unknown): value is WordSweepPoint {
  if (typeof value !== 'object' || value === null) return false
  const point = value as Partial<WordSweepPoint>
  return (
    typeof point.time === 'number' &&
    Number.isFinite(point.time) &&
    point.time >= 0 &&
    typeof point.progress === 'number' &&
    Number.isFinite(point.progress) &&
    point.progress >= 0 &&
    point.progress <= 1
  )
}

function isSweepMap(value: unknown): value is WordSweepTimingsMap {
  if (typeof value !== 'object' || value === null) return false
  return Object.entries(value).every(
    ([lineKey, line]) =>
      /^\d+$/.test(lineKey) &&
      typeof line === 'object' &&
      line !== null &&
      Object.entries(line).every(
        ([wordKey, points]) =>
          /^\d+$/.test(wordKey) &&
          Array.isArray(points) &&
          points.every(isSweepPoint),
      ),
  )
}

export function parseLrcTimingMetadata(
  text: string,
): LyricsTimingExtension | null {
  const match = text.match(META_RE)
  if (!match) return null
  try {
    const parsed = JSON.parse(
      atob(match[1]),
    ) as Partial<SerializedTimingExtension>
    if (parsed.v !== 1) return null
    const wordEndTimings = restoreWordEnds(parsed.ends ?? {})
    const wordSweepTimings = parsed.sweeps ?? {}
    if (wordEndTimings === null || !isSweepMap(wordSweepTimings)) return null
    return { wordEndTimings, wordSweepTimings }
  } catch {
    return null
  }
}

export function withLrcTimingMetadata(
  text: string,
  extension: LyricsTimingExtension,
): string {
  const clean = text.replace(META_RE, '').replace(/^\s*\n/, '')
  const payload: SerializedTimingExtension = { v: 1 }
  if (Object.keys(extension.wordEndTimings).length > 0) {
    payload.ends = extension.wordEndTimings
  }
  if (Object.keys(extension.wordSweepTimings).length > 0) {
    payload.sweeps = extension.wordSweepTimings
  }
  if (payload.ends === undefined && payload.sweeps === undefined) return clean
  return `[x-mp-timing:${btoa(JSON.stringify(payload))}]\n${clean}`
}
