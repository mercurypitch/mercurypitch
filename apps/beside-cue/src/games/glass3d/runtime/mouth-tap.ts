// A tap when a mouth opens (P5, the Sorting Line).
// ============================================================
//
// A gate's mouth opens and shuts with the voice, and a voice wavers: a
// note held near the edge of a band can open and close a mouth several
// times a second. A tap for every opening would buzz like a fault, and
// a haptic that reads as a fault teaches the player nothing. So an
// opening is felt only after the mouth has been shut for a moment --
// long enough to be a closing the player made, not one the voice let
// slip.
//
// The first thing it is told is only noted, never felt: a mouth that is
// already open when a gate comes into play did not just open.

/** How long a mouth must have been shut for its next opening to be felt. */
export const MOUTH_QUIET_SECONDS = 0.25

/** `true` when this opening should be felt. Feed it every step, with
 * the mouth as it stands and the wall time. */
export type MouthTap = (open: boolean, nowSeconds: number) => boolean

export const createMouthTap = (
  quietSeconds = MOUTH_QUIET_SECONDS,
): MouthTap => {
  let known = false
  let open = false
  let shutAt = Number.NEGATIVE_INFINITY
  return (isOpen, now) => {
    if (!known) {
      known = true
      open = isOpen
      if (!isOpen) shutAt = now
      return false
    }
    if (isOpen === open) return false
    open = isOpen
    if (!isOpen) {
      shutAt = now
      return false
    }
    return now - shutAt >= quietSeconds
  }
}
