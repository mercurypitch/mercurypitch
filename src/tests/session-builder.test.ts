// ============================================================
// Session Builder Tests
// Validates the pure helpers used by controllers and the LibraryTab.
// ============================================================

import { beforeEach, describe, expect, it, vi } from 'vitest'

const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: vi.fn((k: string) => store[k] ?? null),
    setItem: vi.fn((k: string, v: string) => {
      store[k] = v
    }),
    removeItem: vi.fn((k: string) => {
      delete store[k]
    }),
    clear: vi.fn(() => {
      store = {}
    }),
  }
})()
Object.defineProperty(global, 'localStorage', { value: localStorageMock })

import { buildScaleMelody, buildSessionItemMelody, buildSessionPlaybackMelody, firstPlayableSessionIndex, isSessionItemMelodyMissing, } from '@/lib/session-builder'
import { melodyStore } from '@/stores/melody-store'
import type { PlaybackSession, SessionItem } from '@/types'

describe('buildSessionItemMelody', () => {
  it('returns notes for a scale item', () => {
    const item: SessionItem = {
      id: 's1',
      type: 'scale' as 'rest',
      startBeat: 0,
      label: 'C Major',
      scaleType: 'major',
      beats: 8,
    }
    const built = buildSessionItemMelody(item)
    expect(built.length).toBeGreaterThan(0)
    // Each item should be a MelodyItem with a note.
    expect(built[0].note).toBeDefined()
    expect(built[0].note.midi).toBeGreaterThan(0)
  })

  it('returns empty for a rest item', () => {
    const item: SessionItem = {
      id: 'r1',
      type: 'rest',
      startBeat: 0,
      label: 'Rest',
      restMs: 1000,
    }
    expect(buildSessionItemMelody(item)).toEqual([])
  })

  // ── A melody item whose melody is gone ──────────────────────────
  //
  // This block replaces a test that asserted `built.length` was greater than
  // zero for a melodyId pointing at nothing — it pinned the defect in place.
  // What it was greater than zero WITH was one middle C, and the sequencer
  // then scored the singer against that C under the label of the melody they
  // had written.
  //
  // Deleting a melody deliberately leaves the session items referencing it,
  // so that `restoreMelody` — the undo sitting directly below `deleteMelody`
  // — can put things back. That makes "this item points at nothing" a real
  // state the app has to render, not a corruption to repair.

  const brokenItem: SessionItem = {
    id: 'u1',
    type: 'melody',
    startBeat: 0,
    label: 'Warm-up in D',
    melodyId: 'melody-that-was-deleted',
  }

  it('builds nothing for a melody that no longer exists', () => {
    expect(buildSessionItemMelody(brokenItem)).toEqual([])
  })

  it('reports the item as missing rather than leaving it to guess', () => {
    expect(isSessionItemMelodyMissing(brokenItem)).toBe(true)
  })

  it('comes back to life when the delete is undone', () => {
    // The whole reason the item is left dangling. A stored `missing: true`
    // flag would have to be un-set here by a second write; deriving it means
    // restoring the melody is the only thing that has to happen.
    const melody = {
      id: 'melody-that-was-deleted',
      name: 'Warm-up in D',
      key: 'D',
      scaleType: 'major',
      bpm: 90,
      created: Date.now(),
      items: [
        {
          id: 1,
          note: { midi: 62, name: 'D' as const, octave: 4, freq: 293.66 },
          startBeat: 0,
          duration: 1,
        },
      ],
    }
    melodyStore.restoreMelody(melody as never)

    expect(isSessionItemMelodyMissing(brokenItem)).toBe(false)
    expect(buildSessionItemMelody(brokenItem)).toHaveLength(1)
    expect(buildSessionItemMelody(brokenItem)[0].note.midi).toBe(62)

    melodyStore.deleteMelody('melody-that-was-deleted')
    expect(isSessionItemMelodyMissing(brokenItem)).toBe(true)
    expect(buildSessionItemMelody(brokenItem)).toEqual([])
  })

  it('calls a present-but-empty melody missing too', () => {
    // Same user-visible outcome — a lane with nothing to sing — and the same
    // C4 fallback used to hide it.
    melodyStore.restoreMelody({
      id: 'empty-melody',
      name: 'Empty',
      key: 'C',
      scaleType: 'major',
      bpm: 90,
      created: Date.now(),
      items: [],
    } as never)
    const item: SessionItem = {
      id: 'u2',
      type: 'melody',
      startBeat: 0,
      label: 'Empty',
      melodyId: 'empty-melody',
    }

    expect(buildSessionItemMelody(item)).toEqual([])
  })

  it('does not call a scale or rest item missing', () => {
    // isSessionItemMelodyMissing answers for melody items only. A rest builds
    // empty because it IS empty, and that must not read as broken.
    const rest: SessionItem = {
      id: 'r2',
      type: 'rest',
      startBeat: 0,
      label: 'Rest',
      restMs: 1000,
    }
    const scale: SessionItem = {
      id: 's2',
      type: 'scale' as 'rest',
      startBeat: 0,
      label: 'C Major',
      scaleType: 'major',
      beats: 8,
    }

    expect(isSessionItemMelodyMissing(rest)).toBe(false)
    expect(isSessionItemMelodyMissing(scale)).toBe(false)
  })

  it('falls back to the major scale when a custom one no longer parses', () => {
    // The singer asked for a scale and the definition is broken — which is not
    // the same as an item pointing at nothing, so it still produces notes.
    // buildMultiOctaveScale handles this itself, which is why the second
    // single-note fallback that used to sit in the scale branch was
    // unreachable and has been removed.
    const scale: SessionItem = {
      id: 's3',
      type: 'scale' as 'rest',
      startBeat: 0,
      label: 'Broken custom scale',
      scaleType: 'custom:C:Q,Z',
      beats: 4,
    }

    const built = buildSessionItemMelody(scale)
    expect(built).toHaveLength(4)
    expect(built.every((i) => i.note.midi > 0)).toBe(true)
  })

  it('uses major and eight beats when the item says neither', () => {
    // Legacy session items predate scaleType/beats; they must still build.
    const scale = {
      id: 's5',
      type: 'scale',
      startBeat: 0,
      label: 'Bare scale',
    } as unknown as SessionItem

    expect(buildSessionItemMelody(scale)).toHaveLength(8)
  })

  it('spans two octaves once the item is long enough to need them', () => {
    const short = {
      id: 's6',
      type: 'scale',
      startBeat: 0,
      label: 'Twelve',
      scaleType: 'major',
      beats: 12,
    } as unknown as SessionItem
    const long = { ...short, id: 's7', beats: 13 } as SessionItem

    const shortNotes = buildSessionItemMelody(short).map((i) => i.note.midi)
    const longNotes = buildSessionItemMelody(long).map((i) => i.note.midi)

    // One octave caps out at 8 rows; the two-octave build has more to give.
    expect(shortNotes).toHaveLength(8)
    expect(longNotes.length).toBeGreaterThan(shortNotes.length)
  })

  it('builds nothing for a scale item of zero beats', () => {
    const scale: SessionItem = {
      id: 's4',
      type: 'scale' as 'rest',
      startBeat: 0,
      label: 'No beats',
      scaleType: 'major',
      beats: 0,
    }

    expect(buildSessionItemMelody(scale)).toEqual([])
  })

  it('builds a preset from the items it carries', () => {
    const preset: SessionItem = {
      id: 'p1',
      type: 'preset' as 'rest',
      startBeat: 0,
      label: 'Five-tone',
      items: [
        {
          id: 9,
          note: { midi: 65, name: 'F', octave: 4, freq: 349.23 },
          startBeat: 0,
          duration: 2,
        },
      ],
    } as SessionItem

    const built = buildSessionItemMelody(preset)
    expect(built.map((i) => i.note.midi)).toEqual([65])
    expect(built[0].duration).toBe(2)
  })

  it('falls back for a preset that carries nothing', () => {
    // Unlike a melody item, a preset names no external record — there is
    // nothing that could have been deleted, so an empty one is a malformed
    // item rather than a broken reference, and it is not reported as missing.
    const preset: SessionItem = {
      id: 'p2',
      type: 'preset' as 'rest',
      startBeat: 0,
      label: 'Empty preset',
    } as SessionItem

    expect(buildSessionItemMelody(preset)).toHaveLength(1)
    expect(isSessionItemMelodyMissing(preset)).toBe(false)
  })

  it('falls back for a melody item with no melodyId at all', () => {
    // Not the deleted-melody case: this item never named a melody, so there
    // is nothing to tell the singer was lost.
    const item: SessionItem = {
      id: 'm0',
      type: 'melody',
      startBeat: 0,
      label: 'Unattached',
    }

    expect(buildSessionItemMelody(item)).toHaveLength(1)
    expect(isSessionItemMelodyMissing(item)).toBe(false)
  })
})

describe('buildSessionPlaybackMelody', () => {
  it('omits an item whose melody was deleted, rather than inserting a C4', () => {
    // The concatenated melody is what "Play All in sequence" scores against.
    // With the middle-C fallback, a deleted melody contributed one C4 note in
    // the middle of the run and the singer was marked on it.
    melodyStore.restoreMelody({
      id: 'still-here',
      name: 'Still here',
      key: 'C',
      scaleType: 'major',
      bpm: 90,
      created: 0,
      items: [
        {
          id: 1,
          note: { midi: 62, name: 'D', octave: 4, freq: 293.66 },
          startBeat: 0,
          duration: 1,
        },
      ],
    } as never)
    const session: PlaybackSession = {
      id: 'with-a-hole',
      name: 'With a hole',
      created: Date.now(),
      items: [
        {
          id: 'a',
          type: 'melody',
          startBeat: 0,
          label: 'A',
          melodyId: 'still-here',
        },
        { id: 'b', type: 'melody', startBeat: 0, label: 'B', melodyId: 'gone' },
        {
          id: 'c',
          type: 'melody',
          startBeat: 0,
          label: 'C',
          melodyId: 'still-here',
        },
      ],
    } as PlaybackSession

    const { items, durationBeats } = buildSessionPlaybackMelody(session)

    expect(items.map((i) => i.note.midi)).toEqual([62, 62])
    expect(items.map((i) => i.startBeat)).toEqual([0, 1])
    // The gap contributes no time either — a deleted melody is not a rest.
    expect(durationBeats).toBe(2)
  })

  it('advances past a rest with no explicit length', () => {
    const session: PlaybackSession = {
      id: 'bare-rest',
      name: 'Bare rest',
      created: Date.now(),
      items: [{ id: 'r', type: 'rest', startBeat: 0, label: 'Rest' }],
    } as PlaybackSession

    // 2000 ms at the helper's 500 ms-per-beat approximation.
    expect(buildSessionPlaybackMelody(session).durationBeats).toBe(4)
  })

  it('concatenates all session items, shifting startBeats sequentially', () => {
    const session: PlaybackSession = {
      id: 'concat',
      name: 'Concat',
      created: Date.now(),
      deletable: true,
      items: [
        {
          id: 'a',
          type: 'scale' as 'rest',
          startBeat: 0,
          label: 'A',
          scaleType: 'major',
          beats: 4,
        },
        {
          id: 'b',
          type: 'scale' as 'rest',
          startBeat: 0,
          label: 'B',
          scaleType: 'major',
          beats: 4,
        },
      ],
    }
    const { items, durationBeats } = buildSessionPlaybackMelody(session)
    expect(items.length).toBeGreaterThan(0)
    expect(durationBeats).toBeGreaterThan(0)
    // Items must be sorted by startBeat ascending.
    for (let i = 1; i < items.length; i++) {
      expect(items[i].startBeat).toBeGreaterThanOrEqual(items[i - 1].startBeat)
    }
  })

  it('advances offset for rest items', () => {
    const session: PlaybackSession = {
      id: 'rest',
      name: 'Rest',
      created: Date.now(),
      deletable: true,
      items: [
        {
          id: 'r',
          type: 'rest',
          startBeat: 0,
          label: 'Rest',
          restMs: 2000,
        },
      ],
    }
    const { items, durationBeats } = buildSessionPlaybackMelody(session)
    expect(items).toEqual([])
    // Rest still advances duration so the playback runtime knows to wait.
    expect(durationBeats).toBeGreaterThan(0)
  })
})

describe('buildScaleMelody', () => {
  it('writes scale items into the melody store', () => {
    melodyStore.setMelody([])
    expect(melodyStore.items()).toHaveLength(0)
    buildScaleMelody('major', 8)
    expect(melodyStore.items().length).toBeGreaterThan(0)
  })
})

describe('firstPlayableSessionIndex', () => {
  // A REGRESSION FOUND IN REVIEW. The sequencer skips a deleted melody for
  // items 2..N, but item 1 is built by usePlaybackController on a path that
  // never reaches that guard. Once buildSessionItemMelody returned [] for a
  // missing melody, that empty result fell through to the controller's
  // "nothing loaded, generate a scale" branch — so pressing Play on a session
  // whose first melody had been deleted started an eight-note scale under
  // that melody's name. Worse than the single middle C it replaced.

  const melodyItem = (id: string, melodyId: string): SessionItem => ({
    id,
    type: 'melody',
    startBeat: 0,
    label: `Item ${id}`,
    melodyId,
  })

  beforeEach(() => {
    melodyStore.restoreMelody({
      id: 'present',
      name: 'Present',
      key: 'C',
      scaleType: 'major',
      bpm: 90,
      created: 0,
      items: [
        {
          id: 1,
          note: { midi: 60, name: 'C', octave: 4, freq: 261.63 },
          startBeat: 0,
          duration: 1,
        },
      ],
    } as never)
  })

  it('starts on item one when it is playable', () => {
    expect(
      firstPlayableSessionIndex([
        melodyItem('a', 'present'),
        melodyItem('b', 'gone'),
      ]),
    ).toBe(0)
  })

  it('skips a leading deleted melody', () => {
    expect(
      firstPlayableSessionIndex([
        melodyItem('a', 'gone'),
        melodyItem('b', 'present'),
      ]),
    ).toBe(1)
  })

  it('skips a run of them', () => {
    expect(
      firstPlayableSessionIndex([
        melodyItem('a', 'gone'),
        melodyItem('b', 'also-gone'),
        melodyItem('c', 'present'),
      ]),
    ).toBe(2)
  })

  it('reports past the end when every melody is gone', () => {
    // The caller reads this as "nothing here to play" rather than indexing
    // into it — items[length] is undefined, which the play path already
    // guards.
    const items = [melodyItem('a', 'gone'), melodyItem('b', 'also-gone')]
    expect(firstPlayableSessionIndex(items)).toBe(items.length)
  })

  it('never skips a rest or a scale', () => {
    // Only a melody item can point at something deleted. A rest builds empty
    // because it IS empty, and starting a session by silently skipping the
    // singer's warm-up rest would be its own bug.
    const rest: SessionItem = {
      id: 'r',
      type: 'rest',
      startBeat: 0,
      label: 'Rest',
      restMs: 1000,
    }
    expect(firstPlayableSessionIndex([rest, melodyItem('b', 'gone')])).toBe(0)
  })

  it('is empty-safe', () => {
    expect(firstPlayableSessionIndex([])).toBe(0)
  })
})
