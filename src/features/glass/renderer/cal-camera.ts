// ============================================================
// CalCamera — dead-zone view centering for calibrate mode.
//
// The old approach kept a rolling average of the sung pitch and
// drew the ribbon RELATIVE to it (center = center*0.97 + off*0.03
// every ~30 ms update). That average converges on whatever is
// being sung with a ~1 s time constant — so after gliding up to a
// note and HOLDING it, the view center caught up and the dot
// visibly sank back to the middle even though the pitch never
// moved ("the tracker goes down no matter what I do").
//
// This is the classic camera-follow fix instead: a dead zone.
// While the pitch stays inside the middle band of the view the
// camera is FROZEN — a held note holds perfectly still. Only when
// the pitch pushes past the band edge (a real glide) does the
// camera pan, smoothly, just enough to keep the dot at the edge.
// ============================================================

/** Fraction of the half-view height that never pans the camera. */
const DEAD_ZONE = 0.5
/** Per-update catch-up rate once outside the dead zone (~30 Hz updates). */
const PAN_RATE = 0.22

export class CalCamera {
  private center: number | null = null

  reset(): void {
    this.center = null
  }

  /**
   * Track one voiced sample (absolute cents) and return the view center.
   * `viewCents` is the half-range of the visible window in cents.
   */
  track(offCents: number, viewCents: number): number {
    if (this.center === null) {
      this.center = offCents
      return this.center
    }
    const zone = viewCents * DEAD_ZONE
    const delta = offCents - this.center
    if (Math.abs(delta) > zone) {
      // Pan toward the point that puts the sample back on the zone edge.
      const overshoot = delta - Math.sign(delta) * zone
      this.center += overshoot * PAN_RATE
    }
    return this.center
  }
}
