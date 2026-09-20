// ── A lyric line, word by word ────────────────────────────────────────
// Which word of the line is being sung, and how far through it.
//
// The answer comes from `computeActiveWord`, the same function Karaoke Night
// and the mixer's lyric panel ask -- so a word lights up in a room at the
// moment it lights up there, and a fix to one is a fix to all three. What
// this module adds is the jam's side of the bargain: a line's words arrive
// over the wire from another browser, with no schema in between, so they are
// checked here before anything trusts them.

import type { LyricsLineTiming } from '@/lib/jam/types'
import { computeActiveWord } from '@/lib/lyrics-service'

/** How far a line's words have been sung. */
export interface JamWordProgress {
  /** Every word up to and including this one is sung; -1 before the first. */
  sungUpTo: number
  /** How far through the NEXT word the singing is, 0 to 1. */
  fraction: number
}

export const NOTHING_SUNG: JamWordProgress = { sungUpTo: -1, fraction: 0 }

/** A line as words, with whatever timing it carries that can be trusted. */
export interface JamLineWords {
  words: readonly string[]
  /** One per word, or absent: the line is then shared out evenly. */
  startsSec?: number[]
  /** Sparse -- only the words somebody marked an end for. */
  endsSec?: number[]
}

/**
 * How long the last line of a song is taken to run, having no next line to
 * end at. Only the even share-out reads it, and that caps itself by how long
 * the words take to sing, so this is a ceiling rather than a guess.
 */
const LAST_LINE_SEC = 8

const isTime = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0

const splitText = (text: string): string[] =>
  text.split(/\s+/).filter((w) => w.length > 0)

/**
 * Lines are rebuilt rarely and read every frame, so the split is kept per
 * line OBJECT. Weak, so a song that leaves takes its lines with it.
 */
const parsed = new WeakMap<LyricsLineTiming, JamLineWords>()

/**
 * A line's words.
 *
 * Its own mapping when that holds together: words that add up to the text a
 * singer reads, and a start for every one of them. Anything else -- a line
 * that was never mapped, a peer on a build that words these differently, a
 * garbled message -- falls back to the text split on spaces, which the even
 * share-out can still light up. Never a throw: this runs inside a paint.
 */
export function jamLineWords(line: LyricsLineTiming): JamLineWords {
  const known = parsed.get(line)
  if (known !== undefined) return known

  const fromText = splitText(line.text)
  let result: JamLineWords = { words: fromText }

  const { words, wordStartsSec: starts, wordEndsSec: ends } = line
  if (
    Array.isArray(words) &&
    Array.isArray(starts) &&
    words.length === starts.length &&
    words.length === fromText.length &&
    words.every((w, i) => w === fromText[i]) &&
    starts.every(isTime)
  ) {
    const endsSec: number[] = []
    if (Array.isArray(ends)) {
      ends.forEach((end, i) => {
        if (isTime(end) && i < words.length) endsSec[i] = end
      })
    }
    result = {
      words: fromText,
      startsSec: [...starts],
      ...(endsSec.length > 0 ? { endsSec } : {}),
    }
  }

  parsed.set(line, result)
  return result
}

/** How far line `index` has been sung at `positionSec`. */
export function jamWordProgress(
  lines: readonly LyricsLineTiming[],
  index: number,
  positionSec: number,
): JamWordProgress {
  const line = lines[index]
  if (line === undefined) return NOTHING_SUNG
  const { words, startsSec, endsSec } = jamLineWords(line)
  if (words.length === 0) return NOTHING_SUNG
  const endSec =
    line.endSec ?? lines[index + 1]?.startSec ?? line.startSec + LAST_LINE_SEC
  const at = computeActiveWord(
    [...words],
    line.startSec,
    endSec,
    startsSec,
    positionSec,
    endsSec,
  )
  return { sungUpTo: at.activeUpTo, fraction: at.fraction }
}
