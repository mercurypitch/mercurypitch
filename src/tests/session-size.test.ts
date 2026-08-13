// What "how big is this song" should answer. The reported bug: a song
// whose stems occupy 25 MB showed 5 MB, because the chip rendered the
// uploaded MP3 rather than what separation produced from it — and showed
// nothing at all on a device that received the song by sync, which has
// the stems but never had the upload.

import { describe, expect, it } from 'vitest'
import { sessionSize, sessionSizeLabel } from '@/lib/session-size'
import type { UvrSession } from '@/stores/uvr-store'

const MB = 1024 * 1024

function session(patch: Partial<UvrSession>): UvrSession {
  return {
    id: 's1',
    status: 'complete',
    createdAt: 0,
    ...patch,
  } as UvrSession
}

const bytes = (n: number): string => `${Math.round(n / MB)} MB`

describe('sessionSize', () => {
  it('counts the stems, not the upload they came from', () => {
    const size = sessionSize(
      session({
        originalFile: { name: 'song.mp3', size: 5 * MB } as never,
        outputs: { vocal: 'v.m4a', instrumental: 'i.m4a' },
        stemMeta: { vocal: { size: 12 * MB }, instrumental: { size: 13 * MB } },
      }),
    )
    // The exact shape of the complaint: 5 MB shown where 25 MB is stored.
    expect(size.stemBytes).toBe(25 * MB)
    expect(size.originalBytes).toBe(5 * MB)
    expect(size.bytes).toBe(30 * MB)
    expect(size.complete).toBe(true)
  })

  it('has a figure for a song that arrived by sync', () => {
    // No originalFile: a portable bundle carries stems only. This is the
    // device most likely to be short of space, so a blank chip there is
    // the worst place for one.
    const size = sessionSize(
      session({
        outputs: { vocal: 'v.m4a', instrumental: 'i.m4a' },
        stemMeta: { vocal: { size: 9 * MB }, instrumental: { size: 11 * MB } },
      }),
    )
    expect(size.bytes).toBe(20 * MB)
    expect(size.originalBytes).toBe(0)
    expect(size.complete).toBe(true)
  })

  it('ignores MIDI transcriptions', () => {
    // Kilobytes against megabytes, and not audio — including them would
    // add noise to the number without moving it.
    const size = sessionSize(
      session({
        outputs: {
          vocal: 'v.m4a',
          instrumental: 'i.m4a',
          vocalMidi: 'v.mid',
          instrumentalMidi: 'i.mid',
        },
        stemMeta: { vocal: { size: 2 * MB }, instrumental: { size: 3 * MB } },
      }),
    )
    expect(size.bytes).toBe(5 * MB)
  })

  it('flags a total it cannot vouch for', () => {
    // Sessions separated before stem sizes were recorded have outputs and
    // no metadata. Presenting half a total as the whole is worse than
    // admitting the gap.
    const size = sessionSize(
      session({
        outputs: { vocal: 'v.m4a', instrumental: 'i.m4a' },
        stemMeta: { vocal: { size: 4 * MB } },
      }),
    )
    expect(size.bytes).toBe(4 * MB)
    expect(size.complete).toBe(false)
  })

  it('falls back to the upload when there are no stems yet', () => {
    const size = sessionSize(
      session({ originalFile: { name: 'a.mp3', size: 7 * MB } as never }),
    )
    expect(size.bytes).toBe(7 * MB)
    expect(size.complete).toBe(true)
  })
})

describe('sessionSizeLabel', () => {
  it('says nothing rather than claiming zero', () => {
    // A card with no chip reads as "no figure"; a card saying 0 Bytes
    // reads as a song that occupies nothing, which is never true of one
    // you can play.
    expect(sessionSizeLabel(session({}), bytes)).toBeNull()
  })

  it('marks an incomplete total as a floor', () => {
    expect(
      sessionSizeLabel(
        session({
          outputs: { vocal: 'v.m4a', instrumental: 'i.m4a' },
          stemMeta: { vocal: { size: 4 * MB } },
        }),
        bytes,
      ),
    ).toBe('≥ 4 MB')
  })

  it('states a complete total plainly', () => {
    expect(
      sessionSizeLabel(
        session({
          outputs: { vocal: 'v.m4a', instrumental: 'i.m4a' },
          stemMeta: { vocal: { size: 4 * MB }, instrumental: { size: 6 * MB } },
        }),
        bytes,
      ),
    ).toBe('10 MB')
  })
})
