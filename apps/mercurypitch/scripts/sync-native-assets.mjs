// Stages everything the native bundle serves from its origin root into one
// generated directory, and hands Vite that directory as its publicDir.
//
// Two tiers live there, from two different places:
//   - the pitch engine's runtime (sync-ort-assets.mjs): the wasm pair and the
//     SwiftF0 model, so the microphone works on a plane
//   - the manifest tier (../native-assets.mjs): the public/ pictures the V1-1
//     surfaces reference by absolute URL — the twin portraits, the character
//     art, the onboarding sky and the room covers. The first TestFlight build
//     shipped without them and every one of those images came up blank.
//
// WHY A SEPARATE DIRECTORY, and not `apps/mercurypitch/public/`. Everything
// here is copied in by a build; nothing is authored. A directory called
// `public/` invites someone to drop a file in it, and the next build would
// delete it without a word. `.native-public/` is gitignored in full and wiped
// on every run, which is also what keeps a renamed asset from lingering as a
// ghost in the bundle — the "stale copy cap sync did not overwrite" failure,
// one level earlier.
//
// Called from the Vite plugin in vite.config.ts, NOT from an npm lifecycle
// hook: `pnpm exec vite build` is how CI builds, and it does not run hooks.
// That exact mistake shipped a bundle with no vendored wasm at all.
//
// Still runnable directly (`node scripts/sync-native-assets.mjs`) for a
// one-off, and that is what the package's predev/prebuild hooks call.

import { copyFileSync, mkdirSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { NATIVE_ASSETS, resolveNativeAssets, totalBytes, } from '../native-assets.mjs'
import { syncOrtAssets } from './sync-ort-assets.mjs'

const here = dirname(fileURLToPath(import.meta.url))

/** The generated publicDir. Gitignored, wiped and refilled by every build. */
export const NATIVE_PUBLIC_DIR = join(here, '../.native-public')

/** The web app's public/ tree — the one source of truth for both tiers. */
export const WEB_PUBLIC_DIR = join(here, '../../../public')

export function syncNativeAssets() {
  // Wipe first. A manifest entry that was narrowed, or an asset that was
  // renamed, otherwise leaves its old file sitting in the bundle forever:
  // present, plausible and no longer referenced by anything.
  rmSync(NATIVE_PUBLIC_DIR, { recursive: true, force: true })
  mkdirSync(NATIVE_PUBLIC_DIR, { recursive: true })

  const { ortOut, modelOut } = syncOrtAssets(NATIVE_PUBLIC_DIR)

  const { entries, files } = resolveNativeAssets(WEB_PUBLIC_DIR)

  // An entry that matches nothing is a rename nobody noticed, and the whole
  // point of naming files instead of copying a tree is that this is loud.
  // assert-bundle.mjs repeats the check against the built bundle; this one
  // fails at the moment the cause is still on screen.
  const empty = entries.filter((entry) => entry.files.length === 0)
  if (empty.length > 0) {
    throw new Error(
      `[sync-native-assets] ${empty.length} manifest entr${empty.length === 1 ? 'y matches' : 'ies match'} no file under ${WEB_PUBLIC_DIR}:\n` +
        empty.map((entry) => `  - ${entry.glob}`).join('\n') +
        `\nEither the asset moved (fix the glob in native-assets.mjs) or it is gone (drop the entry, and check what rendered it).`,
    )
  }

  for (const file of files) {
    const to = join(NATIVE_PUBLIC_DIR, file)
    mkdirSync(dirname(to), { recursive: true })
    copyFileSync(join(WEB_PUBLIC_DIR, file), to)
  }

  return {
    dir: NATIVE_PUBLIC_DIR,
    ortOut,
    modelOut,
    entries,
    files,
    bytes: totalBytes(WEB_PUBLIC_DIR, files),
  }
}

// Direct invocation stays supported.
if (import.meta.url === `file://${process.argv[1]}`) {
  const { dir, files, bytes } = syncNativeAssets()
  console.log(
    `[sync-native-assets] ${NATIVE_ASSETS.length} manifest entries -> ${files.length} files, ${bytes} bytes`,
  )
  console.log(`[sync-native-assets] staged -> ${dir}`)
}
