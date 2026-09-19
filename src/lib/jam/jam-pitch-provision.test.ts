// ── Jam pitch provisioning tests ─────────────────────────────────────
// Two questions, answered away from the async machinery that acts on
// them: whose job is it to work out this song's vocal line, and what
// does the lane area say while nobody has.
//
// The second matters as much as the first. A room with no target notes
// drew empty lanes and said nothing at all, so "this song has no guide",
// "the guide is being worked out" and "the guide failed" were one
// picture -- and that picture looked like a broken app.

import { describe, expect, it } from 'vitest'
import { GUEST_NO_GUIDE_REASON, GUEST_WAITING_REASON, JAM_PITCH_IDLE, jamPitchBanner, jamPitchNeed, NO_VOCAL_STEM_REASON, NOT_ANALYSABLE_REASON, VOCAL_LEFT_WITH_HOST_REASON, } from '@/lib/jam/jam-pitch-provision'
import type { JamSong } from '@/lib/jam/jam-song'
import type { JamSongNote } from '@/lib/jam/types'

function song(over: Partial<JamSong> = {}): JamSong {
  return {
    id: 'session:abc123',
    title: 'A Song',
    stems: { instrumental: 'blob:inst', vocal: 'blob:vox' },
    lines: [],
    notes: [],
    durationSec: 120,
    origin: 'local',
    ...over,
  }
}

const NOTE: JamSongNote = { midi: 60, startSec: 0, endSec: 1 }

describe('jamPitchNeed', () => {
  it('does nothing about a song that already has its line', () => {
    expect(jamPitchNeed(song({ notes: [NOTE] }), true)).toEqual({
      kind: 'have',
    })
    expect(jamPitchNeed(song({ notes: [NOTE] }), false)).toEqual({
      kind: 'have',
    })
  })

  it('does nothing about no song at all', () => {
    expect(jamPitchNeed(null, true)).toEqual({ kind: 'have' })
  })

  it('makes the host the one who analyses', () => {
    expect(jamPitchNeed(song(), true)).toEqual({
      kind: 'analyse',
      sessionId: 'abc123',
      vocalUrl: 'blob:vox',
    })
  })

  it('leaves a guest waiting rather than analysing in parallel', () => {
    // Every device could analyse the demo -- its stems are public -- and
    // every device doing it would be six phones spending a minute of CPU
    // to reach the same answer. The host sends the line instead.
    expect(jamPitchNeed(song(), false)).toEqual({ kind: 'wait' })
  })

  it('replaces a raw line, because nobody ever cleaned it up', () => {
    // A stored merge from before the clean-up pass existed. "There are
    // notes" used to end the question, so such a song stayed noisy in every
    // room, for ever.
    const raw = song({ notes: [NOTE], notesFrom: 'raw' })
    expect(jamPitchNeed(raw, true)).toEqual({
      kind: 'analyse',
      sessionId: 'abc123',
      vocalUrl: 'blob:vox',
    })
  })

  it('leaves a raw line alone when nothing better can be made', () => {
    // No vocal track, or a guest: the raw line is still a line.
    const noVocal = song({
      notes: [NOTE],
      notesFrom: 'raw',
      stems: { instrumental: 'blob:inst' },
    })
    expect(jamPitchNeed(noVocal, true)).toEqual({ kind: 'have' })
    expect(
      jamPitchNeed(song({ notes: [NOTE], notesFrom: 'raw' }), false),
    ).toEqual({ kind: 'have' })
  })

  it('never redoes a line its owner corrected by hand', () => {
    for (const notesFrom of ['saved', 'edited', 'room'] as const) {
      expect(jamPitchNeed(song({ notes: [NOTE], notesFrom }), true)).toEqual({
        kind: 'have',
      })
    }
  })

  it('does not try to fetch a vocal track that left with the last host', () => {
    // A song only its host held reaches the room as that host's own blob
    // addresses, stamped `origin: 'url'` on arrival. Inherit the room and
    // the address points at a device that has gone: fetching fails, and so
    // would every Try again.
    const inherited = song({ origin: 'url' })
    expect(jamPitchNeed(inherited, true)).toEqual({
      kind: 'cannot',
      reason: VOCAL_LEFT_WITH_HOST_REASON,
    })
    // The host's OWN blob is fine -- that is what a separation is.
    expect(jamPitchNeed(song({ origin: 'local' }), true).kind).toBe('analyse')
  })

  it('finds any example under its own id', () => {
    const example = song({
      id: 'karaoke-night-demo:josephine',
      stems: { instrumental: 'https://x/i.m4a', vocal: 'https://x/v.m4a' },
      origin: 'url',
    })
    expect(jamPitchNeed(example, true)).toEqual({
      kind: 'analyse',
      sessionId: 'karaoke-night-demo:josephine',
      vocalUrl: 'https://x/v.m4a',
    })
  })

  it('finds the demo under its own id, not only a session one', () => {
    expect(jamPitchNeed(song({ id: 'karaoke-night-demo' }), true)).toEqual({
      kind: 'analyse',
      sessionId: 'karaoke-night-demo',
      vocalUrl: 'blob:vox',
    })
  })

  it('says so plainly when there is no vocal track to work from', () => {
    const need = jamPitchNeed(
      song({ stems: { instrumental: 'blob:inst' } }),
      true,
    )
    expect(need).toEqual({ kind: 'cannot', reason: NO_VOCAL_STEM_REASON })
  })

  it('refuses a song that has no analysable source at all', () => {
    // A drill, a saved melody, the weekly challenge: these carry their
    // notes by construction, so an empty list means the room is running
    // something that simply has none.
    for (const id of ['exercise:major-scale', 'melody:42', 'session:', '']) {
      expect(jamPitchNeed(song({ id }), true)).toEqual({
        kind: 'cannot',
        reason: NOT_ANALYSABLE_REASON,
      })
    }
  })
})

describe('jamPitchBanner', () => {
  const working = {
    ...JAM_PITCH_IDLE,
    phase: 'working' as const,
    progress: 42,
    songId: 'session:abc123',
  }
  const broken = {
    ...JAM_PITCH_IDLE,
    phase: 'unavailable' as const,
    songId: 'session:abc123',
    reason: 'It did not finish.',
    retryable: true,
  }

  it('says where the line came from, once there is one', () => {
    // It used to say nothing here, so a line cleaned up a minute ago and a
    // room where nothing had happened looked exactly alike.
    for (const notesFrom of ['saved', 'edited', 'room'] as const) {
      expect(
        jamPitchBanner(
          JAM_PITCH_IDLE,
          song({ notes: [NOTE], notesFrom }),
          true,
        ),
      ).toEqual({ kind: 'ready', credit: notesFrom })
    }
  })

  it('calls a raw line a saved one, which is all it is to a singer', () => {
    const raw = song({ notes: [NOTE], notesFrom: 'raw' })
    expect(jamPitchBanner(JAM_PITCH_IDLE, raw, true)).toEqual({
      kind: 'ready',
      credit: 'saved',
    })
  })

  it('tells a guest the line is the host one, and an heir to the room nothing', () => {
    // Notes that arrived over the wire carry no provenance. "From the host"
    // is true for a guest; for whoever inherited the room it would now mean
    // somebody who has left.
    const wired = song({ notes: [NOTE], origin: 'url' })
    expect(jamPitchBanner(JAM_PITCH_IDLE, wired, false)).toEqual({
      kind: 'ready',
      credit: 'host',
    })
    expect(jamPitchBanner(JAM_PITCH_IDLE, wired, true)).toEqual({
      kind: 'none',
    })
  })

  it('shows the work while a raw line is being replaced', () => {
    const raw = song({ notes: [NOTE], notesFrom: 'raw' })
    expect(jamPitchBanner(working, raw, true)).toEqual({
      kind: 'working',
      progress: 42,
    })
  })

  it('lets a line outrank the failure to make a better one', () => {
    const sung = song({ notes: [NOTE], notesFrom: 'saved' })
    expect(jamPitchBanner(broken, sung, true)).toEqual({
      kind: 'ready',
      credit: 'saved',
    })
  })

  it('stops telling a guest to wait for a host who has already tried', () => {
    const none = song({ origin: 'url', pitchGuide: 'unavailable' })
    expect(jamPitchBanner(JAM_PITCH_IDLE, none, false)).toEqual({
      kind: 'unavailable',
      message: GUEST_NO_GUIDE_REASON,
      retry: false,
    })
  })

  it('shows how far the analysis has got', () => {
    expect(jamPitchBanner(working, song(), true)).toEqual({
      kind: 'working',
      progress: 42,
    })
  })

  it('offers the host a retry and never offers a guest one', () => {
    expect(jamPitchBanner(broken, song(), true)).toEqual({
      kind: 'unavailable',
      message: 'It did not finish.',
      retry: true,
    })
    // A guest pressing Try again would analyse a stem they may not even
    // hold, and could not send the result anyway.
    expect(jamPitchBanner(broken, song(), false)).toEqual({
      kind: 'unavailable',
      message: 'It did not finish.',
      retry: false,
    })
  })

  it('does not offer a retry for something retrying cannot fix', () => {
    expect(
      jamPitchBanner({ ...broken, retryable: false }, song(), true),
    ).toEqual({
      kind: 'unavailable',
      message: 'It did not finish.',
      retry: false,
    })
  })

  it('never captions one song with the state of another', () => {
    // The analysis outlives the song that started it. A run still
    // finishing for the last pick must not draw a progress bar under the
    // one the singer just chose.
    const other = song({ id: 'session:zzz' })
    expect(jamPitchBanner(working, other, true)).toEqual({ kind: 'none' })
    expect(jamPitchBanner(broken, other, false)).toEqual({
      kind: 'unavailable',
      message: GUEST_WAITING_REASON,
      retry: false,
    })
  })

  it('tells a guest who to wait for, and tells the host nothing yet', () => {
    expect(jamPitchBanner(JAM_PITCH_IDLE, song(), false)).toEqual({
      kind: 'unavailable',
      message: GUEST_WAITING_REASON,
      retry: false,
    })
    // The host is between picking the song and the first frame of
    // analysis. A message that appears for one tick and vanishes is
    // worse than no message.
    expect(jamPitchBanner(JAM_PITCH_IDLE, song(), true)).toEqual({
      kind: 'none',
    })
  })

  it('says nothing at all when no song is loaded', () => {
    expect(jamPitchBanner(working, null, true)).toEqual({ kind: 'none' })
  })
})
