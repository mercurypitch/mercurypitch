import { describe, expect, it } from 'vitest'
import type { GuitarNote } from '@/lib/guitar/guitar-synth'
import { DEFAULT_BASS_TUNING, DEFAULT_GUITAR_TUNING, } from '@/lib/guitar/instrument-tuning'
import type { SheetLane } from './sheet-model'
import { barsPerSystemForWidth, beatFractionInSystem, buildSheetBars, buildSheetPlacement, groupIntoSystems, laneNotesInSystem, locateBeat, sheetLoopFragments, sheetLoopMarkers, totalBeatsForLanes, } from './sheet-model'

function note(
  startBeat: number,
  duration = 1,
  id = `n${startBeat}`,
): GuitarNote {
  return {
    id,
    midi: 64,
    noteName: 'E4',
    stringIndex: 0,
    fret: 0,
    startBeat,
    duration,
    targetFreq: 329.63,
  }
}

function lane(
  notes: readonly GuitarNote[],
  overrides: Partial<SheetLane> = {},
): SheetLane {
  return {
    trackId: 'track-1',
    trackName: 'Rhythm guitar',
    kind: 'authored',
    instrument: 'guitar',
    tuning: DEFAULT_GUITAR_TUNING,
    notes,
    outOfRangeNotes: 0,
    ...overrides,
  }
}

describe('buildSheetBars', () => {
  // The arithmetic belongs to `@/lib/midi-bars` and is tested there. These
  // check the sheet asks it the right question.

  it('covers the score in common time when the file said nothing', () => {
    const bars = buildSheetBars(9)
    expect(bars).toHaveLength(3)
    expect(bars.map((bar) => bar.startBeat)).toEqual([0, 4, 8])
    expect(bars.every((bar) => bar.beats === 4)).toBe(true)
  })

  it('always draws one bar, so an empty score is not a blank page', () => {
    expect(buildSheetBars(0)).toHaveLength(1)
    expect(buildSheetBars(-8)).toHaveLength(1)
    expect(buildSheetBars(Number.NaN)).toHaveLength(1)
  })

  it('changes bar length where the score changes time signature', () => {
    const bars = buildSheetBars(14, [
      { beat: 0, numerator: 4, denominator: 4 },
      { beat: 8, numerator: 3, denominator: 4 },
    ])
    expect(bars.map((bar) => bar.beats)).toEqual([4, 4, 3, 3])
    expect(bars.map((bar) => bar.startBeat)).toEqual([0, 4, 8, 11])
  })

  it('draws a 6/8 score in three-quarter bars, not six-beat ones', () => {
    const bars = buildSheetBars(6, [{ beat: 0, numerator: 6, denominator: 8 }])
    expect(bars.map((bar) => bar.startBeat)).toEqual([0, 3])
  })
})

describe('groupIntoSystems', () => {
  it('lays whole bars across, and keeps a short final system', () => {
    const systems = groupIntoSystems(buildSheetBars(20), 2)
    expect(systems.map((system) => system.bars.length)).toEqual([2, 2, 1])
    expect(systems[1]).toMatchObject({ index: 1, startBeat: 8, beats: 8 })
  })

  it('never groups fewer than one bar per system', () => {
    expect(groupIntoSystems(buildSheetBars(8), 0)).toHaveLength(2)
    expect(groupIntoSystems(buildSheetBars(8), -3)).toHaveLength(2)
  })

  it('returns nothing for no bars', () => {
    expect(groupIntoSystems([], 4)).toEqual([])
  })
})

describe('barsPerSystemForWidth', () => {
  it('fits as many readable bars as the width allows', () => {
    expect(barsPerSystemForWidth(1000, { minBarWidth: 240, maxBars: 4 })).toBe(
      4,
    )
    expect(barsPerSystemForWidth(700, { minBarWidth: 240, maxBars: 4 })).toBe(2)
  })

  it('keeps one bar on a narrow or unmeasured page', () => {
    expect(barsPerSystemForWidth(120)).toBe(1)
    expect(barsPerSystemForWidth(0)).toBe(1)
    expect(barsPerSystemForWidth(Number.NaN)).toBe(1)
  })

  it('honours its own ceiling', () => {
    expect(barsPerSystemForWidth(4000, { minBarWidth: 100, maxBars: 3 })).toBe(
      3,
    )
    expect(barsPerSystemForWidth(4000, { minBarWidth: 100, maxBars: 0 })).toBe(
      1,
    )
  })
})

describe('totalBeatsForLanes', () => {
  it('runs to the last note that finishes, across every lane', () => {
    expect(totalBeatsForLanes([lane([note(0, 2)]), lane([note(6, 3)])])).toBe(9)
  })

  it('is zero for lanes with no notes', () => {
    expect(totalBeatsForLanes([lane([])])).toBe(0)
    expect(totalBeatsForLanes([])).toBe(0)
  })

  it('does not let a negative duration pull the end backwards', () => {
    expect(totalBeatsForLanes([lane([note(4, -2)])])).toBe(4)
  })
})

describe('buildSheetPlacement', () => {
  it('indexes each lane into the system its notes start in', () => {
    const placement = buildSheetPlacement({
      lanes: [
        lane([note(0), note(9)]),
        lane([note(5)], { trackId: 'track-2' }),
      ],
      barsPerSystem: 1,
    })

    expect(placement.systems).toHaveLength(3)
    expect(laneNotesInSystem(placement, 0, 0).map((n) => n.startBeat)).toEqual([
      0,
    ])
    expect(laneNotesInSystem(placement, 1, 1).map((n) => n.startBeat)).toEqual([
      5,
    ])
    expect(laneNotesInSystem(placement, 2, 0).map((n) => n.startBeat)).toEqual([
      9,
    ])
    expect(laneNotesInSystem(placement, 2, 1)).toEqual([])
  })

  it('sorts a system by time even when the source did not', () => {
    const placement = buildSheetPlacement({
      lanes: [lane([note(3, 1, 'late'), note(1, 1, 'early')])],
      barsPerSystem: 1,
    })
    expect(laneNotesInSystem(placement, 0, 0).map((n) => n.id)).toEqual([
      'early',
      'late',
    ])
  })

  it('keeps notes outside the bars rather than dropping them', () => {
    const placement = buildSheetPlacement({
      lanes: [lane([note(-4), note(3)])],
      totalBeats: 4,
      barsPerSystem: 1,
    })
    expect(laneNotesInSystem(placement, 0, 0)).toHaveLength(2)
  })

  it('lands a note past the written end in the final system', () => {
    const placement = buildSheetPlacement({
      lanes: [lane([note(0), note(40)])],
      totalBeats: 8,
      barsPerSystem: 1,
    })
    const last = placement.systems.length - 1
    expect(
      laneNotesInSystem(placement, last, 0).map((n) => n.startBeat),
    ).toEqual([40])
  })

  it('measures its own length when none is given', () => {
    const placement = buildSheetPlacement({ lanes: [lane([note(0, 6)])] })
    expect(placement.totalBeats).toBe(6)
    expect(placement.systems.length).toBeGreaterThan(0)
  })

  it('keeps every lane on its own tuning', () => {
    const placement = buildSheetPlacement({
      lanes: [
        lane([note(0)]),
        lane([note(0)], {
          trackId: 'bass',
          instrument: 'bass',
          tuning: DEFAULT_BASS_TUNING,
        }),
      ],
      barsPerSystem: 2,
    })
    expect(placement.lanes[0]?.tuning.stringCount).toBe(6)
    expect(placement.lanes[1]?.tuning.stringCount).toBe(4)
  })

  it('lays out an empty sheet without failing', () => {
    const placement = buildSheetPlacement({ lanes: [], barsPerSystem: 4 })
    expect(placement.systems).toHaveLength(1)
    expect(placement.notesBySystem[0]).toEqual([])
    expect(placement.barsPerSystem).toBe(4)
  })

  it('never groups fewer than one bar per system', () => {
    const placement = buildSheetPlacement({
      lanes: [lane([note(0)])],
      totalBeats: 8,
      barsPerSystem: 0,
    })
    expect(placement.barsPerSystem).toBe(1)
  })
})

describe('laneNotesInSystem', () => {
  it('reads an unknown system or lane as empty', () => {
    const placement = buildSheetPlacement({ lanes: [lane([note(0)])] })
    expect(laneNotesInSystem(placement, 99, 0)).toEqual([])
    expect(laneNotesInSystem(placement, 0, 99)).toEqual([])
  })
})

describe('locateBeat', () => {
  const placement = buildSheetPlacement({
    lanes: [lane([note(0), note(20)])],
    totalBeats: 24,
    barsPerSystem: 2,
  })

  it('places a beat across the system it falls in', () => {
    expect(locateBeat(placement, 4)).toEqual({ systemIndex: 0, fraction: 0.5 })
    expect(locateBeat(placement, 8)).toEqual({ systemIndex: 1, fraction: 0 })
  })

  it('clamps to the page rather than leaving it', () => {
    expect(locateBeat(placement, -10)).toEqual({ systemIndex: 0, fraction: 0 })
    const last = placement.systems.length - 1
    expect(locateBeat(placement, 9_999)).toEqual({
      systemIndex: last,
      fraction: 1,
    })
    expect(locateBeat(placement, Number.NaN)).toEqual({
      systemIndex: 0,
      fraction: 0,
    })
  })

  it('has nowhere to point on a sheet with no systems', () => {
    expect(locateBeat({ ...placement, systems: [] }, 4)).toBeNull()
  })
})

describe('beatFractionInSystem', () => {
  const [system] = groupIntoSystems(buildSheetBars(8), 2)

  it('measures how far across the system a beat sits', () => {
    expect(beatFractionInSystem(system!, 2)).toBe(0.25)
  })

  it('clamps outside its own bars', () => {
    expect(beatFractionInSystem(system!, -4)).toBe(0)
    expect(beatFractionInSystem(system!, 40)).toBe(1)
  })

  it('reads a zero-length system as its start', () => {
    expect(beatFractionInSystem({ ...system!, beats: 0 }, 3)).toBe(0)
  })
})

describe('sheet loop placement', () => {
  const placement = buildSheetPlacement({
    lanes: [lane([note(0), note(20)])],
    totalBeats: 24,
    barsPerSystem: 2,
  })

  it('splits a range across systems without moving its authored boundaries', () => {
    expect(sheetLoopFragments(placement, 6, 18)).toEqual([
      {
        systemIndex: 0,
        startFraction: 0.75,
        endFraction: 1,
        startsAtA: true,
        endsAtB: false,
      },
      {
        systemIndex: 1,
        startFraction: 0,
        endFraction: 1,
        startsAtA: false,
        endsAtB: false,
      },
      {
        systemIndex: 2,
        startFraction: 0,
        endFraction: 0.25,
        startsAtA: false,
        endsAtB: true,
      },
    ])
  })

  it('puts B on the previous system when it lands exactly on a row break', () => {
    expect(sheetLoopMarkers(placement, 8, 16)).toEqual([
      { mark: 'A', systemIndex: 1, fraction: 0 },
      { mark: 'B', systemIndex: 1, fraction: 1 },
    ])
    expect(sheetLoopFragments(placement, 8, 16)).toHaveLength(1)
  })

  it('shows an isolated mark without inventing a range', () => {
    expect(sheetLoopFragments(placement, 8, null)).toEqual([])
    expect(sheetLoopMarkers(placement, 8, null)).toEqual([
      { mark: 'A', systemIndex: 1, fraction: 0 },
    ])
  })
})
