// ============================================================
// Studio double tap — two taps on one target, close in time and place, made by hand because a touch screen's dblclick cannot be counted on
// ============================================================
//
// Browsers send dblclick for two taps only sometimes: never where the page
// turned off double-tap zoom, never on some tablets, and with a delay on
// others. A MIDI clip opens its notes on a double tap, so the timeline
// counts taps itself: a second tap on the same target within 300 ms and
// 24 px of the first is a double tap. A third tap starts again, so three
// quick taps open once.

/** The longest gap between the taps of a double tap, in milliseconds. */
export const STUDIO_DOUBLE_TAP_MS = 300
/** The farthest a second tap may land from the first, in CSS pixels. */
export const STUDIO_DOUBLE_TAP_PX = 24

/** A tap: what it landed on, where, and when (an event's timeStamp). */
export interface StudioTap {
  readonly target: string
  readonly x: number
  readonly y: number
  readonly time: number
}

export function createStudioDoubleTap() {
  let last: StudioTap | null = null
  return {
    /** Count a tap; true when it is the second of a double tap. */
    tap(next: StudioTap): boolean {
      const previous = last
      const second =
        previous !== null &&
        previous.target === next.target &&
        next.time - previous.time >= 0 &&
        next.time - previous.time <= STUDIO_DOUBLE_TAP_MS &&
        Math.hypot(next.x - previous.x, next.y - previous.y) <=
          STUDIO_DOUBLE_TAP_PX
      last = second ? null : next
      return second
    },
    /** Forget the last tap: a drag or a press elsewhere came between. */
    reset(): void {
      last = null
    },
  }
}

export type StudioDoubleTap = ReturnType<typeof createStudioDoubleTap>
