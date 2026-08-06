// ── Per-line scoring ─────────────────────────────────────────────────
// How well each lyric line was sung.
//
// The drill scorer works in beats against a melody; a song works in
// seconds against the analysed vocal line, and its natural unit is the
// LINE rather than the note. "You lost it on the second chorus" is
// something a person can act on; "note 47 was 30 cents flat" is not.
//
// Built on the same scoreNoteInRange the drills use, so a line score and
// a drill score mean the same thing -- the only difference is which
// numeric coordinate the range is measured in.
//
// Two clocks meet here. Pitch samples are stamped with Date.now(), while
// notes and lyrics live on the song's own timeline, so everything is
// converted through an anchor: a wall-clock instant and the song position
// at that instant. Anchoring per line rather than per run is deliberate --
// it stays correct across a seek, because a line scored as it finishes
// carries its own anchor from when it started.

import { scoreNoteInRange } from '@/features/exercises/exercise-scoring-utils'
import type { JamSongNote, LyricsLineTiming, TimeStampedPitchSample, } from '@/lib/jam/types'

export interface JamLineScore {
  lineIndex: number
  startSec: number
  endSec: number
  /** 0-100, and 0 for a line that had notes and went unsung. */
  score: number
  /** Whether anything voiced landed in the line at all. */
  voiced: boolean
  /** Target notes the line covered; 0 means there was nothing to score. */
  noteCount: number
}

/** Ties the wall clock to the song clock: `positionSec` held at `atMs`. */
export interface SongClockAnchor {
  atMs: number
  positionSec: number
}

/** One pitch sample on the song's timeline. */
interface SongTimeSample {
  freq: number
  time: number
  cents: number
}

/**
 * When a line ends, if the lyrics only gave a start.
 *
 * Falls back to the next line's start, and for the last line to a few
 * seconds -- a final line with no end would otherwise absorb every sample
 * to the end of the recording, including the outro and the applause.
 */
const LAST_LINE_SEC = 6

export function lineRange(
  lines: readonly LyricsLineTiming[],
  i: number,
): { startSec: number; endSec: number } {
  const line = lines[i]
  if (line === undefined) return { startSec: 0, endSec: 0 }
  const next = lines[i + 1]
  return {
    startSec: line.startSec,
    endSec: line.endSec ?? next?.startSec ?? line.startSec + LAST_LINE_SEC,
  }
}

/** Lyric lines that overlap at least one target note. */
export function scoreableLineIndices(
  lines: readonly LyricsLineTiming[],
  notes: readonly JamSongNote[],
): number[] {
  const indices: number[] = []
  for (let i = 0; i < lines.length; i++) {
    const { startSec, endSec } = lineRange(lines, i)
    if (
      notes.some((note) => note.endSec > startSec && note.startSec < endSec)
    ) {
      indices.push(i)
    }
  }
  return indices
}

/**
 * Move samples from the wall clock onto the song clock.
 *
 * Silent frames are dropped here rather than scored as wrong: a breath is
 * not a mistake, and scoreNoteInRange judges what was sung, not whether
 * something was sung at every instant.
 */
export function toSongTime(
  samples: readonly TimeStampedPitchSample[] | undefined,
  anchor: SongClockAnchor,
): SongTimeSample[] {
  return (samples ?? [])
    .filter((s) => s.frequency > 0)
    .map((s) => ({
      freq: s.frequency,
      time: anchor.positionSec + (s.timestamp - anchor.atMs) / 1000,
      cents: s.cents,
    }))
}

/**
 * Score a single line against the notes underneath it.
 *
 * A line with no target notes scores nothing and is marked noteCount 0 --
 * the difference between "you missed this" and "there was nothing here".
 * An instrumental break inside a lyric sheet is not a failure, and
 * counting it as one would drag an honest run down for singing nothing
 * where nothing was written. A line WITH notes that went unsung does
 * score zero: that is a miss.
 */
function scoreLineWith(
  lines: readonly LyricsLineTiming[],
  i: number,
  notes: readonly JamSongNote[],
  history: SongTimeSample[],
): JamLineScore {
  const { startSec, endSec } = lineRange(lines, i)
  const inLine = notes.filter((n) => n.endSec > startSec && n.startSec < endSec)
  const voiced = history.some((h) => h.time >= startSec && h.time < endSec)
  if (inLine.length === 0) {
    return { lineIndex: i, startSec, endSec, score: 0, voiced, noteCount: 0 }
  }
  // Averaged across the line's notes, each judged only against the samples
  // in ITS slot -- singing the right notes in the wrong order inside a
  // line should not score as if they were right.
  const total = inLine.reduce(
    (sum, n) => sum + scoreNoteInRange(history, n.midi, n.startSec, n.endSec),
    0,
  )
  return {
    lineIndex: i,
    startSec,
    endSec,
    score: Math.round(total / inLine.length),
    voiced,
    noteCount: inLine.length,
  }
}

/**
 * Score one line as it finishes, from the raw sample buffer.
 *
 * This is the live path: called when the playhead leaves a line, with the
 * anchor captured when that line was entered.
 */
export function scoreLiveLine(
  lines: readonly LyricsLineTiming[],
  lineIndex: number,
  notes: readonly JamSongNote[],
  samples: readonly TimeStampedPitchSample[] | undefined,
  anchor: SongClockAnchor,
): JamLineScore {
  return scoreLineWith(lines, lineIndex, notes, toSongTime(samples, anchor))
}

/** Score a whole take at once, for a run scored after the fact. */
export function scoreLines(
  lines: readonly LyricsLineTiming[],
  notes: readonly JamSongNote[],
  samples: readonly TimeStampedPitchSample[] | undefined,
  anchor: SongClockAnchor,
): JamLineScore[] {
  const history = toSongTime(samples, anchor)
  return lines.map((_line, i) => scoreLineWith(lines, i, notes, history))
}

/**
 * The run's overall score, over the lines that could be scored.
 *
 * Lines with nothing to sing are excluded from the denominator, so a song
 * whose lyric sheet includes instrumental gaps is not punished for them.
 * When the caller knows the singer's assigned scoreable-line count, it passes
 * that stable total separately; completed retakes still replace one another,
 * while seeking around the lyric sheet cannot grow the denominator.
 * Returns null when nothing was scoreable, which is not the same as zero --
 * zero is a claim about the singing, and there was none to judge.
 */
export function overallLineScore(
  scores: readonly JamLineScore[],
  expectedLineCount?: number,
): {
  score: number
  sungLines: number
  completedLines: number
  totalLines: number
} | null {
  const scorable = scores.filter((s) => s.noteCount > 0)
  if (scorable.length === 0) return null
  const total = scorable.reduce((sum, s) => sum + s.score, 0)
  return {
    score: Math.round(total / scorable.length),
    sungLines: scorable.filter((s) => s.voiced).length,
    completedLines: scorable.length,
    totalLines: Math.max(scorable.length, expectedLineCount ?? scorable.length),
  }
}
