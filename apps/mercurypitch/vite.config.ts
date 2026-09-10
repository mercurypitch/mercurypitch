import { resolve } from 'node:path'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import solid from 'vite-plugin-solid'

// The same resolution the root config does, for the same constant. `@`
// resolves to the root `src`, so the code reading __COMMIT_SHA__ is literally
// the web app's -- and a constant that one build defines and the other does
// not is not a missing feature, it is a ReferenceError on the phone.
let commitSha = 'unknown'
try {
  const { execSync } = await import('node:child_process')
  commitSha = execSync('git rev-parse --short HEAD', {
    stdio: ['ignore', 'pipe', 'ignore'],
  })
    .toString()
    .trim()
} catch {
  const envSha = [
    process.env.VITE_COMMIT_SHA,
    process.env.GITHUB_SHA,
    process.env.COMMIT_SHA,
  ].find((value): value is string => value !== undefined && value !== '')
  if (envSha !== undefined) commitSha = envSha.substring(0, 7)
}

// Mercury Pitch native — build config.
//
// This app owns almost no source. `@` resolves to the repository's own
// `src/`, so every screen, store and library the native shell renders is the
// SAME file the web app ships, not a copy. Owner answer 1 forbids
// copy-paste; this alias is how that is enforced rather than promised.
// Anything under `apps/mercurypitch/src/` is native-only wiring, and it
// should stay small enough to read in one sitting.
const ROOT_SRC = resolve(
  fileURLToPath(new URL('.', import.meta.url)),
  '../../src',
)

export default defineConfig(({ mode }) => ({
  // NOT './'. Beside Cue uses a relative base, and that was reviewed and
  // rejected here (implementation plan §3.0, decision 8, 2026-09-10):
  // Capacitor serves `webDir` at the origin root on both platforms, so '/'
  // is correct and a relative base only buys ambiguity for the router.
  base: '/',

  plugins: [solid()],

  resolve: {
    alias: {
      '@': ROOT_SRC,
    },
    // The root app, this shell and the workspace packages must agree on one
    // copy of Solid, or reactivity silently stops crossing the boundary.
    dedupe: ['solid-js'],
  },

  define: {
    // Every constant the ROOT config defines must be defined here too. `@`
    // aliases to that same source tree, so any module reachable from this
    // entry can read one; Vite replaces only what it is told about, and an
    // unreplaced `__SW_ENABLED__` is a bare identifier that throws the moment
    // its module is evaluated. `src/lib/pwa-service-worker.ts` really is in
    // this graph -- main.tsx never CALLS registerServiceWorker, but something
    // it imports imports the module, and a define is about the module being
    // evaluated, not the function being called.
    __COMMIT_SHA__: JSON.stringify(commitSha),
    // Always false. The store is this app's update channel; a service worker
    // inside a signed binary would be a second one, serving code review never
    // saw. `registerServiceWorker` is not called from main.tsx either -- this
    // is the belt to that brace.
    __SW_ENABLED__: JSON.stringify(false),

    // The native build is a distinct target from the web build, and code
    // that must not run inside a WebView keys off this rather than
    // sniffing the user agent.
    __NATIVE_BUILD__: JSON.stringify(true),
    __APP_CHANNEL__: JSON.stringify(
      (process.env.GITHUB_REF ?? '').startsWith('refs/tags/')
        ? 'release'
        : mode === 'production'
          ? 'ci'
          : 'dev',
    ),
  },

  build: {
    target: 'es2022',
    rollupOptions: {
      // Exactly one HTML document. The web build emits an entry page per SEO
      // route; none of them belong in a bundle that ships inside an app, and
      // a second document is also a second AudioContext waiting to happen.
      input: resolve(
        fileURLToPath(new URL('.', import.meta.url)),
        'index.html',
      ),
    },
  },

  // The pitch stream's detector worker imports the detector, which Rollup
  // splits into its own chunk — and Vite's default `iife` worker format
  // cannot express a code-split build. `audioWorklet.addModule` loads its
  // file as a module regardless, so ES is the only format serving both.
  // Every WebView above our minimum handles module workers.
  worker: {
    format: 'es',
  },

  optimizeDeps: {
    // Same reason as the root app: onnxruntime-web is reached only from the
    // detector worker, the first time a microphone starts. If Vite discovers
    // it late it re-bundles and RELOADS the page — so the tap that starts
    // the mic would be answered by a fresh document, with no error shown.
    exclude: ['onnxruntime-web'],
  },
}))
