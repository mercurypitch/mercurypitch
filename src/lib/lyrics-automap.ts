// ============================================================
// Lyrics automap — pasted lyric lines timed against the sung notes
// ============================================================
//
// Untimed lyrics (a paste, a .txt, an LRCLIB record with plain lyrics only)
// used to be spread evenly over the whole song: the first line lit at 0:00
// and a typical line was 5 to 15 seconds out. The vocal's analysed notes
// (the raw ones, before the clean-up that merges a phrase into a few long
// notes) say where the voice sounds, and that places most lines:
//
//  - a line nearly always starts after a clear silence, and nearly every
//    clear silence (a second or more) starts a line;
//  - the rest start after a breath or inside a phrase, sung straight on,
//    where the line's length in syllables against the singing decides;
//  - a blank line in the paste starts a stanza, and a stanza starts after
//    the longest silence near it (an instrumental break), not merely one
//    over two seconds;
//  - singing that is in no line (a "yeah" before the first, an "ooh" after
//    the last) can be left out at a small cost per second, rather than
//    stretching the first or last line over it.
//
// One dynamic programme over the note starts places every line at once and
// in order. On the three example songs, their notes against their hand-timed
// lyrics, it puts 81, 82 and 64 per cent of lines within a second (the even
// spread: 12, 10 and 5), the first line within 0.9 s; with blank lines
// between their sections, as a lyrics site gives them, 81, 82 and 74. A
// 40-second break mid-song changes none of it. With the blank lines in, a
// stray phrase at either end costs little (77, 82, 74 per cent with a
// "yeah" before the first line; 81, 82, 71 with an "ooh" after the last).
// Without them it can push every line one late: nothing then says which
// phrase is the first line's, and lines of a like length fit either way.
// A song takes 12 to 43 ms, a 14-minute one 100 ms; one too long and dense
// to search within WORK_BUDGET stays untimed rather than hold up the page.
//
// Pure data-in/data-out. Tests: src/lib/lyrics-automap.test.ts

import { formatTimeLrc } from '@/lib/lrc-generator'
import { countSyllables } from '@/lib/word-sync'

/** A sung note, seconds: the pitch analysis's raw merged notes. */
export interface TimedNote {
  readonly startSec: number
  readonly endSec: number
}

/** One line of a paste, as the automap reads it. */
export interface PastedLine {
  readonly text: string
  /** A blank line or a section label came before it. */
  readonly stanzaStart: boolean
}

/** Notes closer than this belong to one phrase. */
export const PHRASE_GAP_SEC = 0.3
/** A phrase with less voice than this is a blip, unless it is next to singing. */
export const BLIP_SEC = 0.3
/** A blip this close to real singing is a short word, kept. */
export const BLIP_NEAR_SEC = 0.6
/** The first line starts no earlier than this much voice running unbroken. */
export const FIRST_LINE_VOICE_SEC = 0.5
/** A silence this long or longer is clear: lines start after them. */
export const CLEAR_GAP_SEC = 1
/** A silence this long or longer is a break: stanzas start after them. */
export const BREAK_GAP_SEC = 2
/** A break this long or longer is a whole one: a stanza starting after it earns in full. */
export const FULL_BREAK_SEC = 8
/** No line is sung for longer than this. Bounds the search. */
export const MAX_LINE_SEC = 30
/**
 * The inner steps the search may take (lines, by note starts, by the note
 * starts a line can span): about a tenth of a second, enough for a song of
 * ordinary length. A longer, denser one has each line looked for only
 * within a band either side of where an even pace would start it, narrowed
 * until the search fits, and never under BAND_MIN_SEC of singing.
 */
export const WORK_BUDGET = 3_000_000
export const BAND_MIN_SEC = 20
/** More lines by note starts than this is not tried: the tables alone. */
export const MAX_CELLS = 1_000_000
/** The most singing before the first line that can be in no line, s. */
export const OPENING_VOICE_SEC = 20
/** A held word ("ooooh") lasts about as long as this many syllables. */
export const HELD_WORD_SYLLABLES = 4

const WEIGHTS = {
  /** A line starting after a clear silence. */
  reward: 1,
  /** A clear silence left inside a line. */
  skip: 1,
  /** A line's sung time against its syllables. */
  length: 0.5,
  /** A line's notes against its syllables. */
  notes: 2,
  /** A stanza starting after a whole break; after a shorter one, a share. */
  stanza: 3,
  /**
   * Each second of singing left in no line, before the first or after the
   * last, when a break (BREAK_GAP_SEC) sets it apart from them: a "yeah"
   * ahead of the song, an "ooh" after it.
   */
  unsung: 0.05,
  /** The same for singing that runs up to the line: most likely its own. */
  unsungNear: 0.5,
} as const

/**
 * A section label on a line of its own: [Chorus], (Verse 2), Bridge:,
 * Chorus x2, (Chorus) x2, Repeat chorus, Final chorus, Verse one, *Chorus*,
 * {Chorus}, Instrumental, Guitar solo, Verse 2 - Artist, x2, and a divider
 * of no letters (***). A bracketed line is a label only when it is a
 * section word with at most an order, a number, a name or a repeat:
 * "(Repeat after me)" is sung.
 */
const SECTION_WORD =
  '(?:verse|chorus|pre-?chorus|post-?chorus|bridge|intro|outro|hook|refrain|interlude|instrumental(?: break)?|(?:guitar |piano |sax |drum )?solo|breakdown|coda|tag|repeat(?: chorus)?)'
const SECTION = `(?:(?:first|second|third|last|final|main|double)\\s+)?${SECTION_WORD}(?:\\s*(?:\\d+|one|two|three|four|five|six|seven|eight|nine|ten))?`
const REPEAT = '(?:\\(?\\s*(?:x\\s*\\d+|\\d+\\s*x)\\s*\\)?)'
const SECTION_LABEL = new RegExp(
  [
    // [Anything in square brackets]: always a label, never sung.
    '^\\[[^\\]]*\\]$',
    // A section, maybe credited or repeated, maybe in (), {} or **, maybe
    // ending in a colon: Chorus, Verse 2 - Artist, (Chorus) x2, *Bridge*:.
    `^[(*{]*\\s*${SECTION}(?:\\s*[-–]\\s*[^():]*?)?(?:\\s*${REPEAT})?\\s*[)*}]*(?:\\s*${REPEAT})?\\s*:?$`,
    // A repeat on its own: x2, (2x).
    `^${REPEAT}$`,
    // A divider: no letter or digit in it (***, ---).
    '^[^\\p{L}\\p{N}]+$',
  ].join('|'),
  'iu',
)
/** A label with the line on the same row: "Chorus: we will rock you". */
const LABEL_THEN_LINE = new RegExp(
  `^[(*{]*\\s*${SECTION}\\s*[)*}]*\\s*:\\s*(\\S.*)$`,
  'iu',
)

/** A word held long: a letter three times or more ("ooooh", "yeahhh"). */
const HELD_WORD = /(\p{L})\1\1/u

/**
 * The paste as lines to time: blank lines and section labels dropped, each
 * marking the next line as a stanza start.
 */
export function pastedLines(text: string): PastedLine[] {
  const out: PastedLine[] = []
  let stanza = false
  for (const raw of text.split(/\r?\n/)) {
    // "Chorus: we will rock you": the label starts a stanza, the rest is sung.
    const sung = LABEL_THEN_LINE.exec(raw.trim())?.[1] ?? raw.trim()
    if (sung !== raw.trim()) stanza = true
    if (sung === '' || SECTION_LABEL.test(sung)) {
      stanza = true
      continue
    }
    out.push({ text: sung, stanzaStart: stanza && out.length > 0 })
    stanza = false
  }
  return out
}

/** The line's length in syllables, a held word counted long. */
function syllablesOf(text: string): number {
  let sum = 0
  for (const word of text.split(/\s+/)) {
    if (word === '') continue
    sum += HELD_WORD.test(word) ? HELD_WORD_SYLLABLES : countSyllables(word)
  }
  return Math.max(1, sum)
}

/** A note start a line can start at, with the silence before it. */
interface Candidate {
  readonly at: number
  /** Silence before it, s. */
  readonly gap: number
  /** End of the singing before it. */
  readonly prevEnd: number
}

const voicedOf = (phrase: readonly TimedNote[]): number =>
  phrase.reduce((sum, n) => sum + n.endSec - n.startSec, 0)

/** The notes in phrases; a blip alone in a break is not singing. */
function singingOf(notes: readonly TimedNote[]): TimedNote[] {
  const sorted = notes
    .filter((n) => n.endSec > n.startSec)
    .sort((a, b) => a.startSec - b.startSec)
  const phrases: TimedNote[][] = []
  let end = -Infinity
  for (const n of sorted) {
    if (phrases.length === 0 || n.startSec - end >= PHRASE_GAP_SEC) {
      phrases.push([])
    }
    phrases[phrases.length - 1].push(n)
    end = Math.max(end, n.endSec)
  }
  const bounds = phrases.map((p) => ({
    start: p[0].startSec,
    end: Math.max(...p.map((n) => n.endSec)),
    real: voicedOf(p) >= BLIP_SEC,
  }))
  const near = (i: number): boolean => {
    for (let j = i - 1; j >= 0; j--) {
      if (!bounds[j].real) continue
      if (bounds[i].start - bounds[j].end < BLIP_NEAR_SEC) return true
      break
    }
    for (let j = i + 1; j < bounds.length; j++) {
      if (!bounds[j].real) continue
      return bounds[j].start - bounds[i].end < BLIP_NEAR_SEC
    }
    return false
  }
  return phrases.filter((_, i) => bounds[i].real || near(i)).flat()
}

function candidatesOf(singing: readonly TimedNote[]): Candidate[] {
  const out: Candidate[] = []
  let prevEnd = -Infinity
  for (const n of singing) {
    out.push({ at: n.startSec, gap: n.startSec - prevEnd, prevEnd })
    prevEnd = Math.max(prevEnd, n.endSec)
  }
  return out
}

/** The earliest the first line starts: the first run of real voice. */
function firstIndex(cands: readonly Candidate[], songEnd: number): number {
  for (let i = 0; i < cands.length; i++) {
    if (i > 0 && cands[i].gap < PHRASE_GAP_SEC) continue
    let j = i + 1
    while (j < cands.length && cands[j].gap < PHRASE_GAP_SEC) j++
    const end = j < cands.length ? cands[j].prevEnd : songEnd
    if (end - cands[i].at >= FIRST_LINE_VOICE_SEC) return i
  }
  return 0
}

/** How a placing of the lines is scored (automapLineStarts). */
interface Scoring {
  /** The line from candidate a up to (not including) b against its syllables. */
  readonly lengthCost: (line: number, a: number, b: number) => number
  /** Clear silences left inside the line from candidate a up to b. */
  readonly inside: (a: number, b: number) => number
  /** What starting `line` at candidate c earns. */
  readonly startBonus: (line: number, c: number) => number
  /** The singing from candidate a up to b, in seconds of voice. */
  readonly voiced: (a: number, b: number) => number
  /** The first candidate each line may start at (bandsOf). */
  readonly lo: Int32Array
  /** The last candidate each line may start at. */
  readonly hi: Int32Array
}

/**
 * Sung seconds per syllable: the time from the first line on, clear
 * silences left out. Each candidate counts up to the next one's start, so
 * every silence is counted once before the clear ones come off.
 */
function sungPerSyllable(
  cands: readonly Candidate[],
  first: number,
  songEnd: number,
  syllables: number,
): number {
  let sung = songEnd - cands[first].at
  for (let i = first + 1; i < cands.length; i++) {
    if (cands[i].gap >= CLEAR_GAP_SEC) sung -= cands[i].gap
  }
  return Math.max(0.05, sung / syllables)
}

/**
 * How much of a break a silence is: none below BREAK_GAP_SEC, all of one
 * from FULL_BREAK_SEC, and in between by its doubling. A stanza looks for
 * the longest silence near it, not merely one over two seconds: in a song
 * whose lines are three seconds apart, every line follows a "break".
 */
function breakShare(gap: number): number {
  const share =
    Math.log2(gap / BREAK_GAP_SEC) / Math.log2(FULL_BREAK_SEC / BREAK_GAP_SEC)
  return Math.min(1, Math.max(0, share))
}

/**
 * How far either side of where an even pace would start it a line is
 * looked for, in sung seconds: anywhere while the whole search fits
 * WORK_BUDGET; on a long, dense song, a band narrowed until it fits, never
 * under BAND_MIN_SEC; null when even that is far over, or the tables would
 * be too big: the lyrics stay untimed rather than hold up the page.
 */
function bandHalfWidth(
  lines: number,
  cands: readonly Candidate[],
  first: number,
  songEnd: number,
  sungTotal: number,
): number | null {
  const starts = cands.length - first
  if (lines * starts > MAX_CELLS) return null
  const span = Math.max(1, songEnd - cands[first].at)
  const reach = Math.min(starts, (starts * MAX_LINE_SEC) / span)
  const work = lines * starts * reach
  if (work <= WORK_BUDGET) return Infinity
  const half = Math.max(BAND_MIN_SEC, (sungTotal * WORK_BUDGET) / work / 2)
  const banded = work * Math.min(1, (2 * half) / Math.max(1, sungTotal))
  return banded > 3 * WORK_BUDGET ? null : half
}

/**
 * The candidates each line may start at: within `band` sung seconds of
 * where singing at an even pace, `rate` seconds a syllable, would start it.
 */
function bandsOf(
  syl: readonly number[],
  rate: number,
  cands: readonly Candidate[],
  first: number,
  band: number,
): { lo: Int32Array; hi: Int32Array } {
  const C = cands.length
  const lo = new Int32Array(syl.length).fill(first)
  const hi = new Int32Array(syl.length).fill(C - 1)
  if (band === Infinity) return { lo, hi }
  // Sung time at each candidate: from the first voice, clear silences out.
  const sungAt = new Float64Array(C)
  let cut = 0
  for (let i = first; i < C; i++) {
    if (i > first && cands[i].gap >= CLEAR_GAP_SEC) cut += cands[i].gap
    sungAt[i] = cands[i].at - cands[first].at - cut
  }
  let a = first
  let b = first
  let before = 0
  for (let l = 0; l < syl.length; l++) {
    const due = rate * before
    while (a < C - 1 && sungAt[a] < due - band) a++
    while (b < C - 1 && sungAt[b + 1] <= due + band) b++
    lo[l] = a
    hi[l] = Math.max(a, b)
    before += syl[l]
  }
  return { lo, hi }
}

/** A clear silence left inside a line costs; a short breath a little. */
const skipCost = (gap: number): number =>
  gap >= CLEAR_GAP_SEC ? WEIGHTS.skip : gap >= 0.6 ? WEIGHTS.skip * 0.2 : 0

/** How a placing is scored; null when the search would be too big. */
function scoringFor(
  lines: readonly PastedLine[],
  singing: readonly TimedNote[],
  cands: readonly Candidate[],
  first: number,
  songEnd: number,
): Scoring | null {
  const C = cands.length
  const syl = lines.map((l) => syllablesOf(l.text))
  const totalSyl = syl.reduce((a, b) => a + b, 0)
  const rate = sungPerSyllable(cands, first, songEnd, totalSyl)
  const band = bandHalfWidth(
    lines.length,
    cands,
    first,
    songEnd,
    rate * totalSyl,
  )
  if (band === null) return null
  const notesPerSyl = (C - first) / totalSyl
  const skipPrefix = new Float64Array(C + 1)
  const voicedPrefix = new Float64Array(C + 1)
  for (let i = 0; i < C; i++) {
    skipPrefix[i + 1] = skipPrefix[i] + (i === 0 ? 0 : skipCost(cands[i].gap))
    voicedPrefix[i + 1] =
      voicedPrefix[i] + (singing[i].endSec - singing[i].startSec)
  }
  // The logs the inner loop needs, worked out once.
  const wantSec = syl.map((n) => Math.log(rate * n))
  const wantNotes = syl.map((n) => Math.log(notesPerSyl * n + 1))
  const logCount = Float64Array.from({ length: C + 2 }, (_, k) =>
    Math.log(Math.max(1, k)),
  )
  return {
    ...bandsOf(syl, rate, cands, first, band),
    lengthCost: (line, a, b) => {
      const end = b < C ? cands[b].prevEnd : songEnd
      const r = Math.log(Math.max(0.1, end - cands[a].at)) - wantSec[line]
      const n = logCount[b - a + 1] - wantNotes[line]
      return WEIGHTS.length * r * r + WEIGHTS.notes * n * n
    },
    inside: (a, b) => skipPrefix[b] - skipPrefix[a + 1],
    startBonus: (line, c) => {
      const gap = cands[c].gap
      const clear = WEIGHTS.reward * Math.min(1, gap / CLEAR_GAP_SEC)
      const stanza = lines[line].stanzaStart
        ? WEIGHTS.stanza * breakShare(gap)
        : 0
      return clear + stanza
    },
    voiced: (a, b) => voicedPrefix[b] - voicedPrefix[a],
  }
}

const INF = Number.POSITIVE_INFINITY

/**
 * The best start for the line before one starting at candidate c, and the
 * cost of every line up to it: back from c, until that line would be sung
 * for longer than MAX_LINE_SEC.
 */
function bestBefore(
  prev: Float64Array,
  line: number,
  c: number,
  lowest: number,
  cands: readonly Candidate[],
  scoring: Scoring,
): { cost: number; at: number } {
  let cost = INF
  let at = -1
  for (let p = c - 1; p >= lowest; p--) {
    if (cands[c].prevEnd - cands[p].at > MAX_LINE_SEC) break
    if (prev[p] === INF) continue
    const v = prev[p] + scoring.lengthCost(line, p, c) + scoring.inside(p, c)
    if (v < cost) {
      cost = v
      at = p
    }
  }
  return { cost, at }
}

/**
 * The cost of `voice` seconds of singing in no line, by the silence between
 * it and the nearest line.
 */
const unsungCost = (voice: number, silence: number): number =>
  voice * (silence >= BREAK_GAP_SEC ? WEIGHTS.unsung : WEIGHTS.unsungNear)

/**
 * Where the first line may start: anywhere from the first real voice while
 * the singing it leaves in no line is under OPENING_VOICE_SEC, each second
 * of it costing (a "yeah" before the first line is not its start).
 */
function openingCosts(
  cands: readonly Candidate[],
  first: number,
  scoring: Scoring,
): Float64Array {
  const C = cands.length
  const cost = new Float64Array(C).fill(INF)
  for (let c = first; c < C; c++) {
    const left = scoring.voiced(first, c)
    if (left > OPENING_VOICE_SEC) break
    cost[c] = unsungCost(left, cands[c].gap) - scoring.startBonus(0, c)
  }
  return cost
}

/**
 * The placing itself: cost[l][c] is the best placing of lines 0..l with
 * line l starting at candidate c, and back[l][c] where line l - 1 started.
 */
function placeLines(
  count: number,
  cands: readonly Candidate[],
  first: number,
  scoring: Scoring,
): { cost: Float64Array[]; back: Int32Array[] } {
  const C = cands.length
  const cost: Float64Array[] = Array.from({ length: count }, () =>
    new Float64Array(C).fill(INF),
  )
  const back = Array.from({ length: count }, () => new Int32Array(C).fill(-1))
  cost[0] = openingCosts(cands, first, scoring)
  for (let l = 1; l < count; l++) {
    const lowest = Math.max(first + l - 1, scoring.lo[l - 1])
    for (let c = Math.max(first + l, scoring.lo[l]); c <= scoring.hi[l]; c++) {
      const best = bestBefore(cost[l - 1], l - 1, c, lowest, cands, scoring)
      if (best.at < 0) continue
      cost[l][c] = best.cost - scoring.startBonus(l, c)
      back[l][c] = best.at
    }
  }
  return { cost, back }
}

/**
 * The last line from candidate c at its best: sung up to a clear silence
 * within MAX_LINE_SEC, with the singing after it in no line (an "ooh" after
 * the last line does not stretch it), or sung on to the very end, which is
 * always a choice, however long the run.
 */
function lastLineCost(
  line: number,
  c: number,
  cands: readonly Candidate[],
  scoring: Scoring,
): number {
  const C = cands.length
  let best = scoring.lengthCost(line, c, C) + scoring.inside(c, C)
  for (let e = c + 1; e < C; e++) {
    if (cands[e].prevEnd - cands[c].at > MAX_LINE_SEC) break
    if (cands[e].gap < CLEAR_GAP_SEC) continue
    const cost =
      scoring.lengthCost(line, c, e) +
      scoring.inside(c, e) +
      unsungCost(scoring.voiced(e, C), cands[e].gap)
    best = Math.min(best, cost)
  }
  return best
}

/** Where the last line starts; -1 when there is no placing. */
function lastStart(
  last: Float64Array,
  line: number,
  from: number,
  cands: readonly Candidate[],
  scoring: Scoring,
): number {
  let best = INF
  let start = -1
  for (let c = Math.max(from, scoring.lo[line]); c <= scoring.hi[line]; c++) {
    if (last[c] === INF) continue
    const total = last[c] + lastLineCost(line, c, cands, scoring)
    if (total < best) {
      best = total
      start = c
    }
  }
  return start
}

/**
 * Each line's start, in seconds, from the vocal's notes; null when the
 * notes cannot carry the lines (none, or fewer note starts than lines).
 */
export function automapLineStarts(
  lines: readonly PastedLine[],
  notes: readonly TimedNote[],
): number[] | null {
  const L = lines.length
  const singing = singingOf(notes)
  const cands = candidatesOf(singing)
  if (L === 0 || cands.length === 0) return null
  const songEnd = Math.max(...singing.map((n) => n.endSec))
  const first = firstIndex(cands, songEnd)
  if (cands.length - first < L) return null
  const scoring = scoringFor(lines, singing, cands, first, songEnd)
  if (scoring === null) return null
  const { cost, back } = placeLines(L, cands, first, scoring)
  const end = lastStart(cost[L - 1], L - 1, first + L - 1, cands, scoring)
  if (end < 0) return null
  const starts = Array<number>(L)
  for (let l = L - 1, c = end; l >= 0; l--) {
    starts[l] = cands[c].at
    c = back[l][c]
  }
  return starts
}

/**
 * The paste as line-timed LRC, each line on the note it starts at; null
 * when the notes cannot carry it (automapLineStarts). Blank lines and
 * section labels are left out: they are not sung.
 */
export function automappedLrc(
  text: string,
  notes: readonly TimedNote[],
): string | null {
  const lines = pastedLines(text)
  const starts = automapLineStarts(lines, notes)
  if (starts === null) return null
  return lines
    .map((line, i) => {
      // To the hundredth first: 59.999 must read 01:00.00, not 00:60.00.
      const at = Math.round(Math.max(0, starts[i]) * 100) / 100
      return `[${formatTimeLrc(at)}]${line.text}`
    })
    .join('\n')
}
