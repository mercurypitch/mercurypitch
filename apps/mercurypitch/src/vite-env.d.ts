/// <reference types="vite/client" />

// Native-only build constants, replaced by `define` in vite.config.ts.
//
// The three the web app also has -- __COMMIT_SHA__, __SW_ENABLED__ and
// __NATIVE_BUILD__ -- are declared once in `src/vite-env.d.ts` at the
// repository root, and this package's tsconfig includes that file rather than
// restating them. One declaration per constant, wherever it is defined.

/** Which build produced this bundle: 'dev', 'ci' or 'release'.
 *
 * NOTE: the moment anything under the root `src/` reads it, this declaration
 * has to move to `src/vite-env.d.ts` and the ROOT vite config has to define a
 * value for it -- otherwise the web build gets a bare identifier that throws.
 * __NATIVE_BUILD__ has already made exactly that move; this one is declared
 * here for now because only this build defines it.
 */
declare const __APP_CHANNEL__: 'dev' | 'ci' | 'release'

// Build-time configuration this shell reads. Declared rather than left to
// Vite's `[key: string]: any` index signature, so a typo in the name is a
// compile error here instead of an empty string on a phone.
//
// Both are documented in .env.example and are empty until the owner creates
// the OAuth clients (checklist M-D1, M-D2). Empty is a supported state: the
// key is omitted at initialize and the provider reports itself unavailable.
interface ImportMetaEnv {
  /** iOS OAuth client id — the Google SDK's own audience on that platform. */
  readonly VITE_GOOGLE_IOS_CLIENT_ID?: string
  /** Web OAuth client id — Android's Credential Manager, and the audience
   *  the db-worker verifies every Google token against. */
  readonly VITE_GOOGLE_WEB_CLIENT_ID?: string
}
