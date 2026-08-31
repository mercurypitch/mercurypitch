import { afterEach, describe, expect, it, vi } from 'vitest'
import type { GuitarNote } from '@/lib/guitar/guitar-synth'
import { DEFAULT_BASS_TUNING, DEFAULT_GUITAR_TUNING, } from '@/lib/guitar/instrument-tuning'
import type { SheetLane } from './sheet-model'
import type { SheetMetrics, SheetRenderer } from './sheet-render'
import { DEFAULT_SHEET_METRICS, followScrollTop, layoutSystemLanes, readSheetTheme, visibleSystemRange, } from './sheet-render'
import { tabSheetRenderer } from './sheet-tab-renderer'

const metrics: SheetMetrics = { ...DEFAULT_SHEET_METRICS, width: 800 }

function lane(overrides: Partial<SheetLane> = {}): SheetLane {
  return {
    trackId: 'track-1',
    trackName: 'Lead guitar',
    kind: 'authored',
    instrument: 'guitar',
    tuning: DEFAULT_GUITAR_TUNING,
    notes: [] as readonly GuitarNote[],
    outOfRangeNotes: 0,
    ...overrides,
  }
}

describe('layoutSystemLanes', () => {
  it('stacks lanes downwards with a gap between them', () => {
    const layout = layoutSystemLanes(
      [lane(), lane({ trackId: 'track-2' })],
      metrics,
      tabSheetRenderer,
    )
    const first = layout.lanes[0]
    const second = layout.lanes[1]
    expect(first?.top).toBe(metrics.systemPaddingTop)
    expect(second?.top).toBe(
      metrics.systemPaddingTop + (first?.height ?? 0) + metrics.laneGap,
    )
  })

  it('gives a bass lane less height than a guitar lane', () => {
    const layout = layoutSystemLanes(
      [lane(), lane({ trackId: 'bass', tuning: DEFAULT_BASS_TUNING })],
      metrics,
      tabSheetRenderer,
    )
    expect(layout.lanes[1]?.height).toBeLessThan(layout.lanes[0]?.height ?? 0)
  })

  it('marks the part being scored', () => {
    const layout = layoutSystemLanes(
      [lane(), lane({ trackId: 'track-2' })],
      metrics,
      tabSheetRenderer,
      'track-2',
    )
    expect(layout.lanes.map((entry) => entry.scored)).toEqual([false, true])
  })

  it('does not leave the trailing gap hanging under the last lane', () => {
    const single = layoutSystemLanes([lane()], metrics, tabSheetRenderer)
    expect(single.height).toBe(
      metrics.systemPaddingTop +
        (single.lanes[0]?.height ?? 0) +
        metrics.systemPaddingBottom,
    )
  })

  it('is padding alone when nothing is shown', () => {
    const empty = layoutSystemLanes([], metrics, tabSheetRenderer)
    expect(empty.lanes).toEqual([])
    expect(empty.height).toBe(
      metrics.systemPaddingTop + metrics.systemPaddingBottom,
    )
  })

  it('asks the renderer for the height, so a swap changes the layout', () => {
    const tall: SheetRenderer = {
      ...tabSheetRenderer,
      id: 'notation',
      laneHeight: () => 200,
    }
    const layout = layoutSystemLanes([lane(), lane()], metrics, tall)
    expect(layout.lanes[1]?.top).toBe(
      metrics.systemPaddingTop + 200 + metrics.laneGap,
    )
  })
})

describe('visibleSystemRange', () => {
  const base = {
    scrollTop: 0,
    viewportHeight: 600,
    systemHeight: 200,
    systemCount: 50,
  }

  it('mounts the systems on screen plus one either side', () => {
    expect(visibleSystemRange({ ...base, scrollTop: 1000 })).toEqual({
      start: 4,
      end: 9,
    })
  })

  it('never asks for a system before the first or past the last', () => {
    expect(visibleSystemRange(base)).toEqual({ start: 0, end: 4 })
    expect(visibleSystemRange({ ...base, scrollTop: 100_000 })).toEqual({
      start: 50,
      end: 50,
    })
  })

  it('takes a wider overscan when asked', () => {
    expect(
      visibleSystemRange({ ...base, scrollTop: 1000, overscan: 3 }),
    ).toEqual({ start: 2, end: 11 })
    expect(
      visibleSystemRange({ ...base, scrollTop: 1000, overscan: 0 }),
    ).toEqual({ start: 5, end: 8 })
  })

  it('has nothing to mount for an empty sheet', () => {
    expect(visibleSystemRange({ ...base, systemCount: 0 })).toEqual({
      start: 0,
      end: 0,
    })
  })

  it('falls back to everything before the page has been measured', () => {
    expect(visibleSystemRange({ ...base, systemHeight: 0 })).toEqual({
      start: 0,
      end: 50,
    })
  })

  it('reads an unmeasured scroll position as the top', () => {
    expect(
      visibleSystemRange({
        ...base,
        scrollTop: Number.NaN,
        viewportHeight: Number.NaN,
      }),
    ).toEqual({ start: 0, end: 1 })
    expect(visibleSystemRange({ ...base, scrollTop: -500 })).toEqual({
      start: 0,
      end: 4,
    })
  })
})

describe('readSheetTheme', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('works before anything has been styled', () => {
    expect(readSheetTheme(null).staffLine).toContain('rgba')
  })

  it('takes its colours from the stylesheet', () => {
    const element = document.createElement('div')
    vi.spyOn(window, 'getComputedStyle').mockReturnValue({
      getPropertyValue: (name: string) =>
        name === '--score-sheet-scored-accent' ? ' #ff0000 ' : '',
    } as unknown as CSSStyleDeclaration)

    const theme = readSheetTheme(element)
    expect(theme.scoredAccent).toBe('#ff0000')
    // Anything the stylesheet leaves unset keeps the built-in value.
    expect(theme.noteText).toBe('#f6ecdc')
  })
})

describe('followScrollTop', () => {
  // A four-lane system at 300%: far taller than the viewport, the shape the
  // follow guard used to break on ("keep the scored part in view" report).
  const layout = {
    lanes: [
      { top: 40, height: 240, scored: false },
      { top: 300, height: 240, scored: true },
      { top: 560, height: 240, scored: false },
      { top: 820, height: 240, scored: false },
    ],
    height: 1100,
  }
  const base = {
    layout,
    systemIndex: 2,
    systemHeight: 1100,
    focusedInset: 0,
    viewportHeight: 500,
    maxScrollTop: 10_000,
    contentInsetTop: 0,
  }

  it('holds the scored lane in the middle of the view, not the system top', () => {
    // Scored lane centre: 2*1100 + 300 + 120 = 2620; minus half a viewport.
    expect(followScrollTop(base)).toBe(2620 - 250)
  })

  it('follows the middle of the whole system when no part is scored', () => {
    const unscored = {
      ...layout,
      lanes: layout.lanes.map((entry) => ({ ...entry, scored: false })),
    }
    expect(followScrollTop({ ...base, layout: unscored })).toBe(
      2 * 1100 + 1100 / 2 - 250,
    )
  })

  it('never scrolls above the top of the page', () => {
    expect(
      followScrollTop({ ...base, systemIndex: 0, viewportHeight: 4000 }),
    ).toBe(0)
  })

  it('rests at the end of the song instead of overshooting past it', () => {
    expect(followScrollTop({ ...base, maxScrollTop: 1800 })).toBe(1800)
  })

  it('carries the scroller inset so centring is exact, not off by the padding', () => {
    expect(followScrollTop({ ...base, contentInsetTop: 12 })).toBe(
      2620 - 250 + 12,
    )
  })
})
