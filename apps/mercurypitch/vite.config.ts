import { assertPurchaseBuildSafe } from '@irchiinnuss/purchase-kit'
import { resolve } from 'node:path'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import solid from 'vite-plugin-solid'
// @ts-expect-error -- the same kind of plain .mjs helper, shared with
// scripts/assert-bundle.mjs, which must stay dependency-free.
import { karaokeImportFor, portableConsoleFor, readEnvFiles, resolveApiBase, resolveUvrOrigin, } from './api-base.mjs'
// @ts-expect-error -- a plain .mjs helper with no types, on purpose: it runs
// under bare node for a one-off sync as well as inside this config.
import { NATIVE_PUBLIC_DIR, pitchEngineBytes, syncNativeAssets, } from './scripts/sync-native-assets.mjs'

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

/**
 * What this app calls itself, and where its two build switches live.
 *
 * The names are prefixed and must stay that way. Beside Cue's are
 * `VITE_BESIDE_CUE_*`; sharing one name would let one app's distribution
 * variable decide the other app's build, which is the failure the shared
 * policy exists to make impossible.
 */
const PURCHASE_POLICY = {
  appName: 'Mercury Pitch',
  distributionEnv: 'VITE_MERCURYPITCH_DISTRIBUTION',
  platformEnv: 'VITE_MERCURYPITCH_NATIVE_PLATFORM',
} as const

/**
 * The Karaoke room's Stage 2 (plan S8): the modules only a build that imports
 * songs uses. Every reference to them from the rest of the app is a plain
 * conditional on KARAOKE_IMPORT (src/lib/native-build.ts), which a store
 * build folds away; declared free of side effects here, a module nothing
 * uses is then dropped whole. Without this the import queue's module-level
 * signals, which read storage as they are made, would keep it in the store
 * build. `assert-bundle.mjs` STAGE 2 checks the result on every build, so a
 * module missing from this list is a red check rather than a quiet leak.
 */
const KARAOKE_STAGE_2 = [
  '/src/features/karaoke-room/KaraokeImport.tsx',
  '/src/features/karaoke-room/KaraokeLibraryImports.tsx',
  '/src/features/karaoke-room/karaoke-import-checks.ts',
  '/src/features/karaoke-room/karaoke-import-queue.ts',
  '/src/features/karaoke-room/karaoke-imported-songs.ts',
  '/src/features/karaoke-room/karaoke-songs.ts',
  '/apps/mercurypitch/src/shell/karaoke-subscription.ts',
  '/apps/mercurypitch/src/shell/settings/KaraokeSongsGroups.tsx',
  '/apps/mercurypitch/src/shell/settings/StorageImportedSongs.tsx',
  '/apps/mercurypitch/src/shell/settings/imported-songs-copy.ts',
]

function isKaraokeStage2(id: string): boolean {
  const path = id.replace(/\?.*$/u, '').replace(/\\/gu, '/')
  return KARAOKE_STAGE_2.some((module) => path.endsWith(module))
}

export default defineConfig(({ mode, command }) => {
  // Fail before producing a bundle, not after shipping one. The Cloud
  // subscription sells through RevenueCat wherever the build carries its
  // platform's key (src/infrastructure/purchases-setup.ts), so a store build
  // without that key, or with a Test Store one, stops here.
  //
  // process.env last: CI exports these directly and must win over a stray
  // .env.local on whoever's machine ran the build.
  if (command === 'build') {
    assertPurchaseBuildSafe(
      PURCHASE_POLICY,
      {
        ...loadEnv(mode, fileURLToPath(new URL('.', import.meta.url))),
        ...process.env,
      },
      (process.env.GITHUB_REF ?? '').startsWith('refs/tags/mp-v'),
    )
  }

  // Which db-worker the bundle talks to: the dev one unless the process says
  // MERCURYPITCH_API_TARGET=production on purpose (api-base.mjs says why).
  // Compiled in through `define` so the switch wins over the env files, and
  // printed on every build so a log answers the question without the binary.
  const env = readEnvFiles(
    fileURLToPath(new URL('.', import.meta.url)),
    mode,
  ) as Record<string, string>
  const api = resolveApiBase(env, process.env) as {
    base: string
    target: string
    source: string
  }
  // Stage 2 of the Karaoke room: where songs are separated, and whether the
  // room offers to import them at all. Both follow the same switch.
  const uvrOrigin = resolveUvrOrigin(api, process.env) as string
  const karaokeImport = karaokeImportFor(api) as boolean
  // The portable console and the Developer screen: what the env says (the
  // committed .env turns them on), and never in the store build.
  const portableConsole = portableConsoleFor(api, env) as boolean
  if (command === 'build') {
    console.log(
      `[mercurypitch] API base compiled in: ${api.base === '' ? '(none: a local-only build, sign-in is off)' : api.base} [${api.target}; ${api.source}]`,
    )
    console.log(
      `[mercurypitch] Karaoke import: ${karaokeImport ? 'on' : 'off'}; songs separated on ${uvrOrigin === '' ? '(no host: this build cannot separate)' : uvrOrigin}`,
    )
    console.log(
      `[mercurypitch] Portable console and Developer screen: ${portableConsole ? 'in (a test build)' : 'out'}`,
    )
  }

  return {
    // Generated, never authored: scripts/sync-native-assets.mjs wipes and
    // refills it from the repository's public/ tree on every build and every
    // dev server. Vite's default (`<root>/public`) would be a directory that
    // looks hand-maintained and is not.
    publicDir: NATIVE_PUBLIC_DIR,

    // NOT './'. Beside Cue uses a relative base, and that was reviewed and
    // rejected here (implementation plan §3.0, decision 8, 2026-09-10):
    // Capacitor serves `webDir` at the origin root on both platforms, so '/'
    // is correct and a relative base only buys ambiguity for the router.
    base: '/',

    plugins: [
      solid(),
      {
        // Fill the staged publicDir before anything is bundled: the wasm
        // runtime, the SwiftF0 model, and the manifest tier of public/
        // pictures (native-assets.mjs). This was an npm `prebuild` hook and
        // that was wrong: `pnpm exec vite build` -- how CI builds, to avoid
        // repeating tsc -- does not run lifecycle scripts, so the hook
        // silently did nothing and the bundle shipped without the assets it
        // is supposed to carry. A plugin runs for every build and every dev
        // server, however each was started.
        //
        // `configResolved`, NOT `buildStart`/`configureServer`. Measured
        // 2026-09-11: the dev server takes ONE snapshot of publicDir's file
        // names before any `configureServer` hook runs, and only serves a
        // path that is in it (`initPublicFiles`). Filling the directory from
        // that hook therefore produced a dev server that answered
        // /legends/mid/adele.webp with index.html -- the SPA fallback, 200,
        // 2 KB of HTML where a picture should be. `configResolved` runs at
        // the end of resolveConfig, which is before both the snapshot and the
        // build, so one hook covers `vite`, `vite build` and `vite preview`.
        //
        // Awaited: Vite awaits every configResolved hook before it goes on,
        // and the staging now starts by making sure the Karaoke room's
        // example stems are here and exactly the pinned files
        // (scripts/fetch-karaoke-examples.mjs), which may mean a download.
        name: 'mercurypitch:sync-native-assets',
        async configResolved() {
          await syncNativeAssets()
        },
      },
    ],

    resolve: {
      alias: {
        '@': ROOT_SRC,
      },
      // The root app, this shell and the workspace packages must agree on one
      // copy of Solid, or reactivity silently stops crossing the boundary.
      dedupe: ['solid-js'],
    },

    define: {
      // Vite replaces a bare `process` with nothing at all, so a dependency
      // that reads `process.env.NODE_ENV` at module scope throws on the phone
      // -- the same class of failure as an unreplaced `__SW_ENABLED__`, and
      // just as invisible until the module happens to be evaluated. The root
      // config has defined this since before the native app existed; parity
      // is the fix, and `src/define-parity.test.ts` is what keeps it.
      'process.env': {},

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
      // What the pitch engine adds to the app, for the Storage screen.
      __PITCH_ENGINE_BYTES__: JSON.stringify(pitchEngineBytes()),

      // The resolved worker, over whatever the env files said: this is how
      // the production switch outranks the dev default in `.env`.
      'import.meta.env.VITE_API_BASE_URL': JSON.stringify(api.base),
      // Same move for the console the committed `.env` turns on: a store
      // build compiles it out, and the Developer screen with it, whatever
      // the env files or the process said. Every gate reads it as a plain
      // `=== 'true'`, so the branch folds and the dynamic imports go with it.
      'import.meta.env.VITE_PORTABLE_CONSOLE': JSON.stringify(
        portableConsole ? 'true' : 'false',
      ),
      // The Karaoke room's own songs (plan S8, Stage 2): compiled in for a
      // test build and out of the store build, and the host that separates
      // them, which goes with the worker above (api-base.mjs).
      __KARAOKE_IMPORT__: JSON.stringify(karaokeImport),
      __UVR_ORIGIN__: JSON.stringify(uvrOrigin),
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
        treeshake: {
          // A Karaoke Stage 2 module that nothing uses is dropped whole, its
          // module-level state included (KARAOKE_STAGE_2, above).
          moduleSideEffects: (id) => !isKaraokeStage2(id),
        },
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
  }
})
