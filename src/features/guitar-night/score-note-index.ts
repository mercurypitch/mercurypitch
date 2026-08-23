// ============================================================
// Guitar Night score-note index — stable logarithmic lookups over authored starts.
// ============================================================
//
// A moving score playhead is sampled every animation frame. Sorting the whole
// score in that path makes long Guitar Pro files pay import-time work again and
// again, so the room builds this index only when its reference changes.

export interface ScoreNoteStartSource {
  startBeat: number
}

/** Copy finite authored starts into ascending order once per score reference. */
export function buildScoreNoteStartIndex(
  notes: readonly ScoreNoteStartSource[],
): readonly number[] {
  const starts: number[] = []
  for (const note of notes) {
    if (Number.isFinite(note.startBeat)) starts.push(note.startBeat)
  }
  starts.sort((left, right) => left - right)
  return starts
}

/** First index whose authored start is at or after `beat`. */
export function lowerBoundScoreNoteStart(
  sortedStarts: readonly number[],
  beat: number,
): number {
  let lower = 0
  let upper = sortedStarts.length
  while (lower < upper) {
    const middle = lower + Math.floor((upper - lower) / 2)
    const candidate = sortedStarts[middle]
    if (candidate !== undefined && candidate < beat) lower = middle + 1
    else upper = middle
  }
  return lower
}

/** Next authored onset at or after the playhead, if the score has one. */
export function nextScoreNoteStart(
  sortedStarts: readonly number[],
  beat: number,
): number | undefined {
  return sortedStarts[lowerBoundScoreNoteStart(sortedStarts, beat)]
}
