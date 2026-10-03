// ── "Download .lyricsfile" keeps every word's timing ─────────────────────
//
// A song whose word timing lives inline in its enhanced LRC (the demo songs
// do: `[01:52.91] the [01:53.23] dark`) has nothing in the mapper's own
// word-time store, and the export read only that store: the file came out
// with line starts and no `words:` at all, while its sweep block still named
// word indices the file never defined. And the timing stores are keyed by
// the line's place in the LRC, rests included, while the export numbers the
// lines it writes with the rests left out, so a song with a rest had its
// timings land on the wrong lines.
//
// This drives the real store and the real controller, exports, reads the
// file back with the lyricsfile reader, and expects the same words with the
// same starts, ends and sweeps.

import { createRoot } from 'solid-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { saveLyricsToDb } from '@/db/services/lyrics-db-service'
import { useStemMixerLyricsController } from '@/features/stem-mixer/useStemMixerLyricsController'
import { withLrcTimingMetadata } from '@/lib/lrc-timing-metadata'
import { parseLyricsfile } from '@/lib/lyricsfile'

/**
 * Four LRC lines, the second a rest: "Paper boats over" is LRC line 2 and the
 * second line the file writes. Its last word has an authored end and a split;
 * "Silver rain" (LRC line 3) has both ends.
 */
function wordTimedLrc(): string {
  const paperEnds: number[] = []
  paperEnds[2] = 9.4
  return withLrcTimingMetadata(
    [
      '[00:01.00] Lantern [00:01.60] under [00:02.20] glass',
      '[00:04.00] ~Rest~',
      '[00:07.00] Paper [00:07.50] boats [00:08.10] over',
      '[00:12.00] Silver [00:12.40] rain',
    ].join('\n'),
    {
      wordEndTimings: { 2: paperEnds, 3: [12.3, 13.1] },
      wordSweepTimings: { 2: { 2: [{ time: 8.8, progress: 0.5 }] } },
    },
  )
}

/** Run the export and hand back the file it would have downloaded. */
async function exportLyricsfile(sessionId: string): Promise<string> {
  let file: Blob | null = null
  URL.createObjectURL = vi.fn((blob: Blob) => {
    file = blob
    return 'blob:lyricsfile-export-test'
  })
  URL.revokeObjectURL = vi.fn()
  // The download's click would navigate, which jsdom does not do.
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
  await createRoot(async (dispose) => {
    const controller = useStemMixerLyricsController({
      sessionId,
      songTitle: 'Round trip',
      duration: () => 30,
      playing: () => false,
      elapsed: () => 0,
      seekToWithWindow: () => {},
    })
    await controller.loadLyrics()
    controller.handleDownloadLyricsfile()
    dispose()
  })
  if (file === null) throw new Error('the export wrote no file')
  // jsdom's Blob has no text(); its FileReader reads one.
  const blob: Blob = file
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error ?? new Error('unreadable'))
    reader.readAsText(blob)
  })
}

const { createObjectURL, revokeObjectURL } = URL
afterEach(() => {
  URL.createObjectURL = createObjectURL
  URL.revokeObjectURL = revokeObjectURL
  vi.restoreAllMocks()
})

describe('Download .lyricsfile', () => {
  it('round-trips inline word timing, header ends and sweeps past a rest', async () => {
    const sessionId = 'lyricsfile-export-roundtrip'
    await saveLyricsToDb(sessionId, {
      text: wordTimedLrc(),
      format: 'lrc',
      filename: 'round-trip.lrc',
    })

    const parsed = await parseLyricsfile(await exportLyricsfile(sessionId))
    expect(parsed).not.toBeNull()
    const doc = parsed!

    // The rest is not a line of words; the three sung lines are, in order.
    expect(doc.lines.map((line) => [line.time, line.text])).toEqual([
      [1, 'Lantern under glass'],
      [7, 'Paper boats over'],
      [12, 'Silver rain'],
    ])
    // Every word keeps its start, on the line it belongs to.
    expect(doc.wordTimings).toEqual({
      0: [1, 1.6, 2.2],
      1: [7, 7.5, 8.1],
      2: [12, 12.4],
    })
    // The authored ends land on "over", and on "Silver" and "rain".
    expect(doc.wordEndTimings[0]).toBeUndefined()
    expect(doc.wordEndTimings[1]?.[2]).toBe(9.4)
    expect(0 in (doc.wordEndTimings[1] ?? [])).toBe(false)
    expect(doc.wordEndTimings[2]).toEqual([12.3, 13.1])
    // The split stays on "over", keyed the way the file numbers its lines.
    expect(doc.wordSweepTimings).toEqual({
      1: { 2: [{ time: 8.8, progress: 0.5 }] },
    })
  })

  it("puts the mapper's word times on their own lines when a rest comes first", async () => {
    // Line-level LRC with the word times the mapper recorded, keyed the way
    // the store keys them: by LRC line, the rest at 1 counted.
    const sessionId = 'lyricsfile-export-mapped-past-a-rest'
    await saveLyricsToDb(sessionId, {
      text: [
        '[00:01.00] Lantern under glass',
        '[00:04.00] ~Rest~',
        '[00:07.00] Paper boats over',
        '[00:12.00] Silver rain',
      ].join('\n'),
      format: 'lrc',
      filename: 'mapped.lrc',
      wordTimings: { 2: [7, 7.5, 8.1], 3: [12, 12.4] },
    })

    const parsed = await parseLyricsfile(await exportLyricsfile(sessionId))

    expect(parsed?.wordTimings).toEqual({
      1: [7, 7.5, 8.1],
      2: [12, 12.4],
    })
  })
})
