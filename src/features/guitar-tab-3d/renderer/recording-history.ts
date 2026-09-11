// Recording history gives measured notes a NOW boundary and a bounded, unscored trail.

/** The upper runway remains empty; this is where new evidence enters history. */
export const RECORDING_NOW_DEPTH = 0.22

export function recordingNoteDepth(
  beat: number,
  nowBeat: number,
  historyBeats: number,
): number {
  return (
    RECORDING_NOW_DEPTH * (1 + (beat - nowBeat) / Math.max(1, historyBeats))
  )
}
