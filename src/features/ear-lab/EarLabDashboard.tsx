// ============================================================
// EarLabDashboard — the Mercury Column and the way into the
// drills. The layout enforces the product's honesty rule in
// pixels: the calibrated number is large and solid, the practice
// estimate is smaller and explicitly labelled an estimate, and
// unmeasured faculties say "Unmeasured" instead of pretending
// to be zeros.
// ============================================================

import type { JSX } from 'solid-js'
import { For, Show } from 'solid-js'
import type { FacultyId } from '@/lib/ear/drills'
import { FACULTY_LABEL, findThresholdDrill } from '@/lib/ear/drills'
import { isProvisional } from '@/lib/ear/elo'
import { calibrationHistory, earPlayerRating, latestCalibration, latestThresholdReading, practiceIndexEstimate, } from '@/stores/ear-lab-store'
import styles from './EarLabDashboard.module.css'
import { LatencyWizard } from './LatencyWizard'
import { MercuryColumn } from './MercuryColumn'

export type EarLabView = 'dashboard' | 'hairline' | 'calibration' | 'home'

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

export function EarLabDashboard(props: EarLabDashboardProps): JSX.Element {
  const calibrated = () => latestCalibration()
  const estimate = () => practiceIndexEstimate()

  const facultyReadout = (faculty: FacultyId): string | null => {
    if (faculty === 'resolution') {
      const reading = latestThresholdReading('hairline')
      if (!reading) return null
      const unit = findThresholdDrill('hairline')?.unitShort ?? ''
      return `${reading.value.toFixed(1)}${unit}`
    }
    if (faculty === 'function') {
      const rating = earPlayerRating('home')
      if (rating.attempts === 0) return null
      const provisional = isProvisional(rating) ? ' · settling' : ''
      const voice = earPlayerRating('home-sing')
      const voicePart =
        voice.attempts > 0 ? ` · voice ${Math.round(voice.rating)}` : ''
      return `${Math.round(rating.rating)}${provisional}${voicePart}`
    }
    return null
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

          <button
            type="button"
            class={styles.calibrateBtn}
            onClick={() => props.onNavigate('calibration')}
          >
            Run Calibration
          </button>
          <p class={styles.calibrateNote}>
            About 3 minutes. Three separate measurements run at once, shuffled
            trial by trial and averaged — the only reading that marks the
            column.
          </p>
        </div>
      </section>

      <section class={styles.drills}>
        <article class={styles.drillCard}>
          <h3>Hairline</h3>
          <p>
            Two tones, ever closer — the finest gap your ear still resolves, in
            cents.
          </p>
          <div class={styles.drillStats}>
            <Show
              when={latestThresholdReading('hairline')}
              fallback={<span class={styles.unmeasured}>No reading yet</span>}
            >
              {(reading) => (
                <span>
                  Latest{' '}
                  <strong>
                    {reading().value.toFixed(1)}
                    {'¢'}
                  </strong>
                </span>
              )}
            </Show>
          </div>
          <button
            type="button"
            class={styles.drillStartBtn}
            onClick={() => props.onNavigate('hairline')}
          >
            Open
          </button>
        </article>

        <article class={styles.drillCard}>
          <h3>Home</h3>
          <p>
            A cadence plants the key, one note sounds — name the degree. The
            hearing that transfers to real music.
          </p>
          <div class={styles.drillStats}>
            <Show
              when={earPlayerRating('home').attempts > 0}
              fallback={<span class={styles.unmeasured}>Unrated</span>}
            >
              <span>
                Rating{' '}
                <strong>{Math.round(earPlayerRating('home').rating)}</strong>
                {isProvisional(earPlayerRating('home')) ? ' · settling' : ''}
              </span>
            </Show>
          </div>
          <button
            type="button"
            class={styles.drillStartBtn}
            onClick={() => props.onNavigate('home')}
          >
            Open
          </button>
        </article>
      </section>

      <section class={styles.drills}>
        <LatencyWizard />
      </section>

      <section class={styles.rulers}>
        <h4>Why there is no percent here</h4>
        <p>
          Adaptive drills hold everyone near 75% correct forever, so a score can
          never show growth. The Ear Lab reports thresholds in real units
          (cents, notes) that keep falling, and ratings against items of frozen
          difficulty that keep rising. Calibration re-measures you on a sealed
          protocol — the marks on the column are earned, not estimated.
        </p>
      </section>
    </div>
  )
}
