// ============================================================
// Auto-selecting the Default Session's melody for a voice type
// ============================================================
//
// Opening the app on the Default Session is supposed to light the major scale
// that sits in your voice's octave. It never did. The effect that drives it
// handed the loader a SESSION ITEM id where a MELODY id was wanted, and the
// loader resolves its argument against the melody library, so the lookup
// missed every time.
//
// A miss used to return in silence, which is why nobody noticed a feature that
// had never once worked. Then the loader learned to warn on a miss — a session
// item can legitimately outlive its melody, and a pill that did nothing at all
// was worse than one that explained itself. From that moment the dead lookup
// spoke up, and every page load on the Default Session announced "That melody
// was deleted." about a melody sitting right there in the library. The default
// voice type is `tenor` and the default session carries its scale, so this hit
// every singer who had not changed a setting.
//
// The assertions that matter are the two halves of that:
//
//   1. what comes back is a melody id — one the library can actually resolve;
//   2. nothing comes back at all when it cannot be resolved, because this runs
//      off an effect, not off a click, and a real miss must stay quiet.
//
// The session comes from the real store rather than a hand-rolled fixture on
// purpose: the whole defect lives in the gap between an item's `id` and its
// `melodyId`, and a fixture that made them equal would test nothing.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { isVocalRangeMelody, pickVocalRangeMelody, vocalRangeMelodyId, } from '@/lib/vocal-range'
import type { VocalRangePreset } from '@/stores/settings-store'
import type { PlaybackSession } from '@/types'

const ALL_PRESETS: VocalRangePreset[] = [
  'soprano',
  'mezzo-soprano',
  'alto',
  'tenor',
  'baritone',
  'bass',
]

/**
 * The real seeded library and its Default Session — generated item ids, real
 * melody rows, exactly what a first launch produces.
 */
async function seededApp(): Promise<{
  session: PlaybackSession
  melodyExists: (id: string) => boolean
}> {
  const store = await import('@/stores/melody-store')
  store.seedDefaultSession()
  const { getDefaultSession } = await import('@/stores/session-store')
  return {
    session: getDefaultSession(),
    melodyExists: (id) => store.getMelody(id) !== undefined,
  }
}

/** A session built by hand, for the shapes the real one cannot produce. */
function sessionOf(
  id: string,
  items: PlaybackSession['items'],
): PlaybackSession {
  return { id, name: 'Session', deletable: true, created: 0, items }
}

beforeEach(() => {
  localStorage.clear()
  vi.resetModules()
})

describe('vocalRangeMelodyId', () => {
  it('roots the scale in the voice type default octave', () => {
    // Straight off VOCAL_RANGES.defaultOctave: bass/baritone 2, tenor/alto 3,
    // soprano/mezzo 4.
    expect(vocalRangeMelodyId('bass')).toBe('scale-major-c2')
    expect(vocalRangeMelodyId('baritone')).toBe('scale-major-c2')
    expect(vocalRangeMelodyId('tenor')).toBe('scale-major-c3')
    expect(vocalRangeMelodyId('alto')).toBe('scale-major-c3')
    expect(vocalRangeMelodyId('soprano')).toBe('scale-major-c4')
    expect(vocalRangeMelodyId('mezzo-soprano')).toBe('scale-major-c4')
  })
})

describe('pickVocalRangeMelody', () => {
  it('returns an id the melody library can resolve, not the item id', async () => {
    const { session, melodyExists } = await seededApp()
    const { getMelody } = await import('@/stores/melody-store')

    // `tenor` is the shipped default preset, so this is the path every new
    // singer takes on their first load.
    const picked = pickVocalRangeMelody(session, 'tenor', melodyExists, null)

    // The regression, stated as plainly as it can be: feed this to
    // `melodyStore.getMelody` and something comes back. The old code returned
    // `match.id` — a `generateSessionItemId()` value — and the library had
    // nothing under it, which is what produced "That melody was deleted."
    expect(picked).toBe('scale-major-c3')
    expect(getMelody(picked as string)).toBeDefined()
  })

  it('never hands back a session item id, whatever the voice type', async () => {
    const { session, melodyExists } = await seededApp()
    const itemIds = session.items.map((item) => item.id)

    // Item ids are generated keys; melody ids name library rows. Nothing may
    // cross between them — otherwise the test above passes by coincidence.
    // Voice types the default session does not carry return null, which is
    // also not an item id.
    for (const preset of ALL_PRESETS) {
      const picked = pickVocalRangeMelody(session, preset, melodyExists, null)
      expect(itemIds).not.toContain(picked)
      expect(picked === null || picked === vocalRangeMelodyId(preset)).toBe(
        true,
      )
    }
  })

  it('matches on melodyId rather than taking the first melody in the session', () => {
    // The default session leads with C major, so a bug that grabbed the first
    // melody item would look right for a tenor and wrong for everyone else.
    const session = sessionOf('default', [
      { id: 'item-a', type: 'melody', startBeat: 0, label: 'C', melodyId: 'scale-major-c3' }, // prettier-ignore
      { id: 'item-b', type: 'melody', startBeat: 16, label: 'Low C', melodyId: 'scale-major-c2' }, // prettier-ignore
    ])

    expect(pickVocalRangeMelody(session, 'bass', () => true, null)).toBe(
      'scale-major-c2',
    )
  })

  it('stays quiet when the melody is gone from the library', async () => {
    const { session } = await seededApp()

    // A session item outliving its melody is a supported state — it is why
    // the loader warns at all. But this path is an effect firing on load, not
    // the singer pressing a pill, so it declines to call the loader rather
    // than borrowing the loader's warning.
    expect(pickVocalRangeMelody(session, 'tenor', () => false, null)).toBeNull()
  })

  it('stays quiet when the session does not carry that voice type', async () => {
    const { session, melodyExists } = await seededApp()

    // The shipped default session holds C and G major in octave 3 only, so a
    // bass finds nothing to open even with a fully stocked library. Quietly
    // is the only acceptable way to find nothing.
    expect(pickVocalRangeMelody(session, 'bass', melodyExists, null)).toBeNull()
  })

  it('ignores rests, which have no melody to open', () => {
    // A rest whose item id happens to spell a melody id is the exact shape the
    // old code could not tell apart.
    const session = sessionOf('default', [
      { id: 'scale-major-c3', type: 'rest', startBeat: 0, label: 'Rest', restMs: 8000 }, // prettier-ignore
    ])

    expect(pickVocalRangeMelody(session, 'tenor', () => true, null)).toBeNull()
  })

  it('only auto-selects on the Default Session', () => {
    const session = sessionOf('my-warmup', [
      { id: 'item-a', type: 'melody', startBeat: 0, label: 'C', melodyId: 'scale-major-c3' }, // prettier-ignore
    ])

    // Someone else's session is theirs to arrange; moving their selection
    // because of a settings value would be an edit they did not ask for.
    expect(pickVocalRangeMelody(session, 'tenor', () => true, null)).toBeNull()
  })

  it('handles having no session at all', () => {
    // `userSession` is null before one is chosen, and the effect runs anyway —
    // it is registered with `defer: false`.
    expect(pickVocalRangeMelody(null, 'tenor', () => true, null)).toBeNull()
    expect(
      pickVocalRangeMelody(undefined, 'tenor', () => true, null),
    ).toBeNull()
  })
})

// ============================================================
// Not at the cost of what is already open
// ============================================================
//
// This is the refusal that only became necessary once the rest of it worked.
// Loading a melody REPLACES the contents of the piano roll, and the effect
// that calls this is keyed on the session — so the first build of the fix
// wiped a 498-note import the moment the session settled underneath it. A
// convenience is not allowed to destroy work.
//
// It was caught by an e2e that had nothing to do with voice types
// (`compose-bigsong.spec.ts`, which imports a 267-bar song and measures the
// roll). These are the same rule, stated where it lives.

describe('pickVocalRangeMelody leaves the roll alone when it holds real work', () => {
  it('declines when the singer has their own melody open', () => {
    const session = sessionOf('default', [
      { id: 'item-a', type: 'melody', startBeat: 0, label: 'C', melodyId: 'scale-major-c3' }, // prettier-ignore
    ])

    // An import, an edit, a recording — anything that is not one of the
    // handful of scales this feature owns.
    expect(
      pickVocalRangeMelody(
        session,
        'tenor',
        () => true,
        'melody-1786813267641',
      ),
    ).toBeNull()
  })

  it('declines when its own scale is already the one open', () => {
    const session = sessionOf('default', [
      { id: 'item-a', type: 'melody', startBeat: 0, label: 'C', melodyId: 'scale-major-c3' }, // prettier-ignore
    ])

    // Nothing to do, and reloading would throw away an edit to the scale
    // itself. The effect re-runs on every session change, so this is the
    // common case rather than an edge one.
    expect(
      pickVocalRangeMelody(session, 'tenor', () => true, 'scale-major-c3'),
    ).toBeNull()
  })

  it('still swaps one of its own scales for another', () => {
    const session = sessionOf('default', [
      { id: 'item-a', type: 'melody', startBeat: 0, label: 'C3', melodyId: 'scale-major-c3' }, // prettier-ignore
      { id: 'item-b', type: 'melody', startBeat: 16, label: 'C2', melodyId: 'scale-major-c2' }, // prettier-ignore
    ])

    // The feature itself: a bass arrives on the tenor's scale — which is what
    // a fresh install loads — and gets their own. Replacing a scale this put
    // there is the one replacement it is entitled to make.
    expect(
      pickVocalRangeMelody(session, 'bass', () => true, 'scale-major-c3'),
    ).toBe('scale-major-c2')
  })
})

describe('isVocalRangeMelody', () => {
  it('claims exactly the scales the auto-select can load', () => {
    // Octaves 2, 3 and 4 — every VOCAL_RANGES.defaultOctave there is.
    expect(isVocalRangeMelody('scale-major-c2')).toBe(true)
    expect(isVocalRangeMelody('scale-major-c3')).toBe(true)
    expect(isVocalRangeMelody('scale-major-c4')).toBe(true)

    // A scale nobody's default octave points at is still somebody's work.
    expect(isVocalRangeMelody('scale-major-c5')).toBe(false)
    expect(isVocalRangeMelody('scale-major-g3')).toBe(false)
    expect(isVocalRangeMelody('melody-1786813267641')).toBe(false)
  })
})
