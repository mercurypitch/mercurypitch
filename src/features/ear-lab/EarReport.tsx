// ============================================================
// EarReport — what you confuse with what, and how the thresholds
// have moved. Two instruments no shipping trainer offers:
//
//  - the confusion heatmap (expected × answered misses per drill),
//    with the worst pairs called out as sentences with rates —
//    "You hear Fa as Sol on 41% of attempts" is the single most
//    actionable line the Ear Lab can produce;
//  - threshold history sparklines, where falling IS improving.
//
// Confusion rates use tap-item attempts (mic answers do not touch
// items), so a rate is perception against a stable yardstick.
// ============================================================

import type { JSX } from 'solid-js'
import { For, Show } from 'solid-js'
import { SparklineChart } from '@/features/practice-intelligence/components/SparklineChart'
import { bankItemState, LEAP_BANK, STACK_BANK } from '@/lib/ear/banks'
import type { ConfusionMatrix } from '@/lib/ear/confusion-report'
import { buildConfusionMatrix, topConfusions } from '@/lib/ear/confusion-report'
import { findThresholdDrill } from '@/lib/ear/drills'
import { HOME_DEGREES, homeItemState } from '@/lib/ear/item-bank'
import { earConfusions, earItemStates, thresholdHistory, } from '@/stores/ear-lab-store'
import styles from './EarReport.module.css'

interface ConfusionSection {
  drillId: string
  title: string
  /** Confusion-key labels in axis order. */
  labels: string[]
  /** Display name per label (axis ticks + sentences). */
  display: (label: string) => string
  /** Tap attempts for a label's item (rate denominator). */
  attemptsFor: (label: string) => number
}

const SECTIONS: ConfusionSection[] = [
  {
    drillId: 'home',
    title: 'Home — scale degrees',
    labels: HOME_DEGREES.map((d) => `deg-${d.degree}`),
    display: (label) => {
      const degree = HOME_DEGREES.find((d) => `deg-${d.degree}` === label)
      return degree ? `${degree.solfege} (${degree.degree})` : label
    },
    attemptsFor: (label) => {
      const degree = Number(label.replace('deg-', ''))
      return homeItemState(earItemStates(), degree).attempts
    },
  },
  {
    drillId: 'leap',
    title: 'Leap — intervals',
    labels: LEAP_BANK.map((item) => item.itemId),
    display: (label) =>
      LEAP_BANK.find((item) => item.itemId === label)?.label ?? label,
    attemptsFor: (label) => {
      const item = LEAP_BANK.find((i) => i.itemId === label)
      return item ? bankItemState(earItemStates(), item).attempts : 0
    },
  },
  {
    drillId: 'stack',
    title: 'Stack — chord qualities',
    labels: STACK_BANK.map((item) => item.itemId),
    display: (label) =>
      STACK_BANK.find((item) => item.itemId === label)?.name ?? label,
    attemptsFor: (label) => {
      const item = STACK_BANK.find((i) => i.itemId === label)
      return item ? bankItemState(earItemStates(), item).attempts : 0
    },
  },
  {
    drillId: 'contour',
    title: 'Contour — directions',
    labels: ['up', 'down', 'same'],
    display: (label) => label,
    // Contour's expected labels are directions, not items — no
    // per-item denominator exists, so sentences show counts only.
    attemptsFor: () => 0,
  },
]

const THRESHOLDS = ['hairline', 'the-grid'] as const

export function EarReport(props: { onBack: () => void }): JSX.Element {
  return (
    <div class={styles.report} id="ear-report">
      <div class={styles.header}>
        <button
          type="button"
          class={styles.backBtn}
          onClick={() => props.onBack()}
        >
          Back
        </button>
        <h2>Ear Report</h2>
      </div>

      <section class={styles.section}>
        <h3>Thresholds over time</h3>
        <p class={styles.sectionNote}>Falling is improving.</p>
        <Show
          when={THRESHOLDS.some((id) => thresholdHistory(id).length > 0)}
          fallback={
            <p class={styles.empty}>
              No threshold readings yet — run Hairline or The Grid.
            </p>
          }
        >
          <div class={styles.sparkRow}>
            <For
              each={THRESHOLDS.filter((id) => thresholdHistory(id).length > 0)}
            >
              {(drillId) => {
                const drill = findThresholdDrill(drillId)
                const history = () => thresholdHistory(drillId)
                const decimals = () => (drill?.unitShort === 'ms' ? 0 : 1)
                return (
                  <div class={styles.sparkCard}>
                    <span class={styles.sparkTitle}>{drill?.name}</span>
                    {/* Negated so the line RISES as the threshold falls —
                        the sparkline must read like progress, not decline. */}
                    <SparklineChart
                      data={history()
                        .slice(0, 20)
                        .map((r) => -r.value)
                        .reverse()}
                      width={150}
                      height={36}
                    />
                    <span class={styles.sparkValue}>
                      {history()[0].value.toFixed(decimals())}
                      {drill?.unitShort}
                      <span class={styles.sparkBest}>
                        {' '}
                        · best{' '}
                        {Math.min(...history().map((r) => r.value)).toFixed(
                          decimals(),
                        )}
                        {drill?.unitShort}
                      </span>
                    </span>
                  </div>
                )
              }}
            </For>
          </div>
        </Show>
      </section>

      <For each={SECTIONS}>
        {(section) => {
          const confusions = () => earConfusions(section.drillId)
          const matrix = () =>
            buildConfusionMatrix(confusions(), section.labels)
          const top = () =>
            topConfusions(confusions(), {
              limit: 3,
              attemptsFor: section.attemptsFor,
            })
          return (
            <section class={styles.section}>
              <h3>{section.title}</h3>
              <Show
                when={matrix().totalMisses > 0}
                fallback={
                  <p class={styles.empty}>
                    No misses recorded yet — play the drill and this map fills
                    in.
                  </p>
                }
              >
                <ul class={styles.callouts}>
                  <For each={top()}>
                    {(confusion) => (
                      <li>
                        You answer {section.display(confusion.expected)} as{' '}
                        <strong>{section.display(confusion.answered)}</strong>{' '}
                        {confusion.rate !== null
                          ? `on ${Math.round(confusion.rate * 100)}% of attempts`
                          : `(${confusion.count} times)`}
                        .
                      </li>
                    )}
                  </For>
                </ul>
                <ConfusionHeatmap matrix={matrix()} display={section.display} />
              </Show>
            </section>
          )
        }}
      </For>
    </div>
  )
}

function ConfusionHeatmap(props: {
  matrix: ConfusionMatrix
  display: (label: string) => string
}): JSX.Element {
  const short = (label: string) => {
    const name = props.display(label)
    // Axis ticks stay compact; the full name lives in the cell title.
    return name.length > 4 ? name.slice(0, 4) : name
  }

  return (
    <div class={styles.heatmapScroll}>
      <div
        class={styles.heatmap}
        style={{
          'grid-template-columns': `auto repeat(${props.matrix.labels.length}, minmax(28px, 1fr))`,
        }}
      >
        <div class={styles.axisCorner} title="expected \ answered" />
        <For each={props.matrix.labels}>
          {(label) => (
            <div class={styles.axisLabel} title={props.display(label)}>
              {short(label)}
            </div>
          )}
        </For>
        <For each={props.matrix.labels}>
          {(rowLabel, row) => (
            <>
              <div class={styles.axisLabel} title={props.display(rowLabel)}>
                {short(rowLabel)}
              </div>
              <For each={props.matrix.labels}>
                {(colLabel, col) => {
                  const count = () => props.matrix.cells[row()][col()]
                  const heat = () =>
                    props.matrix.maxCount === 0
                      ? 0
                      : count() / props.matrix.maxCount
                  return (
                    <div
                      class={styles.cell}
                      style={{
                        background:
                          count() > 0
                            ? `color-mix(in srgb, var(--red) ${Math.round(
                                12 + heat() * 55,
                              )}%, transparent)`
                            : undefined,
                      }}
                      title={`Heard ${props.display(rowLabel)}, answered ${props.display(colLabel)}: ${count()}`}
                    >
                      {count() > 0 ? count() : ''}
                    </div>
                  )
                }}
              </For>
            </>
          )}
        </For>
      </div>
    </div>
  )
}
