// ============================================================
// IndexDials — the Mercury Index as a brass-rimmed main dial, and
// the six faculties as subsidiary dials. A needle only moves for a
// number the store actually holds; an unmeasured faculty is a blank
// dial with "Unmeasured" engraved beneath it, never a needle at zero.
// ============================================================

import type { JSX } from 'solid-js'
import { For, Show } from 'solid-js'
import type { FacultyId } from '@/lib/ear/drills'
import { FACULTY_LABEL } from '@/lib/ear/drills'
import { INDEX_MAX } from '@/lib/ear/mercury-index'
import styles from './IndexDials.module.css'
import type { InstrumentReading } from './instruments'

export interface FacultyDial {
  faculty: FacultyId
  /** 0–1000 sub-score, or null when never measured. */
  score: number | null
  /** The reading in the drill's own unit, or null. */
  reading: InstrumentReading | null
  /** True when the score is a practice estimate, not a sealed part. */
  estimated: boolean
}

interface IndexDialsProps {
  /** Last calibrated index, or null before the first calibration. */
  calibrated: number | null
  /** Change since the previous calibration, or null. */
  delta: number | null
  /** Date label of the previous calibration the delta is measured from. */
  deltaSince: string | null
  /** Live practice estimate (0 hides the line). */
  estimate: number
  faculties: FacultyDial[]
}

const SWEEP = 240
const TICKS = Array.from({ length: 21 }, (_, i) => i)

/** Needle angle for a 0–1000 value: −120° at 0, +120° at 1000. */
function angleFor(value: number): number {
  const t = Math.max(0, Math.min(INDEX_MAX, value)) / INDEX_MAX
  return -SWEEP / 2 + SWEEP * t
}

function tick(i: number, cx: number, inner: number, outer: number) {
  const angle = ((-SWEEP / 2 + (SWEEP * i) / 20) * Math.PI) / 180
  return {
    x1: cx + Math.sin(angle) * inner,
    y1: cx - Math.cos(angle) * inner,
    x2: cx + Math.sin(angle) * outer,
    y2: cx - Math.cos(angle) * outer,
  }
}

export function IndexDials(props: IndexDialsProps): JSX.Element {
  const needleAngle = () => angleFor(props.calibrated ?? 0)
  const showEstimate = () =>
    props.estimate > 0 && props.estimate !== (props.calibrated ?? -1)

  return (
    <div class={styles.dials}>
      <div class={styles.mainDial} data-tour="ear.index">
        <svg
          viewBox="0 0 200 200"
          role="img"
          aria-label={
            props.calibrated === null
              ? 'Mercury Index: not yet marked'
              : `Mercury Index ${props.calibrated} of ${INDEX_MAX}`
          }
          class={styles.mainSvg}
        >
          <circle cx="100" cy="100" r="94" class={styles.mainRim} />
          <circle cx="100" cy="100" r="86" class={styles.mainFace} />
          <g class={styles.ticks}>
            <For each={TICKS}>
              {(i) => {
                const major = i % 5 === 0
                const ends = tick(i, 100, major ? 70 : 76, 82)
                return (
                  <line
                    x1={ends.x1}
                    y1={ends.y1}
                    x2={ends.x2}
                    y2={ends.y2}
                    classList={{ [styles.tickMajor]: major }}
                  />
                )
              }}
            </For>
          </g>
          <g
            class={styles.needle}
            classList={{ [styles.needleIdle]: props.calibrated === null }}
            style={{ transform: `rotate(${needleAngle()}deg)` }}
          >
            <line x1="100" y1="100" x2="100" y2="32" />
            <circle cx="100" cy="100" r="4" />
          </g>
          <text x="100" y="140" class={styles.mainLabel} text-anchor="middle">
            MERCURY INDEX
          </text>
          <text x="100" y="168" class={styles.mainValue} text-anchor="middle">
            {props.calibrated ?? '—'}
          </text>
        </svg>
        <p class={styles.mainNote}>
          <Show
            when={props.calibrated !== null}
            fallback={<span class={styles.unmarked}>Not yet marked</span>}
          >
            <Show when={props.delta !== null}>
              <span
                class={
                  (props.delta ?? 0) >= 0 ? styles.deltaUp : styles.deltaDown
                }
              >
                {(props.delta ?? 0) >= 0 ? '+' : ''}
                {props.delta}
              </span>{' '}
              since last calibration
              <Show when={props.deltaSince}> · {props.deltaSince}</Show>
            </Show>
          </Show>
          <Show when={showEstimate()}>
            <span class={styles.estimateLine}>
              Practice estimate {props.estimate}
            </span>
          </Show>
        </p>
      </div>

      <ul
        class={styles.subDials}
        data-tour="ear.faculties"
        aria-label="The faculties"
      >
        <For each={props.faculties}>
          {(dial) => (
            <li class={styles.subDial}>
              <svg
                viewBox="0 0 80 80"
                role="img"
                aria-label={
                  dial.score === null
                    ? `${FACULTY_LABEL[dial.faculty]}: unmeasured`
                    : `${FACULTY_LABEL[dial.faculty]}: ${dial.reading?.value ?? ''} ${
                        dial.reading?.unit ?? ''
                      }`.trim()
                }
                class={styles.subSvg}
              >
                <circle
                  cx="40"
                  cy="40"
                  r="34"
                  class={styles.subRim}
                  classList={{ [styles.subRimBlank]: dial.score === null }}
                />
                <Show
                  when={dial.score !== null}
                  fallback={
                    <circle cx="40" cy="40" r="2" class={styles.subDot} />
                  }
                >
                  <g
                    class={styles.subNeedle}
                    classList={{ [styles.subNeedleEstimate]: dial.estimated }}
                    style={{
                      transform: `rotate(${angleFor(dial.score ?? 0)}deg)`,
                    }}
                  >
                    <line x1="40" y1="40" x2="40" y2="14" />
                    <circle cx="40" cy="40" r="2.4" />
                  </g>
                </Show>
              </svg>
              <span class={styles.subName}>{FACULTY_LABEL[dial.faculty]}</span>
              <Show
                when={dial.reading}
                fallback={<span class={styles.unmeasured}>Unmeasured</span>}
              >
                {(reading) => (
                  <span class={styles.subReading}>
                    {reading().value}
                    <Show when={reading().unit}>
                      <small> {reading().unit}</small>
                    </Show>
                    <Show when={reading().settling}>
                      <small> · settling</small>
                    </Show>
                  </span>
                )}
              </Show>
            </li>
          )}
        </For>
      </ul>
    </div>
  )
}
