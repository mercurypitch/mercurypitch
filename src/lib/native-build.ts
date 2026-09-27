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

// Declared here as well as in src/vite-env.d.ts: the db worker type-checks
// this module through the background catalogue (workers/db-worker perks.ts),
// and its program has no Vite globals. Ambient, so it emits nothing.
declare const __NATIVE_BUILD__: boolean | undefined
declare const __KARAOKE_IMPORT__: boolean | undefined
declare const __UVR_ORIGIN__: string | undefined

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

/**
 * Whether the Karaoke room offers to import a singer's own songs, which the
 * server separates (plan S8, Stage 2). On in a native test build, TestFlight
 * among them; off in the store build until the subscription is real; never
 * on the web, which has its own upload. Compiled in or out like
 * `IS_NATIVE_BUILD`, so the store build carries none of it
 * (apps/mercurypitch/api-base.mjs decides, from the worker switch).
 */
export const KARAOKE_IMPORT: boolean =
  IS_NATIVE_BUILD &&
  typeof __KARAOKE_IMPORT__ !== 'undefined' &&
  __KARAOKE_IMPORT__

/**
 * The origin `/api/uvr/*` is asked on. Empty on the web, whose page is on
 * the worker that serves it. A native page is on capacitor://localhost, so
 * a native build names the web host that goes with its db-worker.
 */
export const UVR_ORIGIN: string =
  IS_NATIVE_BUILD && typeof __UVR_ORIGIN__ === 'string' ? __UVR_ORIGIN__ : ''
