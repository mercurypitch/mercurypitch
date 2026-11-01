// ============================================================
// Untimed lyrics are timed from the song's notes
// ============================================================
//
// A paste, a .txt or an LRCLIB record with plain lyrics only used to be
// spread evenly over the whole song, line 1 at 0:00. With the vocal's notes
// in hand the controller times the lines from them (lyrics-automap.ts) and
// keeps the result as its own version, Auto-timed, over the untimed
// Original: whenever both are there, in either order, on this visit or a
// later one, and never over a mapping.
//
// This drives the real controller over the real store.

import { createRoot, createSignal } from 'solid-js'
import { describe, expect, it, vi } from 'vitest'
import { loadLyricsFromDb, saveLyricsToDb, } from '@/db/services/lyrics-db-service'
import type { TimedNote } from '@/lib/lyrics-automap'
import { useStemMixerLyricsController } from './useStemMixerLyricsController'

const PASTE = 'First line of the song\n\nSecond line of the song'

/** Two phrases, at 12 s and at 20 s. */
function twoPhrases(): TimedNote[] {
  const notes: TimedNote[] = []
  for (const start of [12, 20]) {
    for (let t = start; t < start + 3; t += 0.25) {
      notes.push({ startSec: t, endSec: t + 0.25 })
    }
  }
  return notes
}

function controllerWith(
  sessionId: string,
  vocalNotes: () => readonly TimedNote[],
) {
  return useStemMixerLyricsController({
    sessionId,
    songTitle: 'Auto time',
    duration: () => 40,
    playing: () => false,
    elapsed: () => 0,
    seekToWithWindow: () => {},
    vocalNotes,
  })
}

const paste = (
  controller: ReturnType<typeof controllerWith>,
  text = PASTE,
): void => {
  controller.handleLyricsUpload({ text, format: 'txt', filename: 'song.txt' })
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

/** The line times on show, or none while the lyrics are untimed. */
const shown = (controller: ReturnType<typeof controllerWith>): number[] =>
  controller.lrcLines().map((l) => l.time)

describe('untimed lyrics, timed from the notes', () => {
  it('times a paste from the notes, as Auto-timed over the Original', async () => {
    await createRoot(async (dispose) => {
      const controller = controllerWith('autotime-paste', twoPhrases)

      paste(controller)
      await settle()

      expect(controller.lrcLines().map((l) => [l.time, l.text])).toEqual([
        [12, 'First line of the song'],
        [20, 'Second line of the song'],
      ])
      expect(controller.lyricsLines()).toEqual([])
      expect(controller.activeVersionKind()).toBe('auto-time')
      expect(controller.lyricsVersions().map((v) => v.kind)).toEqual([
        'imported',
        'auto-time',
      ])
      // The Original keeps the paste as it came, blank line and all.
      expect(controller.lyricsVersions()[0].text).toBe(PASTE)
      dispose()
    })
  })

  it('times plain lyrics picked from LRCLIB', async () => {
    await createRoot(async (dispose) => {
      const controller = controllerWith('autotime-lrclib', twoPhrases)

      await controller.handleSongPick({
        id: 7,
        artist: 'Someone',
        title: 'Auto time',
        plainLyrics: PASTE,
      })
      await settle()

      expect(shown(controller)).toEqual([12, 20])
      expect(controller.activeVersionKind()).toBe('auto-time')
      dispose()
    })
  })

  it('times the lyrics once the notes come in (on a phone, with the mic)', async () => {
    await createRoot(async (dispose) => {
      const [notes, setNotes] = createSignal<TimedNote[]>([])
      // eslint-disable-next-line solid/reactivity -- read by the controller's own effect
      const controller = controllerWith('autotime-later', notes)

      paste(controller)
      await settle()
      expect(shown(controller)).toEqual([])
      expect(controller.lyricsLines()).toHaveLength(2)

      setNotes(twoPhrases())
      await settle()

      expect(shown(controller)).toEqual([12, 20])
      expect(controller.activeVersionKind()).toBe('auto-time')
      dispose()
    })
  })

  it('times untimed lyrics kept from an earlier visit', async () => {
    await saveLyricsToDb('autotime-revisit', {
      text: PASTE,
      format: 'txt',
      filename: 'song.txt',
      versions: [{ kind: 'imported', text: PASTE, createdAt: 1 }],
      activeVersionKind: 'imported',
    })
    await createRoot(async (dispose) => {
      const controller = controllerWith('autotime-revisit', twoPhrases)

      await controller.loadLyrics()
      await settle()

      expect(shown(controller)).toEqual([12, 20])
      expect(controller.activeVersionKind()).toBe('auto-time')
      dispose()
    })
  })

  it('leaves alone lyrics replaced by timed ones before the notes came', async () => {
    await createRoot(async (dispose) => {
      const [notes, setNotes] = createSignal<TimedNote[]>([])
      // eslint-disable-next-line solid/reactivity -- read by the controller's own effect
      const controller = controllerWith('autotime-replaced', notes)

      paste(controller)
      controller.handleLyricsUpload({
        text: '[00:05.00]Timed by hand',
        format: 'lrc',
        filename: 'song.lrc',
      })
      setNotes(twoPhrases())
      await settle()

      expect(controller.lrcLines().map((l) => [l.time, l.text])).toEqual([
        [5, 'Timed by hand'],
      ])
      expect(controller.activeVersionKind()).toBe('imported')
      dispose()
    })
  })

  it('leaves alone an LRC pasted with a tag on its first line', async () => {
    await createRoot(async (dispose) => {
      const controller = controllerWith('autotime-tagged', twoPhrases)

      // The paste box takes it for text: its first line has no time.
      paste(controller, '[ar:Someone]\n[00:11.80]First line here')
      await settle()

      expect(controller.activeVersionKind()).toBe('imported')
      expect(controller.lyricsVersions().map((v) => v.kind)).toEqual([
        'imported',
      ])
      dispose()
    })
  })

  it('does not time the lyrics while they are being mapped by hand', async () => {
    await createRoot(async (dispose) => {
      const [notes, setNotes] = createSignal<TimedNote[]>([])
      // eslint-disable-next-line solid/reactivity -- read by the controller's own effect
      const controller = controllerWith('autotime-tapping', notes)

      paste(controller)
      await settle()
      controller.startLrcGen()
      setNotes(twoPhrases())
      await settle()

      expect(controller.lrcGenMode()).toBe(true)
      expect(controller.lyricsVersions().map((v) => v.kind)).toEqual([
        'imported',
      ])
      dispose()
    })
  })

  it('keeps the Original once the singer switches back to it', async () => {
    await createRoot(async (dispose) => {
      const controller = controllerWith('autotime-switch', twoPhrases)

      paste(controller)
      await settle()
      controller.switchVersion('imported')
      await settle()

      expect(controller.activeVersionKind()).toBe('imported')
      expect(shown(controller)).toEqual([])
      dispose()
    })
  })

  it('keeps the Original a singer switched back to from their own mapping', async () => {
    await createRoot(async (dispose) => {
      const [notes, setNotes] = createSignal<TimedNote[]>([])
      // eslint-disable-next-line solid/reactivity -- read by the controller's own effect
      const controller = controllerWith('autotime-mapped', notes)

      paste(controller)
      // Mapped by hand, then back to the Original.
      controller.persistLyrics(
        '[00:11.00]First line of the song\n[00:19.00]Second line of the song',
        'lrc',
        'song.lrc',
        undefined,
        undefined,
        'lrc-gen',
      )
      controller.switchVersion('imported')
      setNotes(twoPhrases())
      await settle()

      expect(controller.activeVersionKind()).toBe('imported')
      expect(controller.lyricsVersions().map((v) => v.kind)).toEqual([
        'imported',
        'lrc-gen',
      ])
      dispose()
    })
  })

  it('does not make Auto-timed again once the singer deleted it, until new lyrics come', async () => {
    await createRoot(async (dispose) => {
      const controller = controllerWith('autotime-declined', twoPhrases)

      paste(controller)
      await settle()
      controller.deleteVersion('auto-time')
      await settle()

      expect(controller.activeVersionKind()).toBe('imported')
      expect(controller.lyricsVersions().map((v) => v.kind)).toEqual([
        'imported',
      ])
      // The saves go out one after another: the paste, Auto-timed, then the
      // delete. The paste's record is the Original too, so wait for the one
      // that carries the singer's no, or the later visit can read the paste
      // (or Auto-timed) before the delete has reached the store.
      await vi.waitFor(async () => {
        const stored = await loadLyricsFromDb('autotime-declined')
        expect(stored?.activeVersionKind).toBe('imported')
        expect(stored?.autoTimeDeclined).toBe(true)
        expect(stored?.versions?.map((v) => v.kind)).toEqual(['imported'])
      })
      dispose()
    })

    // A later visit keeps the Original too.
    await createRoot(async (dispose) => {
      const controller = controllerWith('autotime-declined', twoPhrases)

      await controller.loadLyrics()
      await settle()
      expect(controller.activeVersionKind()).toBe('imported')

      // New lyrics are a new start.
      paste(controller, 'Another first line\nAnother second line')
      await settle()
      expect(controller.activeVersionKind()).toBe('auto-time')
      dispose()
    })
  })

  it('leaves a tap-along left part-way on an earlier visit to the singer', async () => {
    const three =
      'First line of the song\nSecond line of the song\nThird line of the song'
    await createRoot(async (dispose) => {
      const controller = controllerWith('autotime-taps', () => [])

      paste(controller, three)
      await settle()
      // Two of the three lines tapped, and the page left.
      controller.startLrcGen()
      controller.handleNextLine()
      controller.handleNextLine()
      expect(controller.lrcGenMode()).toBe(true)
      dispose()
    })
    await vi.waitFor(async () => {
      expect((await loadLyricsFromDb('autotime-taps'))?.text).toBe(three)
    })

    await createRoot(async (dispose) => {
      const controller = controllerWith('autotime-taps', twoPhrases)

      await controller.loadLyrics()
      await settle()

      expect(controller.activeVersionKind()).toBe('imported')
      expect(controller.lyricsVersions().map((v) => v.kind)).toEqual([
        'imported',
      ])
      dispose()
    })
  })

  it('carries no repeats marked on the untimed lines into Auto-timed', async () => {
    // Marked on the lines as pasted, labels counted; the timed lines leave
    // the labels out, so the marks would land on the wrong lines.
    const text =
      '[Verse]\nFirst line of the song\n[Chorus]\nSecond line of the song'
    await saveLyricsToDb('autotime-blocks', {
      text,
      format: 'txt',
      filename: 'song.txt',
      blocks: [
        { id: 'b1', label: 'Chorus', lineIndices: [2, 3], repeatCount: 2 },
      ],
      versions: [{ kind: 'imported', text, createdAt: 1 }],
      activeVersionKind: 'imported',
    })
    await createRoot(async (dispose) => {
      const controller = controllerWith('autotime-blocks', twoPhrases)

      await controller.loadLyrics()
      await settle()

      expect(controller.activeVersionKind()).toBe('auto-time')
      expect(controller.blocks()).toEqual([])
      await vi.waitFor(async () => {
        const stored = await loadLyricsFromDb('autotime-blocks')
        expect(stored?.activeVersionKind).toBe('auto-time')
        expect(stored?.blocks).toBeUndefined()
      })
      dispose()
    })
  })

  it('takes deleting the singer’s own mapping as a no to timing the lyrics', async () => {
    await createRoot(async (dispose) => {
      const [notes, setNotes] = createSignal<TimedNote[]>([])
      // eslint-disable-next-line solid/reactivity -- read by the controller's own effect
      const controller = controllerWith('autotime-unmapped', notes)

      paste(controller)
      controller.persistLyrics(
        '[00:11.00]First line of the song\n[00:19.00]Second line of the song',
        'lrc',
        'song.lrc',
        undefined,
        undefined,
        'lrc-gen',
      )
      controller.deleteVersion('lrc-gen')
      setNotes(twoPhrases())
      await settle()

      expect(controller.activeVersionKind()).toBe('imported')
      expect(controller.lyricsVersions().map((v) => v.kind)).toEqual([
        'imported',
      ])
      dispose()
    })
  })

  it('times a text edit of untimed lyrics as well', async () => {
    await createRoot(async (dispose) => {
      const [notes, setNotes] = createSignal<TimedNote[]>([])
      // eslint-disable-next-line solid/reactivity -- read by the controller's own effect
      const controller = controllerWith('autotime-edited', notes)

      paste(controller)
      await settle()
      // A typo fixed before the notes came.
      controller.beginTextEdit()
      controller.applyTextEdit([
        {
          time: null,
          text: 'First line of this song',
          rawText: null,
          originalIndex: 0,
        },
        {
          time: null,
          text: 'Second line of this song',
          rawText: null,
          originalIndex: 1,
        },
      ])
      await settle()
      expect(controller.activeVersionKind()).toBe('edited')

      setNotes(twoPhrases())
      await settle()

      expect(controller.activeVersionKind()).toBe('auto-time')
      expect(controller.lrcLines().map((l) => [l.time, l.text])).toEqual([
        [12, 'First line of this song'],
        [20, 'Second line of this song'],
      ])
      dispose()
    })
  })

  it('spreads a paste as before when the song has no notes', async () => {
    await createRoot(async (dispose) => {
      const controller = controllerWith('autotime-none', () => [])

      paste(controller)
      await settle()

      expect(shown(controller)).toEqual([])
      expect(controller.lyricsLines()).toEqual([
        'First line of the song',
        'Second line of the song',
      ])
      expect(controller.activeVersionKind()).toBe('imported')
      dispose()
    })
  })
})
