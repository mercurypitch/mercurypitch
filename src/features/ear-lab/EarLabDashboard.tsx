// ============================================================
// EarLabDashboard — the Mercury Column and the way into the
// drills. The layout enforces the product's honesty rule in
// pixels: the calibrated number is large and solid, the practice
// estimate is smaller and explicitly labelled an estimate, and
// unmeasured faculties say "Unmeasured" instead of pretending
// to be zeros.
// ============================================================

import type { JSX } from 'solid-js'
import { createMemo, For, Show } from 'solid-js'
import type { FacultyId } from '@/lib/ear/drills'
import { FACULTY_LABEL, findThresholdDrill } from '@/lib/ear/drills'
import { isProvisional } from '@/lib/ear/elo'
import { calibrationHistory, earPlayerRating, latestCalibration, latestThresholdReading, practiceIndexEstimate, } from '@/stores/ear-lab-store'
import styles from './EarLabDashboard.module.css'
import { LatencyWizard } from './LatencyWizard'
import { MercuryColumn } from './MercuryColumn'

export type EarLabView =
  | 'dashboard'
  | 'hairline'
  | 'calibration'
  | 'home'
  | 'leap'
  | 'stack'
  | 'contour'
  | 'grid'
  | 'report'

interface EarLabDashboardProps {
  onNavigate: (view: EarLabView) => void
}

const FACULTY_ORDER: FacultyId[] = [
  'resolution',
  'function',
  'shape',
  'colour',
  'time',
  'wild',
]

interface DrillCardDef {
  view: EarLabView
  title: string
  blurb: string
  /** One-line stat, or null for "not played yet". */
  stat: () => string | null
  emptyStat: string
}

function ratingStat(drillId: string): string | null {
  const rating = earPlayerRating(drillId)
  if (rating.attempts === 0) return null
  return `Rating ${Math.round(rating.rating)}${
    isProvisional(rating) ? ' · settling' : ''
  }`
}

function thresholdStat(drillId: string): string | null {
  const reading = latestThresholdReading(drillId)
  if (!reading) return null
  const unit = findThresholdDrill(drillId)?.unitShort ?? ''
  const decimals = unit === 'ms' ? 0 : 1
  return `Latest ${reading.value.toFixed(decimals)}${unit}`
}

const DRILL_CARDS: DrillCardDef[] = [
  {
    view: 'hairline',
    title: 'Hairline',
    blurb:
      'Two tones, ever closer — the finest gap your ear still resolves, in cents.',
    stat: () => thresholdStat('hairline'),
    emptyStat: 'No reading yet',
  },
  {
    view: 'home',
    title: 'Home',
    blurb:
      'A cadence plants the key, one note sounds — name the degree, by tap or by voice. The hearing that transfers.',
    stat: () => {
      const ear = ratingStat('home')
      const voice = earPlayerRating('home-sing')
      if (ear === null) return null
      return voice.attempts > 0
        ? `${ear} · voice ${Math.round(voice.rating)}`
        : ear
    },
    emptyStat: 'Unrated',
  },
  {
    view: 'grid',
    title: 'The Grid',
    blurb:
      'Six clicks, one off the lattice — the finest timing flaw you still catch, in milliseconds.',
    stat: () => thresholdStat('the-grid'),
    emptyStat: 'No reading yet',
  },
  {
    view: 'leap',
    title: 'Leap',
    blurb: 'Name the interval. The supporting vocabulary drill behind Home.',
    stat: () => ratingStat('leap'),
    emptyStat: 'Unrated',
  },
  {
    view: 'stack',
    title: 'Stack',
    blurb: 'One chord, roved root — name its quality. Colour hearing opens.',
    stat: () => ratingStat('stack'),
    emptyStat: 'Unrated',
  },
  {
    view: 'contour',
    title: 'Contour',
    blurb:
      'Up, down or same, fast — down to quarter-tone gaps at the top tier.',
    stat: () => ratingStat('contour'),
    emptyStat: 'Unrated',
  },
]

export function EarLabDashboard(props: EarLabDashboardProps): JSX.Element {
  const calibrated = () => latestCalibration()
  // Memoized: the hero reads it three times per render and it walks
  // every drill's readings and ratings to build the composite.
  const estimate = createMemo(() => practiceIndexEstimate())

  const facultyReadout = (faculty: FacultyId): string | null => {
    switch (faculty) {
      case 'resolution':
        return thresholdStat('hairline')?.replace('Latest ', '') ?? null
      case 'time':
        return thresholdStat('the-grid')?.replace('Latest ', '') ?? null
      case 'function': {
        const rating = earPlayerRating('home')
        if (rating.attempts === 0) return null
        const provisional = isProvisional(rating) ? ' · settling' : ''
        const voice = earPlayerRating('home-sing')
        const voicePart =
          voice.attempts > 0 ? ` · voice ${Math.round(voice.rating)}` : ''
        return `${Math.round(rating.rating)}${provisional}${voicePart}`
      }
      case 'shape': {
        // Leap and Contour average into the faculty; the readout
        // shows whichever exist.
        const parts = ['leap', 'contour']
          .map((id) => ({ id, rating: earPlayerRating(id) }))
          .filter((p) => p.rating.attempts > 0)
        if (parts.length === 0) return null
        const mean =
          parts.reduce((sum, p) => sum + p.rating.rating, 0) / parts.length
        const settling = parts.some((p) => isProvisional(p.rating))
        return `${Math.round(mean)}${settling ? ' · settling' : ''}`
      }
      case 'colour': {
        const rating = earPlayerRating('stack')
        if (rating.attempts === 0) return null
        return `${Math.round(rating.rating)}${
          isProvisional(rating) ? ' · settling' : ''
        }`
      }
      default:
        return null
    }
  }

  const delta = (): number | null => {
    const runs = calibrationHistory()
    if (runs.length < 2) return null
    return runs[0].index - runs[1].index
  }

  return (
    <div class={styles.dashboard} id="ear-lab-panel">
      <header class={styles.header}>
        <h2>Ear Lab</h2>
        <p>Your ear, measured — in units that cannot flatter you.</p>
      </header>

      <section class={styles.hero}>
        <MercuryColumn
          calibrated={calibrated()?.index ?? null}
          estimate={estimate().value}
          marks={calibrationHistory().map((run) => ({
            at: run.at,
            index: run.index,
          }))}
          missingCount={estimate().missing.length}
        />

        <div class={styles.heroSide}>
          <div class={styles.indexBlock}>
            <span class={styles.indexLabel}>Mercury Index</span>
            <Show
              when={calibrated()}
              fallback={<span class={styles.indexEmpty}>Not yet marked</span>}
            >
              {(run) => (
                <>
                  <span class={styles.indexValue}>{run().index}</span>
                  <Show when={delta() !== null}>
                    <span
                      class={
                        (delta() ?? 0) >= 0 ? styles.deltaUp : styles.deltaDown
                      }
                    >
                      {(delta() ?? 0) >= 0 ? '+' : ''}
                      {delta()} since last calibration
                    </span>
                  </Show>
                </>
              )}
            </Show>
            <Show when={estimate().value > 0}>
              <span class={styles.estimateLine}>
                Practice estimate: {estimate().value}
              </span>
            </Show>
          </div>

          <ul class={styles.facultyList}>
            <For each={FACULTY_ORDER}>
              {(faculty) => (
                <li class={styles.facultyRow}>
                  <span class={styles.facultyName}>
                    {FACULTY_LABEL[faculty]}
                  </span>
                  <Show
                    when={facultyReadout(faculty)}
                    fallback={<span class={styles.unmeasured}>Unmeasured</span>}
                  >
                    {(readout) => (
                      <span class={styles.facultyValue}>{readout()}</span>
                    )}
                  </Show>
                </li>
              )}
            </For>
          </ul>

          <div class={styles.heroActions}>
            <button
              type="button"
              class={styles.calibrateBtn}
              onClick={() => props.onNavigate('calibration')}
            >
              Run Calibration
            </button>
            <button
              type="button"
              class={styles.reportBtn}
              onClick={() => props.onNavigate('report')}
            >
              Ear Report
            </button>
          </div>
          <p class={styles.calibrateNote}>
            About 3 minutes. Three separate measurements run at once, shuffled
            trial by trial and averaged — the only reading that marks the
            column.
          </p>
        </div>
      </section>

      <section class={styles.drills}>
        <For each={DRILL_CARDS}>
          {(card) => (
            <article class={styles.drillCard}>
              <h3>{card.title}</h3>
              <p>{card.blurb}</p>
              <div class={styles.drillStats}>
                <Show
                  when={card.stat()}
                  fallback={
                    <span class={styles.unmeasured}>{card.emptyStat}</span>
                  }
                >
                  {(stat) => <span>{stat()}</span>}
                </Show>
              </div>
              <button
                type="button"
                class={styles.drillStartBtn}
                onClick={() => props.onNavigate(card.view)}
              >
                Open
              </button>
            </article>
          )}
        </For>
      </section>

      <section class={styles.drills}>
        <LatencyWizard />
      </section>

      <section class={styles.rulers}>
        <h4>Why there is no percent here</h4>
        <p>
          Adaptive drills hold everyone near 75% correct forever, so a score can
          never show growth. The Ear Lab reports thresholds in real units
          (cents, milliseconds, notes) that keep falling, and ratings against
          items of frozen difficulty that keep rising. Calibration re-measures
          you on a sealed protocol — the marks on the column are earned, not
          estimated.
        </p>
      </section>
    </div>
  )
}
