// Scheduled beat windows let accompaniment borrow a host's musical clock without owning its transport.
export interface SessionBeatWindow {
  readonly kind: 'beat'
  readonly startBeat: number
  readonly endBeat: number
  readonly iteration: number
  /** Exact AudioContext time, including the host's tempo map and loop offset. */
  timeAtBeat(beat: number): number
}

export type SessionBeatEvent = SessionBeatWindow | { readonly kind: 'stop' }
export type SubscribeSessionBeat = (
  listener: (event: SessionBeatEvent) => void,
) => () => void
