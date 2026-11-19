// One reading, one rounding (formatThresholdReading, lib/ear/drills.ts).
// A threshold reading is printed in five places: the plate a run ends on,
// Merc's line under it, the bench (Today's row and the station's tile),
// the station sheet's row and the Ear Report. Each used to round for
// itself: Drift's plate said "4 %" where its row on the sheet said "4.0 %",
// and the plate's count could end a float's width off the reading it
// counted to. Every place here is handed the same readings, the awkward
// ones that sit on a rounding edge, and must print each the same way.

import { cleanup, render, screen } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { instrumentReading, INSTRUMENTS } from '@/features/ear-lab/instruments'
import type { ThresholdPlate, TracePoint } from '@/features/ear-lab/stage-room'
import type { FacultyId } from '@/lib/ear/drills'
import { findThresholdDrill, formatThresholdReading } from '@/lib/ear/drills'
import type * as GpuGateModule from '@/lib/merc/gpu-gate'
import { recordThresholdReading, resetEarLabStore, } from '@/stores/ear-lab-store'
import { countedLevel, STAIRS_MS } from './lit/LitStaircase'
import { thresholdPlateLine } from './merc-lines'
import { PlateOnDesk } from './MercPlate'
import { MercReport } from './MercReport'
import { stationReading } from './stations'
import { StationSheet } from './StationSheet'

// The plate drawn whole at once, as under reduced motion: the number it
// settles on is the one asked about.
vi.mock('@/components/room-kit/reduced-motion', () => ({
  prefersReducedMotion: () => true,
}))
// jsdom has no WebGL: Merc is his still.
vi.mock('@/lib/merc/gpu-gate', async (importOriginal) => ({
  ...(await importOriginal<typeof GpuGateModule>()),
  canRunLiveMerc: (): boolean => false,
}))

beforeEach(() => resetEarLabStore())
afterEach(cleanup)

interface Case {
  drillId: string
  faculty: FacultyId
  value: number
  /** How every place prints it. */
  shows: string
  /** Its station's tile shows this drill's reading. */
  leads?: boolean
  /** The Ear Report traces it. */
  traced?: boolean
}

const CASES: Case[] = [
  // A tie a float can hold exactly, and the float just under it.
  {
    drillId: 'hairline',
    faculty: 'resolution',
    value: 158.75,
    shows: '158.8',
    leads: true,
    traced: true,
  },
  {
    drillId: 'hairline',
    faculty: 'resolution',
    value: 158.74999999999997,
    shows: '158.7',
    leads: true,
    traced: true,
  },
  { drillId: 'beat-hunt', faculty: 'resolution', value: 2.25, shows: '2.3' },
  {
    drillId: 'the-grid',
    faculty: 'time',
    value: 22.5,
    shows: '23',
    leads: true,
    traced: true,
  },
  // Drift keeps a tenth under 3 % and none from there; the sheet wrote both
  // with a tenth.
  { drillId: 'drift', faculty: 'time', value: 2.96, shows: '3.0' },
  { drillId: 'drift', faculty: 'time', value: 4.2, shows: '4' },
  { drillId: 'span', faculty: 'shape', value: 4.5, shows: '5' },
  { drillId: 'desk-colour', faculty: 'colour', value: 1.25, shows: '1.3' },
]

const label = (c: Case): string => `${c.drillId} at ${c.value}`

function seed(c: Case): void {
  recordThresholdReading({
    drillId: c.drillId,
    value: c.value,
    spread: 1,
    tracks: 1,
    source: 'practice',
  })
}

/** The run's way, ending well away from the reading, as a real one may. */
const WAY: TracePoint[] = [
  { level: 200, turn: false, correct: true },
  { level: 100, turn: true, correct: false },
  { level: 200, turn: true, correct: true },
]

function plateFor(c: Case): ThresholdPlate {
  const drill = findThresholdDrill(c.drillId)
  return {
    kind: 'threshold',
    value: c.value,
    // As the drill view builds it (ThresholdDrillView.tsx).
    format: (value) => formatThresholdReading(c.drillId, value),
    unit: drill?.unit ?? 'dB',
    unitShort: drill?.unitShort ?? 'dB',
    lowerIsBetter: true,
    previous: null,
    calibration: false,
    provisional: false,
    note: '',
    trace: WAY,
    trials: WAY.length,
    turns: 2,
    replays: 0,
  }
}

describe('one reading, one rounding', () => {
  it.each(CASES)('prints $drillId at $value as $shows', (c) => {
    expect(formatThresholdReading(c.drillId, c.value)).toBe(c.shows)
  })

  it.each(CASES)(
    'ends the plate and Merc’s line on the same number: $drillId at $value',
    (c) => {
      const plate = plateFor(c)
      render(() => (
        <PlateOnDesk
          plate={plate}
          own={null}
          drillId={c.drillId}
          short={false}
          faculty="Resolution"
        />
      ))
      const number = screen
        .getByRole('status', { name: 'Reading' })
        .querySelector('[aria-hidden="true"]')
      expect(number?.textContent, label(c)).toBe(c.shows)
      // The count itself lands on the reading, not an ease's float away.
      expect(plate.format(countedLevel(WAY, c.value, STAIRS_MS.settled))).toBe(
        c.shows,
      )
      // Merc's line, as the room words it (MercDrillRoom.tsx).
      const line = thresholdPlateLine({
        value: c.value,
        shown: plate.format(c.value),
        unit: plate.unit,
        previous: null,
        lowerIsBetter: true,
      })
      expect(line.startsWith(`${c.shows} `), line).toBe(true)
    },
  )

  it.each(CASES)(
    'prints the same number on the bench and its station: $drillId at $value',
    (c) => {
      seed(c)
      const instrument = INSTRUMENTS.find((one) => one.drillId === c.drillId)
      expect(instrument, label(c)).toBeDefined()
      if (instrument === undefined) return
      expect(instrumentReading(instrument)?.value).toBe(c.shows)
      if (c.leads === true) {
        expect(stationReading(c.faculty)?.value).toBe(c.shows)
      }
    },
  )

  it.each(CASES)(
    'prints the same number on the station sheet: $drillId at $value',
    (c) => {
      seed(c)
      render(() => (
        <StationSheet
          faculty={c.faculty}
          lit={null}
          onStart={() => undefined}
          onOpenFieldBook={() => undefined}
          onClose={() => undefined}
        />
      ))
      const row = screen
        .getAllByTestId('merc-station-row')
        .find((one) => one.getAttribute('data-drill') === c.drillId)
      // The desk's row carries no unit: its drill is not in the catalogue.
      const unit = findThresholdDrill(c.drillId)?.unitShort ?? ''
      expect(row?.textContent, label(c)).toContain(
        unit === '' ? c.shows : `${c.shows} ${unit}`,
      )
    },
  )

  it.each(CASES.filter((c) => c.traced === true))(
    'prints the same number in the Ear Report: $drillId at $value',
    (c) => {
      seed(c)
      render(() => (
        <MercReport onBack={() => undefined} onNavigate={() => undefined} />
      ))
      const card = screen
        .getByTestId('merc-report-screen')
        .querySelector(`[data-plate="trace-${c.drillId}"]`)
      const unit = findThresholdDrill(c.drillId)?.unitShort ?? ''
      expect(card?.textContent, label(c)).toContain(`${c.shows} ${unit}`)
      expect(card?.textContent).toContain(`best ${c.shows} ${unit}`)
    },
  )
})
