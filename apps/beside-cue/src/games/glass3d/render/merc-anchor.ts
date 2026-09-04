// Where the body goes so his feet do not move.
// ============================================================
//
// Pure, so it can be tested without a glb. `merc.ts` measures the
// asset and hands the numbers here; this only does the arithmetic --
// and the arithmetic earned its own file by shipping backwards once.
// The first version held his TOP still: a stretched Merc sank 39 cm
// and a squashed one rose 39 cm, and a check at heightScale 1 (where
// the offset is zero whichever sign it has) said it was fine. maff
// found it on a phone, 2026-09-04.

/** What `createMerc` measures once, at load. */
export interface MercAnchor {
  /** `bounds.min.y` of the raw asset: how far below its own origin the
   * lowest vertex sits, in asset units. Negative. */
  readonly rawMinY: number
  /** `bounds` height of the raw asset, in asset units. */
  readonly rawHeight: number
  /** The height `createMerc` was asked for, in metres. */
  readonly restHeight: number
}

/** How far below the root origin his lowest point hangs at rest. */
export const feetBelowRoot = (a: MercAnchor): number =>
  (-a.rawMinY / a.rawHeight) * a.restHeight

/**
 * The body node's `position.y`, for a given height scale.
 *
 * The root origin is his vertical centre, so scaling the body about it
 * moves the feet by half the change in height. This puts them back:
 * whatever the scale, his lowest point is `feetBelowRoot` under the
 * root, which is exactly where the rest shape left it.
 */
export const bodyLiftFor = (a: MercAnchor, heightScale: number): number =>
  feetBelowRoot(a) * (heightScale - 1)

/** Where his lowest point ends up, relative to the root, after the lift.
 * Constant by construction; the test says so. */
export const feetAfterLift = (a: MercAnchor, heightScale: number): number =>
  bodyLiftFor(a, heightScale) +
  (a.rawMinY / a.rawHeight) * a.restHeight * heightScale
