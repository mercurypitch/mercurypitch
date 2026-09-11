// ============================================================
// Which build am I in
// ============================================================
//
// The one place `__NATIVE_BUILD__` is read. Both Vite configs define it, so
// this constant-folds to a literal `true` or `false` before Rollup runs —
// which is the point: a branch guarded by it is dead code in one of the two
// builds and is eliminated outright, taking whatever it imports with it. A
// runtime flag would only hide the UI; this removes it from the bundle.
//
// Under vitest it is neither: `vitest.config.ts` has no `define` block, so the
// identifier survives and reading it bare would be a ReferenceError. The
// `typeof` guard is what makes the module safe to import from a test, and it
// is the same idiom `src/lib/defaults.ts` uses for `__COMMIT_SHA__`.

/** True only inside the `apps/mercurypitch` bundle. False on the web, and
 *  false under vitest — where a test that needs the other answer mocks
 *  `@/lib/native-build`. */
export const IS_NATIVE_BUILD: boolean =
  typeof __NATIVE_BUILD__ !== 'undefined' && __NATIVE_BUILD__

/**
 * Whether this build may offer a way to spend money — credit packs, the
 * supporter tiers, a donation link, or a button that only leads to one.
 *
 * Read this, not `IS_NATIVE_BUILD`, wherever the question is about money.
 * The two give the same answer today for different reasons, and only one of
 * them changes: when in-app purchase lands, credits become buyable inside
 * the store binary and exactly this constant flips. A call site that asked
 * "am I native?" would then have to be found and re-read one by one.
 *
 * A build that answers false must not merely hide the purchase: it must
 * not carry the link, the price, or the words either. App Store guideline
 * 3.1.1 and Play's billing policy are read against the binary.
 */
export const CAN_TAKE_PAYMENT: boolean = !IS_NATIVE_BUILD
