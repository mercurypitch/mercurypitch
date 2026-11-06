// ============================================================
// Sender clock — a sender's wall clock carried onto the receiver's
// ============================================================
//
// A stage frame says where the song was and when, by the sender's
// `Date.now()` (src/lib/tv-stage/protocol.ts), and between frames the
// stage runs the song on from that moment by its own clock (model.ts). On
// the iPhone's second screen both ends read one clock. A Cast receiver is
// another device, and its clock can be seconds off the phone's: drawn as
// sent, the song would run seconds ahead or behind.
//
// So each frame's moment is moved onto the receiver's clock first. A frame
// arrives at `at + skew + transit`. Over the last few seconds of frames,
// the smallest `arrival - at` is the skew plus the quickest transit, which
// is the closest either can get to the skew alone: the lane runs that
// quickest transit behind the phone, a few ms, and does not jitter with the
// slower ones. Readings older than the window roll out, so a sender whose
// clock is set back is followed once its old readings have gone.
//
// Tests: src/lib/cast-receiver/sender-clock.test.ts.

/** How long a reading of the skew counts, in ms. */
export const SENDER_CLOCK_WINDOW_MS = 5_000

export interface SenderClock {
  /**
   * The moment `senderAt` on the receiver's clock, from a message that
   * arrived at `arrivedAt` there.
   */
  toLocal(senderAt: number, arrivedAt: number): number
  /** Forgets every reading: a new sender, or none. */
  reset(): void
}

export function createSenderClock(
  windowMs: number = SENDER_CLOCK_WINDOW_MS,
): SenderClock {
  let readings: { arrivedAt: number; offset: number }[] = []
  return {
    toLocal(senderAt, arrivedAt) {
      readings = readings.filter(
        (reading) => arrivedAt - reading.arrivedAt <= windowMs,
      )
      readings.push({ arrivedAt, offset: arrivedAt - senderAt })
      const offset = Math.min(...readings.map((reading) => reading.offset))
      return senderAt + offset
    },
    reset() {
      readings = []
    },
  }
}
