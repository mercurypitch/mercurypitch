// ── Jam view preference tests ────────────────────────────────────────
// localStorage is an untyped input. Everything in this module reads a
// value someone else's build wrote, or that a hand-edit left half
// finished, and hands it straight to a grid template or to a divisor.
// A NaN split share is a room with no lyrics in it and no way back; a
// NaN zoom is a lane that draws nothing at all. So the validators are
// the feature, and they are tested against what storage can really
// return rather than against the happy value.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { JAM_ZOOM_MAX, JAM_ZOOM_MIN } from '@/lib/jam/jam-lane-zoom'
import { JAM_LYRICS_SCALE_DEFAULT, JAM_LYRICS_SCALE_MAX, JAM_LYRICS_SCALE_MIN, } from '@/lib/jam/jam-lyrics-scale'
import { isJamLyricsAlign, isJamStackedShare, isJamWideShare, JAM_LANE_ZOOM_KEY, JAM_LYRICS_ALIGN_KEY, JAM_LYRICS_SCALE_KEY, JAM_SPLIT_STACKED_DEFAULT, JAM_SPLIT_STACKED_KEY, JAM_SPLIT_STACKED_MAX, JAM_SPLIT_STACKED_MIN, JAM_SPLIT_WIDE_DEFAULT, JAM_SPLIT_WIDE_KEY, JAM_SPLIT_WIDE_MAX, JAM_SPLIT_WIDE_MIN, jamLaneZoom, jamLyricsScale, jamSplitBounds, jamSplitShare, resetJamSplitShare, setJamLaneZoom, setJamLyricsAlign, setJamLyricsScale, setJamSplitShare, } from '@/lib/jam/jam-view-prefs'

/** Everything localStorage can hand back that is not a share. */
const NOT_A_NUMBER: unknown[] = [
  '50',
  null,
  undefined,
  {},
  [],
  Number.NaN,
  Number.POSITIVE_INFINITY,
  true,
]

describe('isJamLyricsAlign', () => {
  it('takes the three alignments and nothing else', () => {
    expect(isJamLyricsAlign('left')).toBe(true)
    expect(isJamLyricsAlign('center')).toBe(true)
    expect(isJamLyricsAlign('right')).toBe(true)
    for (const bad of ['centre', 'justify', '', null, undefined, 0, {}]) {
      expect(isJamLyricsAlign(bad)).toBe(false)
    }
  })
})

describe('the share validators', () => {
  it('refuse a value that would collapse one side of the stage', () => {
    expect(isJamWideShare(JAM_SPLIT_WIDE_MIN)).toBe(true)
    expect(isJamWideShare(JAM_SPLIT_WIDE_MAX)).toBe(true)
    expect(isJamWideShare(JAM_SPLIT_WIDE_MIN - 0.5)).toBe(false)
    expect(isJamWideShare(JAM_SPLIT_WIDE_MAX + 0.5)).toBe(false)
    expect(isJamWideShare(0)).toBe(false)
    expect(isJamWideShare(100)).toBe(false)
  })

  it('refuse everything that is not a finite number', () => {
    for (const bad of NOT_A_NUMBER) {
      expect(isJamWideShare(bad)).toBe(false)
      expect(isJamStackedShare(bad)).toBe(false)
    }
  })

  it('keep the two layouts on their own ranges', () => {
    // 28% of the height is a readable strip of lyrics on a phone only if
    // you never wanted to read them. The stacked floor is higher on
    // purpose, and one shared validator would have lost that.
    expect(isJamStackedShare(28)).toBe(false)
    expect(isJamWideShare(28)).toBe(true)
    expect(isJamStackedShare(JAM_SPLIT_STACKED_MAX)).toBe(true)
    expect(isJamWideShare(JAM_SPLIT_STACKED_MAX)).toBe(false)
  })
})

describe('jamSplitBounds', () => {
  it('reports the range the handle is allowed to move in', () => {
    expect(jamSplitBounds(false)).toEqual({
      min: JAM_SPLIT_WIDE_MIN,
      max: JAM_SPLIT_WIDE_MAX,
      fallback: JAM_SPLIT_WIDE_DEFAULT,
    })
    expect(jamSplitBounds(true)).toEqual({
      min: JAM_SPLIT_STACKED_MIN,
      max: JAM_SPLIT_STACKED_MAX,
      fallback: JAM_SPLIT_STACKED_DEFAULT,
    })
  })
})

describe('the live signals', () => {
  beforeEach(() => {
    setJamLaneZoom(JAM_ZOOM_MIN)
    setJamLyricsAlign('center')
    setJamLyricsScale(JAM_LYRICS_SCALE_DEFAULT)
    resetJamSplitShare(false)
    resetJamSplitShare(true)
  })

  it('clamps a lyric size in the setter, at both ends', () => {
    // A wheel and a pinch both overshoot as a matter of course. Stored
    // unclamped, the value would fail its own validator on the next load
    // and the viewer would be quietly put back to 100%.
    expect(setJamLyricsScale(99)).toBe(JAM_LYRICS_SCALE_MAX)
    expect(jamLyricsScale()).toBe(JAM_LYRICS_SCALE_MAX)
    expect(localStorage.getItem(JAM_LYRICS_SCALE_KEY)).toBe(
      String(JAM_LYRICS_SCALE_MAX),
    )
    expect(setJamLyricsScale(0)).toBe(JAM_LYRICS_SCALE_MIN)
    expect(jamLyricsScale()).toBe(JAM_LYRICS_SCALE_MIN)
    expect(localStorage.getItem(JAM_LYRICS_SCALE_KEY)).toBe(
      String(JAM_LYRICS_SCALE_MIN),
    )
  })

  it('reads a lyric size that is not a number as the shipped size', () => {
    // The floor would be a visible change the viewer never asked for.
    setJamLyricsScale(1.5)
    expect(setJamLyricsScale(Number.NaN)).toBe(JAM_LYRICS_SCALE_DEFAULT)
    expect(jamLyricsScale()).toBe(JAM_LYRICS_SCALE_DEFAULT)
  })

  it('keeps a size a pinch chose, not only the button stops', () => {
    expect(setJamLyricsScale(1.37)).toBe(1.37)
    expect(jamLyricsScale()).toBe(1.37)
  })

  it('clamps a zoom in the setter, so no caller has to know the range', () => {
    // The pinch handler multiplies by a finger ratio and the wheel
    // handler by a notch; both can overshoot, and neither should have to
    // remember which end it overshot.
    expect(setJamLaneZoom(99)).toBe(JAM_ZOOM_MAX)
    expect(jamLaneZoom()).toBe(JAM_ZOOM_MAX)
    expect(setJamLaneZoom(0)).toBe(JAM_ZOOM_MIN)
    expect(jamLaneZoom()).toBe(JAM_ZOOM_MIN)
    expect(setJamLaneZoom(Number.NaN)).toBe(JAM_ZOOM_MIN)
  })

  it('rounds a drag to something a stage can actually be set to', () => {
    // A drag is a ratio of two pixel measurements; stored raw it reads
    // as a claim to a hundred-thousandth of a pixel.
    expect(setJamSplitShare(false, 32.230885311871226)).toBe(32.23)
    expect(setJamSplitShare(true, 61.666666)).toBe(61.67)
  })

  it('clamps a drag to the layout it came from', () => {
    // A pointer can leave the stage entirely; the share it implies is
    // then negative or past 100, and the grid would happily draw it.
    expect(setJamSplitShare(false, -40)).toBe(JAM_SPLIT_WIDE_MIN)
    expect(setJamSplitShare(false, 400)).toBe(JAM_SPLIT_WIDE_MAX)
    expect(setJamSplitShare(true, -40)).toBe(JAM_SPLIT_STACKED_MIN)
    expect(setJamSplitShare(true, 400)).toBe(JAM_SPLIT_STACKED_MAX)
  })

  it('keeps the two shares apart, so a monitor never resizes a phone', () => {
    setJamSplitShare(false, 30)
    expect(jamSplitShare(false)).toBe(30)
    expect(jamSplitShare(true)).toBe(JAM_SPLIT_STACKED_DEFAULT)

    setJamSplitShare(true, 75)
    expect(jamSplitShare(true)).toBe(75)
    expect(jamSplitShare(false)).toBe(30)
  })

  it('resets to the shipped balance, per layout', () => {
    setJamSplitShare(false, 70)
    setJamSplitShare(true, 35)
    expect(resetJamSplitShare(false)).toBe(JAM_SPLIT_WIDE_DEFAULT)
    expect(jamSplitShare(true)).toBe(35)
    expect(resetJamSplitShare(true)).toBe(JAM_SPLIT_STACKED_DEFAULT)
  })

  it('writes each preference under its own key', () => {
    // The mixer has a lyric alignment too. One shared key would mean
    // centring a room's words re-centred somebody's stem editor.
    setJamLyricsAlign('right')
    setJamLyricsScale(1.25)
    setJamLaneZoom(2)
    setJamSplitShare(false, 40)
    setJamSplitShare(true, 45)
    expect(localStorage.getItem(JAM_LYRICS_ALIGN_KEY)).toBe('right')
    expect(localStorage.getItem(JAM_LYRICS_SCALE_KEY)).toBe('1.25')
    expect(localStorage.getItem(JAM_LANE_ZOOM_KEY)).toBe('2')
    expect(localStorage.getItem(JAM_SPLIT_WIDE_KEY)).toBe('40')
    expect(localStorage.getItem(JAM_SPLIT_STACKED_KEY)).toBe('45')
  })
})

describe('what a fresh page load restores', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.resetModules()
  })

  it('takes a stored preference over the default', async () => {
    localStorage.setItem(JAM_LYRICS_ALIGN_KEY, 'left')
    localStorage.setItem(JAM_LYRICS_SCALE_KEY, '1.5')
    localStorage.setItem(JAM_LANE_ZOOM_KEY, '2.5')
    localStorage.setItem(JAM_SPLIT_WIDE_KEY, '65')
    localStorage.setItem(JAM_SPLIT_STACKED_KEY, '35')

    const prefs = await import('@/lib/jam/jam-view-prefs')
    expect(prefs.jamLyricsAlign()).toBe('left')
    expect(prefs.jamLyricsScale()).toBe(1.5)
    expect(prefs.jamLaneZoom()).toBe(2.5)
    expect(prefs.jamSplitShare(false)).toBe(65)
    expect(prefs.jamSplitShare(true)).toBe(35)
  })

  it('falls back to the default rather than trusting a bad value', async () => {
    localStorage.setItem(JAM_LYRICS_ALIGN_KEY, 'justify')
    // In range for the lane zoom, out of range for the words: a value
    // pasted under the wrong key must not come back as 4x lyrics.
    localStorage.setItem(JAM_LYRICS_SCALE_KEY, '4')
    localStorage.setItem(JAM_LANE_ZOOM_KEY, 'null')
    localStorage.setItem(JAM_SPLIT_WIDE_KEY, '0')
    localStorage.setItem(JAM_SPLIT_STACKED_KEY, '"most of it"')

    const prefs = await import('@/lib/jam/jam-view-prefs')
    expect(prefs.jamLyricsAlign()).toBe('center')
    expect(prefs.jamLyricsScale()).toBe(JAM_LYRICS_SCALE_DEFAULT)
    expect(prefs.jamLaneZoom()).toBe(JAM_ZOOM_MIN)
    expect(prefs.jamSplitShare(false)).toBe(JAM_SPLIT_WIDE_DEFAULT)
    expect(prefs.jamSplitShare(true)).toBe(JAM_SPLIT_STACKED_DEFAULT)
  })

  it('survives a key that is not JSON at all', async () => {
    // A half-written value, or a key an older build stored raw.
    localStorage.setItem(JAM_LANE_ZOOM_KEY, '{2.5')
    localStorage.setItem(JAM_LYRICS_SCALE_KEY, '1.5x')
    localStorage.setItem(JAM_SPLIT_WIDE_KEY, '')

    const prefs = await import('@/lib/jam/jam-view-prefs')
    expect(prefs.jamLaneZoom()).toBe(JAM_ZOOM_MIN)
    expect(prefs.jamLyricsScale()).toBe(JAM_LYRICS_SCALE_DEFAULT)
    expect(prefs.jamSplitShare(false)).toBe(JAM_SPLIT_WIDE_DEFAULT)
  })

  it('keeps the extra playback controls open only for a real yes', async () => {
    // Anything that is not the boolean `true` folds them away: a truthy
    // string here would open a row of controls nobody asked for.
    for (const stored of ['"true"', '1', '"yes"', 'null', '{true']) {
      vi.resetModules()
      localStorage.setItem('pitchperfect_jam_more_controls', stored)
      const prefs = await import('@/lib/jam/jam-view-prefs')
      expect(prefs.jamMoreControlsPinned()).toBe(false)
    }
    vi.resetModules()
    localStorage.setItem('pitchperfect_jam_more_controls', 'true')
    const prefs = await import('@/lib/jam/jam-view-prefs')
    expect(prefs.JAM_MORE_CONTROLS_KEY).toBe('pitchperfect_jam_more_controls')
    expect(prefs.jamMoreControlsPinned()).toBe(true)
  })

  it('centres the words and shows the whole phrase by default', async () => {
    const prefs = await import('@/lib/jam/jam-view-prefs')
    expect(prefs.jamLyricsAlign()).toBe('center')
    expect(prefs.jamLyricsScale()).toBe(JAM_LYRICS_SCALE_DEFAULT)
    expect(prefs.jamLaneZoom()).toBe(JAM_ZOOM_MIN)
    expect(prefs.jamSplitShare(false)).toBe(JAM_SPLIT_WIDE_DEFAULT)
    expect(prefs.jamSplitShare(true)).toBe(JAM_SPLIT_STACKED_DEFAULT)
  })
})
