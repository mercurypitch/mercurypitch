// ============================================================
// Bars — where one ends and the next begins, from the file
// ============================================================
//
// Every reading surface needs bar lines, and until this module they each
// assumed four quarter notes. That is right for most rock and wrong for every
// waltz, every 6/8 shuffle, and Maiden's habit of dropping a 2/4 bar in to
// turn a phrase around. A wrong bar line is worse than none: the reader
// counts to the line, the line is not where the music says it is, and they
// blame themselves.
//
// The source shape is beat-positioned rather than bar-indexed because that is
// what the files carry. Standard MIDI writes a 0x58 meta at a tick; Guitar Pro
// writes a signature on a master bar, and the master bar knows its own start
// tick. Bar indexes are derived here, once, so nothing downstream has to walk
// signatures itself.

/** Beats throughout this module are quarter notes — the unit note starts use. */
export interface MidiTimeSignature {
  /** Quarter-note beat the signature takes effect on. */
  beat: number
  /** Beats in a bar, as written: the 6 of 6/8. */
  numerator: number
  /** Note value that gets one beat, as written: the 8 of 6/8. */
  denominator: number
}

export interface MidiBar {
  index: number
  startBeat: number
  /** Length in quarter notes, so 6/8 is three and 4/4 is four. */
  beats: number
}

/** The default every surface used to hardcode. Still the answer when a file says nothing. */
export const DEFAULT_TIME_SIGNATURE: MidiTimeSignature = {
  beat: 0,
  numerator: 4,
  denominator: 4,
}

/** Bars past this are a corrupt file, not a long song, and would hang the layout. */
export const MAX_BARS = 4096

/**
 * A bar's length in quarter notes.
 *
 * 6/8 is three quarters, not six: the numerator counts eighths. Getting this
 * wrong draws a bar twice as wide as the music in it.
 */
export function quarterBeatsPerBar(signature: MidiTimeSignature): number {
  if (!isWritable(signature)) return quarterBeatsPerBar(DEFAULT_TIME_SIGNATURE)
  return (signature.numerator * 4) / signature.denominator
}

/** A signature a bar could actually be written in. */
function isWritable(signature: MidiTimeSignature): boolean {
  const { numerator, denominator } = signature
  return (
    Number.isFinite(numerator) &&
    Number.isFinite(denominator) &&
    numerator > 0 &&
    denominator > 0
  )
}

/**
 * Signatures in force order, with anything unusable dropped and a bar-zero
 * signature guaranteed.
 *
 * A file may repeat the same signature on every bar (Guitar Pro does), may
 * write one part-way through, or may write none at all. All three have to end
 * up as a list that starts at beat zero and never goes backwards.
 */
export function normalizeTimeSignatures(
  signatures: readonly MidiTimeSignature[] | undefined,
): MidiTimeSignature[] {
  const usable = (signatures ?? [])
    .filter(
      (signature) =>
        Number.isFinite(signature.beat) &&
        signature.beat >= 0 &&
        isWritable(signature),
    )
    .sort((left, right) => left.beat - right.beat)

  const ordered: MidiTimeSignature[] = []
  for (const signature of usable) {
    const previous = ordered.at(-1)
    // Two signatures on one beat: the later one in the file wins, the way a
    // sequencer overwrites rather than stacks.
    if (previous !== undefined && previous.beat === signature.beat) {
      ordered[ordered.length - 1] = signature
      continue
    }
    // A repeat of what is already in force is not a change worth carrying.
    if (
      previous !== undefined &&
      previous.numerator === signature.numerator &&
      previous.denominator === signature.denominator
    ) {
      continue
    }
    ordered.push(signature)
  }

  if (ordered[0]?.beat !== 0) ordered.unshift(DEFAULT_TIME_SIGNATURE)
  return ordered
}

/**
 * Every bar covering `totalBeats`, honouring each signature from the beat it
 * takes effect.
 *
 * A signature landing mid-bar cuts that bar short rather than overlapping the
 * next one — which is what a written score does, and what makes a pickup bar
 * read correctly.
 */
export function buildBars(
  totalBeats: number,
  signatures: readonly MidiTimeSignature[] | undefined,
): MidiBar[] {
  const span = Number.isFinite(totalBeats) ? Math.max(0, totalBeats) : 0
  const ordered = normalizeTimeSignatures(signatures)
  if (span === 0) {
    return [{ index: 0, startBeat: 0, beats: quarterBeatsPerBar(ordered[0]) }]
  }

  const bars: MidiBar[] = []
  let beat = 0
  let next = 1
  let current = quarterBeatsPerBar(ordered[0])

  while (beat < span && bars.length < MAX_BARS) {
    while (next < ordered.length && ordered[next].beat <= beat) {
      current = quarterBeatsPerBar(ordered[next])
      next += 1
    }
    const boundary =
      next < ordered.length ? Math.min(ordered[next].beat, span) : span
    // Both terms are positive: `current` is filtered to be, and the inner loop
    // has already consumed every signature at or before `beat`, so the next one
    // is strictly ahead. The loop therefore always advances.
    const beats = Math.min(current, boundary - beat)
    bars.push({ index: bars.length, startBeat: beat, beats })
    beat += beats
  }

  return bars
}

/**
 * The index of the bar containing `beat`, clamped to the bars that exist.
 *
 * Binary search because a playhead asks this on every frame and a long score
 * has thousands of bars.
 */
export function barIndexAtBeat(bars: readonly MidiBar[], beat: number): number {
  if (bars.length === 0) return 0
  if (!Number.isFinite(beat) || beat <= 0) return 0
  let low = 0
  let high = bars.length - 1
  while (low < high) {
    const mid = (low + high + 1) >> 1
    if (bars[mid].startBeat <= beat) low = mid
    else high = mid - 1
  }
  return low
}
