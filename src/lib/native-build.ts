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
