// ============================================================
// Metronome arm — its swing as the beats go by
// ============================================================
//
// The small metronome beside a beat row swings on the run's own beats, so
// a change of tempo bends no swing: it reaches a side on every beat, left
// and right in turn, and crosses the middle halfway between (the stats
// site's metronomeAngle). Pure, and on its own, so a page that swings one
// (Lesson 17's hero) loads nothing else of the beat machine's.

/** The arm's angle, degrees, `beats` beats after its first: −24° × cos(π beats). */
export function angleAtBeats(beats: number): number {
  const a = -24 * Math.cos(Math.PI * beats)
  // a tidy zero at the middle, never −0 or 1e-15
  return Math.abs(a) < 1e-9 ? 0 : a
}
