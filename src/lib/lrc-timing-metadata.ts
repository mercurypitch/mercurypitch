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

function isNumberArrayMap(value: unknown): value is WordTimingsMap {
  if (typeof value !== 'object' || value === null) return false
  return Object.entries(value).every(
    ([key, line]) =>
      /^\d+$/.test(key) &&
      Array.isArray(line) &&
      line.every(
        (item) =>
          typeof item === 'number' && Number.isFinite(item) && item >= 0,
      ),
  )
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
    const wordEndTimings = parsed.ends ?? {}
    const wordSweepTimings = parsed.sweeps ?? {}
    if (!isNumberArrayMap(wordEndTimings) || !isSweepMap(wordSweepTimings)) {
      return null
    }
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
