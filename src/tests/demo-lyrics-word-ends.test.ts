// ── A demo song's word ends reach the stage ──────────────────────────
//
// The demo songs are SEEDED: `seedDemoLyrics` writes bare text into the
// lyrics store and the mixer finds it there on load. That path never goes
// through the upload handler, which was the only thing that read the
// `x-mp-timing` tag — so an authored mapping kept its word ends when a
// singer uploaded the file and lost them when the studio published it.
//
// This drives the real store and the real controller, because the bug
// lived in the gap between two modules that were each correct alone.

import { createRoot } from 'solid-js'
import { describe, expect, it, vi } from 'vitest'
import { loadLyricsFromDb, saveLyricsToDb, } from '@/db/services/lyrics-db-service'
import { useStemMixerLyricsController } from '@/features/stem-mixer/useStemMixerLyricsController'
import { withLrcTimingMetadata } from '@/lib/lrc-timing-metadata'

const controllerFor = (sessionId: string) =>
  useStemMixerLyricsController({
    sessionId,
    songTitle: 'Seeded demo',
    duration: () => 30,
    playing: () => false,
    elapsed: () => 0,
    seekToWithWindow: () => {},
  })

/** One end marked, on the last word of the second line. */
function seededText(): string {
  const ends: number[] = []
  ends[2] = 9.4
  return withLrcTimingMetadata(
    '[00:01.00] Lantern [00:01.60] under\n[00:07.00] Paper [00:07.50] boats [00:08.10] over',
    {
      wordEndTimings: { 1: ends },
      wordSweepTimings: { 1: { 2: [{ time: 8.8, progress: 0.5 }] } },
    },
  )
}

describe('seeded demo lyrics', () => {
  it('load with the word ends and splits the author mapped', async () => {
    const sessionId = 'karaoke-night-demo:word-ends-test'
    // Exactly what `seedDemoLyrics` writes: text, format, filename.
    await saveLyricsToDb(sessionId, {
      text: seededText(),
      format: 'lrc',
      filename: 'seeded-demo.lrc',
    })

    await createRoot(async (dispose) => {
      const controller = controllerFor(sessionId)
      await controller.loadLyrics()

      // The tag is not a lyric line.
      expect(controller.lrcLines().map((l) => l.time)).toEqual([1, 7])
      expect(controller.wordEndTimings()[1]?.[2]).toBe(9.4)
      expect(0 in (controller.wordEndTimings()[1] ?? [])).toBe(false)
      expect(controller.wordSweepTimings()[1]?.[2]).toEqual([
        { time: 8.8, progress: 0.5 },
      ])
      dispose()
    })

    // ...and they are stored with the version, so the next load does not
    // depend on the tag surviving whatever the singer does to the text.
    // The migration's write is fire-and-forget, so wait for it to land.
    await vi.waitFor(async () => {
      const stored = await loadLyricsFromDb(sessionId)
      expect(stored?.versions?.[0]?.wordEndTimings?.[1]?.[2]).toBe(9.4)
    })
  })
})
