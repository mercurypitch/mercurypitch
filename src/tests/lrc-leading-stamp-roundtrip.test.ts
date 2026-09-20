// ============================================================
// Every LRC line an export writes must open with a stamp.
//
// `LRC_LINE_RE` in lyrics-service.ts requires one, so `parseLrcFile` skips a
// body that starts with a bare word — the line is not mistimed, it is GONE.
// Four builders emit one stamp per word and produce exactly that whenever the
// FIRST word happens to have no start of its own.
//
// These are round-trip tests on purpose: an assertion on the emitted text
// alone would pass for any leading stamp, including one the parser reads as a
// repeated-line marker instead of a word time.
// ============================================================

import { describe, expect, it } from 'vitest'
import { composeGenResult } from '@/features/stem-mixer/lrc-gen-engine'
import type { CanonicalLrcEntry } from '@/features/stem-mixer/types'
import { buildLrcTextFromCanonical, buildWordLevelLrc, } from '@/lib/lrc-generator'
import { parseLrcFile, parseLrcWordTimings } from '@/lib/lyrics-service'
import { lyricsfileToLrc } from '@/lib/lyricsfile'

const WORDS = ['Como', 'esta', 'amigo']
const TEXT = WORDS.join(' ')

/**
 * A sparse array of word starts, which is what the mapper really produces
 * when it skips a word. `WordTimingsMap` types every slot as `number`, so a
 * hole can only be built, never written as a literal.
 */
function sparse(...times: (number | undefined)[]): number[] {
  const out: number[] = []
  times.forEach((time, i) => {
    if (time !== undefined) out[i] = time
  })
  out.length = times.length
  return out
}

/** The line as it reads back: its own start, plus every word's. */
function roundTrip(lrc: string) {
  const lines = parseLrcFile(lrc)
  if (lines.length === 0) return null
  const timings = parseLrcWordTimings(lines[0].text, lines[0].time)
  return {
    time: lines[0].time,
    words: timings?.words ?? lines[0].text.split(/\s+/),
    wordTimes: timings?.wordTimes ?? [],
  }
}

describe('a line whose first word has no start survives the round trip', () => {
  it('lyricsfileToLrc', () => {
    const lrc = lyricsfileToLrc({
      metadata: {},
      lines: [{ time: 10, text: TEXT }],
      wordTimings: { 0: sparse(undefined, 11, 12) },
      wordEndTimings: {},
      wordSweepTimings: {},
    })

    expect(roundTrip(lrc)).toEqual({
      time: 10,
      words: WORDS,
      wordTimes: [10, 11, 12],
    })
  })

  it('buildWordLevelLrc', () => {
    // No line time reaches this builder, so the first stamp it can honestly
    // write is the first word start it has. The line must still survive.
    const lrc = buildWordLevelLrc([TEXT], { 0: [undefined, 11, 12] })

    expect(roundTrip(lrc)).toEqual({
      time: 11,
      words: WORDS,
      wordTimes: [11, 11, 12],
    })
  })

  it('buildLrcTextFromCanonical', () => {
    const entry: CanonicalLrcEntry = {
      type: 'line',
      lrcIndex: 0,
      canonicalIndex: 0,
      time: 10,
      text: TEXT,
      words: WORDS,
    }
    const lrc = buildLrcTextFromCanonical([entry], undefined, {
      0: [undefined, 11, 12],
    })

    expect(roundTrip(lrc)).toEqual({
      time: 10,
      words: WORDS,
      wordTimes: [10, 11, 12],
    })
  })

  it('composeGenResult, plain-text source', () => {
    const { lrcText } = composeGenResult({
      canonical: [],
      lines: [TEXT],
      lineTimes: [10],
      wordTimes: { 0: sparse(undefined, 11, 12) },
      wordEnds: {},
      wordSweeps: {},
      touchedLines: new Set([0]),
      snapshot: null,
      duration: 30,
    })

    expect(roundTrip(lrcText)).toEqual({
      time: 10,
      words: WORDS,
      wordTimes: [10, 11, 12],
    })
  })
})

describe('a fully stamped line keeps its word times', () => {
  // The guard on the fix: the head stamp must not become a SECOND square
  // stamp in front of a first word that already has one. `parseLrcWordTimings`
  // reads a square stamp at the head of a body as "sung again at", not as a
  // word time, so the first word would silently fall back to the line time.
  it('lyricsfileToLrc does not time the first word twice', () => {
    const lrc = lyricsfileToLrc({
      metadata: {},
      lines: [{ time: 9, text: TEXT }],
      wordTimings: { 0: [10, 11, 12] },
      wordEndTimings: {},
      wordSweepTimings: {},
    })

    expect(lrc).toBe('[00:10.00] Como [00:11.00] esta [00:12.00] amigo')
    expect(roundTrip(lrc)).toEqual({
      time: 10,
      words: WORDS,
      wordTimes: [10, 11, 12],
    })
  })

  it('buildLrcTextFromCanonical does not time the first word twice', () => {
    const entry: CanonicalLrcEntry = {
      type: 'line',
      lrcIndex: 0,
      canonicalIndex: 0,
      time: 9,
      text: TEXT,
      words: WORDS,
    }
    const lrc = buildLrcTextFromCanonical([entry], undefined, {
      0: [10, 11, 12],
    })

    expect(lrc).toBe('[00:10.00] Como [00:11.00] esta [00:12.00] amigo')
    expect(roundTrip(lrc)).toEqual({
      time: 10,
      words: WORDS,
      wordTimes: [10, 11, 12],
    })
  })
})

describe('a line with no word starts at all still survives', () => {
  it('lyricsfileToLrc', () => {
    const lrc = lyricsfileToLrc({
      metadata: {},
      lines: [{ time: 10, text: TEXT }],
      wordTimings: { 0: sparse(undefined, undefined, undefined) },
      wordEndTimings: {},
      wordSweepTimings: {},
    })

    expect(roundTrip(lrc)).toEqual({
      time: 10,
      words: WORDS,
      wordTimes: [],
    })
  })
})
