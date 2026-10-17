// ============================================================
// Staging an example from a song link
// ============================================================
//
// A song link (`?song=<slug>`) stages the example's library row, the same
// row a pick from the on-stage song sheet stages. That is what keeps the
// visitor's own changes: a vocal they replaced plays instead of the
// published one (restored by the seed, which lets local stems win), edited
// lyrics stay (`seedDemoLyrics` never overwrites an edit) and so does an
// edited title.
//
// Karaoke Night does not seed the examples library on its own; the studio
// does, at boot. So on a first visit there is no row yet. This asks for the
// seed and waits for it to finish before looking (`seedExamplesLibrary`
// hands every caller the same promise), then stages.
//
// When there is still no playable row (no IndexedDB in a private window, a
// failed write), it falls back to the published stems, which is what
// `?session=` stages for an example. The link always sings.
//
// Lazy-loaded by the page only when a song link is opened: it pulls in the
// session store, which first paint must not pay for.

import { ensureSessionHydrated } from '@/features/stem-mixer/karaoke-playlist-runner'
import { IS_DEV } from '@/lib/defaults'
import type { KaraokeNightLaunchParams } from '@/lib/karaoke-night-link'
import { getUvrSession, initGroupStore, initSessionStore, } from '@/stores/uvr-store'
import type { DemoSongManifest } from './demo-song'
import { demoSessionId, seedDemoLyrics } from './demo-song'
import { isExampleSession } from './examples-library'
import type { KaraokeSong } from './KaraokeRailPanels'
import { seedExamplesLibrary } from './seed-examples'

/** The song a link to this example should put on stage. Never rejects. */
export async function exampleSongFromLink(
  manifest: DemoSongManifest,
  launch: Pick<KaraokeNightLaunchParams, 'autoplay' | 'startAtSec'>,
): Promise<KaraokeSong> {
  const sessionId = demoSessionId(manifest.slug)
  const launchFields = {
    autoPlay: launch.autoplay,
    initialSeekSec: launch.startAtSec ?? undefined,
  }

  try {
    // The seed decides against the caches, so they load first, exactly as
    // the studio sequences it.
    await Promise.all([initSessionStore(), initGroupStore()])
    await seedExamplesLibrary()
    const row = getUvrSession(sessionId)
    if (row !== undefined && isExampleSession(row)) {
      const outputs = (await ensureSessionHydrated(row)).outputs
      if (
        (outputs?.vocal ?? '') !== '' ||
        (outputs?.instrumental ?? '') !== ''
      ) {
        return {
          sessionId,
          title:
            row.originalFile?.name ?? `${manifest.title} · ${manifest.artist}`,
          stems: { vocal: outputs?.vocal, instrumental: outputs?.instrumental },
          ...launchFields,
        }
      }
    }
  } catch (err) {
    if (IS_DEV) console.warn('[KaraokeNight] song link fell back:', err)
  }

  // The stage's lyrics controller reads the db on mount and searches online
  // when it finds nothing, so the words must land before the song does.
  try {
    await seedDemoLyrics(manifest)
  } catch {
    // A song without its words is still a song.
  }
  return {
    sessionId,
    title: `${manifest.title} · ${manifest.artist}`,
    stems: manifest.stems,
    ...launchFields,
  }
}
