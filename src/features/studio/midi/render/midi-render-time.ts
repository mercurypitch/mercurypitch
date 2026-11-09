// ============================================================
// Studio MIDI render time — ticks to seconds at a sequence's own tempo, until the song model's time module replaces this file
// ============================================================
//
// A sequence keeps the tempo its ticks were laid on, so tick t is always
// t x 60 / (ppq x tempoBpm) seconds after tick 0, whatever the song's tempo
// is now. The song model is getting a time module of its own
// (src/lib/studio/midi/time.ts) that will hold every tick and frame
// conversion; when it lands, the renderer imports this conversion from
// there and this file goes.

/** Seconds from tick 0 to tick `ticks`, at `ppq` ticks a beat and `tempoBpm` beats a minute. */
export function ticksToSeconds(
  ticks: number,
  ppq: number,
  tempoBpm: number,
): number {
  return (ticks * 60) / (ppq * tempoBpm)
}
