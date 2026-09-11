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
// Every check runs against every bundle root it is given, `--android-assets`
// included. Those are the bytes that reach the APK, `cap sync` copies webDir
// wholesale, and a sync that did not overwrite the previous build leaves a
// tree that is stale rather than absent -- which the PRESENT checks alone
// cannot tell apart from a good one.
//
// Dependency-free on purpose: it runs on a bare runner before any workspace
// install has necessarily happened, and inside the reusable Capacitor
// workflow, which knows nothing about this app.

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

/** The files sync-ort-assets.mjs vendors, relative to a bundle root. */
const VENDORED = [
  'ort/ort-wasm-simd-threaded.mjs',
  'ort/ort-wasm-simd-threaded.wasm',
  'models/swiftf0.onnx',
]

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
