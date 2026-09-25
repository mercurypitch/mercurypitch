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
  // ── Boot ─────────────────────────────────────────────────────
  //
  // The app has no opening curtain and no First Light (S4): it launches on
  // its own ground with the mark, and the alley is the welcome. The curtain's
  // first-light plates and First Light's sky are therefore not listed.
  {
    glob: 'brand-mark.svg',
    reason:
      'The Meniscus mark in the boot lockup (src/App.tsx) and the alley top (apps/mercurypitch/src/alley/RoomsAlley.tsx); the shipped master, never an inlined copy.',
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

  // ── The guided exercise loop ─────────────────────────────────
  {
    glob: 'exercises/examples/*.mp3',
    reason:
      "The coach's spoken example a guided exercise offers: the catalogue names it by absolute URL (src/features/zen/exercise-catalog.ts) and the example button plays it and draws its waveform (src/features/zen/ZenPitchStage.tsx).",
  },

  // ── Home rail and the onboarding Map ─────────────────────────
  //
  // Only the covers drawn from a photograph are listed. Practice, Exercises,
  // Analysis and the Ascent draw their own vector art inside the bundle, so
  // they need no cover here.
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

  // ── The Sing room's cover ────────────────────────────────────
  //
  // One cover since S4 (23 Sep 2026): the owner chose it over the B and mock
  // takes that shipped for the test period, and those two families are gone
  // from public/sing/ and the catalogue.
  {
    glob: 'sing/retro-analog-studio*.webp',
    reason:
      "The Retro Analog Studio cover in all four variants — the Sing room IS this photograph, and the trace is drawn on a transparent canvas over it (src/features/sing-room/SingRoomStage.tsx via the 'sing' surface in src/lib/backgrounds/background-catalog.ts). Portrait and landscape both ship: a phone held sideways picks the other one.",
  },

  // ── The Ear Lab's own room ───────────────────────────────────
  //
  // The landscape file above ships for the Home rail. This is the room
  // itself held upright: without it the Ear Lab drew no photograph on a
  // phone in portrait, and a door's open had no picture to end on (device
  // round 4).
  {
    glob: 'ear-lab/regulator-room-portrait.webp',
    reason:
      "The Regulator Room in portrait, the Ear Lab's default room: the room draws it on its [data-room-background] (src/features/ear-lab/EarRoomShell.tsx via the 'ear' surface in src/lib/backgrounds/background-catalog.ts), and the Ear Lab door's open ends on it (apps/mercurypitch/src/alley/alley-entry.ts).",
  },

  // ── The alley: the Rooms tab and the welcome (S4) ───────────
  //
  // Bundled at full quality on purpose (owner, 23 Sep 2026): the alley is the
  // first thing a fresh install draws, so it cannot wait on a network.
  {
    glob: 'rooms/alley/night-rooms-hero*.webp',
    reason:
      'The night alley plate at 1x and 2x — the Rooms tab and the first-run welcome ARE this picture, and every door quad is measured on it (apps/mercurypitch/src/alley/alley-plate.ts).',
  },
  {
    glob: 'rooms/alley/retro-analog-studio-portrait-loop.mp4',
    reason:
      'The tape-reel loop the Sing door plays inside its doorway when it is selected, and carries into the room on Enter (apps/mercurypitch/src/alley/RoomsAlley.tsx).',
  },
  {
    glob: 'rooms/alley/*-ambient-take2-loop.m4a',
    reason:
      'The two room ambients a selected Sing or Ear Lab door fades in, decoded into a looping buffer (apps/mercurypitch/src/alley/alley-audio.ts).',
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
