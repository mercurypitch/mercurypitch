// ============================================================
// Seeding the Examples library into the session list
// ============================================================
//
// The effectful half of `examples-library.ts`: it takes the decisions made
// there and writes them. Kept separate so the decisions stay testable without
// a database, and so the first-paint graph (`demo-song.ts`) never gains a
// static store import through the back door.
//
// Runs once at startup and is deliberately quiet. Nothing here is worth
// interrupting a visitor over — a failed seed means the Examples group is
// missing this session, not that anything of theirs is lost.
//
// Plan: docs/plans/lrc-mapper-studio-plan.md (Phase 7).

import { createSignal } from 'solid-js'
import { IS_DEV } from '@/lib/defaults'
import { IS_NATIVE_BUILD } from '@/lib/native-build'
import { addSessionToGroup, createGroup, getAllUvrSessions, getGroups, importUvrSessionDurable, updateUvrSessionOutputs, } from '@/stores/uvr-store'
import type { BundledExample } from './bundled-examples'
import { loadBundledExamples } from './bundled-examples'
import type { DemoSongManifest } from './demo-song'
import { demoSessionId, loadDemoSongs, loadDemoSongsFromApi, seedDemoLyrics, } from './demo-song'
import { exampleAttribution, EXAMPLES_GROUP_NAME, exampleSessionFrom, examplesToSeed, isExampleSession, mergeExampleManifests, reconcileExampleGroup, } from './examples-library'

let seeded = false

/**
 * The manifests this device has seen, for the surfaces that have to show a
 * credit. Kept here rather than on the session row so that adding attribution
 * needs no schema change, and so a corrected credit reaches every device on
 * the next load instead of being frozen into whatever was stored at seed time.
 */
const [exampleManifests, setExampleManifests] = createSignal<
  readonly DemoSongManifest[]
>([])

export { exampleManifests }

/**
 * The credit for a session, or null if it is not an example.
 *
 * The corpus is Creative Commons, so this is an obligation rather than a
 * nicety — anywhere an example is shown by name, this has to be shown too.
 */
export function exampleCreditFor(
  sessionId: string,
): ReturnType<typeof exampleAttribution> {
  const manifest = exampleManifests().find(
    (candidate) => demoSessionId(candidate.slug) === sessionId,
  )
  return manifest === undefined ? null : exampleAttribution(manifest)
}

/**
 * Put the demo corpus in the session list, as ordinary rows.
 *
 * Idempotent, and safe to call before the stores have anything in them —
 * every decision is taken against the caches as they are at call time, and a
 * row that already exists is left exactly alone.
 */
export async function seedExamplesLibrary(): Promise<void> {
  if (IS_NATIVE_BUILD) {
    startNativeSeed()
    return nativeSeed ?? undefined
  }
  if (seeded) return
  seeded = true
  try {
    const manifests = await loadDemoSongs()
    setExampleManifests(manifests)
    if (manifests.length === 0) return

    const existing = new Set(getAllUvrSessions().map((s) => s.sessionId))
    const missing = examplesToSeed(manifests, existing)
    for (const [index, manifest] of missing.entries()) {
      const session = exampleSessionFrom(manifest, index)
      if (await importUvrSessionDurable(session)) {
        existing.add(session.sessionId)
      }
    }

    // Lyrics come second and per song: `seedDemoLyrics` already knows never to
    // clobber a visitor's edit, and a song whose lyrics fail to fetch is still
    // a playable row.
    for (const manifest of manifests) {
      await seedDemoLyrics(manifest)
    }

    await ensureExamplesGroup(manifests, existing)
  } catch (err) {
    if (IS_DEV) console.warn('[Examples] seeding failed:', err)
  }
}

/**
 * The native app's seed, in two halves: its bundle, then the server.
 *
 * The bundle alone makes the library, so a first launch with no network has
 * three songs to sing, with their words, their credits and their notes
 * (audits K3 and K1). Only then does it ask the server, and what the server
 * says is merged over the bundle (`mergeExampleManifests`): a lyric
 * correction, a credit, a song the bundle lacks. Each half is quiet on
 * failure, and the first never waits on the second.
 *
 * One seed per launch, shared: the app starts it at boot, and the Karaoke
 * room, which may open before it has finished, waits on the same one
 * (`whenBundledExamplesSeeded`) instead of finding an empty library.
 */
let nativeBundleSeed: Promise<BundledExample[]> | null = null
let nativeSeed: Promise<void> | null = null

function startNativeSeed(): void {
  if (nativeBundleSeed !== null) return
  const bundleHalf = seedBundledExamples()
  nativeBundleSeed = bundleHalf
  nativeSeed = bundleHalf.then(seedFromServer)
}

/**
 * Resolves once the examples the bundle carries are in the library: rows,
 * words and notes. Never waits on the network. Starts the seed if nothing
 * has yet. Native only; the web has no bundle.
 */
export async function whenBundledExamplesSeeded(): Promise<void> {
  startNativeSeed()
  await nativeBundleSeed
}

async function seedBundledExamples(): Promise<BundledExample[]> {
  try {
    const bundled = await loadBundledExamples()
    if (bundled.length === 0) return bundled
    await seedManifests(bundled, bundled)
    // The notes come last: a song with no notes is still a song.
    const { seedBundledNotes } = await import('./bundled-notes')
    for (const song of bundled) {
      try {
        await seedBundledNotes(song)
      } catch (err) {
        if (IS_DEV) console.warn(`[Examples] notes for ${song.slug}:`, err)
      }
    }
    return bundled
  } catch (err) {
    if (IS_DEV) console.warn('[Examples] seeding the bundle failed:', err)
    return []
  }
}

async function seedFromServer(bundled: BundledExample[]): Promise<void> {
  try {
    const fromServer = await loadDemoSongsFromApi()
    if (fromServer.length === 0) return
    await seedManifests(mergeExampleManifests(bundled, fromServer), bundled)
  } catch (err) {
    if (IS_DEV) console.warn('[Examples] going online failed:', err)
  }
}

/**
 * Write one list of examples: rows, lyrics, the group. The native half of
 * `seedExamplesLibrary`, with one step the web does not need — a row an
 * earlier build seeded with the R2 stems is pointed at the bundle's, so the
 * song plays with no network like one seeded today.
 */
async function seedManifests(
  manifests: readonly DemoSongManifest[],
  bundled: readonly BundledExample[],
): Promise<void> {
  setExampleManifests(manifests)

  const existing = new Set(getAllUvrSessions().map((s) => s.sessionId))
  for (const song of bundled) {
    const row = getAllUvrSessions().find(
      (s) => s.sessionId === demoSessionId(song.slug),
    )
    if (
      row === undefined ||
      !isExampleSession(row) ||
      (row.outputs?.vocal === song.stems.vocal &&
        row.outputs.instrumental === song.stems.instrumental)
    )
      continue
    updateUvrSessionOutputs(row.sessionId, [
      { stem: 'vocal', path: song.stems.vocal, duration: song.durationSec },
      {
        stem: 'instrumental',
        path: song.stems.instrumental,
        duration: song.durationSec,
      },
    ])
  }

  // Ordered by the song's place in the whole list, not among the missing
  // ones: a song the server adds later sorts after the bundle's three.
  for (const manifest of examplesToSeed(manifests, existing)) {
    const session = exampleSessionFrom(manifest, manifests.indexOf(manifest))
    if (await importUvrSessionDurable(session)) existing.add(session.sessionId)
  }
  for (const manifest of manifests) await seedDemoLyrics(manifest)
  await ensureExamplesGroup(manifests, existing)
}

async function ensureExamplesGroup(
  manifests: readonly DemoSongManifest[],
  existing: ReadonlySet<string>,
): Promise<void> {
  const group =
    getGroups().find((g) => g.name === EXAMPLES_GROUP_NAME) ??
    (await createGroup(EXAMPLES_GROUP_NAME))

  const wanted = reconcileExampleGroup(manifests, existing, group.sessionIds)
  // Only additions are written. Membership is removed by deleting the session
  // or by the visitor moving it out, and re-asserting the whole list here
  // would undo exactly that.
  for (const sessionId of wanted) {
    if (group.sessionIds.includes(sessionId)) continue
    await addSessionToGroup(sessionId, group.id)
  }
}

/** Test seam: forget that seeding has run. */
export function resetExamplesSeedForTests(): void {
  seeded = false
  nativeBundleSeed = null
  nativeSeed = null
  setExampleManifests([])
}
