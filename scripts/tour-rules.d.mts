// Types for tour-rules.mjs, which src/e2e/coach-tours.spec.ts imports.

/** The share of the window's height a ringed target may take. */
export declare const TARGET_MAX_SHARE: number

/** Whether a target is small enough to ring: at most 70% of the window's height. */
export declare function targetFits(
  rect: { height: number },
  viewport: { height: number },
): boolean

/** Whether every hit-test of the consent bar's buttons landed inside the bar. */
export declare function barOnTop(hits: readonly boolean[]): boolean

/** Runs in the page: hit-tests a stand-in consent bar's buttons, one answer each. */
export declare function probeConsentBar(): boolean[]
