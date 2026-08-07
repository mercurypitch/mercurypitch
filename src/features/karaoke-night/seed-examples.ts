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
import { addSessionToGroup, createGroup, getAllUvrSessions, getGroups, importUvrSessionDurable, } from '@/stores/uvr-store'
import type { DemoSongManifest } from './demo-song'
import { demoSessionId, loadDemoSongs, seedDemoLyrics } from './demo-song'
import { exampleAttribution, EXAMPLES_GROUP_NAME, exampleSessionFrom, examplesToSeed, reconcileExampleGroup, } from './examples-library'

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

async function ensureExamplesGroup(
  manifests: Awaited<ReturnType<typeof loadDemoSongs>>,
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
  setExampleManifests([])
}
