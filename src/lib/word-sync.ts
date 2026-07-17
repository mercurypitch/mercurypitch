// ============================================================
// word-sync — pure helpers for automatic word-level lyric timing
// ============================================================
//
// Given line-level LRC times (the common case — lrclib delivers those) and
// vocal onsets from the separated stem, lay each line's words out by
// syllable weight and snap them to real onsets. See
// docs/plans/lyrics-word-sync.md. Tests: src/tests/word-sync.test.ts.

/** Vowel-group syllable estimate; always at least 1. */
export function countSyllables(word: string): number {
  const clean = word.toLowerCase().replace(/[^a-zà-öø-ÿ']/gi, '')
  if (clean.length === 0) return 1
  const groups = clean.match(/[aeiouyà-öø-ÿ]+/gi)
  let n = groups ? groups.length : 1
  // Trailing silent-e ("home", "care") — not its own syllable.
  if (n > 1 && /[^aeiouy]e$/.test(clean)) n--
  return Math.max(1, n)
}

/** Rough per-word sung duration from syllable count (seconds). */
export function estimateWordDuration(word: string): number {
  return Math.min(2.2, Math.max(0.3, 0.25 + 0.16 * countSyllables(word)))
}

/**
 * Distribute a line's words across [vocalStart, vocalEnd] proportionally to
 * syllable weight. Returns one start time per word.
 */
export function layoutLineWords(
  words: string[],
  vocalStart: number,
  vocalEnd: number,
): number[] {
  if (words.length === 0) return []
  const weights = words.map(countSyllables)
  const total = weights.reduce((a, b) => a + b, 0)
  const span = Math.max(0.05, vocalEnd - vocalStart)
  const times: number[] = []
  let acc = 0
  for (let i = 0; i < words.length; i++) {
    times.push(Math.round((vocalStart + (acc / total) * span) * 1000) / 1000)
    acc += weights[i]
  }
  return times
}

/**
 * Snap word times to the nearest onset within `tolerance`, keeping the
 * result strictly monotonic and inside [lineStart, lineEnd). Each onset is
 * used at most once.
 */
export function snapToOnsets(
  times: number[],
  onsets: number[],
  lineStart: number,
  lineEnd: number,
  tolerance = 0.14,
): number[] {
  const result: number[] = []
  let onsetFrom = 0
  let prev = -Infinity
  for (const t of times) {
    let best = t
    let bestDist = tolerance + 1e-9
    for (let i = onsetFrom; i < onsets.length; i++) {
      const o = onsets[i]
      if (o >= lineEnd) break
      if (o <= prev) continue
      const dist = Math.abs(o - t)
      if (dist <= bestDist) {
        best = o
        bestDist = dist
        onsetFrom = i + 1
      } else if (o > t + tolerance) {
        break
      }
    }
    let next = Math.max(lineStart, best)
    if (next <= prev) next = prev + 0.03
    next = Math.min(next, Math.max(lineStart, lineEnd - 0.05))
    result.push(Math.round(next * 1000) / 1000)
    prev = next
  }
  return result
}

/**
 * Full per-line pipeline: pick the sung span from the onsets inside the
 * line (skips instrumental lead-ins), lay words out by syllables, snap.
 */
export function autoTimeLineWords(
  words: string[],
  lineStart: number,
  lineEnd: number,
  onsets: number[],
): number[] {
  if (words.length === 0) return []
  const inSpan = onsets.filter((o) => o >= lineStart - 0.05 && o < lineEnd)
  let vocalStart = lineStart
  let vocalEnd = lineStart + (lineEnd - lineStart) * 0.85
  if (inSpan.length > 0) {
    vocalStart = Math.max(lineStart, inSpan[0])
    vocalEnd = Math.min(lineEnd, inSpan[inSpan.length - 1] + 0.25)
    if (vocalEnd - vocalStart < 0.3) {
      vocalEnd = Math.min(
        lineEnd,
        vocalStart + Math.max(0.3, (lineEnd - lineStart) * 0.6),
      )
    }
  }
  const layout = layoutLineWords(words, vocalStart, vocalEnd)
  return snapToOnsets(layout, inSpan, lineStart, lineEnd)
}
