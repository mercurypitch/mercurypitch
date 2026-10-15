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
import { KaraokeRoomOptions } from '@/features/karaoke-room/KaraokeRoomOptions'

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
      hasNotes={() => false}
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
