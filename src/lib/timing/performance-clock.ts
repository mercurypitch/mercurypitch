// ============================================================
// Performance clock to audio clock — where an input event's timestamp falls on an AudioContext's clock
// ============================================================
//
// A MIDI message and a key press carry a DOMHighResTimeStamp on the page's
// performance timeline; a sound is started on an AudioContext's clock. Read
// both clocks at one moment and an event's time maps across by the offset
// between them: an event 12 ms before that moment is 12 ms before the
// context time read then. Guitar's MIDI notes, Drum Night's hits and the
// Studio's MIDI lanes all place events this way.

/**
 * The audio clock time, in seconds, of `eventMs` on the performance clock,
 * from one moment read on both: `observedPerformanceMs` (performance.now())
 * and `observedAudioSeconds` (the context's currentTime).
 */
export function performanceToAudioSeconds(
  eventMs: number,
  observedPerformanceMs: number,
  observedAudioSeconds: number,
): number {
  return observedAudioSeconds + (eventMs - observedPerformanceMs) / 1000
}
