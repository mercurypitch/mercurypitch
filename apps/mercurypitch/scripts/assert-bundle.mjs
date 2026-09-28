// The properties a Mercury Pitch store binary has to have, asserted in one
// place so both CI paths assert the same ones.
//
//   node scripts/assert-bundle.mjs <distDir> [--android-assets <dir>]
//
// Three checks, and each of them is a bug that already happened:
//
//   PRESENT  The wasm runtime and the SwiftF0 model are in the bundle.
//            scripts/sync-ort-assets.mjs vendors them; when it was an npm
//            `prebuild` hook, `pnpm exec vite build` -- how CI builds -- never
//            ran it and the bundle shipped with neither.
//
//   USED     Something in dist/assets actually names `/ort/`. This is the
//            check the old shell version did not have, and the reason it is
//            here: the app vendored the files and then did not use them.
//            `configurePitchEngineAssets` configured a package nothing in the
//            running graph imports, so the engine resolved its wasm base from
//            VITE_ONNX_WASM_BASE_URL (apps/mercurypitch/.env) and, unset, fell
//            back to a CDN on the first tap that starts the microphone -- the
//            one moment an offline-first app must not need a network. Both CI
//            jobs were green on that build.
//
//   MANIFEST Every entry in ../native-assets.mjs resolved to at least one
//            file in the bundle, and every file it resolved to in the web
//            app's public/ tree arrived. The native dist is index.html +
//            assets/ + models/ + ort/ by design, and the pictures the V1-1
//            surfaces reference by absolute URL live in public/ -- so the
//            first TestFlight build (mp-v0.1.0) came up with no twin
//            portrait, no character art and no room covers, and nothing
//            anywhere said so. A glob that matches nothing is the shape that
//            failure takes now, and it is a red check rather than a blank
//            screen on a phone.
//
//   EXAMPLES The Karaoke room's example songs arrived whole: the manifest the
//            room seeds its library from is in the bundle, and every stem it
//            names is there with the size and sha256 it was pinned at
//            (fetch-karaoke-examples.mjs). They are what a first launch with
//            no network sings, so a missing or truncated stem is a room that
//            opens on a song it cannot play -- and on the phone, a packaged
//            file that is not there answers status 0 with no body, which
//            looks like silence rather than an error.
//
//   WORKER   The built JS names exactly the db-worker this build asked for
//            (../api-base.mjs): the dev one unless MERCURYPITCH_API_TARGET=
//            production was set on purpose, and never the other one. The
//            native bundle used to compile VITE_API_BASE_URL in as undefined,
//            so every sign-in on a phone failed with "not configured" and
//            nothing in CI noticed; a test build carrying the production
//            worker would be the same silence the other way round.
//
//   UNSOLD   No built file offers a way to pay. The web app sells credit
//            packs through Stripe and links out to Ko-fi and Sponsors, and
//            `@` aliases to that same source tree; App Store guideline 3.1.1
//            and Play's billing policy each reject a binary carrying any of
//            it. The guard is a build constant (src/lib/native-build.ts) and
//            this is what proves the constant did its job in the bundle
//            rather than only in the UI.
//
//            One literal was not enough. `ko-fi.com` alone passed a bundle
//            whose Settings -> About still read "Buy credit packs (€5 / €10 /
//            €20 / €40) through Stripe's secure checkout" -- the changelog
//            is imported as raw markdown, so the prose describing the panels
//            outlived the guard on the panels. A check that names one string
//            asserts one string, not the property in its header.
//
//   NATIVE   The web Settings panel is not in the binary. The native app has
//            its own Settings, pushed by the shell; the web panel it used to
//            push instead carried links out to web-only pages, install hints
//            for a browser, a directory badge and an admin link (S6 audit,
//            D3 to D8). The panel is folded out behind IS_NATIVE_BUILD in
//            two places, and one static import anywhere would bring every
//            line of it back without a visible change on the web.
//
//   STAGE 2  The Karaoke room imports a singer's own songs in exactly the
//            builds the owner chose (27 Sep): every build that is not the
//            store build. The switch is a build constant (KARAOKE_IMPORT,
//            src/lib/native-build.ts) that api-base.mjs's karaokeImportFor
//            decides from the same target as the worker, so a store build
//            must carry none of the import, its queue, its paywall, the
//            store SDK it buys through, or its Settings rows -- absent, not
//            hidden -- and every other build must carry all of them.
//
// Every check runs against every bundle root it is given, `--android-assets`
// included. Those are the bytes that reach the APK, `cap sync` copies webDir
// wholesale, and a sync that did not overwrite the previous build leaves a
// tree that is stale rather than absent -- which the PRESENT checks alone
// cannot tell apart from a good one.
//
// It needs only Node and `vite` (through ../api-base.mjs, which reads the env
// files with Vite's own loader): every job that runs it -- the PR gate and
// the reusable Capacitor workflow, which knows nothing about this app -- has
// installed the workspace first.

import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { API_BASES, karaokeImportFor, readEnvFiles, resolveApiBase, } from '../api-base.mjs'
import { resolveNativeAssets, resolveNativeAssetSources, totalBytes, } from '../native-assets.mjs'
import { KARAOKE_EXAMPLE_PINS, NATIVE_ONLY_DIR, } from './fetch-karaoke-examples.mjs'

/** The examples manifest, relative to a bundle root. */
const EXAMPLES_MANIFEST = 'karaoke/examples/manifest.json'

/** The files sync-ort-assets.mjs vendors, relative to a bundle root. */
const VENDORED = [
  'ort/ort-wasm-simd-threaded.mjs',
  'ort/ort-wasm-simd-threaded.wasm',
  'models/swiftf0.onnx',
]

/**
 * The web app's public/ tree: where the manifest tier is copied FROM.
 *
 * Resolved from this file rather than the working directory, because the
 * reusable Capacitor workflow calls this script from the repository root and
 * the PR gate calls it from wherever it happens to be.
 */
const WEB_PUBLIC = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../public',
)

/** This app's own directory, where the env files the build read live. */
const APP_DIR = join(dirname(fileURLToPath(import.meta.url)), '..')

/** Must appear in the bundle: the wasm base the engine really reads. */
const WASM_BASE = '/ort/'

/**
 * Must NOT appear in the bundle, each with what it is when it does.
 *
 * `Stripe` is capitalised on purpose: the brand in prose is the thing that
 * sells, while a lowercase `stripe` is as likely to be a CSS comment about a
 * progress bar. `stripe.com` catches every host -- checkout, buy links, the
 * SDK -- whatever case they are written in.
 */
const FORBIDDEN = [
  ['ko-fi.com', 'the Ko-fi donation link-out that DonatePanel renders'],
  ['github.com/sponsors', 'the GitHub Sponsors link-out from the same panel'],
  ['stripe.com', 'a Stripe host: checkout, a buy link, or their SDK'],
  ['Stripe', 'Stripe named in prose, which is how the changelog sold packs'],
  ['credit packs', 'the credit-pack copy'],
]

/**
 * Present in the web SettingsPanel and nowhere else the native bundle has any
 * business reaching. Each is what the panel is, when it shows up.
 */
const WEB_SETTINGS = [
  ['peerpush.com', 'the web Settings panel (SettingsPanel, its About badge)'],
]

/**
 * Present in the web sign-in dialog and nowhere else. The phone signs in
 * through its own sheet (apps/mercurypitch/src/shell/settings/SignInSheet),
 * which has no television row (audit D2).
 */
const WEB_SIGN_IN = [
  [
    'Sign in with your phone',
    'the web sign-in dialog (AuthModal, its television phone row)',
  ],
]

/**
 * Present in a build that imports songs, and in no other: each is a piece of
 * Stage 2 a store build must not carry.
 */
const KARAOKE_STAGE_2 = [
  ['Import a song', "the Karaoke room's Import button"],
  ['Sing your own songs', 'the Karaoke paywall'],
  ['karaoke-room-imports', 'the import queue'],
  ['Remove imported songs', 'Settings and Storage for imported songs'],
  ['Songs this month', 'the songs left, in the room and in Settings'],
  ['RevenueCatUI', "the store's paywall and subscription pages (RevenueCat)"],
]

const failures = []

/** One line per check, whichever way it went. */
function record(ok, label, fix) {
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${label}`)
  if (!ok) failures.push(`${label}\n        ${fix}`)
}

/** Every file under `dir`, recursively. Missing directory means no files. */
function walk(dir) {
  if (!existsSync(dir)) return []
  const out = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...walk(full))
    else out.push(full)
  }
  return out
}

/**
 * Read as bytes, not text. dist/assets holds fonts and images alongside the
 * chunks, and decoding those as UTF-8 would be wasted work at best.
 */
function contains(file, needle) {
  return readFileSync(file).includes(needle)
}

function main(argv) {
  const args = argv.slice(2)
  let distDir
  let androidAssetsDir

  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === '--android-assets') {
      androidAssetsDir = args[i + 1]
      i += 1
    } else if (distDir === undefined) {
      distDir = args[i]
    } else {
      console.error(`assert-bundle: unexpected argument ${args[i]}`)
      return 1
    }
  }

  if (
    distDir === undefined ||
    (androidAssetsDir !== undefined && androidAssetsDir === '')
  ) {
    console.error(
      'usage: node scripts/assert-bundle.mjs <distDir> [--android-assets <dir>]',
    )
    return 1
  }

  console.log(`assert-bundle: ${distDir}`)

  // WORKER -- what this build ASKED for, resolved the way vite.config.ts
  // resolved it: the same env files for mode production, the same process.
  let api
  try {
    api = resolveApiBase(readEnvFiles(APP_DIR, 'production'), process.env)
    console.log(
      `      API base requested: ${api.base === '' ? '(none)' : api.base} [${api.target}; ${api.source}]`,
    )
  } catch (error) {
    record(
      false,
      'the requested API base resolves',
      error instanceof Error ? error.message : String(error),
    )
  }

  // Every root gets every check. The Android copy is what `cap sync` left
  // behind, and a sync that did not overwrite the previous build leaves the
  // last bundle sitting there -- present, complete, and wrong.
  const roots = [
    ['dist', distDir],
    ...(androidAssetsDir === undefined
      ? []
      : [['android assets', androidAssetsDir]]),
  ]

  for (const [label, root] of roots) {
    const synced = label !== 'dist'

    // PRESENT -- a file missing from only the Android copy means cap sync
    // did not copy it, which is a different fix from the build not
    // producing it.
    for (const file of VENDORED) {
      record(
        existsSync(join(root, file)),
        `${label}: ${file} is present`,
        `Run scripts/sync-ort-assets.mjs (the vite.config.ts plugin runs it for every build) and rebuild${synced ? ', then cap sync' : ''}.`,
      )
    }

    const assets = walk(join(root, 'assets'))
    record(
      assets.length > 0,
      `${label}: ${join(root, 'assets')} holds built files`,
      `${synced ? 'cap sync copied no bundle here' : 'The build produced no assets directory'}. Nothing below this line means anything until it does.`,
    )

    // USED
    record(
      assets.some((file) => contains(file, WASM_BASE)),
      `${label}: a built chunk names ${WASM_BASE}`,
      `No chunk references ${WASM_BASE}, so the engine will resolve its wasm base to the CDN fallback at runtime. Check that VITE_ONNX_WASM_BASE_URL is set in apps/mercurypitch/.env and that the build read it.`,
    )

    // MANIFEST -- resolve the same globs against this bundle root that
    // sync-native-assets.mjs resolved against public/ and native-only/ on the
    // way in. An entry that matched four files there and none here is a
    // publicDir that was not copied; an entry that matches nothing in either
    // is a rename, and the staging step has already refused to build.
    const staged = resolveNativeAssetSources({
      public: WEB_PUBLIC,
      native: NATIVE_ONLY_DIR,
    })
    const bundled = resolveNativeAssets(root)

    for (const entry of bundled.entries) {
      record(
        entry.files.length > 0,
        `${label}: ${entry.glob} resolves (${entry.files.length} file${entry.files.length === 1 ? '' : 's'})`,
        `Nothing in ${root} matches this manifest entry. ${entry.reason} ${
          synced
            ? 'cap sync did not copy the publicDir, or this is a stale bundle.'
            : 'Check that vite.config.ts still points publicDir at the staged directory scripts/sync-native-assets.mjs fills.'
        }`,
      )
    }

    // Every file the manifest resolves to in its source trees has to be here
    // too. The per-entry check above passes on a partial copy; this one does
    // not.
    const absent = staged.files
      .map((file) => file.path)
      .filter((file) => !existsSync(join(root, file)))
    record(
      staged.files.length > 0 && absent.length === 0,
      `${label}: all ${staged.files.length} manifest files were copied`,
      staged.files.length === 0
        ? `The manifest resolved to no files at all under ${WEB_PUBLIC} or ${NATIVE_ONLY_DIR}. Either a source tree is missing from this checkout or every glob in native-assets.mjs is stale.`
        : `Missing here: ${absent.slice(0, 8).join(', ')}${absent.length > 8 ? ` (+${absent.length - 8} more)` : ''}. Rebuild${synced ? ', then cap sync' : ''}.`,
    )

    // EXAMPLES -- the songs a first launch with no network sings.
    const examplesFile = join(root, EXAMPLES_MANIFEST)
    /** @type {string[]} */
    let named = []
    try {
      const examples = JSON.parse(readFileSync(examplesFile, 'utf8'))
      named = examples.songs.flatMap((song) => [
        song.stems.vocal,
        song.stems.instrumental,
      ])
    } catch (error) {
      named = []
      record(
        false,
        `${label}: ${EXAMPLES_MANIFEST} is readable`,
        `${error instanceof Error ? error.message : String(error)}. The Karaoke room seeds its example songs from this file.`,
      )
    }
    const wrong = named.flatMap((url) => {
      const path = String(url).replace(/^\//u, '')
      const pin = KARAOKE_EXAMPLE_PINS.find(
        (candidate) => candidate.path === path,
      )
      const file = join(root, path)
      if (pin === undefined) return [`${path} (no pin)`]
      if (!existsSync(file)) return [`${path} (missing)`]
      const bytes = readFileSync(file)
      const hash = createHash('sha256').update(bytes).digest('hex')
      return bytes.byteLength === pin.bytes && hash === pin.sha256
        ? []
        : [`${path} (${bytes.byteLength} bytes, sha256 ${hash.slice(0, 12)})`]
    })
    record(
      named.length > 0 && wrong.length === 0,
      `${label}: the ${named.length} example stems the Karaoke room names are here, as pinned`,
      named.length === 0
        ? `${EXAMPLES_MANIFEST} names no stems.`
        : `Wrong or missing: ${wrong.join(', ')}. The build stages them from native-only/ after scripts/fetch-karaoke-examples.mjs verified them${synced ? '; cap sync did not copy them, or this is a stale bundle' : ''}.`,
    )

    const manifestBytes = totalBytes(root, bundled.files)
    console.log(
      `      manifest tier: ${bundled.files.length} files, ${manifestBytes} bytes (${(manifestBytes / 1024 / 1024).toFixed(2)} MiB)`,
    )
    if (!synced) {
      for (const entry of bundled.entries) {
        console.log(
          `        ${String(totalBytes(root, entry.files)).padStart(9)} B  ${entry.glob}`,
        )
      }
    }

    // WORKER -- the requested base is in the JS, and no other known one is.
    if (api !== undefined) {
      const chunks = assets.filter((file) => file.endsWith('.js'))
      const named = (needle) => chunks.some((file) => contains(file, needle))
      if (api.base === '') {
        console.log(
          `warn  ${label}: no API base compiled in -- a local-only build, sign-in and sync are off (apps/mercurypitch/.env names the dev worker; see .env.example)`,
        )
      } else {
        record(
          named(api.base),
          `${label}: the built JS names the requested API base ${api.base}`,
          `No chunk carries ${api.base}, so auth-service throws "VITE_API_BASE_URL is not configured" on the phone. Check that vite.config.ts still compiles api-base.mjs's answer in through \`define\`${synced ? ', or this is a stale bundle cap sync did not overwrite' : ''}.`,
        )
      }
      const others = Object.values(API_BASES).filter(
        (base) => base !== api.base && named(base),
      )
      record(
        others.length === 0,
        `${label}: no other db-worker is compiled in`,
        `Found ${others.join(', ')} beside the requested ${api.base === '' ? '(none)' : api.base}. A test build must not carry the production worker, and a store build must not carry the dev one${synced ? '; or this is a stale bundle' : ''}.`,
      )
    }

    // UNSOLD
    const selling = []
    for (const file of assets) {
      for (const [needle, what] of FORBIDDEN) {
        if (contains(file, needle))
          selling.push(`${needle} (${what}) in ${file}`)
      }
    }
    record(
      selling.length === 0,
      `${label}: no built file offers a way to pay`,
      `Found ${selling.join('; ')}. Something reaches a paid surface from a path CAN_TAKE_PAYMENT does not guard (src/lib/native-build.ts)${synced ? ', or this is a stale bundle cap sync did not overwrite' : ''}. A store binary that carries a payment page, its link or its prose is rejected, not warned.`,
    )

    // NATIVE
    const webSettings = []
    for (const file of assets) {
      for (const [needle, what] of WEB_SETTINGS) {
        if (contains(file, needle))
          webSettings.push(`${needle} (${what}) in ${file}`)
      }
    }
    record(
      webSettings.length === 0,
      `${label}: the web Settings panel is not in the bundle`,
      `Found ${webSettings.join('; ')}. Something imports the web SettingsPanel without the IS_NATIVE_BUILD fold (src/App.tsx) or reaches it from the shell${synced ? ', or this is a stale bundle cap sync did not overwrite' : ''}. The native Settings is apps/mercurypitch/src/shell/settings.`,
    )

    // STAGE 2 -- decided from the same answer as WORKER, so it can only be
    // asked once the requested base resolved.
    if (api !== undefined) {
      const importing = karaokeImportFor(api)
      const carried = KARAOKE_STAGE_2.filter(([needle]) =>
        assets.some((file) => contains(file, needle)),
      )
      const wrong = importing
        ? KARAOKE_STAGE_2.filter((piece) => !carried.includes(piece))
        : carried
      record(
        wrong.length === 0,
        importing
          ? `${label}: the Karaoke room imports songs in this ${api.target} build (${KARAOKE_STAGE_2.length} pieces)`
          : `${label}: the store build carries no Karaoke import`,
        importing
          ? `Missing: ${wrong.map(([needle, what]) => `${needle} (${what})`).join('; ')}. A ${api.target} build compiles KARAOKE_IMPORT in as true (vite.config.ts, api-base.mjs karaokeImportFor)${synced ? '; or this is a stale bundle' : ''}.`
          : `Found ${wrong.map(([needle, what]) => `${needle} (${what})`).join('; ')}. Something reaches Stage 2 from a path KARAOKE_IMPORT does not fold away (src/lib/native-build.ts)${synced ? ', or this is a stale bundle cap sync did not overwrite' : ''}.`,
      )
    }

    const webSignIn = []
    for (const file of assets) {
      for (const [needle, what] of WEB_SIGN_IN) {
        if (contains(file, needle))
          webSignIn.push(`${needle} (${what}) in ${file}`)
      }
    }
    record(
      webSignIn.length === 0,
      `${label}: the web sign-in dialog is not in the bundle`,
      `Found ${webSignIn.join('; ')}. Something renders the web AuthModal without the IS_NATIVE_BUILD fold (src/App.tsx) or reaches it from the shell${synced ? ', or this is a stale bundle cap sync did not overwrite' : ''}. The native way in is the shell's sign-in sheet; openAuthModal routes to it.`,
    )
  }

  if (failures.length > 0) {
    console.error(`\nassert-bundle: ${failures.length} check(s) failed.`)
    for (const failure of failures) console.error(`  - ${failure}`)
    return 1
  }

  console.log('\nassert-bundle: every check passed.')
  return 0
}

process.exit(main(process.argv))
