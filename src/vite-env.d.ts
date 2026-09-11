/// <reference types="vite/client" />
declare const __COMMIT_SHA__: string
/**
 * True for any `vite build`, false under `vite dev` — where dist/sw.js does not
 * exist and registering it would only log a failure. Not `import.meta.env.PROD`
 * on purpose: `build:dev` builds in development mode and still ships a worker.
 */
declare const __SW_ENABLED__: boolean

/**
 * True only in the `apps/mercurypitch` bundle, false in the web build.
 *
 * UNDEFINED under vitest: the root `vitest.config.ts` has no `define` block,
 * so nothing replaces the identifier and reading it bare is a ReferenceError.
 * That is why no module reads this directly — `src/lib/native-build.ts` wraps
 * it in the `typeof` guard and everything imports `IS_NATIVE_BUILD` instead.
 *
 * Declared here rather than in the app, because both Vite configs now define
 * it and the root `src/` tree both of them compile is where it is read.
 */
declare const __NATIVE_BUILD__: boolean
