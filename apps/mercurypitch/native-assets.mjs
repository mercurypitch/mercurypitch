// ============================================================
// Native asset manifest — which public/ files ship inside the binary
// ============================================================
//
// The native bundle is deliberately NOT the web app's public/ tree. That tree
// is 37 MB of room photography, night-app packs, drum kits and legend masters,
// and a store binary carrying all of it would pay for eleven rooms V1-1 never
// opens. So `dist` was index.html + assets/ + models/ + ort/ and nothing else.
//
// Which is why the first TestFlight build (mp-v0.1.0, 11 Sep 2026) came up
// with no twin portrait, no character art and no room covers: every one of
// those is an ABSOLUTE URL into public/ — `/legends/mid/adele.webp`,
// `characters/aria_idle.svg`, `url('/jam/room-stage.webp')` — written by code
// the native shell shares with the web app through the `@` alias, and there
// was nothing behind any of them. Nothing failed loudly; images just did not
// arrive.
//
// This file is the middle answer between "ship nothing" and "ship 37 MB": a
// named list of what the V1-1 surfaces actually reference, each with the
// reason beside it so the next person can tell a needed file from an inherited
// one. `scripts/sync-native-assets.mjs` stages the matches into the build's
// publicDir before Vite copies it; `scripts/assert-bundle.mjs` re-resolves the
// same list against `dist` and fails when an entry matched nothing.
//
// Adding an entry:
//   - It must be reachable from a V1-1 surface. "A later phase will want it"
//     is what turns a manifest back into a copy of public/.
//   - Write the narrowest glob that covers the surface. `legends/*.webp` does
//     not reach into `legends/mid/`; a single `*` never crosses a `/`.
//   - Say WHY in one line, and name the module that reads it. A manifest whose
//     entries cannot be traced back to a caller cannot be pruned later.
//   - Add the source prefix to `.github/workflows/mercurypitch-mobile.yml`
//     (both the `paths:` filter and `changed-paths-regex`), or a change to the
//     art will not re-run the build that asserts the art is there.
//
// NOT here, on purpose: a fetched tier. Everything below is bundled, which is
// what makes a cold offline first run show the same pictures as a warm one.
// Fetching the rest from the web origin is a separate decision because it
// needs the native Content-Security-Policy to allow `img-src` for that origin
// (task A6), and A6 has not settled which origin is compiled in.

import { existsSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

/**
 * One manifest entry.
 *
 * @typedef {object} NativeAssetEntry
 * @property {string} glob Path glob relative to the repository's `public/`.
 * @property {string} reason One line: which surface needs it, and where.
 */

/** @type {readonly NativeAssetEntry[]} */
export const NATIVE_ASSETS = [
  // ── Boot and onboarding ──────────────────────────────────────
  {
    glob: 'opening/first-light-*.webp',
    reason:
      'The cold-start plate behind the boot screen, wide and tall (src/App.tsx) — the first frame the app draws.',
  },
  {
    glob: 'brand-mark.svg',
    reason:
      'The Meniscus mark in the boot lockup (src/App.tsx); the shipped master, never an inlined copy.',
  },
  {
    glob: 'onboarding/sky-*.webp',
    reason:
      "First Light's sky, wide and tall (src/features/onboarding/onboarding.module.css) — the backdrop every beat sits on.",
  },

  // ── The twin, and the voiceprint art that carries it ─────────
  {
    glob: 'legends/*.webp',
    reason:
      'Twin portraits at 928px: the reveal card (src/features/mirror/RevealCard.tsx) and the voiceprint image the share sheet and BeatPrints draw (src/features/mirror/voiceprint-share.ts).',
  },
  {
    glob: 'legends/thumbs/*.webp',
    reason:
      'The same portraits at 120px: the voiceprint rows in Settings -> Your voice (src/components/account/VoiceSection.tsx), which is where a twin is looked at again.',
  },
  {
    glob: 'favicon.svg',
    reason:
      'The mark in the Voice Constellation topbar (src/features/voice-constellation/VoiceConstellationSurface.tsx) — a different file from brand-mark.svg, and the only place the app asks for it.',
  },
  {
    glob: 'legends/mid/*.webp',
    reason:
      'The same portraits at 360px: the onboarding twin and keep beats (src/features/onboarding/beats/BeatTwin.tsx, BeatKeep.tsx), the progress card and the profile row.',
  },

  // ── Character art ────────────────────────────────────────────
  {
    glob: 'characters/*.svg',
    reason:
      'The nine practice guides: the picker (src/components/CharacterIcons.tsx), the practice header avatar (src/App.tsx) and the Jam chat widget.',
  },

  // ── Home rail and the onboarding Map ─────────────────────────
  //
  // Only the covers drawn from a photograph are listed. Practice, Exercises,
  // Analysis and the Ascent draw their own vector art inside the bundle, so
  // they need no file here.
  {
    glob: 'karaoke-night-stage.webp',
    reason:
      'Home rail and the onboarding Map: the Karaoke cover (src/features/home/DestinationGallery.module.css).',
  },
  {
    glob: 'jam/room-stage.webp',
    reason:
      'Home rail and the onboarding Map: the Jam cover (src/features/home/DestinationGallery.module.css).',
  },
  {
    glob: 'home/hear-yourself-tease.webp',
    reason:
      'Home rail: the veiled Hear Yourself cover (src/features/home/DestinationGallery.module.css).',
  },
  {
    glob: 'piano-night/afterglow-studio-landscape.webp',
    reason:
      'Home rail: the Piano Night room photo (src/features/home/DestinationGallery.tsx).',
  },
  {
    glob: 'ear-lab/regulator-room-landscape.webp',
    reason:
      'Home rail: the Ear Lab room photo (src/features/home/DestinationGallery.tsx).',
  },
  {
    glob: 'guitar-night/velvet-rehearsal.webp',
    reason:
      'Home rail: the Guitar Night room photo (src/features/home/DestinationGallery.tsx).',
  },
  {
    glob: 'drum-night/pocket-console-landscape.webp',
    reason:
      'Home rail: the Drum Night room photo (src/features/home/DestinationGallery.tsx).',
  },
]

/** Characters a glob segment may contain that a RegExp would read as syntax. */
const REGEXP_SPECIAL = /[.+?^${}()|[\]\\]/gu

/**
 * A glob as a RegExp over slash-separated relative paths.
 *
 * `*` matches within one segment, `**` across segments. That distinction is
 * the whole reason this is hand-written rather than `fs.globSync`: the
 * manifest leans on `legends/*.webp` meaning the 31 masters and NOT the 31
 * more inside `legends/mid/`, and a matcher that let `*` cross a `/` would
 * quietly double the tier.
 */
export function globToRegExp(glob) {
  let source = ''
  let index = 0

  while (index < glob.length) {
    if (glob.startsWith('**/', index)) {
      source += '(?:[^/]+/)*'
      index += 3
      continue
    }
    if (glob.startsWith('**', index)) {
      source += '.*'
      index += 2
      continue
    }
    if (glob[index] === '*') {
      source += '[^/]*'
      index += 1
      continue
    }
    source += glob[index].replace(REGEXP_SPECIAL, '\\$&')
    index += 1
  }

  return new RegExp(`^${source}$`, 'u')
}

/**
 * Every file under `root`, as paths relative to it, with `/` separators.
 *
 * Missing directory means no files, so a caller can ask about a bundle root
 * that a build never produced and get an empty answer rather than a throw.
 *
 * @param {string} root
 * @returns {string[]}
 */
export function listFiles(root) {
  /**
   * @param {string} dir
   * @param {string} prefix
   * @returns {string[]}
   */
  const walk = (dir, prefix) => {
    /** @type {string[]} */
    const out = []
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const rel = prefix === '' ? entry.name : `${prefix}/${entry.name}`
      if (entry.isDirectory()) out.push(...walk(join(dir, entry.name), rel))
      else out.push(rel)
    }
    return out
  }

  if (!existsSync(root)) return []
  return walk(root, '').sort()
}

/**
 * Resolve the manifest against a directory — the repository's `public/` when
 * staging a build, a bundle root when asserting one. Both callers run the same
 * globs over the same matcher, which is the point: an entry that resolved to
 * four files on the way in has to resolve to four files on the way out.
 *
 * @param {string} root
 * @param {readonly NativeAssetEntry[]} [manifest]
 * @returns {{ entries: Array<NativeAssetEntry & { files: string[] }>, files: string[] }}
 */
export function resolveNativeAssets(root, manifest = NATIVE_ASSETS) {
  const all = listFiles(root)
  const entries = manifest.map((entry) => {
    const pattern = globToRegExp(entry.glob)
    return { ...entry, files: all.filter((file) => pattern.test(file)) }
  })

  const seen = new Set()
  for (const entry of entries) for (const file of entry.files) seen.add(file)

  return { entries, files: [...seen].sort() }
}

/**
 * Total size in bytes of `files`, read relative to `root`.
 *
 * @param {string} root
 * @param {readonly string[]} files
 */
export function totalBytes(root, files) {
  let bytes = 0
  for (const file of files) bytes += statSync(join(root, file)).size
  return bytes
}
