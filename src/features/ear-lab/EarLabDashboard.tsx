// ============================================================
// EarLabDashboard — the bench. The Regulator (the Mercury Column
// as a regulator's pendulum jar), the Index dial with the six
// faculty sub-dials, today's regulation, and the instrument strip.
// The layout enforces the product's honesty rule in pixels: the
// calibrated number is the solid fill and the big needle, the
// practice estimate is a fainter line explicitly labelled, and an
// unmeasured faculty is a blank dial that says "Unmeasured" rather
// than a needle at zero.
// ============================================================

import type { JSX } from 'solid-js'
import { createMemo, For, Show } from 'solid-js'
import type { FacultyId } from '@/lib/ear/drills'
import { calibrationHistory, latestCalibration, practiceIndexEstimate, thresholdHistory, } from '@/stores/ear-lab-store'
import { IconArc, IconBalance, IconBassLine, IconBeats, IconChain, IconFork, IconGears, IconLattice, IconLoupe, IconMetre, IconMetronome, IconNumerals, IconSeal, IconSpan, IconStylus, IconTap, IconTwelve, } from './ear-icons'
import styles from './EarLabDashboard.module.css'
import { FieldBookCard } from './FieldBookCard'
import type { FacultyDial } from './IndexDials'
import { IndexDials } from './IndexDials'
import type { Instrument, InstrumentView } from './instruments'
import { dateLabel, facultyReadout, instrumentReading, INSTRUMENTS, wildFacultyScore, } from './instruments'
import { Regulator } from './Regulator'
import { SprintCard } from './SprintCard'
import { setFieldBookSessionId } from './wild-store'

export type EarLabView =
  | 'dashboard'
  | 'hairline'
  | 'calibration'
  | 'home'
  | 'leap'
  | 'stack'
  | 'contour'
  | 'grid'
  | 'pulse'
  | 'echo'
  | 'span'
  | 'beat-hunt'
  | 'drift'
  | 'gravity'
  | 'the-pull'
  | 'cadence'
  | 'bassline'
  | 'subdivide'
  | 'field-book'
  | 'report'

interface EarLabDashboardProps {
  onNavigate: (view: EarLabView) => void
  /** The room's Today control lives on the shell; the bench hands it
   *  the scroll that brings today's regulation into view. */
}

const FACULTY_ORDER: FacultyId[] = [
  'resolution',
  'function',
  'shape',
  'colour',
  'time',
  'wild',
]

const INSTRUMENT_ICON: Record<
  InstrumentView,
  (p: { size?: number; class?: string }) => JSX.Element
> = {
  hairline: IconLoupe,
  home: IconFork,
  grid: IconLattice,
  leap: IconArc,
  stack: IconGears,
  contour: IconStylus,
  pulse: IconTap,
  echo: IconChain,
  span: IconSpan,
  'beat-hunt': IconBeats,
  drift: IconMetronome,
  gravity: IconTwelve,
  'the-pull': IconBalance,
  cadence: IconNumerals,
  bassline: IconBassLine,
  subdivide: IconMetre,
  calibration: IconSeal,
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000

function monthLabel(at: number): string {
  return new Date(at).toLocaleDateString(undefined, { month: 'long' })
}

interface Headline {
  lead: string
  rest: string
  lede: string
}

/** The coach's line: the number that matters most right now, in its
 *  own unit, and how it has moved. Never a percent, never a streak. */
function headline(): Headline {
  const sealed = latestCalibration()
  const runs = calibrationHistory()
  if (sealed) {
    const previous = runs.at(1)
    const rest =
      previous !== undefined
        ? `In ${monthLabel(previous.at)} it was ${previous.index}.`
        : `Sealed ${dateLabel(sealed.at)}.`
    return {
      lead: `Index ${sealed.index}.`,
      rest,
      lede: 'Your ear, in units that cannot flatter you. The mercury moves only when a sealed calibration says so.',
    }
  }
  const hairline = thresholdHistory('hairline')
  const latest = hairline.at(0)
  if (latest !== undefined) {
    const earliest = hairline.at(-1)
    const rounded = Math.round(latest.value)
    const rest =
      earliest !== undefined &&
      earliest !== latest &&
      latest.at - earliest.at >= WEEK_MS
        ? `In ${monthLabel(earliest.at)} it was ${Math.round(earliest.value)}.`
        : 'Run a calibration to mark the glass.'
    return {
      lead: `${rounded} cent${rounded === 1 ? '' : 's'}.`,
      rest,
      lede: 'The finest gap your ear still resolves. Practice draws the fainter line; only a sealed calibration marks the glass.',
    }
  }
  return {
    lead: 'Nothing measured yet.',
    rest: 'Two minutes on Hairline is a first reading.',
    lede: 'Your ear, in units that cannot flatter you. The mercury moves only when a sealed calibration says so.',
  }
}

export function EarLabDashboard(props: EarLabDashboardProps): JSX.Element {
  const openInstrument = (instrument: Instrument) =>
    props.onNavigate(instrument.view)

  const calibrated = () => latestCalibration()
  // Memoized: the bench reads it several times per render and it walks
  // every drill's readings and ratings to build the composite.
  const estimate = createMemo(() => practiceIndexEstimate())
  const line = createMemo(() => headline())

  const delta = (): number | null => {
    const runs = calibrationHistory()
    if (runs.length < 2) return null
    return runs[0].index - runs[1].index
  }

  const deltaSince = (): string | null => {
    const runs = calibrationHistory()
    return runs.length < 2 ? null : dateLabel(runs[1].at)
  }

  const faculties = createMemo((): FacultyDial[] => {
    const sealedParts = calibrated()?.parts ?? {}
    const estimateParts = estimate().parts
    return FACULTY_ORDER.map((faculty) => {
      // In The Wild reads the Field Book's own rating: never sealed,
      // never an estimate of the Column.
      if (faculty === 'wild') {
        return {
          faculty,
          score: wildFacultyScore(),
          reading: facultyReadout('wild'),
          estimated: false,
        }
      }
      const sealedScore = sealedParts[faculty]
      const estimated = estimateParts[faculty]
      return {
        faculty,
        score: sealedScore ?? estimated ?? null,
        reading: facultyReadout(faculty),
        estimated: sealedScore === undefined && estimated !== undefined,
      }
    })
  })

  return (
    <div class={styles.bench} id="ear-lab-panel">
      <div class={styles.heading}>
        <span class={styles.kicker}>
          <i aria-hidden="true" /> At the bench
        </span>
        <h1 class={styles.title} data-testid="ear-bench-title">
          {line().lead}
          <br />
          {line().rest}
        </h1>
        <p class={styles.lede}>{line().lede}</p>
      </div>

      <div class={styles.grid}>
        <div class={styles.regulatorCell} data-tour="ear.column">
          <Regulator
            calibrated={calibrated()?.index ?? null}
            estimate={estimate().value}
            marks={calibrationHistory().map((run) => ({
              at: run.at,
              index: run.index,
            }))}
            missingCount={estimate().missing.length}
          />
        </div>

        <div class={styles.dialsCell}>
          <IndexDials
            calibrated={calibrated()?.index ?? null}
            delta={delta()}
            deltaSince={deltaSince()}
            estimate={estimate().value}
            faculties={faculties()}
          />
        </div>

        <div class={styles.regulationCell}>
          <SprintCard onNavigate={props.onNavigate} />
        </div>
      </div>

      <div
        class={styles.strip}
        role="list"
        aria-label="The instruments"
        data-tour="ear.drills"
      >
        <For each={INSTRUMENTS}>
          {(instrument) => {
            const Icon = INSTRUMENT_ICON[instrument.view]
            const reading = () => instrumentReading(instrument)
            return (
              <button
                type="button"
                role="listitem"
                class={styles.instrument}
                classList={{
                  [styles.instrumentSeal]: instrument.view === 'calibration',
                }}
                onClick={() => openInstrument(instrument)}
                aria-label={`${instrument.name} — ${instrument.measures}`}
              >
                <Icon size={30} class={styles.instrumentIcon} />
                <span class={styles.instrumentName}>{instrument.name}</span>
                <span class={styles.instrumentMeasures}>
                  {instrument.measures}
                </span>
                <Show
                  when={reading()}
                  fallback={
                    <span class={styles.instrumentEmpty}>
                      {instrument.view === 'calibration'
                        ? 'Unsealed'
                        : 'Unmeasured'}
                    </span>
                  }
                >
                  {(value) => (
                    <span class={styles.instrumentReading}>
                      {value().value}
                      <Show when={value().unit}>
                        <small> {value().unit}</small>
                      </Show>
                      <Show when={value().settling}>
                        <small> · settling</small>
                      </Show>
                    </span>
                  )}
                </Show>
              </button>
            )
          }}
        </For>
      </div>

      <div class={styles.fieldBook}>
        <FieldBookCard
          onOpen={(sessionId) => {
            setFieldBookSessionId(sessionId)
            props.onNavigate('field-book')
          }}
        />
      </div>
    </div>
  )
}
