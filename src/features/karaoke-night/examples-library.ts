// ============================================================
// Examples library — the demo corpus as ordinary session rows
// ============================================================
//
// The demo songs are already served from R2 and already have a manifest, a
// session-id scheme and a non-destructive lyrics seed. What they did not have
// is a way into the session list: only Karaoke Night ever read the manifest,
// so the hand-mapped corpus lived in one person's Downloads folder.
//
// This is the decision layer for putting them there. It answers three
// questions and touches nothing:
//
//   1. Which manifests deserve a row (`examplesToSeed`).
//   2. What that row looks like (`exampleSessionFrom`).
//   3. Which of a group's members are still real (`reconcileExampleGroup`).
//
// **Rows are metadata only, and that is not a compromise.** `outputs.vocal`
// and `outputs.instrumental` are the R2 URLs themselves, so creating a row
// transfers nothing — the audio moves the first time somebody opens the song,
// exactly like the Karaoke Night demo already works. There is no separate
// "pull" step to build, and nobody's mobile data is spent on a song they
// never asked for.
//
// Plan: docs/plans/lrc-mapper-studio-plan.md (Phase 7).

import type { UvrSession } from '@/stores/uvr-store'
import type { DemoSongManifest } from './demo-song'
import { demoIsPlayable, demoSessionId, isDemoSessionId } from './demo-song'

/** The group every example lands in. Matched by name — ids are db-generated. */
export const EXAMPLES_GROUP_NAME = 'Examples'

/**
 * The `provider` stamped on every seeded example, and the only reliable way
 * to tell one from a visitor's own upload once both are ordinary rows in the
 * session store.
 *
 * Group membership would be the intuitive test and is the wrong one: a
 * visitor can drag an example out of the Examples group, and the row is
 * still not their song.
 */
export const EXAMPLE_PROVIDER = 'examples'

/**
 * True for a seeded example rather than something the visitor brought.
 *
 * The funnel needs this to keep `karaoke_song_staged` meaning "brought
 * their own song" — it is Campaign E's bid target, and an event a visitor
 * can fire by tapping a built-in track would optimise the campaign toward
 * exactly the behaviour it is supposed to measure the absence of.
 *
 * Two independent signals, either sufficient. `provider` is what the
 * current seeder stamps; the session-id format covers rows a device
 * seeded under an older build that may predate the stamp. Every example
 * id comes from `demoSessionId()` by construction, and a visitor's own
 * separation can never be given one — so the id check adds legacy safety
 * without any way to misclassify a real upload.
 */
export function isExampleSession(
  session: Pick<UvrSession, 'provider' | 'sessionId'> | undefined,
): boolean {
  if (session === undefined) return false
  return (
    session.provider === EXAMPLE_PROVIDER || isDemoSessionId(session.sessionId)
  )
}

/**
 * A stable creation timestamp per example, so the list orders them the way the
 * studio does rather than by whenever a given device first opened the app.
 *
 * Deliberately in the past: examples should sort below a visitor's own work,
 * not above it. One day apart keeps the manifest's order intact.
 */
const EXAMPLES_EPOCH_MS = Date.UTC(2020, 0, 1)
const ONE_DAY_MS = 86_400_000

/**
 * The session row for one manifest.
 *
 * `status: 'completed'` is the truth: separation is done, the stems exist, and
 * the row is playable the moment it is created. Nothing about it is a stub.
 */
export function exampleSessionFrom(
  manifest: DemoSongManifest,
  index: number,
): UvrSession {
  const duration = manifest.durationSec
  return {
    sessionId: demoSessionId(manifest.slug),
    status: 'completed',
    progress: 100,
    originalFile: {
      name: `${manifest.artist} — ${manifest.title}`,
      size: 0,
      mimeType: 'audio/mpeg',
    },
    outputs: {
      vocal: manifest.stems.vocal ?? '',
      instrumental: manifest.stems.instrumental ?? '',
    },
    stemMeta:
      duration === undefined
        ? undefined
        : { vocal: { duration }, instrumental: { duration } },
    processingMode: 'server',
    provider: EXAMPLE_PROVIDER,
    createdAt: EXAMPLES_EPOCH_MS + index * ONE_DAY_MS,
  }
}

/**
 * Which manifests still need a row.
 *
 * A visitor who deleted an example gets it back on the next visit — the
 * alternative is remembering every deletion forever, and re-adding is the
 * cheaper mistake to live with than a library that cannot be repaired.
 * Their *lyrics* are safe either way: `shouldSeedLyrics` protects an edited
 * copy regardless of what happens to the row.
 */
export function examplesToSeed(
  manifests: readonly DemoSongManifest[],
  existingSessionIds: ReadonlySet<string>,
): DemoSongManifest[] {
  return manifests.filter(
    (manifest) =>
      demoIsPlayable(manifest) &&
      !existingSessionIds.has(demoSessionId(manifest.slug)),
  )
}

/**
 * The membership an Examples group should have.
 *
 * Two things have to be true at once: a song parked in the studio must stop
 * being listed, and a session the visitor moved out of the group by hand must
 * stay out. So the answer is the intersection of "still a live example" and
 * "still a session that exists", never a rebuild from the manifest alone.
 */
export function reconcileExampleGroup(
  manifests: readonly DemoSongManifest[],
  existingSessionIds: ReadonlySet<string>,
  currentMembers: readonly string[],
): string[] {
  const live = new Set(
    manifests
      .filter(demoIsPlayable)
      .map((manifest) => demoSessionId(manifest.slug)),
  )
  // Deduped as it goes: a stored group is data, and a membership list that
  // has picked up a repeat somewhere must not have it preserved forever.
  const seen = new Set<string>()
  const kept: string[] = []
  for (const id of currentMembers) {
    if (!live.has(id) || !existingSessionIds.has(id) || seen.has(id)) continue
    seen.add(id)
    kept.push(id)
  }
  const added = [...live].filter(
    (id) => !seen.has(id) && existingSessionIds.has(id),
  )
  return [...kept, ...added]
}

/**
 * The credit line a Creative Commons corpus obliges us to show.
 *
 * Returns null rather than an empty string when a manifest carries no
 * attribution, so a caller cannot render a blank credit and call it done.
 */
export function exampleAttribution(
  manifest: DemoSongManifest,
): { text: string; url: string; license: string; licenseUrl: string } | null {
  const attribution = manifest.attribution
  const text = (attribution?.text ?? '').trim()
  if (text === '') return null
  return {
    text,
    url: attribution.url ?? '',
    license: attribution.license ?? '',
    licenseUrl: attribution.licenseUrl ?? '',
  }
}
