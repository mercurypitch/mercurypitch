/// <reference types="vite/client" />

// Native-only build constants, replaced by `define` in vite.config.ts.
//
// The two the web app also has -- __COMMIT_SHA__ and __SW_ENABLED__ -- are
// declared once in `src/vite-env.d.ts` at the repository root, and this
// package's tsconfig includes that file rather than restating them. One
// declaration per constant, wherever it is defined.

/**
 * True in this bundle and nowhere else. Code that must not run inside a
 * WebView keys off this rather than sniffing the user agent.
 *
 * NOTE: the moment anything under the root `src/` reads it, this declaration
 * has to move to `src/vite-env.d.ts` and the ROOT vite config has to define
 * it as `false` -- otherwise the web build gets a bare identifier that throws.
 * Declared here for now because only this build defines it.
 */
declare const __NATIVE_BUILD__: boolean

/** Which build produced this bundle: 'dev', 'ci' or 'release'. Same caveat. */
declare const __APP_CHANNEL__: 'dev' | 'ci' | 'release'
