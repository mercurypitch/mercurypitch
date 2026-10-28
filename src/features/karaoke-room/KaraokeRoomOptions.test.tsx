// ============================================================
// KaraokeRoomOptions: Find my key's notices stay in the sheet
// ============================================================
//
// Open, the sheet holds Find my key's notices and says them in its key row,
// because a toast would sit over the sheet. The room changes songs with the
// sheet open (autoplay, a song still loading as it opens), and each song's
// mixer hands over a key of its own, so the hold follows the key that is
// there now: the old song's lets go, the new song's holds until the sheet
// shuts.

import { cleanup, render } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { afterEach, describe, expect, it } from 'vitest'
import type { KeyShiftBinding } from '@/components/key-shift/KeyShiftControl'
import { KaraokeRoomOptions, notesRowSub, } from '@/features/karaoke-room/KaraokeRoomOptions'

afterEach(cleanup)

/** A song's key, writing down each hold and let-go it is asked for. */
function songKey(song: string, holds: string[]): KeyShiftBinding {
  return {
    value: () => 0,
    heard: () => 0,
    onChange: () => {},
    keyLabel: () => undefined,
    suggestion: () => null,
    onFindKey: () => {},
    disabledReason: () => undefined,
    notice: () => null,
    holdNotices: (held) => holds.push(`${song} ${held ? 'held' : 'let go'}`),
  }
}

function mountOptions() {
  const [open, setOpen] = createSignal(false)
  const [key, setKey] = createSignal<KeyShiftBinding | null>(null)
  const view = render(() => (
    <KaraokeRoomOptions
      isOpen={open()}
      close={() => setOpen(false)}
      notes={{
        offered: () => false,
        on: () => false,
        has: () => false,
        finding: () => false,
        progress: () => 0,
        toggle: () => {},
      }}
      musicPercent={() => null}
      onResetMusicLevel={() => {}}
      onAllSettings={() => {}}
      keyControl={key}
    />
  ))
  return { setOpen, setKey, unmount: view.unmount }
}

describe('Find my key notices while the sheet is open', () => {
  it('hold on the song that is there now, as songs change under the sheet', () => {
    const holds: string[] = []
    const { setOpen, setKey } = mountOptions()

    setOpen(true) // the first song is still loading: no key yet
    setKey(songKey('first', holds))
    setKey(null) // the next song is cued with the sheet open
    setKey(songKey('second', holds))
    setOpen(false)

    expect(holds).toEqual([
      'first held',
      'first let go',
      'second held',
      'second let go',
    ])
  })

  it('are let go when the room goes with the sheet open', () => {
    const holds: string[] = []
    const { setOpen, setKey, unmount } = mountOptions()
    setKey(songKey('only', holds))

    setOpen(true)
    unmount()

    expect(holds).toEqual(['only held', 'only let go'])
  })

  it('are not touched while the sheet stays shut', () => {
    const holds: string[] = []
    const { setKey } = mountOptions()

    setKey(songKey('first', holds))
    setKey(songKey('second', holds))

    expect(holds).toEqual([])
  })
})

describe('the notes row', () => {
  const notes = (has: boolean, finding: boolean, progress = 0) => ({
    offered: () => true,
    on: () => finding,
    has: () => has,
    finding: () => finding,
    progress: () => progress,
    toggle: () => {},
  })

  it('says a song has its notes, will have them read, or how far the read has got', () => {
    expect(notesRowSub(notes(true, false))).toBe('This song has its notes')
    expect(notesRowSub(notes(false, false))).toBe(
      'Turning this on reads them from the vocal',
    )
    expect(notesRowSub(notes(false, true, 42.6))).toBe(
      'Reading the vocal to find the notes: 43%',
    )
  })
})
