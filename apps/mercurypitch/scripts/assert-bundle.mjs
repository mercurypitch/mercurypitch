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
//   UNSOLD   No file in dist/assets mentions ko-fi.com. The web app sells
//            credit packs through Stripe and links out to Ko-fi, and `@`
//            aliases to that same source tree; App Store guideline 3.1.1 and
//            Play's billing policy each reject a binary carrying either. The
//            guard is a build constant (src/lib/native-build.ts) and this is
//            what proves the constant did its job in the bundle rather than
//            only in the UI.
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

/** Must NOT appear in the bundle: the donation link-out. */
const FORBIDDEN = 'ko-fi.com'

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

  // PRESENT -- in the web bundle, and in the Android copy once cap sync has
  // run. A file missing from only the second one means cap sync did not copy
  // it, which is a different fix from the build not producing it.
  for (const [label, root] of [
    ['dist', distDir],
    ...(androidAssetsDir === undefined
      ? []
      : [['android assets', androidAssetsDir]]),
  ]) {
    for (const file of VENDORED) {
      record(
        existsSync(join(root, file)),
        `${label}: ${file} is present`,
        `Run scripts/sync-ort-assets.mjs (the vite.config.ts plugin runs it for every build) and rebuild${label === 'dist' ? '' : ', then cap sync'}.`,
      )
    }
  }

  const assets = walk(join(distDir, 'assets'))
  record(
    assets.length > 0,
    `dist: ${join(distDir, 'assets')} holds built files`,
    'The build produced no assets directory. Nothing below this line means anything until it does.',
  )

  // USED
  record(
    assets.some((file) => contains(file, WASM_BASE)),
    `dist: a built chunk names ${WASM_BASE}`,
    `No chunk references ${WASM_BASE}, so the engine will resolve its wasm base to the CDN fallback at runtime. Check that VITE_ONNX_WASM_BASE_URL is set in apps/mercurypitch/.env and that the build read it.`,
  )

  // UNSOLD
  const selling = assets.filter((file) => contains(file, FORBIDDEN))
  record(
    selling.length === 0,
    `dist: no built file mentions ${FORBIDDEN}`,
    `${FORBIDDEN} is in ${selling.join(', ')}. Something now reaches the billing panels from a path IS_NATIVE_BUILD does not guard (src/lib/native-build.ts). A store binary that links out to a payment page is rejected, not warned.`,
  )

  if (failures.length > 0) {
    console.error(`\nassert-bundle: ${failures.length} check(s) failed.`)
    for (const failure of failures) console.error(`  - ${failure}`)
    return 1
  }

  console.log('\nassert-bundle: every check passed.')
  return 0
}

process.exit(main(process.argv))
